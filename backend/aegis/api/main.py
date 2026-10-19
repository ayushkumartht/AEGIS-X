"""AEGIS-X API — thin HTTP layer over core/engine + domains/flood.

Run: uvicorn api.main:app --reload
Docs: http://127.0.0.1:8000/docs

Every endpoint builds a fresh demo flood scenario by default so the API
is runnable with zero setup; a real deployment would load Scenario/Plan
from a database or GIS import instead of generate_demo_scenario().
"""

from __future__ import annotations

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from aegis.engine.montecarlo import MonteCarloBatch, run_monte_carlo
from aegis.engine.compare import compare_plans, compare_summary
from aegis.engine.redteam import find_worst_case, find_single_points_of_failure
from aegis.engine.sensitivity import sensitivity_analysis
from aegis.domains.flood.demo import generate_demo_plan, generate_demo_scenario
from aegis.domains.flood.model import RAINFALL_TO_WATER_LEVEL, FloodModel
from aegis.domains.flood.types import FloodPlan
from aegis.api.explain import explain_redteam
from aegis.settings import get_settings

app = FastAPI(
    title="AEGIS-X",
    description="Test the decision before reality does.",
    version="0.1.0",
)

# Dev-only CORS: allows the Vite dev server (localhost:5173) to call this API.
# Tighten allow_origins before any real deployment.
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

_model = FloodModel()
_metric_key = "evacuated_pct"


class ConditionOverride(BaseModel):
    rainfall_mm: float | None = None
    resource_availability_pct: float | None = None
    comms_degradation_pct: float | None = None


class PlanOverride(BaseModel):
    boats_per_shelter: list[int] | None = None
    evacuation_priority: list[int] | None = None
    reinforced_cells: list[tuple[int, int]] | None = None


class MonteCarloRequest(BaseModel):
    n_samples: int = Field(default=500, ge=10, le=5000)
    seed: int | None = 42
    plan: PlanOverride | None = None
    # "Point conditions" mode: when set, samples are jittered +/-10% around
    # this point instead of drawn from the full prior uncertainty range.
    # Lets the live-demo sliders actually move the outcome distribution.
    point_conditions: ConditionOverride | None = None


def _build_plan(override: PlanOverride | None, scenario) -> FloodPlan:
    plan = generate_demo_plan(scenario)
    if override is None:
        return plan
    if override.boats_per_shelter is not None:
        plan.boats_per_shelter = override.boats_per_shelter
    if override.evacuation_priority is not None:
        plan.evacuation_priority = override.evacuation_priority
    if override.reinforced_cells is not None:
        plan.reinforced_cells = [tuple(c) for c in override.reinforced_cells]
    return plan


def _run_batch(req: MonteCarloRequest, scenario, plan) -> MonteCarloBatch:
    """Shared batch runner for /flood/monte-carlo and /flood/redteam.
    Uses point_conditions (jittered sampling) when provided, otherwise
    the model's normal full-prior Monte Carlo sampling.
    """
    if req.point_conditions is None:
        return run_monte_carlo(_model, scenario, plan, n_samples=req.n_samples, seed=req.seed)

    point = req.point_conditions.model_dump(exclude_none=True)
    rng = np.random.default_rng(req.seed)
    samples = [_model.sample_conditions_near(rng, point) for _ in range(req.n_samples)]
    return run_monte_carlo(
        _model, scenario, plan, n_samples=req.n_samples, conditions_override=samples
    )


@app.get("/")
def root():
    return {"name": "AEGIS-X", "tagline": "Test the decision before reality does."}


@app.get("/flood/demo-scenario")
def demo_scenario():
    scenario = generate_demo_scenario()
    return {
        "name": scenario.name,
        "grid_size": scenario.grid_size,
        "shelters": scenario.shelters,
        "bridges": scenario.bridges,
        "population_clusters": scenario.population_clusters,
        "elevation": scenario.elevation.tolist(),
        "roads": scenario.roads.tolist(),
    }


@app.post("/flood/flood-state")
def flood_state(conditions: ConditionOverride):
    """Per-cell flooded grid for a given rainfall value, so the frontend
    can paint the flood overlay without recomputing BFS client-side.
    """
    scenario = generate_demo_scenario()
    rainfall = conditions.rainfall_mm if conditions.rainfall_mm is not None else 100.0
    water_level = rainfall * RAINFALL_TO_WATER_LEVEL
    flooded = (scenario.elevation < water_level).tolist()
    return {"water_level_m": water_level, "flooded": flooded}


@app.post("/flood/monte-carlo")
def flood_monte_carlo(req: MonteCarloRequest):
    scenario = generate_demo_scenario()
    plan = _build_plan(req.plan, scenario)
    batch = _run_batch(req, scenario, plan)

    return {
        "plan": plan.name,
        "n_samples": req.n_samples,
        "summary": batch.summary(_metric_key),
        "resilience_worst_10pct": batch.resilience(_metric_key),
    }


@app.post("/flood/compare")
def flood_compare(plan_a: PlanOverride, plan_b: PlanOverride, n_samples: int = 500, seed: int = 42):
    scenario = generate_demo_scenario()
    plans = {
        "Plan A": _build_plan(plan_a, scenario),
        "Plan B": _build_plan(plan_b, scenario),
    }
    plans["Plan A"].name, plans["Plan B"].name = "Plan A", "Plan B"
    batches = compare_plans(_model, scenario, plans, _metric_key, n_samples=n_samples, seed=seed)
    return compare_summary(batches, _metric_key)


@app.post("/flood/redteam")
def flood_redteam(req: MonteCarloRequest):
    scenario = generate_demo_scenario()
    plan = _build_plan(req.plan, scenario)
    batch = _run_batch(req, scenario, plan)

    worst_cases = find_worst_case(batch, _metric_key, top_n=5)
    spofs = find_single_points_of_failure(_model, scenario, plan, _metric_key)
    sensitivity = sensitivity_analysis(batch, _metric_key)

    return {
        "plan": plan.name,
        "worst_case_futures": [vars(w) for w in worst_cases],
        "single_points_of_failure": [vars(s) for s in spofs],
        "sensitivity": [vars(s) for s in sensitivity],
    }


@app.post("/flood/explain")
def flood_explain(req: MonteCarloRequest):
    """Groq narrates the /flood/redteam findings in plain language.
    Per the "math decides, the LLM explains" rule, the LLM only receives
    already-computed numbers and never generates a finding itself.
    """
    redteam_result = flood_redteam(req)
    try:
        narration = explain_redteam(redteam_result)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    return {"narration": narration, "based_on": redteam_result}
