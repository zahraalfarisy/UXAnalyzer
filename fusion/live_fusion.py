"""Calibrate and preview on the main thread, then record gaze and mouse together."""
from pathlib import Path
import csv
import json
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "eyetrax" / "src"))
from eyetrax.recording import run_recording

def detect_rage_click(data, window_sec=1.0, threshold=3):
    clicks = [e for e in data if e["subtype"] == "click"]
    events = []
    used = set()
    for i, c in enumerate(clicks):
        if i in used:
            continue
        window = [d for d in clicks if c["timestamp"] <= d["timestamp"] <= c["timestamp"] + window_sec]
        if len(window) >= threshold:
            for j, d in enumerate(clicks):
                if d in window:
                    used.add(j)
            events.append({"type": "rage_click", "timestamp": c["timestamp"], "x": c["x"], "y": c["y"], "count": len(window)})
    return events

def detect_gaze_mouse_mismatch(gaze, mouse, tolerance_px=150, tolerance_sec=0.5):
    events = []
    clicks = [e for e in mouse if e["subtype"] == "click"]
    for c in clicks:
        nearby = [g for g in gaze if abs(g["timestamp"] - c["timestamp"]) <= tolerance_sec]
        if not nearby:
            continue
        g = min(nearby, key=lambda sample: abs(sample["timestamp"] - c["timestamp"]))
        dist = ((g["gaze_x"] - c["x"])**2 + (g["gaze_y"] - c["y"])**2)**0.5
        if dist > tolerance_px:
            events.append({"type": "gaze_mouse_mismatch", "timestamp": c["timestamp"],
                           "mouse_pos": (c["x"], c["y"]), "gaze_pos": (round(g["gaze_x"]), round(g["gaze_y"])),
                           "distance_px": round(dist)})
    return events

def main():
    destination = run_recording(track_mouse=True)
    if destination is None:
        return
    with (destination / "gaze_log.csv").open(encoding="utf-8") as f:
        gaze = [{key: float(value) for key, value in row.items()} for row in csv.DictReader(f)]
    mouse_session = json.loads((destination / "mouse_session.json").read_text(encoding="utf-8"))
    mouse = [{"timestamp": event["ts"], "x": event["x"], "y": event["y"],
              "subtype": event["meta"]["subtype"]} for event in mouse_session["events"]]
    events = sorted(detect_rage_click(mouse) + detect_gaze_mouse_mismatch(gaze, mouse),
                    key=lambda event: event["timestamp"])
    (destination / "friction_events.json").write_text(json.dumps(events, indent=2), encoding="utf-8")
    print(f"Friction candidates: {len(events)}. Check calibration error before interpreting gaze mismatch.")


if __name__ == "__main__":
    main()
