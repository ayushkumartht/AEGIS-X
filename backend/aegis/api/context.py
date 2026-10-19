"""Per-district working state: scenario, current forecast ranges, field-report beliefs, model."""

from __future__ import annotations

import threading
from dataclasses import dataclass, field

from aegis.domains.flood.demo import generate_demo_scenario
from aegis.domains.flood.hydrology import load_rating
from aegis.domains.flood.model import FloodModel
from aegis.domains.flood.serialize import load_scenario
from aegis.domains.flood.types import FloodScenario
from aegis.domains.flood.uncertainty import forecast_space, prior_space
from aegis.engine.interfaces import ConditionSpace
from aegis.exceptions import DataError, OfflineError
from aegis.fusion.beliefs import compute_overrides, explain_beliefs
from aegis.fusion.reports import FieldReport, ParsedReport
from aegis.ingest import open_meteo
from aegis.ingest.district import list_districts, load_district
from aegis.settings import get_settings
from aegis.storage import repo

DEMO = "demo"
_lock = threading.Lock()
_contexts: dict[str, DistrictContext] = {}
_scenarios: dict[str, FloodScenario] = {}


@dataclass
class DistrictContext:
    district: str
    scenario: FloodScenario
    space: ConditionSpace
    model: FloodModel
    forecast: dict = field(default_factory=dict)
    beliefs: list[dict] = field(default_factory=list)


def scenario_path(district: str):
    return get_settings().aegis_data_dir / "processed" / district / "scenario.json"


def available_districts() -> list[dict]:
    out = [{"id": DEMO, "name": "Synthetic demo district", "built": True, "synthetic": True}]
    for d in list_districts():
        cfg = load_district(d)
        out.append({"id": d, "name": cfg.name, "built": scenario_path(d).exists(), "synthetic": False})
    return out


def _scenario(district: str) -> FloodScenario:
    if district not in _scenarios:
        if district == DEMO:
            _scenarios[district] = generate_demo_scenario()
        else:
            path = scenario_path(district)
            if not path.exists():
                raise DataError(
                    f"District {district!r} has no built scenario. Run scripts/fetch_data.py and "
                    f"scripts/build_scenario.py --district {district}."
                )
            _scenarios[district] = load_scenario(path)
    return _scenarios[district]


def _field_reports(district: str) -> list[FieldReport]:
    out = []
    for r in repo.list_reports(district):
        parsed = ParsedReport(**{k: v for k, v in r["parsed"].items() if k in ParsedReport.__dataclass_fields__})
        out.append(FieldReport(r["id"], r["received_at"], r["source_type"], r["raw_text"], parsed))
    return out


def _build(district: str, refresh: bool) -> DistrictContext:
    scenario = _scenario(district)
    overrides = compute_overrides(
        _field_reports(district), scenario.bridge_names, int(scenario.metadata.get("boats_total", 12))
    )
    beliefs = explain_beliefs(overrides, scenario.bridge_names)

    if district == DEMO:
        space = prior_space(scenario, overrides=overrides)
        forecast = {"source": "synthetic priors", "forecast_date": None}
        return DistrictContext(district, scenario, space, FloodModel(space=space), forecast, beliefs)

    cfg = load_district(district)
    point = cfg.forecast_points[0]
    rating = load_rating(get_settings().aegis_data_dir / "reference" / f"calibration_{district}.json")
    try:
        rain = open_meteo.rain_ensemble(district, point.id, point.lat, point.lon, refresh=refresh)
        flow = open_meteo.discharge_ensemble(district, point.id, point.lat, point.lon, refresh=refresh)
        space, base, meta = forecast_space(scenario, rain, flow, rating, overrides)
        meta["source"] = "live forecast ensembles"
    except (DataError, OfflineError) as exc:
        space, base = prior_space(scenario, overrides=overrides), 0.3
        meta = {"source": "priors only: no forecast available", "forecast_date": None, "warning": str(exc)}
    meta["rating"] = rating.to_dict()
    return DistrictContext(district, scenario, space, FloodModel(space=space, base_stage_m=base), meta, beliefs)


def get_context(district: str, refresh: bool = False) -> DistrictContext:
    with _lock:
        if refresh or district not in _contexts:
            _contexts[district] = _build(district, refresh)
        return _contexts[district]


def invalidate(district: str) -> None:
    with _lock:
        _contexts.pop(district, None)


def reset() -> None:
    """Forget everything (tests)."""
    with _lock:
        _contexts.clear()
        _scenarios.clear()
