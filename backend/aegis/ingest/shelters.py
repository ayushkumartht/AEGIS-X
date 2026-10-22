"""Hand-made shelter list (from the district disaster management plan), validated."""

from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path

from aegis.exceptions import DataError
from aegis.settings import REPO_ROOT


@dataclass(frozen=True)
class ShelterRecord:
    id: str
    name: str
    lat: float | None  # None: a real shelter whose position is not known (the builder places it)
    lon: float | None
    capacity: int
    type: str
    source: str


def _coord(text: str | None) -> float | None:
    text = (text or "").strip()
    return float(text) if text else None


def load_shelters(csv_path: str) -> list[ShelterRecord]:
    """Load shelters from a CSV with columns id,name,lat,lon,capacity,type,source.

    A missing path or a header-only file gives an empty list (the builder then derives
    candidates from OpenStreetMap). lat and lon may both be blank for a shelter that is known
    to exist but is not on the map. Bad rows raise DataError with the row number.
    """
    if not csv_path:
        return []
    path = Path(csv_path)
    if not path.is_absolute():
        path = REPO_ROOT / path
    if not path.exists():
        return []
    rows = []
    with path.open(encoding="utf-8", newline="") as fh:
        lines = [ln for ln in fh if ln.strip() and not ln.lstrip().startswith("#")]
    for n, row in enumerate(csv.DictReader(lines), start=2):
        try:
            rec = ShelterRecord(
                id=row["id"].strip(),
                name=row["name"].strip(),
                lat=_coord(row["lat"]),
                lon=_coord(row["lon"]),
                capacity=int(row["capacity"]),
                type=row["type"].strip(),
                source=row["source"].strip(),
            )
        except (KeyError, ValueError, AttributeError) as exc:
            raise DataError(f"{path.name} row {n}: {exc}") from exc
        if rec.capacity <= 0 or not rec.id:
            raise DataError(f"{path.name} row {n}: id and positive capacity are required")
        if (rec.lat is None) != (rec.lon is None):
            raise DataError(f"{path.name} row {n}: give both lat and lon, or leave both blank")
        rows.append(rec)
    return rows
