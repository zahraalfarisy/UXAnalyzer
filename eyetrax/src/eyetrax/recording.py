"""Record synchronized gaze/mouse data only after the preview handoff."""
from __future__ import annotations

import csv
from datetime import datetime, timezone
import json
import time

from eyetrax.gaze import GazeEstimator
from eyetrax.session import gaze_samples, prepare_session, session_args


def run_recording(track_mouse=False):
    args = session_args()
    estimator = GazeEstimator(model_name=args.model)
    listener = None
    samples = None
    mouse_events = []
    report = None
    try:
        prepared = prepare_session(estimator, args)
        if prepared is None:
            print("Session cancelled. No recording started.")
            return
        smoother, calibration_report = prepared
        sid = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
        destination = args.output / sid
        destination.mkdir(parents=True, exist_ok=False)
        estimator.save_model(destination / "gaze_model.pkl")
        report_path = destination / "calibration_report.json"
        report = dict(calibration_report, session_id=sid, started_at=time.time(), frames=0, valid_frames=0)
        report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(f"Recording to {destination}. Switch to your website. Ctrl+C in terminal stops.")

        if track_mouse:
            from pynput import mouse

            def append_mouse(x, y, subtype, **meta):
                mouse_events.append({"ts": time.time(), "source": "mouse", "session_id": sid,
                                     "x": x, "y": y, "meta": {"subtype": subtype, **meta}})

            def on_click(x, y, button, pressed):
                if pressed:
                    append_mouse(x, y, "click", button=str(button))

            listener = mouse.Listener(on_move=lambda x, y: append_mouse(x, y, "move"),
                                      on_click=on_click,
                                      on_scroll=lambda x, y, dx, dy: append_mouse(x, y, "scroll", dx=dx, dy=dy))
            listener.start()

        samples = gaze_samples(estimator, smoother, args.camera,
                               report["screen_width"], report["screen_height"])
        with (destination / "gaze_log.csv").open("w", newline="", encoding="utf-8") as gaze_file, \
                (destination / "gaze_quality.csv").open("w", newline="", encoding="utf-8") as quality_file:
            gaze_writer = csv.DictWriter(gaze_file, fieldnames=["timestamp", "gaze_x", "gaze_y"])
            quality_writer = csv.DictWriter(quality_file, fieldnames=["timestamp", "raw_x", "raw_y",
                                                                    "gaze_x", "gaze_y", "valid", "reason"])
            gaze_writer.writeheader()
            quality_writer.writeheader()
            for row in samples:
                report["frames"] += 1
                quality_writer.writerow(row)
                if row["valid"]:
                    report["valid_frames"] += 1
                    gaze_writer.writerow({key: row[key] for key in gaze_writer.fieldnames})
                if report["frames"] % 30 == 0:
                    gaze_file.flush()
                    quality_file.flush()
    except KeyboardInterrupt:
        print("\nRecording stopped.")
    finally:
        if listener is not None:
            listener.stop()
            listener.join()
        if samples is not None:
            samples.close()
        estimator.close()
        if report is not None:
            report.update(ended_at=time.time(), mouse_events=len(mouse_events),
                          valid_frame_ratio=report["valid_frames"] / max(report["frames"], 1))
            report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
            if track_mouse:
                (destination / "mouse_session.json").write_text(
                    json.dumps({"session_id": sid, "events": mouse_events}, indent=2), encoding="utf-8")
            print(f"Saved: {destination} | valid gaze {report['valid_frames']}/{report['frames']}")
    return destination
