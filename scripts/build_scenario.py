"""Build the flood scenario (road graph, thresholds, people, shelters) for a district.

Usage (from the repo root):
    .venv\\Scripts\\python.exe scripts\\build_scenario.py --district cachar

Needs scripts/fetch_data.py to have run first. Node elevations are fetched on the first build
and cached, so later builds work offline. Output: data/processed/<district>/scenario.json
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from aegis.domains.flood.builder import build_scenario  # noqa: E402
from aegis.domains.flood.serialize import save_scenario  # noqa: E402
from aegis.ingest import open_meteo, osm  # noqa: E402
from aegis.ingest.district import load_district  # noqa: E402
from aegis.ingest.shelters import load_shelters  # noqa: E402
from aegis.settings import get_settings  # noqa: E402


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--district", default="cachar")
    args = ap.parse_args()

    d = load_district(args.district)
    roads = osm.roads(d.id, d.bbox)
    features = osm.features(d.id, d.bbox, d.river_name)
    scenario = build_scenario(
        d, roads, features, lambda pts: open_meteo.elevations(d.id, pts), load_shelters(d.shelters_csv)
    )
    out = get_settings().aegis_data_dir / "processed" / d.id / "scenario.json"
    save_scenario(scenario, out)

    md = scenario.metadata
    print(f"Built {d.name}: {md['n_nodes']} nodes, {md['n_edges']} edges")
    print(f"  river normal level {md['river_base_m']:.1f} m ({md['river_base_method']})")
    print(f"  {len(scenario.bridges)} key bridges, {len(scenario.clusters)} clusters "
          f"({scenario.total_population} people), {len(scenario.shelters)} shelters, {len(scenario.staging)} staging points")
    hands = sorted(c.hand_m for c in scenario.clusters)
    print(f"  cluster flood thresholds (m above normal): min {hands[0]:.1f}, median {hands[len(hands)//2]:.1f}, max {hands[-1]:.1f}")
    print(f"Saved {out}")


if __name__ == "__main__":
    main()
