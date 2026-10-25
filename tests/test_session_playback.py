"""Hardware-free regression checks for screen replay and tracking diagnostics."""
import io
import json
from contextlib import contextmanager, redirect_stdout
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
import sys
import threading
import unittest
from unittest.mock import Mock, patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "eyetrax" / "src"))

import numpy as np
from api import server
from api._scripts import run_session as recorder
from eyetrax import session
from eyetrax.filters import KalmanEMASmoother


@contextmanager
def camera_context(cap):
    try:
        yield cap
    finally:
        cap.release()


class PlaybackTests(unittest.TestCase):
    def test_recording_saves_gaze_and_generates_fusion_events(self):
        with TemporaryDirectory() as temp:
            root = Path(temp)
            latest = root / 'data' / 'latest_calibration'
            latest.mkdir(parents=True)
            (latest / 'gaze_model.pkl').write_bytes(b'mock model')
            (latest / 'report.json').write_text(json.dumps({
                'model': 'ridge', 'camera': 0, 'ema_alpha': .25,
                'measurement_noise_cov': [[1, 0], [0, 1]],
                'screen_width': 1000, 'screen_height': 1000,
            }))
            def listener_factory(**callbacks):
                listener = Mock()
                listener.start.side_effect = lambda: callbacks['on_click'](900, 900, 'left', True)
                return listener
            def screen(destination, report, stop):
                report.update(video_started_at=1000, video_frames=10)
            def samples(*args):
                yield dict(timestamp=1000, raw_x=10, raw_y=10, gaze_x=10, gaze_y=10, valid=True, reason='ok')
                yield dict(timestamp=1001, raw_x=None, raw_y=None, gaze_x=None, gaze_y=None, valid=False, reason='no_face')
            with patch.object(recorder, 'ROOT', root), \
                 patch.object(recorder, 'GazeEstimator', return_value=Mock()), \
                 patch.object(recorder, 'session_args', return_value=SimpleNamespace(camera=0)), \
                 patch.object(recorder, 'gaze_samples', side_effect=samples), \
                 patch.object(recorder, 'record_screen', side_effect=screen), \
                 patch.object(recorder, 'monitor_stop'), \
                 patch.object(recorder.time, 'time', return_value=1000), \
                 patch.dict(sys.modules, {'pynput': SimpleNamespace(mouse=SimpleNamespace(Listener=listener_factory))}), \
                 redirect_stdout(io.StringIO()):
                recorder.main()
            destination = next((root / 'data' / 'sessions').iterdir())
            report = json.loads((destination / 'calibration_report.json').read_text())
            self.assertEqual(report['frames'], 2)
            self.assertEqual(report['valid_frames'], 1)
            self.assertEqual(report['gaze_reasons'], {'ok': 1, 'no_face': 1})
            self.assertEqual(report['video_started_at'], 1000)
            events = json.loads((destination / 'friction_events.json').read_text())
            self.assertEqual(events[0]['type'], 'gaze_mouse_mismatch')

    def test_camera_warmup_and_cooperative_stop_release_camera(self):
        cap = Mock()
        cap.read.side_effect = [(False, None), (True, np.zeros((2, 2, 3)))]
        estimator = Mock()
        estimator.extract_features.return_value = ([1], False)
        estimator.predict.return_value = np.array([[40, 50]])
        stopped = threading.Event()
        with patch.object(session, 'camera', return_value=camera_context(cap)), patch.object(session.time, 'sleep'):
            samples = session.gaze_samples(estimator, KalmanEMASmoother(), 0, 100, 100, stopped)
            self.assertTrue(next(samples)['valid'])
            stopped.set()
            self.assertEqual(list(samples), [])
        cap.release.assert_called_once()

    def test_codec_failure_is_reported_and_writer_released(self):
        writer = Mock()
        writer.isOpened.return_value = False
        report = {'screen_width': 100, 'screen_height': 100}
        with patch.object(recorder.cv2, 'VideoWriter', return_value=writer):
            recorder.record_screen(ROOT, report, threading.Event())
        self.assertIn('H.264', report['video_error'])
        self.assertEqual(report['video_frames'], 0)
        writer.release.assert_called_once()

    def test_slow_capture_preserves_elapsed_video_time(self):
        writer = Mock()
        screen = Mock()
        screen.grab.return_value = np.zeros((100, 100, 4), dtype=np.uint8)
        screen.__enter__ = Mock(return_value=screen)
        screen.__exit__ = Mock(return_value=False)
        stop = Mock()
        stop.is_set.side_effect = [False, False, True]
        report = {'screen_width': 100, 'screen_height': 100}
        # A 350ms delay requires three extra frames, not just one frame.
        with patch.object(recorder.cv2, 'VideoWriter', return_value=writer), \
             patch.object(recorder.mss, 'mss', return_value=screen), \
             patch.object(recorder.time, 'monotonic', side_effect=[0, 0, 0, .35, .35]), \
             patch.object(recorder.time, 'time', return_value=1000):
            recorder.record_screen(ROOT, report, stop)
        self.assertNotIn('video_error', report)
        self.assertEqual(report['video_started_at'], 1000)
        self.assertEqual(writer.write.call_count, 4)

    def test_session_exposes_video_timeline_and_quality_without_fabricating_gaze(self):
        with TemporaryDirectory() as temp:
            folder = Path(temp) / 'example'
            folder.mkdir()
            report = {'screen_width': 100, 'screen_height': 100, 'started_at': 99,
                      'video_started_at': 100, 'frames': 3, 'valid_frames': 0,
                      'gaze_reasons': {'no_face': 3}}
            (folder / 'calibration_report.json').write_text(json.dumps(report))
            (folder / 'screen.mp4').write_bytes(b'video fixture')
            with patch.object(server, 'DATA_DIR', Path(temp)):
                result = server.get_session('example')
                self.assertEqual(result['video_url'], '/data/example/screen.mp4')
                self.assertEqual(result['video_started_at'], 100)
                self.assertEqual(result['gaze_samples'], [])
                self.assertEqual(result['quality']['reasons'], {'no_face': 3})
                (folder / 'screen.mp4').unlink()
                self.assertIsNone(server.get_session('example')['video_url'])

    def test_recording_stream_updates_metrics_and_preserves_errors(self):
        saved_state = server._state.copy()
        try:
            for code, output, has_error in [
                (0, 'Progress:{"frames":2,"valid_frames":1}\nSaved:' + str(server.DATA_DIR / 'example') + '|\n', False),
                (1, 'Camera failed\n', True),
            ]:
                proc = Mock(returncode=code, stdout=io.StringIO(output))
                server._state.update(error=None, recording_metrics=None)
                with patch.object(server.subprocess, 'Popen', return_value=proc):
                    server._run_recording()
                self.assertEqual(bool(server._state['error']), has_error)
                if not has_error:
                    self.assertEqual(server._state['session_id'], 'example')
                    self.assertEqual(server._state['recording_metrics']['valid_frames'], 1)
        finally:
            server._state.update(saved_state)


if __name__ == '__main__':
    unittest.main()
