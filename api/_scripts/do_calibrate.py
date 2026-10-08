import sys
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "eyetrax" / "src"))

from eyetrax.gaze import GazeEstimator
from eyetrax.session import session_args, prepare_session

def main():
    args = session_args()
    estimator = GazeEstimator(model_name=args.model)
    print("Starting calibration UI...")
    
    prepared = prepare_session(estimator, args)
    if prepared is not None:
        smoother, report = prepared
        out_dir = ROOT / "data" / "latest_calibration"
        out_dir.mkdir(parents=True, exist_ok=True)
        estimator.save_model(out_dir / "gaze_model.pkl")
        (out_dir / "report.json").write_text(json.dumps(report, indent=2))
        print("Calibration complete and saved to latest_calibration")
    else:
        print("Calibration cancelled.")
        sys.exit(1)

if __name__ == "__main__":
    main()
