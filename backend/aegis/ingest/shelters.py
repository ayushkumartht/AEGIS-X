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
    lat: float
    lon: float
    capacity: int
    type: str
    source: str


def load_shelters(csv_path: str) -> list[ShelterRecord]:
    """Load shelters from a CSV with columns id,name,lat,lon,capacity,type,source.

    A missing path or a header-only file gives an empty list (the builder then derives
    candidates from OpenStreetMap). Bad rows raise DataError with the row number.
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
                lat=float(row["lat"]),
                lon=float(row["lon"]),
                capacity=int(row["capacity"]),
                type=row["type"].strip(),
                source=row["source"].strip(),
            )
        except (KeyError, ValueError, AttributeError) as exc:
            raise DataError(f"{path.name} row {n}: {exc}") from exc
        if rec.capacity <= 0 or not rec.id:
            raise DataError(f"{path.name} row {n}: id and positive capacity are required")
        rows.append(rec)
    return rows
