from contextlib import contextmanager
from types import SimpleNamespace
import csv
import json
import sys

import cv2
import numpy as np
import pytest

from eyetrax.calibration import common, dense_grid
from eyetrax.filters import KalmanSmoother, KalmanEMASmoother
from eyetrax.filters.kalman import within_target_noise
from eyetrax import session, recording


def test_noise_excludes_distance_and_bias_between_targets():
    targets = [[0, 0], [0, 0], [1000, 1000], [1000, 1000]]
    predictions = [[99, 49], [101, 51], [1199, 1299], [1201, 1301]]
    np.testing.assert_allclose(within_target_noise(predictions, targets), np.diag([2, 2]))


def test_kalman_returns_current_correction():
    smoother = KalmanSmoother()
    smoother.step(0, 0)
    x, y = smoother.step(1000, 500)
    assert x > 900 and y > 450
    assert smoother._initialized


def test_reset_clears_ema_and_preserves_tuned_noise():
    old = KalmanEMASmoother(ema_alpha=0.9)
    old.kf.measurementNoiseCov = np.diag([40, 60]).astype(np.float32)
    old.step(100, 100)
    new = session.fresh_smoother(old)
    np.testing.assert_equal(new.kf.measurementNoiseCov, old.kf.measurementNoiseCov)
    assert new.step(800, 700) == (800, 700)


def test_all_targets_remain_visible():
    canvas = np.zeros((100, 100, 3), np.uint8)
    common.draw_targets(canvas, [(20, 20), (50, 50), (80, 80)], active=1, completed=1)
    assert canvas[20, 20].any() and canvas[80, 80].any()
    np.testing.assert_array_equal(canvas[50, 60], [0, 255, 0])


def test_validation_reports_pixel_error_without_clipping():
    metrics = session.validation_metrics([[3, 4], [1003, 1004]], [[0, 0], [1000, 1000]], 1920, 1080)
    assert metrics["mean_error_px"] == 5
    assert metrics["p90_error_px"] == 5
    assert len(metrics["per_target"]) == 2


def test_single_grid_axis_is_centered():
    assert common.compute_grid_points_from_shape(1, 1, 1920, 1080) == [(960, 540)]


def test_insufficient_samples_fail_instead_of_training_partial_grid(monkeypatch):
    clock = iter(range(100))
    monkeypatch.setattr(common.time, "monotonic", lambda: next(clock))
    monkeypatch.setattr(cv2, "imshow", lambda *args: None)
    monkeypatch.setattr(cv2, "waitKey", lambda *args: -1)
    estimator = SimpleNamespace(extract_features=lambda frame: (None, False))
    cap = SimpleNamespace(read=lambda: (True, np.zeros((1, 1, 3))))
    with pytest.raises(RuntimeError, match="too few valid samples"):
        common._pulse_and_capture(estimator, cap, [(50, 50)], 100, 100,
                                  pulse_d=1, cd_d=3, min_samples=2, max_retries=0)


def test_cancelled_calibration_releases_camera_without_training(monkeypatch):
    calls = []
    cap = SimpleNamespace(release=lambda: calls.append("release"))
    monkeypatch.setattr(dense_grid, "open_camera", lambda *args: cap)
    monkeypatch.setattr(dense_grid, "get_screen_size", lambda: (100, 100))
    monkeypatch.setattr(dense_grid, "wait_for_face_and_countdown", lambda *args: False)
    monkeypatch.setattr(cv2, "destroyAllWindows", lambda: calls.append("close"))
    estimator = SimpleNamespace(train=lambda *args: pytest.fail("Should not train after ESC"))
    assert dense_grid.run_dense_grid_calibration(estimator) is False
    assert calls == ["release", "close"]


@contextmanager
def dummy_context(value=None):
    yield value


def test_validation_does_not_train_and_is_separate_from_grid(monkeypatch):
    captured = []
    monkeypatch.setattr(session, "camera", lambda *args: dummy_context(None))
    monkeypatch.setattr(session, "fullscreen", lambda *args: dummy_context())
    def capture(estimator, cap, points, *args, **kwargs):
        captured.extend(points)
        targets = [point for point in points for _ in range(2)]
        return targets, targets
    monkeypatch.setattr(session, "_pulse_and_capture", capture)
    estimator = SimpleNamespace(predict=lambda X: X, train=lambda *args: pytest.fail("Validation must not train"))
    args = SimpleNamespace(camera=0, grid_rows=4, grid_cols=4, settle=1, capture=1.5)
    metrics, _ = session.validate(estimator, args, 1920, 1080)
    training = common.compute_grid_points_from_shape(4, 4, 1920, 1080)
    assert set(captured).isdisjoint(training)
    assert metrics["mean_error_px"] == 0


def test_preview_waits_for_enter_and_cancels_cleanly(monkeypatch):
    monkeypatch.setattr(session, "get_screen_size", lambda: (100, 100))
    monkeypatch.setattr(session, "run_dense_grid_calibration", lambda *args, **kwargs: True)
    monkeypatch.setattr(session, "validate", lambda *args: ({"mean_error_px": 5, "p90_error_px": 8}, np.eye(2, dtype=np.float32)))
    cap = SimpleNamespace(read=lambda: (True, np.zeros((1, 1, 3))))
    monkeypatch.setattr(session, "camera", lambda *args: dummy_context(cap))
    monkeypatch.setattr(session, "fullscreen", lambda *args: dummy_context())
    monkeypatch.setattr(cv2, "imshow", lambda *args: None)
    keys = iter([-1, -1, 13])
    reads = []
    def extract(frame):
        reads.append(1)
        return None, False
    estimator = SimpleNamespace(extract_features=extract)
    monkeypatch.setattr(cv2, "waitKey", lambda *args: next(keys))
    args = SimpleNamespace(camera=0, model="ridge", model_file=None, grid_rows=4, grid_cols=4, settle=1, capture=1.5, ema_alpha=.25)
    assert session.prepare_session(estimator, args) is not None
    assert len(reads) == 3
    monkeypatch.setattr(cv2, "waitKey", lambda *args: 27)
    assert session.prepare_session(estimator, args) is None


def test_recording_marks_invalid_frames_and_resets_after_gap(monkeypatch):
    cap = SimpleNamespace(read=lambda: (True, np.zeros((1, 1, 3))))
    monkeypatch.setattr(session, "camera", lambda *args: dummy_context(cap))
    features = iter([(None, False), ([1], True), ([2], False), ([3], False), ([4], False)])
    predictions = iter([[500, 500], [20, 20], [80, 80]])
    clock = iter([0, 1])
    monkeypatch.setattr(session.time, "monotonic", lambda: next(clock))
    estimator = SimpleNamespace(extract_features=lambda frame: next(features), predict=lambda X: np.asarray([next(predictions)]))
    samples = session.gaze_samples(estimator, KalmanEMASmoother(ema_alpha=.9), 0, 100, 100)
    rows = [next(samples) for _ in range(5)]
    samples.close()
    assert [row["reason"] for row in rows] == ["no_face", "blink", "off_screen", "ok", "ok"]
    assert rows[-1]["gaze_x"] == 80  # Previous fixation does not leak across a lost-tracking gap.


def test_cancelled_prepare_never_creates_recording(monkeypatch, tmp_path):
    monkeypatch.setattr(recording, "session_args", lambda: SimpleNamespace(model="ridge", output=tmp_path))
    monkeypatch.setattr(recording, "GazeEstimator", lambda **kwargs: SimpleNamespace(close=lambda: None))
    monkeypatch.setattr(recording, "prepare_session", lambda *args: None)
    monkeypatch.setattr(recording, "gaze_samples", lambda *args: pytest.fail("Must not record after cancel"))
    assert recording.run_recording(track_mouse=True) is None
    assert not list(tmp_path.iterdir())


def test_accepted_session_saves_synchronized_data_on_interrupt(monkeypatch, tmp_path):
    order = []
    args = SimpleNamespace(model="ridge", output=tmp_path, camera=0)
    monkeypatch.setattr(recording, "session_args", lambda: args)
    estimator = SimpleNamespace(save_model=lambda path: path.write_bytes(b"test model"),
                                close=lambda: order.append("estimator_close"))
    monkeypatch.setattr(recording, "GazeEstimator", lambda **kwargs: estimator)
    def prepare(*args):
        order.append("preview_accepted")
        return KalmanEMASmoother(), {"screen_width": 100, "screen_height": 100}
    monkeypatch.setattr(recording, "prepare_session", prepare)
    class Listener:
        def __init__(self, **callbacks):
            self.callbacks = callbacks
        def start(self):
            order.append("mouse_start")
            self.callbacks["on_click"](40, 50, "left", True)
        def stop(self):
            order.append("mouse_stop")
        def join(self):
            order.append("mouse_join")
    monkeypatch.setitem(sys.modules, "pynput", SimpleNamespace(mouse=SimpleNamespace(Listener=Listener)))
    def samples(*args):
        yield {"timestamp": 1., "raw_x": 40., "raw_y": 50., "gaze_x": 40, "gaze_y": 50, "valid": True, "reason": "ok"}
        yield {"timestamp": 2., "raw_x": None, "raw_y": None, "gaze_x": None, "gaze_y": None, "valid": False, "reason": "blink"}
        raise KeyboardInterrupt
    monkeypatch.setattr(recording, "gaze_samples", samples)
    destination = recording.run_recording(track_mouse=True)
    assert order.index("preview_accepted") < order.index("mouse_start")
    assert order[-3:] == ["mouse_stop", "mouse_join", "estimator_close"]
    with (destination / "gaze_log.csv").open() as f:
        assert len(list(csv.DictReader(f))) == 1
    with (destination / "gaze_quality.csv").open() as f:
        assert len(list(csv.DictReader(f))) == 2
    report = json.loads((destination / "calibration_report.json").read_text())
    assert report["valid_frame_ratio"] == .5
    assert len(json.loads((destination / "mouse_session.json").read_text())["events"]) == 1
    from fusion import live_fusion
    monkeypatch.setattr(live_fusion, "run_recording", lambda **kwargs: destination)
    live_fusion.main()
    assert (destination / "friction_events.json").exists()
