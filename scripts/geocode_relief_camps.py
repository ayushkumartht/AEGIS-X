"""Locate the officially used relief camps and write them as the district's shelter list.

Input:  data/reference/<district>_relief_camps_2024.csv  (names from the district flood report)
Output: data/reference/<district>_shelters.csv            (read by scripts/build_scenario.py)

Each camp is located, in order of trust:
  1. a building of the same name mapped in OpenStreetMap (fuzzy name match),
  2. Nominatim search for "<name>, Silchar" inside the district box,
  3. the centre of the neighbourhood named in the camp's own name (marked approximate).
Camps found by none of these keep a blank lat/lon: the scenario builder then puts them on high
ground in the town and labels the position as assumed.

Capacity: the report gives none. In 2024 Silchar revenue circle ran 124 relief camps holding
34,027 people (274 per camp on average); high schools/colleges get 350 and primary schools 200,
which averages close to that figure for this list. Marked as estimates in the source column.

Usage (from the repo root):
    .venv\\Scripts\\python.exe scripts\\geocode_relief_camps.py --district cachar
"""

from __future__ import annotations

import argparse
import csv
import re
import sys
from difflib import SequenceMatcher
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from aegis.ingest import geocode, osm  # noqa: E402
from aegis.ingest.district import load_district  # noqa: E402

REPORT = "Cachar DDMA Cumulative Flood Report 01.05-30.11.2024 (relief camp opened)"
CAPACITY = {"hs": 350, "lp": 200}
CAPACITY_NOTE = "capacity estimated (2024 average: 34,027 people in 124 Silchar-circle camps)"
MATCH_THRESHOLD = 0.82
WORDS = {
    "govt": "government", "hs": "higher secondary", "h s": "higher secondary", "me": "middle english",
    "lps": "lp school", "pathshala": "pathsala", "bidyalaya": "vidyalaya", "balika": "girls",
}


def normalise(name: str) -> str:
    s = re.sub(r"[^a-z0-9 ]+", " ", name.lower())
    s = re.sub(r"\b\d+\s*(no)?\b", " ", s)  # school numbers such as "684 No"
    for short, full in WORDS.items():
        s = re.sub(rf"\b{short}\b", full, s)
    return re.sub(r"\s+", " ", s).strip()


# Words every school name shares; two names match only on the words that tell schools apart.
GENERIC = {"school", "high", "higher", "secondary", "government", "lp", "middle", "english", "model", "silchar"}


def similarity(a: str, b: str) -> float:
    ta = [w for w in normalise(a).split() if w not in GENERIC]
    tb = [w for w in normalise(b).split() if w not in GENERIC]
    if not ta or not tb:
        return 0.0
    return SequenceMatcher(None, " ".join(ta), " ".join(tb)).ratio()


def centre(e: dict) -> tuple[float, float] | None:
    p = e if "lat" in e else e.get("center")
    return (p["lat"], p["lon"]) if p else None


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--district", default="cachar")
    args = ap.parse_args()

    d = load_district(args.district)
    lon_min, lat_min, lon_max, lat_max = d.bbox
    inside = lambda lat, lon: lat_min <= lat <= lat_max and lon_min <= lon <= lon_max  # noqa: E731
    src = ROOT / "data" / "reference" / f"{d.id}_relief_camps_2024.csv"
    with src.open(encoding="utf-8") as fh:
        camps = list(csv.DictReader(ln for ln in fh if ln.strip() and not ln.startswith("#")))

    elements = osm.named_places(d.id, d.bbox).get("elements", [])
    buildings = [e for e in elements if "place" not in e.get("tags", {}) and e.get("tags", {}).get("name")]
    places = {normalise(e["tags"]["name"]): e for e in elements if "place" in e.get("tags", {})}

    rows, missing, used = [], [], set()
    for n, camp in enumerate(camps, start=1):
        name, locality, kind = camp["name"].strip(), camp["locality"].strip(), camp["kind"].strip()
        found, how = None, ""

        best = max(buildings, key=lambda e: similarity(name, e["tags"]["name"]), default=None)
        if best is not None and similarity(name, best["tags"]["name"]) >= MATCH_THRESHOLD and centre(best):
            found = centre(best)
            how = f"located: OpenStreetMap {best['type']}/{best['id']} \"{best['tags']['name']}\""
        if found is None:
            for hit in geocode.search(d.id, f"{name}, Silchar", d.bbox):
                if similarity(name, hit["name"].split(",")[0]) >= MATCH_THRESHOLD:
                    found, how = (hit["lat"], hit["lon"]), f"located: Nominatim {hit['osm']}"
                    break
        if found is None and locality:
            place = places.get(normalise(locality))
            if place and centre(place):
                found, how = centre(place), f"location approximate: centre of {locality} (OpenStreetMap)"
            else:
                hits = geocode.search(d.id, locality, d.bbox)
                if hits:
                    found = (hits[0]["lat"], hits[0]["lon"])
                    how = f"location approximate: centre of {locality} (Nominatim {hits[0]['osm']})"
        if found is not None and not inside(*found):
            found = None
        if found is None:
            missing.append(name)
        elif (key := (round(found[0], 4), round(found[1], 4), normalise(name))) in used:
            continue
        else:
            used.add(key)
        approx = how.startswith("location approximate")
        rows.append({
            "id": f"camp{n:02d}",
            "name": name,
            "lat": f"{found[0]:.6f}" if found else "",
            "lon": f"{found[1]:.6f}" if found else "",
            "capacity": CAPACITY[kind],
            "type": "relief_camp_approx" if approx else "relief_camp",
            "source": f"{REPORT}; {how or 'not on the map'}; {CAPACITY_NOTE}",
        })

    out = ROOT / "data" / "reference" / f"{d.id}_shelters.csv"
    with out.open("w", encoding="utf-8", newline="") as fh:
        fh.write(
            "# Relief camps the district actually opened in the 2024 floods (see "
            f"{src.name}), located by scripts/geocode_relief_camps.py.\n"
            "# Columns: id,name,lat,lon,capacity,type,source. Capacities are estimates.\n"
        )
        w = csv.DictWriter(fh, fieldnames=["id", "name", "lat", "lon", "capacity", "type", "source"])
        w.writeheader()
        w.writerows(rows)
    exact = sum(r["type"] == "relief_camp" and r["lat"] != "" for r in rows)
    approx = sum(r["type"] == "relief_camp_approx" for r in rows)
    print(f"{len(rows)} camps written to {out.relative_to(ROOT)}: {exact} at the building, {approx} at the neighbourhood centre")
    if missing:
        print(f"{len(missing)} not on the map (lat/lon left blank; the scenario builder places them on high ground): " + "; ".join(missing))


if __name__ == "__main__":
    main()
