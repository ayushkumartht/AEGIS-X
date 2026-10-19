"""Fetch and cache all raw data for a district.

Usage (from the repo root):
    .venv\\Scripts\\python.exe scripts\\fetch_data.py --district cachar [--refresh]

A second run uses only the cache. Forecasts older than 6 hours are re-fetched.
Node elevations are fetched by scripts/build_scenario.py (they depend on the road network).
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from aegis.ingest import open_meteo, osm  # noqa: E402
from aegis.ingest.district import load_district  # noqa: E402


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--district", default="cachar")
    ap.add_argument("--refresh", action="store_true", help="ignore the cache and fetch again")
    args = ap.parse_args()

    d = load_district(args.district)
    print(f"District: {d.name}")
    for p in d.forecast_points:
        rain = open_meteo.rain_ensemble(d.id, p.id, p.lat, p.lon, refresh=args.refresh)
        flow = open_meteo.discharge_ensemble(d.id, p.id, p.lat, p.lon, refresh=args.refresh)
        print(f"  forecast {p.id}: rain members={len(rain['members'])}, discharge members={len(flow['members'])}")
        for ev in d.events:
            open_meteo.rain_history(d.id, p.id, p.lat, p.lon, ev["start"], ev["end"])
            open_meteo.discharge_history(d.id, p.id, p.lat, p.lon, ev["start"], ev["end"])
            print(f"  history {ev['id']}: cached")
    roads = osm.roads(d.id, d.bbox)
    feats = osm.features(d.id, d.bbox, d.river_name)
    print(f"  OSM roads elements={len(roads['elements'])}, features elements={len(feats['elements'])}")
    try:
        print(f"  OSM buildings: {len(osm.buildings(d.id, d.bbox))}")
    except Exception as exc:  # noqa: BLE001 - optional layer: the 3D view works without it
        print(f"  OSM buildings skipped ({exc}); the 3D view will show illustrative houses only")
    print("Done.")


if __name__ == "__main__":
    main()
