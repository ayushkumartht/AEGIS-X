"""District configuration, loaded from data/districts/<id>.yaml."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

import yaml

from aegis.exceptions import DataError
from aegis.settings import get_settings


@dataclass(frozen=True)
class ForecastPoint:
    id: str
    lat: float
    lon: float


@dataclass(frozen=True)
class StagingPoint:
    id: str
    name: str
    lat: float
    lon: float


@dataclass(frozen=True)
class DistrictConfig:
    id: str
    name: str
    bbox: tuple[float, float, float, float]  # lon_min, lat_min, lon_max, lat_max
    river_name: str
    population_total: int
    population_note: str
    forecast_points: tuple[ForecastPoint, ...]
    staging_points: tuple[StagingPoint, ...]
    shelters_csv: str
    events: tuple[dict, ...] = field(default_factory=tuple)
    boats: int = 12
    vehicles: int = 6
    resources_note: str = ""

    @property
    def lat_lon_center(self) -> tuple[float, float]:
        lon_min, lat_min, lon_max, lat_max = self.bbox
        return (lat_min + lat_max) / 2, (lon_min + lon_max) / 2


def districts_dir() -> Path:
    return get_settings().aegis_data_dir / "districts"


def list_districts() -> list[str]:
    return sorted(p.stem for p in districts_dir().glob("*.yaml"))


def load_district(district_id: str) -> DistrictConfig:
    path = districts_dir() / f"{district_id}.yaml"
    if not path.exists():
        raise DataError(f"Unknown district {district_id!r}. Available: {list_districts()}")
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    try:
        bbox = tuple(float(x) for x in raw["bbox"])
        if len(bbox) != 4 or bbox[0] >= bbox[2] or bbox[1] >= bbox[3]:
            raise ValueError("bbox must be [lon_min, lat_min, lon_max, lat_max]")
        return DistrictConfig(
            id=raw["id"],
            name=raw["name"],
            bbox=bbox,
            river_name=raw["river"]["name"],
            population_total=int(raw["population_total"]),
            population_note=raw.get("population_note", ""),
            forecast_points=tuple(ForecastPoint(**p) for p in raw["forecast_points"]),
            staging_points=tuple(StagingPoint(**p) for p in raw["staging_points"]),
            shelters_csv=raw.get("shelters_csv", ""),
            events=tuple(raw.get("events", [])),
            boats=int(raw.get("resources", {}).get("boats", 12)),
            vehicles=int(raw.get("resources", {}).get("vehicles", 6)),
            resources_note=raw.get("resources", {}).get("note", ""),
        )
    except (KeyError, TypeError, ValueError) as exc:
        raise DataError(f"Invalid district file {path.name}: {exc}") from exc
