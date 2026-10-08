"""
UX Analyzer FastAPI Backend
Provides REST endpoints for the React frontend to:
  - List sessions
  - Get session details (calibration, gaze, mouse, friction)
  - Trigger calibration (subprocess)
  - Start / stop recording (subprocess)
  - Run fusion analysis
"""
from __future__ import annotations

import csv
import json
import os
import subprocess
import sys
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import uvicorn
from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# ── Paths ──────────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data" / "sessions"
DATA_DIR.mkdir(parents=True, exist_ok=True)

EYETRAX_SRC = ROOT / "eyetrax" / "src"
MOUSE_SRC = ROOT / "mouse-tracker"
FUSION_SRC = ROOT / "fusion"
PYTHON = ROOT / ".venv" / "Scripts" / "python.exe"
if not PYTHON.exists():
    PYTHON = Path(sys.executable)

# ── App ────────────────────────────────────────────────────────────────────
app = FastAPI(title="UX Analyzer API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── State ──────────────────────────────────────────────────────────────────
_state: dict = {
    "status": "idle",          # idle | calibrating | recording | analyzing
    "session_id": None,
    "proc": None,              # subprocess.Popen
    "error": None,
    "recording_started_at": None,
}
_state_lock = threading.Lock()


def _safe_state() -> dict:
    with _state_lock:
        return {
            "status": _state["status"],
            "session_id": _state["session_id"],
            "error": _state["error"],
            "recording_started_at": _state["recording_started_at"],
        }


# ── Helpers ────────────────────────────────────────────────────────────────

def _session_dir(sid: str) -> Path:
    p = DATA_DIR / sid
    if not p.exists():
        raise HTTPException(status_code=404, detail=f"Session {sid} not found")
    return p


def _parse_calibration(sid: str) -> dict | None:
    path = DATA_DIR / sid / "calibration_report.json"
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def _parse_friction(sid: str) -> list:
    path = DATA_DIR / sid / "friction_events.json"
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8"))


def _parse_gaze(sid: str) -> list:
    path = DATA_DIR / sid / "gaze_log.csv"
    if not path.exists():
        return []
    rows = []
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                rows.append({
                    "timestamp": float(row["timestamp"]),
                    "gaze_x": float(row["gaze_x"]),
                    "gaze_y": float(row["gaze_y"]),
                })
            except (ValueError, KeyError):
                continue
    return rows


def _parse_mouse(sid: str) -> dict:
    path = DATA_DIR / sid / "mouse_session.json"
    if not path.exists():
        return {"events": []}
    return json.loads(path.read_text(encoding="utf-8"))


def _build_session_summary(sid: str) -> dict:
    cal = _parse_calibration(sid)
    friction = _parse_friction(sid)

    # Count mouse events quickly without loading everything
    mouse_path = DATA_DIR / sid / "mouse_session.json"
    mouse_count = 0
    click_count = 0
    if mouse_path.exists():
        try:
            m = json.loads(mouse_path.read_text(encoding="utf-8"))
            events = m.get("events", [])
            mouse_count = len(events)
            click_count = sum(1 for e in events if e.get("meta", {}).get("subtype") == "click")
        except Exception:
            pass

    gaze_path = DATA_DIR / sid / "gaze_log.csv"
    gaze_count = 0
    if gaze_path.exists():
        with open(gaze_path, encoding="utf-8") as f:
            gaze_count = max(0, sum(1 for _ in f) - 1)

    has_friction = (DATA_DIR / sid / "friction_events.json").exists()

    return {
        "session_id": sid,
        "created_at": _sid_to_iso(sid),
        "gaze_samples": gaze_count,
        "mouse_events": mouse_count,
        "click_count": click_count,
        "friction_count": len(friction),
        "has_calibration": cal is not None,
        "has_friction": has_friction,
        "mean_error_px": cal["validation"]["mean_error_px"] if cal and "validation" in cal else None,
        "screen": (
            {"width": cal.get("screen_width"), "height": cal.get("screen_height")}
            if cal else None
        ),
    }


def _sid_to_iso(sid: str) -> str:
    try:
        dt = datetime.strptime(sid, "%Y%m%dT%H%M%S%fZ").replace(tzinfo=timezone.utc)
        return dt.isoformat()
    except ValueError:
        return sid


# ── Routes: status ─────────────────────────────────────────────────────────

@app.get("/api/status")
def get_status():
    return _safe_state()


# ── Routes: sessions ───────────────────────────────────────────────────────

@app.get("/api/sessions")
def list_sessions():
    if not DATA_DIR.exists():
        return []
    sessions = []
    for p in sorted(DATA_DIR.iterdir(), reverse=True):
        if p.is_dir():
            try:
                sessions.append(_build_session_summary(p.name))
            except Exception:
                sessions.append({"session_id": p.name, "error": "parse error"})
    return sessions


@app.get("/api/sessions/{sid}")
def get_session(sid: str):
    _session_dir(sid)
    cal = _parse_calibration(sid)
    friction = _parse_friction(sid)
    gaze = _parse_gaze(sid)
    mouse = _parse_mouse(sid)

    # build heatmap grid
    heatmap = _build_gaze_heatmap(gaze, cal)

    # mouse path (downsample to 500 pts)
    moves = [e for e in mouse.get("events", []) if e.get("meta", {}).get("subtype") == "move"]
    step = max(1, len(moves) // 500)
    mouse_path = [{"x": e["x"], "y": e["y"]} for e in moves[::step]]

    clicks = [
        {
            "x": e["x"], "y": e["y"],
            "timestamp": e["ts"],
            "rage_click": e.get("meta", {}).get("rage_click", False),
        }
        for e in mouse.get("events", [])
        if e.get("meta", {}).get("subtype") == "click"
    ]

    return {
        "session_id": sid,
        "created_at": _sid_to_iso(sid),
        "calibration": cal,
        "friction_events": friction,
        "gaze_samples_count": len(gaze),
        "mouse_path": mouse_path,
        "clicks": clicks,
        "heatmap": heatmap,
    }


def _build_gaze_heatmap(gaze: list, cal: dict | None) -> list:
    cell = 40
    sw = cal["screen_width"] if cal else 1920
    sh = cal["screen_height"] if cal else 1080
    grid: dict[tuple, int] = {}
    for g in gaze:
        try:
            gx = int(float(g["gaze_x"]) // cell) * cell
            gy = int(float(g["gaze_y"]) // cell) * cell
            if 0 <= gx < sw and 0 <= gy < sh:
                grid[(gx, gy)] = grid.get((gx, gy), 0) + 1
        except (ValueError, KeyError):
            continue
    max_v = max(grid.values(), default=1)
    return [
        {"x": x, "y": y, "count": c, "intensity": round(c / max_v, 3)}
        for (x, y), c in grid.items()
    ]


# ── Routes: calibration / recording ────────────────────────────────────────

@app.post("/api/calibrate")
def start_calibration(background_tasks: BackgroundTasks):
    with _state_lock:
        if _state["status"] not in ("idle",):
            raise HTTPException(status_code=409, detail=f"Cannot calibrate while {_state['status']}")
        _state["status"] = "calibrating"
        _state["error"] = None

    background_tasks.add_task(_run_calibration)
    return {"ok": True, "message": "Calibration started in background"}


def _run_calibration():
    """Launch the eyetrax session calibration in a subprocess."""
    script = str(ROOT / "api" / "_scripts" / "do_calibrate.py")
    env = os.environ.copy()
    env["PYTHONPATH"] = str(EYETRAX_SRC)
    try:
        proc = subprocess.Popen(
            [str(PYTHON), script],
            env=env,
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            text=True,
        )
        with _state_lock:
            _state["proc"] = proc
        proc.wait()
        with _state_lock:
            _state["status"] = "idle"
            _state["proc"] = None
    except Exception as exc:
        with _state_lock:
            _state["status"] = "idle"
            _state["error"] = str(exc)
            _state["proc"] = None


@app.post("/api/record/start")
def start_recording(background_tasks: BackgroundTasks):
    with _state_lock:
        if _state["status"] not in ("idle",):
            raise HTTPException(status_code=409, detail=f"Cannot record while {_state['status']}")
        _state["status"] = "recording"
        _state["error"] = None
        _state["recording_started_at"] = time.time()

    background_tasks.add_task(_run_recording)
    return {"ok": True, "message": "Recording started"}


def _run_recording():
    """Launch run_session.py which handles calibrate→record(gaze+mouse+screen)→save."""
    script = str(ROOT / "api" / "_scripts" / "run_session.py")
    env = os.environ.copy()
    
    stop_file = ROOT / "api" / "_scripts" / "stop.flag"
    if stop_file.exists():
        stop_file.unlink()

    try:
        proc = subprocess.Popen(
            [str(PYTHON), script],
            cwd=str(ROOT),
            env=env,
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            text=True,
        )
        with _state_lock:
            _state["proc"] = proc
        out, _ = proc.communicate()
        
        # Parse session id from last stdout line if available
        sid = None
        for line in reversed((out or "").splitlines()):
            if "Saved:" in line:
                try:
                    sid = line.split("Saved:")[-1].strip().split("|")[0].strip().split(os.sep)[-1]
                except Exception:
                    pass
                break
        with _state_lock:
            _state["status"] = "idle"
            _state["session_id"] = sid
            _state["proc"] = None
    except Exception as exc:
        with _state_lock:
            _state["status"] = "idle"
            _state["error"] = str(exc)
            _state["proc"] = None


@app.post("/api/record/stop")
def stop_recording():
    with _state_lock:
        if _state["status"] != "recording":
            raise HTTPException(status_code=409, detail="Not recording")
    
    stop_file = ROOT / "api" / "_scripts" / "stop.flag"
    stop_file.write_text("stop")
    return {"ok": True}


@app.post("/api/sessions/{sid}/analyze")
def analyze_session(sid: str, background_tasks: BackgroundTasks):
    _session_dir(sid)
    background_tasks.add_task(_run_analysis, sid)
    return {"ok": True, "message": f"Analysis started for {sid}"}


def _run_analysis(sid: str):
    """Run fusion analysis on an existing session."""
    with _state_lock:
        _state["status"] = "analyzing"
    try:
        session_path = DATA_DIR / sid
        mouse_path = session_path / "mouse_session.json"
        gaze_path = session_path / "gaze_log.csv"
        friction_path = session_path / "friction_events.json"

        if not mouse_path.exists() or not gaze_path.exists():
            return

        # Inline analysis (mirrors live_fusion detect functions)
        with open(gaze_path, newline="", encoding="utf-8") as f:
            gaze = [{k: float(v) for k, v in row.items()} for row in csv.DictReader(f)]

        mouse_session = json.loads(mouse_path.read_text(encoding="utf-8"))
        mouse = [
            {"timestamp": e["ts"], "x": e["x"], "y": e["y"],
             "subtype": e["meta"]["subtype"]}
            for e in mouse_session.get("events", [])
        ]

        events = sorted(
            _detect_rage_click(mouse) + _detect_gaze_mouse_mismatch(gaze, mouse),
            key=lambda e: e["timestamp"],
        )
        friction_path.write_text(json.dumps(events, indent=2), encoding="utf-8")
    except Exception as exc:
        with _state_lock:
            _state["error"] = str(exc)
    finally:
        with _state_lock:
            _state["status"] = "idle"


def _detect_rage_click(mouse: list, window_sec=1.0, threshold=3) -> list:
    clicks = [e for e in mouse if e["subtype"] == "click"]
    events = []
    used: set = set()
    for i, c in enumerate(clicks):
        if i in used:
            continue
        window = [d for d in clicks if c["timestamp"] <= d["timestamp"] <= c["timestamp"] + window_sec]
        if len(window) >= threshold:
            for j, d in enumerate(clicks):
                if d in window:
                    used.add(j)
            events.append({"type": "rage_click", "timestamp": c["timestamp"],
                           "x": c["x"], "y": c["y"], "count": len(window)})
    return events


def _detect_gaze_mouse_mismatch(gaze: list, mouse: list, tolerance_px=150, tolerance_sec=0.5) -> list:
    import math
    events = []
    clicks = [e for e in mouse if e["subtype"] == "click"]
    for c in clicks:
        nearby = [g for g in gaze if abs(g["timestamp"] - c["timestamp"]) <= tolerance_sec]
        if not nearby:
            continue
        g = min(nearby, key=lambda s: abs(s["timestamp"] - c["timestamp"]))
        dist = math.hypot(g["gaze_x"] - c["x"], g["gaze_y"] - c["y"])
        if dist > tolerance_px:
            events.append({
                "type": "gaze_mouse_mismatch",
                "timestamp": c["timestamp"],
                "mouse_pos": [c["x"], c["y"]],
                "gaze_pos": [round(g["gaze_x"]), round(g["gaze_y"])],
                "distance_px": round(dist),
            })
    return events


# ── Serve frontend ─────────────────────────────────────────────────────────
app.mount("/data", StaticFiles(directory=str(DATA_DIR)), name="data")

_frontend_dist = ROOT / "frontend" / "dist"
if _frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(_frontend_dist), html=True), name="frontend")


if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=8888, reload=True)
