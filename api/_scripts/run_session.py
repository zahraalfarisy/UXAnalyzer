import sys
import time
import threading
import json
import csv
from datetime import datetime, timezone
from pathlib import Path
import cv2
import mss
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "eyetrax" / "src"))
sys.path.insert(0, str(ROOT / "mouse-tracker"))
sys.path.insert(0, str(ROOT / "fusion"))

from eyetrax.gaze import GazeEstimator
from eyetrax.filters import KalmanEMASmoother
from eyetrax.session import gaze_samples, prepare_session, session_args
from live_fusion import detect_rage_click, detect_gaze_mouse_mismatch

stop_file = ROOT / "api" / "_scripts" / "stop.flag"

def monitor_stop(stop_event):
    while not stop_event.wait(0.2):
        if stop_file.exists():
            stop_file.unlink()
            stop_event.set()
            break

def record_screen(dest_dir, report, stop_event):
    sw, sh = report["screen_width"], report["screen_height"]
    fourcc = cv2.VideoWriter_fourcc(*'avc1')
    fps = 10.0
    out = cv2.VideoWriter(str(dest_dir / "screen.mp4"), fourcc, fps, (sw, sh))
    report["video_frames"] = 0
    report["video_fps"] = fps
    try:
        if not out.isOpened():
            raise RuntimeError("H.264 screen recorder could not start. OpenCV needs an H.264 encoder.")
        with mss.mss() as sct:
            monitor = {"top": 0, "left": 0, "width": sw, "height": sh}
            while not stop_event.is_set():
                frame = cv2.cvtColor(np.array(sct.grab(monitor)), cv2.COLOR_BGRA2BGR)
                if not report["video_frames"]:
                    report["video_started_at"] = time.time()
                    origin = time.monotonic()
                # Duplicate frames after capture delays to keep video time aligned
                # with the gaze/mouse wall clock instead of speeding up playback.
                target = int((time.monotonic() - origin) * fps) + 1
                while report["video_frames"] < target:
                    out.write(frame)
                    report["video_frames"] += 1
                stop_event.wait(max(0, origin + report["video_frames"] / fps - time.monotonic()))
    except Exception as exc:
        report["video_error"] = str(exc)
    finally:
        out.release()

def main():
    stop_event = threading.Event()
    threading.Thread(target=monitor_stop, args=(stop_event,), daemon=True).start()
    
    args = session_args()
    latest_model = ROOT / "data" / "latest_calibration" / "gaze_model.pkl"
    latest_report = latest_model.with_name("report.json")
    if latest_model.exists() and latest_report.exists():
        calibration_report = json.loads(latest_report.read_text(encoding="utf-8"))
        estimator = GazeEstimator(model_name=calibration_report["model"])
        estimator.load_model(latest_model)
        args.camera = calibration_report["camera"]
        smoother = KalmanEMASmoother(ema_alpha=calibration_report["ema_alpha"])
        smoother.kf.measurementNoiseCov = np.asarray(
            calibration_report["measurement_noise_cov"], dtype=np.float32)
        prepared = smoother, calibration_report
        print("Using latest calibration model and validation report.")
    else:
        estimator = GazeEstimator(model_name=args.model)
        prepared = prepare_session(estimator, args)
    
    if prepared is None:
        print("Session cancelled.")
        return
        
    smoother, calibration_report = prepared
    sid = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    destination = ROOT / "data" / "sessions" / sid
    destination.mkdir(parents=True, exist_ok=False)
    
    estimator.save_model(destination / "gaze_model.pkl")
    report = dict(calibration_report, session_id=sid, started_at=time.time(), frames=0, valid_frames=0)
    (destination / "calibration_report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    
    mouse_events = []
    from pynput import mouse
    def append_mouse(x, y, subtype, **meta):
        mouse_events.append({"ts": time.time(), "source": "mouse", "session_id": sid,
                             "x": x, "y": y, "meta": {"subtype": subtype, **meta}})
    def on_click(x, y, button, pressed):
        if pressed: append_mouse(x, y, "click", button=str(button))
    
    listener = mouse.Listener(on_move=lambda x, y: append_mouse(x, y, "move"),
                              on_click=on_click,
                              on_scroll=lambda x, y, dx, dy: append_mouse(x, y, "scroll", dx=dx, dy=dy))
    listener.start()
    
    screen_thread = threading.Thread(target=record_screen, args=(destination, report, stop_event))
    screen_thread.start()
    
    samples = gaze_samples(estimator, smoother, args.camera, report["screen_width"], report["screen_height"], stop_event)
    last_progress = 0
    def progress():
        print("Progress:" + json.dumps({
            "frames": report["frames"], "valid_frames": report["valid_frames"],
            "gaze_reasons": report.get("gaze_reasons", {}),
            "video_frames": report.get("video_frames", 0),
            "video_error": report.get("video_error"),
        }), flush=True)
    
    try:
        with (destination / "gaze_log.csv").open("w", newline="", encoding="utf-8") as gaze_file, \
             (destination / "gaze_quality.csv").open("w", newline="", encoding="utf-8") as quality_file:
            gaze_writer = csv.DictWriter(gaze_file, fieldnames=["timestamp", "gaze_x", "gaze_y"])
            quality_writer = csv.DictWriter(quality_file, fieldnames=["timestamp", "raw_x", "raw_y", "gaze_x", "gaze_y", "valid", "reason"])
            gaze_writer.writeheader()
            quality_writer.writeheader()
            
            for row in samples:
                report["frames"] += 1
                reasons = report.setdefault("gaze_reasons", {})
                reasons[row["reason"]] = reasons.get(row["reason"], 0) + 1
                quality_writer.writerow(row)
                if row["valid"]:
                    report["valid_frames"] += 1
                    gaze_writer.writerow({k: row[k] for k in gaze_writer.fieldnames})
                if report["frames"] == 1 or time.monotonic() - last_progress >= 1:
                    gaze_file.flush()
                    quality_file.flush()
                    progress()
                    last_progress = time.monotonic()
    except KeyboardInterrupt:
        print("\nRecording stopped by user.")
    except Exception as exc:
        report["gaze_error"] = str(exc)
    finally:
        listener.stop()
        listener.join()
        stop_event.set()
        screen_thread.join()
        samples.close()
        estimator.close()
        
        report.update(ended_at=time.time(), mouse_events=len(mouse_events))
        (destination / "calibration_report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
        (destination / "mouse_session.json").write_text(json.dumps({"session_id": sid, "events": mouse_events}, indent=2), encoding="utf-8")
        
        mouse_data = [{"timestamp": e["ts"], "x": e["x"], "y": e["y"],
                       "subtype": e["meta"]["subtype"]} for e in mouse_events]
        with (destination / "gaze_log.csv").open(encoding="utf-8") as gaze_file:
            gaze_data = [{k: float(v) for k, v in row.items()}
                         for row in csv.DictReader(gaze_file)]
        events = sorted(detect_rage_click(mouse_data) + detect_gaze_mouse_mismatch(
            gaze_data, mouse_data),
            key=lambda e: e["timestamp"])
        (destination / "friction_events.json").write_text(json.dumps(events, indent=2), encoding="utf-8")
        
        print(f"Saved:{destination}|")

if __name__ == "__main__":
    main()
