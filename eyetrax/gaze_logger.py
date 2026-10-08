"""Run from the repository root: python eyetrax/gaze_logger.py"""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent / "src"))
from eyetrax.recording import run_recording

if __name__ == "__main__":
    run_recording()
