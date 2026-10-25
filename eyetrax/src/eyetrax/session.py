"""Calibration, independent validation and explicit recording handoff."""
from __future__ import annotations

import argparse
from pathlib import Path
import time

import cv2
import numpy as np

from eyetrax.calibration.common import (
    _pulse_and_capture, compute_grid_points_from_shape, draw_targets,
)
from eyetrax.calibration.dense_grid import run_dense_grid_calibration
from eyetrax.filters import KalmanEMASmoother
from eyetrax.filters.kalman import within_target_noise
from eyetrax.utils.screen import get_screen_size
from eyetrax.utils.video import camera, fullscreen


def session_args():
    p = argparse.ArgumentParser(description="Calibrate, validate, preview, then record UX")
    p.add_argument("--camera", type=int, default=0)
    p.add_argument("--grid-rows", type=int, default=4)
    p.add_argument("--grid-cols", type=int, default=4)
    p.add_argument("--settle", type=float, default=1.0)
    p.add_argument("--capture", type=float, default=1.5)
    p.add_argument("--ema-alpha", type=float, default=0.25,
                   help="Previous-output weight: higher means more smoothing and lag")
    p.add_argument("--model", choices=["ridge", "svr", "elastic_net", "tiny_mlp"], default="ridge")
    p.add_argument("--model-file", type=Path, help="Optional local trusted model; still run validation")
    p.add_argument("--output", type=Path, default=Path("data/sessions"))
    args = p.parse_args()
    if args.grid_rows < 2 or args.grid_cols < 2:
        p.error("Use at least a 2x2 calibration grid")
    if args.settle <= 0 or args.capture <= 0 or not 0 <= args.ema_alpha <= 1:
        p.error("Durations must be positive and ema-alpha must be in [0, 1]")
    return args


def validation_metrics(predictions, targets, sw, sh):
    predictions = np.asarray(predictions, dtype=float)
    targets = np.asarray(targets, dtype=float)
    if predictions.shape != targets.shape or predictions.ndim != 2 or predictions.shape[1] != 2 or not len(targets):
        raise ValueError("Expected nonempty matching Nx2 arrays")
    if not np.isfinite(predictions).all() or not np.isfinite(targets).all():
        raise ValueError("Validation predictions/targets must be finite")
    errors = np.linalg.norm(predictions - targets, axis=1)
    per_target = []
    for target in np.unique(targets, axis=0):
        group = predictions[np.all(targets == target, axis=1)]
        median = np.median(group, axis=0)
        per_target.append({"target": target.tolist(), "samples": len(group),
                           "median_prediction": median.tolist(),
                           "median_position_error_px": float(np.linalg.norm(median - target))})
    return {"samples": len(targets), "mean_error_px": float(errors.mean()),
            "median_error_px": float(np.median(errors)),
            "p90_error_px": float(np.percentile(errors, 90)),
            "mean_error_screen_diagonal_pct": float(100 * errors.mean() / np.hypot(sw, sh)),
            "per_target": per_target}


def validate(estimator, args, sw, sh):
    # Offset from the training grid; these samples are NEVER used to train the regressor.
    training = compute_grid_points_from_shape(args.grid_rows, args.grid_cols, sw, sh)
    candidates = [(0.22, 0.24), (0.78, 0.24), (0.51, 0.52), (0.22, 0.78), (0.78, 0.78)]
    pts = [(int(sw * x), int(sh * y)) for x, y in candidates]
    pts = [(x + 1, y + 1) if (x, y) in training else (x, y) for x, y in pts]
    print("[validation] Follow the GREEN target. These points are not training data.")
    with camera(args.camera) as cap, fullscreen("Calibration"):
        result = _pulse_and_capture(estimator, cap, pts, sw, sh,
                                    pulse_d=args.settle, cd_d=args.capture)
    if result is None:
        return None
    features, targets = result
    predictions = estimator.predict(np.asarray(features))
    return validation_metrics(predictions, targets, sw, sh), within_target_noise(predictions, targets)


def prepare_session(estimator, args):
    """Return smoother and validation report only after Enter in the preview."""
    sw, sh = get_screen_size()
    load_model = args.model_file is not None
    while True:
        if load_model:
            estimator.load_model(args.model_file)
            load_model = False
        elif not run_dense_grid_calibration(
            estimator, rows=args.grid_rows, cols=args.grid_cols,
            pulse_d=args.settle, cd_d=args.capture, camera_index=args.camera,
        ):
            return None
        result = validate(estimator, args, sw, sh)
        if result is None:
            return None
        metrics, noise = result
        print(f"[validation] RAW mean={metrics['mean_error_px']:.1f}px; "
              f"p90={metrics['p90_error_px']:.1f}px. R repeats calibration in preview.")
        smoother = KalmanEMASmoother(ema_alpha=args.ema_alpha)
        smoother.kf.measurementNoiseCov = noise
        pts = compute_grid_points_from_shape(args.grid_rows, args.grid_cols, sw, sh)
        last_valid = None
        with camera(args.camera) as cap, fullscreen("Gaze Preview"):
            failed_reads = 0
            while True:
                ok, frame = cap.read()
                failed_reads = 0 if ok else failed_reads + 1
                if failed_reads >= 60:
                    raise RuntimeError("Camera stopped providing frames during preview")
                canvas = np.zeros((sh, sw, 3), np.uint8)
                draw_targets(canvas, pts, message="PREVIEW | ENTER record | R recalibrate | ESC cancel")
                cv2.putText(canvas, f"RAW validation: mean {metrics['mean_error_px']:.0f}px / p90 {metrics['p90_error_px']:.0f}px",
                            (25, 65), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255, 255, 255), 1)
                if ok:
                    features, blink = estimator.extract_features(frame)
                    if features is not None and not blink:
                        raw = estimator.predict(np.asarray([features]))[0]
                        if np.isfinite(raw).all():
                            now = time.monotonic()
                            if last_valid is None or now - last_valid > 0.25:
                                smoother = fresh_smoother(smoother)
                            last_valid = now
                            x, y = smoother.step(*raw)
                            if 0 <= x < sw and 0 <= y < sh:
                                cv2.circle(canvas, (x, y), 10, (255, 150, 0), 2)
                cv2.imshow("Gaze Preview", canvas)
                key = cv2.waitKey(1) & 0xFF
                if key == 27:
                    return None
                if key in (10, 13):
                    # Recording starts with fresh state, not the last preview fixation.
                    report = {"screen_width": sw, "screen_height": sh,
                              "camera": args.camera, "model": args.model,
                              "loaded_model": str(args.model_file) if args.model_file else None,
                              "grid": [args.grid_rows, args.grid_cols],
                              "settle_seconds": args.settle, "capture_seconds": args.capture,
                              "ema_alpha": args.ema_alpha,
                              "measurement_noise_cov": noise.tolist(), "validation": metrics,
                              "validation_uses": "Raw error evaluation and filter noise estimation; no regressor training"}
                    return fresh_smoother(smoother), report
                if key in (ord("r"), ord("R")):
                    args.model_file = None
                    break


def fresh_smoother(previous):
    smoother = KalmanEMASmoother(ema_alpha=previous.ema_alpha)
    smoother.kf.measurementNoiseCov = previous.kf.measurementNoiseCov.copy()
    return smoother


def gaze_samples(estimator, smoother, camera_index, sw, sh, stop_event=None):
    """Yield every frame's quality, with raw and filtered gaze. Ctrl+C stops."""
    last_valid = None
    with camera(camera_index) as cap:
        first_frame_deadline = None
        received_frame = False
        while stop_event is None or not stop_event.is_set():
            ok, frame = cap.read()
            if not ok:
                if first_frame_deadline is None:
                    first_frame_deadline = time.monotonic() + 5
                if not received_frame and time.monotonic() < first_frame_deadline:
                    time.sleep(0.05)
                    continue
                raise RuntimeError("Camera stopped providing frames during recording")
            received_frame = True
            timestamp = time.time()  # Compatible with mouse timestamps in seconds.
            features, blink = estimator.extract_features(frame)
            row = {"timestamp": timestamp, "raw_x": None, "raw_y": None,
                   "gaze_x": None, "gaze_y": None, "valid": False,
                   "reason": "no_face" if features is None else "blink"}
            if features is not None and not blink:
                raw = estimator.predict(np.asarray([features]))[0]
                if not np.isfinite(raw).all():
                    row["reason"] = "nonfinite"
                else:
                    row.update(raw_x=float(raw[0]), raw_y=float(raw[1]))
                    if not (0 <= raw[0] < sw and 0 <= raw[1] < sh):
                        row["reason"] = "off_screen"
                    else:
                        now = time.monotonic()
                        if last_valid is None or now - last_valid > 0.25:
                            smoother = fresh_smoother(smoother)
                        last_valid = now
                        x, y = smoother.step(*raw)
                        row.update(gaze_x=x, gaze_y=y)
                        if 0 <= x < sw and 0 <= y < sh:
                            row.update(valid=True, reason="ok")
                        else:
                            row["reason"] = "filtered_off_screen"
            yield row
