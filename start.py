#!/usr/bin/env python3
"""
start.py — convenience launcher that:
  1. Installs FastAPI deps into .venv if needed
  2. Builds the React frontend (if not already built)
  3. Starts uvicorn on http://localhost:8000
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PYTHON = ROOT / ".venv" / "Scripts" / "python.exe"
if not PYTHON.exists():
    PYTHON = Path(sys.executable)

def run(*args, **kw):
    return subprocess.run(list(args), **kw, check=True)

if __name__ == "__main__":
    # Install API requirements
    req = ROOT / "api" / "requirements.txt"
    run(str(PYTHON), "-m", "pip", "install", "-r", str(req), "--quiet")

    # Build frontend if dist not present
    dist = ROOT / "frontend" / "dist"
    if not dist.exists():
        print("Building React frontend…")
        run("npm", "run", "build", cwd=str(ROOT / "frontend"), shell=True)

    # Launch FastAPI
    print("Starting UX Analyzer API → http://localhost:8888")
    run(
        str(PYTHON), "-m", "uvicorn", "server:app",
        "--host", "0.0.0.0", "--port", "8888", "--reload",
        cwd=str(ROOT / "api"),
    )
