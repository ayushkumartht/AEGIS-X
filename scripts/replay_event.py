"""Calibrate the rating curve against a past event and compute its day-by-day replay.

Usage (from the repo root):
    .venv\\Scripts\\python.exe scripts\\replay_event.py --event silchar_2022

Needs the district scenario (scripts/build_scenario.py) and the cached history
(scripts/fetch_data.py). Writes:
    data/reference/calibration_<district>.json      (committed: the fitted rating curve)
    data/processed/<district>/replay_<event>.json   (served by GET /api/v1/replay/<event>)
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from aegis.domains.flood.serialize import load_scenario  # noqa: E402
from aegis.ingest import open_meteo  # noqa: E402
from aegis.ingest.district import load_district  # noqa: E402
from aegis.replay.replay import calibrate_from_record, run_replay  # noqa: E402
from aegis.settings import get_settings  # noqa: E402


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--event", default="silchar_2022")
    ap.add_argument("--samples", type=int, default=100)
    args = ap.parse_args()

    data = get_settings().aegis_data_dir
    event = yaml.safe_load((data / "reference" / "events" / f"{args.event}.yaml").read_text(encoding="utf-8"))
    d = load_district(event["district"])
    point = next(p for p in d.forecast_points if p.id == event["point"])
    start, end = event["window"]["start"], event["window"]["end"]
    flow = open_meteo.discharge_history(d.id, point.id, point.lat, point.lon, start, end)
    rain = open_meteo.rain_history(d.id, point.id, point.lat, point.lon, start, end)
    scenario = load_scenario(data / "processed" / d.id / "scenario.json")

    share = float(event["assumptions"]["target_flooded_population_share"])
    record = open_meteo.discharge_history(d.id, point.id, point.lat, point.lon, "2010-01-01", "2025-12-31")
    rating, info = calibrate_from_record(scenario, record["dates"], record["values"], share)
    calib_path = data / "reference" / f"calibration_{d.id}.json"
    calib_path.write_text(json.dumps({**rating.to_dict(), "event": args.event, "fit": info}, indent=2), encoding="utf-8")
    print(f"Rating curve: normal (2-year flood) {rating.q_normal:.0f} m3/s, k={rating.k:.2f} m, record {info.get('q_record', 0):.0f} m3/s in {info.get('record_year')} -> {calib_path}")

    result = run_replay(
        scenario, flow["dates"], flow["values"], rain["values"], rating,
        n_samples=args.samples, forecast_error_sigma=float(event["assumptions"]["forecast_error_sigma"]),
    )
    out = data / "processed" / d.id / f"replay_{args.event}.json"
    out.write_text(json.dumps(result), encoding="utf-8")
    print(f"Replay: {result['calibration']['n_steps']} days, interval coverage "
          f"{result['calibration']['interval_coverage_10_90']:.0%} -> {out}")


if __name__ == "__main__":
    main()
