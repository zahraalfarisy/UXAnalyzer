import time

import cv2
import numpy as np


def compute_grid_points(order, sw: int, sh: int, margin_ratio: float = 0.10):
    """
    Translate grid (row, col) indices into absolute pixel locations
    """
    if not order:
        return []

    max_r = max(r for r, _ in order)
    max_c = max(c for _, c in order)

    mx, my = int(sw * margin_ratio), int(sh * margin_ratio)
    gw, gh = sw - 2 * mx, sh - 2 * my

    step_x = 0 if max_c == 0 else gw / max_c
    step_y = 0 if max_r == 0 else gh / max_r

    return [(sw // 2 if max_c == 0 else mx + int(c * step_x),
             sh // 2 if max_r == 0 else my + int(r * step_y)) for r, c in order]


def compute_grid_points_from_shape(
    rows: int,
    cols: int,
    sw: int,
    sh: int,
    margin_ratio: float = 0.10,
    order: str = "default",
) -> list[tuple[int, int]]:
    """
    Generate (x, y) pixel coordinates for a rows x cols grid.

    `order` controls traversal:
    - "default": row-major
    - "serpentine": snake pattern (reduces large jumps between rows)
    """
    if rows <= 0 or cols <= 0:
        raise ValueError(f"rows and cols must be > 0 (got rows={rows}, cols={cols})")
    if not 0.0 <= margin_ratio < 0.5:
        raise ValueError(f"margin_ratio must be in [0.0, 0.5) (got {margin_ratio})")

    if order == "default":
        indices = [(r, c) for r in range(rows) for c in range(cols)]
    elif order == "serpentine":
        indices = []
        for r in range(rows):
            cols_range = range(cols) if r % 2 == 0 else range(cols - 1, -1, -1)
            indices.extend((r, c) for c in cols_range)
    else:
        raise ValueError(f"unknown order '{order}' (expected 'default' or 'serpentine')")

    return compute_grid_points(indices, sw, sh, margin_ratio)


def wait_for_face_and_countdown(cap, gaze_estimator, sw, sh, dur: int = 2) -> bool:
    """
    Waits for a face to be detected (not blinking), then shows a countdown ellipse
    """
    cv2.namedWindow("Calibration", cv2.WND_PROP_FULLSCREEN)
    cv2.setWindowProperty("Calibration", cv2.WND_PROP_FULLSCREEN, cv2.WINDOW_FULLSCREEN)
    fd_start = None
    countdown = False
    deadline = time.monotonic() + 30
    while True:
        if time.monotonic() > deadline:
            raise RuntimeError("No stable face/camera after 30 seconds. Check the camera and lighting.")
        ret, frame = cap.read()
        if not ret:
            if cv2.waitKey(1) == 27:
                return False
            continue
        f, blink = gaze_estimator.extract_features(frame)
        face = f is not None and not blink
        canvas = np.zeros((sh, sw, 3), dtype=np.uint8)
        now = time.monotonic()
        if face:
            if not countdown:
                fd_start = now
                countdown = True
            elapsed = now - fd_start
            if elapsed >= dur:
                return True
            t = elapsed / dur
            e = t * t * (3 - 2 * t)
            ang = 360 * (1 - e)
            cv2.ellipse(
                canvas,
                (sw // 2, sh // 2),
                (50, 50),
                0,
                -90,
                -90 + ang,
                (0, 255, 0),
                -1,
            )
        else:
            countdown = False
            fd_start = None
            txt = "Face not detected"
            fs = 2
            thick = 3
            size, _ = cv2.getTextSize(txt, cv2.FONT_HERSHEY_SIMPLEX, fs, thick)
            tx = (sw - size[0]) // 2
            ty = (sh + size[1]) // 2
            cv2.putText(
                canvas, txt, (tx, ty), cv2.FONT_HERSHEY_SIMPLEX, fs, (0, 0, 255), thick
            )
        cv2.imshow("Calibration", canvas)
        if cv2.waitKey(1) == 27:
            return False


def draw_targets(canvas, pts, active=None, completed=0, message=""):
    """Keep every target visible; only the green target is active."""
    for i, pos in enumerate(pts):
        color = (100, 100, 100) if i >= completed else (180, 130, 70)
        cv2.circle(canvas, tuple(pos), 8, color, -1)
    if active is not None:
        cv2.circle(canvas, tuple(pts[active]), 20, (0, 255, 0), -1)
        cv2.circle(canvas, tuple(pts[active]), 3, (255, 255, 255), -1)
    if message:
        cv2.putText(canvas, message, (25, 35), cv2.FONT_HERSHEY_SIMPLEX,
                    0.65, (255, 255, 255), 1, cv2.LINE_AA)


def _pulse_and_capture(
    gaze_estimator,
    cap,
    pts,
    sw: int,
    sh: int,
    pulse_d: float = 1.0,
    cd_d: float = 1.0,
    min_samples: int = 10,
    max_retries: int = 2,
):
    """
    Shared pulse-and-capture loop for each calibration point
    """
    if pulse_d <= 0 or cd_d <= 0 or min_samples < 2 or max_retries < 0:
        raise ValueError("Durations must be positive, min_samples >= 2, max_retries >= 0")
    feats, targs = [], []
    for index, (x, y) in enumerate(pts):
        for attempt in range(max_retries + 1):
            samples = []
            start = time.monotonic()
            while (elapsed := time.monotonic() - start) < pulse_d + cd_d:
                ok, frame = cap.read()
                capturing = elapsed >= pulse_d
                canvas = np.zeros((sh, sw, 3), dtype=np.uint8)
                stage = "Collecting" if capturing else "Look at GREEN dot"
                draw_targets(canvas, pts, index, index,
                             f"{stage} | {index + 1}/{len(pts)} | samples {len(samples)} | ESC cancel")
                if capturing:
                    progress = min((elapsed - pulse_d) / cd_d, 1.0)
                    cv2.ellipse(canvas, (x, y), (34, 34), 0, -90,
                                -90 + 360 * progress, (255, 255, 255), 2)
                cv2.imshow("Calibration", canvas)
                if cv2.waitKey(1) == 27:
                    return None
                # Warm the blink detector during settling, without training on saccades.
                if ok:
                    ft, blink = gaze_estimator.extract_features(frame)
                    if capturing and ft is not None and not blink and np.isfinite(ft).all():
                        samples.append(ft)
            if len(samples) >= min_samples:
                feats.extend(samples)
                targs.extend([[x, y]] * len(samples))
                break
            print(f"[calibration] Point {index + 1}: only {len(samples)} valid samples; retry {attempt + 1}")
        else:
            raise RuntimeError(f"Point {index + 1} has too few valid samples. Increase capture time/check lighting.")
    return feats, targs
