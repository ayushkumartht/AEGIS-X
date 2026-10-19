"""Open-Meteo: rain and river-discharge ensembles, history, and point elevation.

All functions return plain Python structures (JSON-friendly) so they can be cached as JSON.
`members` arrays have shape (n_members, n_days).
"""

from __future__ import annotations

from datetime import timedelta

from aegis.ingest.cache import cached_json
from aegis.ingest.http import get_json

ENSEMBLE_URL = "https://ensemble-api.open-meteo.com/v1/ensemble"
FLOOD_URL = "https://flood-api.open-meteo.com/v1/flood"
ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
ELEVATION_URL = "https://api.open-meteo.com/v1/elevation"
FORECAST_MAX_AGE = timedelta(hours=6)
ELEVATION_BATCH = 100


def _members(daily: dict, prefix: str) -> list[list[float]]:
    keys = sorted(k for k in daily if k == prefix or k.startswith(prefix + "_member"))
    return [[0.0 if v is None else float(v) for v in daily[k]] for k in keys]


def rain_ensemble(district: str, point_id: str, lat: float, lon: float, days: int = 7, refresh: bool = False) -> dict:
    """Daily rainfall (mm) per ensemble member. {"dates": [...], "members": [[...], ...]}"""
    params = {"latitude": lat, "longitude": lon, "daily": "precipitation_sum", "models": "ecmwf_ifs025", "forecast_days": days}

    def fetch():
        daily = get_json(ENSEMBLE_URL, params)["daily"]
        return {"dates": daily["time"], "members": _members(daily, "precipitation_sum")}

    return cached_json(district, f"rain_ensemble_{point_id}", params, fetch, refresh=refresh, max_age=FORECAST_MAX_AGE)


def discharge_ensemble(district: str, point_id: str, lat: float, lon: float, days: int = 7, refresh: bool = False) -> dict:
    """Daily river discharge (m3/s) per GloFAS ensemble member."""
    params = {"latitude": lat, "longitude": lon, "daily": "river_discharge", "forecast_days": days, "ensemble": "true"}

    def fetch():
        daily = get_json(FLOOD_URL, params)["daily"]
        return {"dates": daily["time"], "members": _members(daily, "river_discharge")}

    return cached_json(district, f"discharge_ensemble_{point_id}", params, fetch, refresh=refresh, max_age=FORECAST_MAX_AGE)


def rain_history(district: str, point_id: str, lat: float, lon: float, start: str, end: str) -> dict:
    params = {"latitude": lat, "longitude": lon, "start_date": start, "end_date": end, "daily": "precipitation_sum"}

    def fetch():
        daily = get_json(ARCHIVE_URL, params)["daily"]
        return {"dates": daily["time"], "values": [0.0 if v is None else v for v in daily["precipitation_sum"]]}

    return cached_json(district, f"rain_history_{point_id}", params, fetch)


def discharge_history(district: str, point_id: str, lat: float, lon: float, start: str, end: str) -> dict:
    params = {"latitude": lat, "longitude": lon, "start_date": start, "end_date": end, "daily": "river_discharge"}

    def fetch():
        daily = get_json(FLOOD_URL, params)["daily"]
        return {"dates": daily["time"], "values": [0.0 if v is None else v for v in daily["river_discharge"]]}

    return cached_json(district, f"discharge_history_{point_id}", params, fetch)


def elevations(district: str, coords: list[tuple[float, float]]) -> list[float]:
    """Elevation in metres for (lat, lon) pairs, fetched in cached batches of 100."""
    out: list[float] = []
    for i in range(0, len(coords), ELEVATION_BATCH):
        batch = coords[i : i + ELEVATION_BATCH]
        params = {
            "latitude": ",".join(f"{lat:.5f}" for lat, _ in batch),
            "longitude": ",".join(f"{lon:.5f}" for _, lon in batch),
        }
        out += cached_json(district, "elevation", params, lambda p=params: get_json(ELEVATION_URL, p)["elevation"])
    return [float(v) for v in out]
