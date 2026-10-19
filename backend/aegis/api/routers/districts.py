from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter

from aegis.api import context
from aegis.api.schemas import FloodStateRequest
from aegis.domains.flood.geojson import flood_state, scenario_layers, terrain_grid
from aegis.domains.flood.plans import baseline_plan, plan_to_dict
from aegis.exceptions import DataError, OfflineError
from aegis.fusion.beliefs import explain_beliefs
from aegis.ingest import osm
from aegis.ingest.district import load_district

router = APIRouter(tags=["districts"])


@router.get("/districts")
def list_districts():
    return context.available_districts()


@router.get("/districts/{district}/layers")
def layers(district: str):
    ctx = context.get_context(district)
    return scenario_layers(ctx.scenario)


@router.get("/districts/{district}/conditions")
def conditions(district: str):
    ctx = context.get_context(district)
    return {
        "forecast": ctx.forecast,
        "variables": [v.describe() for v in ctx.space.variables],
        "beliefs": ctx.beliefs,
        "resources": {
            "boats": ctx.scenario.metadata.get("boats_total"),
            "vehicles": ctx.scenario.metadata.get("vehicles_total"),
            "note": ctx.scenario.metadata.get("resources_note", ""),
        },
    }


@router.get("/districts/{district}/terrain")
def terrain(district: str):
    """Height grid for the 3D view (metres above the river's normal level)."""
    ctx = context.get_context(district)
    return terrain_grid(ctx.scenario)


@router.get("/districts/{district}/buildings")
def mapped_buildings(district: str):
    """Building footprints mapped in OpenStreetMap, from the cache filled by scripts/fetch_data.py.

    Never fetches on request (Overpass can take minutes); empty when not cached or synthetic.
    """
    if district == context.DEMO:
        return []
    cfg = load_district(district)
    if not osm.buildings_cached(cfg.id, cfg.bbox):
        return []
    try:
        return osm.buildings(cfg.id, cfg.bbox)
    except (DataError, OfflineError):
        return []


@router.get("/districts/{district}/baseline-plan")
def baseline(district: str):
    """The plan a district team would typically write: the starting point of the plan editor."""
    ctx = context.get_context(district)
    return plan_to_dict(baseline_plan(ctx.scenario))


@router.post("/districts/{district}/forecast/refresh")
def refresh_forecast(district: str):
    ctx = context.get_context(district, refresh=True)
    return {"forecast": ctx.forecast, "variables": [v.describe() for v in ctx.space.variables]}


@router.post("/districts/{district}/flood-state")
def state(district: str, body: FloodStateRequest):
    ctx = context.get_context(district)
    return flood_state(ctx.scenario, body.level_m, body.closed_bridges)


@router.get("/districts/{district}/scenario")
def scenario_summary(district: str):
    ctx = context.get_context(district)
    s = ctx.scenario
    return {
        "name": s.name,
        "metadata": s.metadata,
        "clusters": [asdict(c) for c in s.clusters],
        "shelters": [asdict(x) for x in s.shelters],
        "staging": [asdict(x) for x in s.staging],
        "bridges": [{"id": b, "name": s.bridge_names.get(b, b)} for b in s.bridges],
        "beliefs": explain_beliefs({}, s.bridge_names),
    }
