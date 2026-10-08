import sys
import time
import threading
import _thread
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
from eyetrax.session import gaze_samples, prepare_session, session_args
from fusion.live_fusion import detect_rage_click, detect_gaze_mouse_mismatch

stop_file = ROOT / "api" / "_scripts" / "stop.flag"

def monitor_stop():
    while True:
        if stop_file.exists():
            stop_file.unlink()
            _thread.interrupt_main()
            break
        time.sleep(0.2)

def record_screen(dest_dir, report, stop_event):
    sw, sh = report["screen_width"], report["screen_height"]
    fourcc = cv2.VideoWriter_fourcc(*'avc1')
    fps = 10.0
    out = cv2.VideoWriter(str(dest_dir / "screen.mp4"), fourcc, fps, (sw, sh))
    
    with mss.mss() as sct:
        monitor = {"top": 0, "left": 0, "width": sw, "height": sh}
        frame_time = 1.0 / fps
        while not stop_event.is_set():
            start_t = time.time()
            img = sct.grab(monitor)
            frame = np.array(img)
            frame = cv2.cvtColor(frame, cv2.COLOR_BGRA2BGR)
            out.write(frame)
            
            elapsed = time.time() - start_t
            sleep_t = frame_time - elapsed
            if sleep_t > 0:
                time.sleep(sleep_t)
    out.release()

def main():
    threading.Thread(target=monitor_stop, daemon=True).start()
    
    args = session_args()
    latest_model = ROOT / "data" / "latest_calibration" / "gaze_model.pkl"
    if latest_model.exists():
        args.model_file = latest_model
        print("Using latest calibration model.")
        
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
    
    stop_event = threading.Event()
    screen_thread = threading.Thread(target=record_screen, args=(destination, report, stop_event))
    screen_thread.start()
    
    samples = gaze_samples(estimator, smoother, args.camera, report["screen_width"], report["screen_height"])
    
    try:
        with (destination / "gaze_log.csv").open("w", newline="", encoding="utf-8") as gaze_file, \
             (destination / "gaze_quality.csv").open("w", newline="", encoding="utf-8") as quality_file:
            gaze_writer = csv.DictWriter(gaze_file, fieldnames=["timestamp", "gaze_x", "gaze_y"])
            quality_writer = csv.DictWriter(quality_file, fieldnames=["timestamp", "raw_x", "raw_y", "gaze_x", "gaze_y", "valid", "reason"])
            gaze_writer.writeheader()
            quality_writer.writeheader()
            
            for row in samples:
                report["frames"] += 1
                quality_writer.writerow(row)
                if row["valid"]:
                    report["valid_frames"] += 1
                    gaze_writer.writerow({k: row[k] for k in gaze_writer.fieldnames})
                if report["frames"] % 30 == 0:
                    gaze_file.flush()
                    quality_file.flush()
    except KeyboardInterrupt:
        print("\nRecording stopped by user.")
    finally:
        listener.stop()
        stop_event.set()
        screen_thread.join()
        
        report.update(ended_at=time.time(), mouse_events=len(mouse_events))
        (destination / "calibration_report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
        (destination / "mouse_session.json").write_text(json.dumps({"session_id": sid, "events": mouse_events}, indent=2), encoding="utf-8")
        
        events = sorted(detect_rage_click(mouse_events) + detect_gaze_mouse_mismatch(
            list(csv.DictReader((destination / "gaze_log.csv").open())), mouse_events),
            key=lambda e: e["timestamp"])
        (destination / "friction_events.json").write_text(json.dumps(events, indent=2), encoding="utf-8")
        
        print(f"Saved:{destination}|")

if __name__ == "__main__":
    main()
