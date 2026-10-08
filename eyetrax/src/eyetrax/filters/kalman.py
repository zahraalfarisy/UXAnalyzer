from __future__ import annotations

from typing import Tuple

import cv2
import numpy as np

from eyetrax.utils.screen import get_screen_size
from eyetrax.utils.video import open_camera

from . import make_kalman
from .base import BaseSmoother


class KalmanSmoother(BaseSmoother):

    def __init__(self, kf=None) -> None:
        super().__init__()

        try:
            import cv2

            self.kf = kf if isinstance(kf, cv2.KalmanFilter) else make_kalman()
        except ImportError:
            self.kf = make_kalman()
        self._initialized = False

    def step(self, x: int, y: int) -> Tuple[int, int]:
        meas = np.array([[float(x)], [float(y)]], dtype=np.float32)

        if not self._initialized:
            self.kf.statePre[:2] = meas
            self.kf.statePost[:2] = meas
            self._initialized = True

        self.kf.predict()
        corrected = self.kf.correct(meas)

        return int(corrected[0, 0]), int(corrected[1, 0])

    def tune(self, gaze_estimator, *, camera_index: int = 0):
        """Estimate within-fixation noise, without gating samples on prediction error."""
        from eyetrax.calibration.common import _pulse_and_capture

        sw, sh = get_screen_size()
        pts = [(sw // 2, sh // 4), (sw // 4, 3 * sh // 4),
               (3 * sw // 4, 3 * sh // 4)]
        cap = open_camera(camera_index)
        try:
            cv2.namedWindow("Calibration", cv2.WND_PROP_FULLSCREEN)
            cv2.setWindowProperty("Calibration", cv2.WND_PROP_FULLSCREEN, cv2.WINDOW_FULLSCREEN)
            result = _pulse_and_capture(gaze_estimator, cap, pts, sw, sh,
                                        pulse_d=1.0, cd_d=1.5)
            if result is None:
                return False
            features, targets = result
            predictions = gaze_estimator.predict(np.asarray(features))
            self.kf.measurementNoiseCov = within_target_noise(predictions, targets)
            return True
        finally:
            cap.release()
            cv2.destroyWindow("Calibration")


def within_target_noise(predictions, targets):
    """Remove each target's mean before pooling variance (units: pixels squared).

    This estimates jitter, not systematic calibration bias. Bias is measured by
    independent validation and must not be treated as filter noise.
    """
    predictions = np.asarray(predictions, dtype=float)
    targets = np.asarray(targets, dtype=float)
    if predictions.shape != targets.shape or predictions.ndim != 2 or predictions.shape[1] != 2:
        raise ValueError("Expected matching Nx2 predictions and targets")
    if not np.isfinite(predictions).all() or not np.isfinite(targets).all():
        raise ValueError("Predictions and targets must be finite")
    groups = []
    degrees = 0
    for target in np.unique(targets, axis=0):
        group = predictions[np.all(targets == target, axis=1)]
        if len(group) >= 2:
            groups.append(group - group.mean(axis=0))
            degrees += len(group) - 1
    if not groups:
        raise ValueError("Need at least two predictions for a target")
    residuals = np.concatenate(groups)
    variance = np.maximum(np.sum(residuals ** 2, axis=0) / degrees, 1.0)
    return np.diag(variance).astype(np.float32)
