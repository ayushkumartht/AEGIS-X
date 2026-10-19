"""The analyses behind the endpoints. Routers stay thin; the WebSocket reuses these."""

from __future__ import annotations

from dataclasses import asdict

import numpy as np

from aegis.api.context import DistrictContext
from aegis.api.schemas import PlanModel, WhatIf
from aegis.domains.flood.checks import action_for
from aegis.domains.flood.evacuation import FALSE_ALARM_WEIGHT
from aegis.domains.flood.model import FloodModel
from aegis.domains.flood.plans import (
    FloodPlanCodec,
    baseline_plan,
    candidate_plans,
    plan_from_dict,
    plan_to_dict,
)
from aegis.domains.flood.types import FloodPlan
from aegis.domains.flood.uncertainty import apply_what_if
from aegis.engine import (
    adversarial_search,
    compare_plans,
    compare_summary,
    discover_failure_boxes,
    find_single_points_of_failure,
    find_worst_case,
    nsga2_optimize,
    rank_variables_by_voi,
    run_monte_carlo,
    sensitivity_analysis,
    sobol_sensitivity,
)
from aegis.engine.montecarlo import MonteCarloBatch

KEY = "evacuated_pct"
VOI_KEY = "decision_score"  # people evacuated, minus a penalty for moving people who did not need to
MEAN_METRICS = (
    "evacuated_pct",
    "people_at_risk_end",
    "unneeded_evacuations",
    "rescued_late",
    "shelter_overflow",
    "boat_utilisation",
    "avg_evac_time_h",
    "flooded_cluster_share",
    "peak_level_m",
)


def model_for(ctx: DistrictContext, what_if: WhatIf | None) -> FloodModel:
    """The district's model, with any "what if" variables fixed."""
    wi = what_if.as_dict() if what_if else None
    if not wi:
        return ctx.model
    return FloodModel(
        space=apply_what_if(ctx.model.condition_space(ctx.scenario), wi),
        base_stage_m=ctx.model.base_stage_m,
        tick_h=ctx.model.tick_h,
        horizon_h=ctx.model.horizon_h,
    )


def plan_of(ctx: DistrictContext, plan: PlanModel | None) -> FloodPlan:
    return plan_from_dict(ctx.scenario, plan.as_dict() if plan else None)


def _f(x) -> float:
    return float(np.asarray(x).item()) if np.isfinite(x) else 0.0


def _box(box) -> dict:
    """A failure box as JSON: unbounded limits become null."""
    out = asdict(box)
    out["limits"] = {k: [None if not np.isfinite(x) else float(x) for x in v] for k, v in box.limits.items()}
    return out


def batch_result(ctx: DistrictContext, plan: FloodPlan, batch: MonteCarloBatch) -> dict:
    """Everything the Results tab shows for one plan."""
    n_clusters = len(ctx.scenario.clusters)
    evac = np.mean([r.result.details["cluster_evacuated"] for r in batch.runs], axis=0) if n_clusters else []
    flooded = np.mean([r.result.details["cluster_flooded"] for r in batch.runs], axis=0) if n_clusters else []
    return {
        "plan": plan_to_dict(plan),
        "n_samples": len(batch.runs),
        "summary": {k: _f(v) for k, v in batch.summary(KEY).items()},
        "resilience_worst_10pct": _f(batch.resilience(KEY)),
        "histogram": batch.histogram(KEY),
        "metric_means": {k: _f(np.mean(batch.metric_array(k))) for k in MEAN_METRICS},
        "clusters": [
            {"id": c.id, "evacuated_share": _f(evac[i]), "flooded_probability": _f(flooded[i])}
            for i, c in enumerate(ctx.scenario.clusters)
        ],
    }


def simulate(ctx: DistrictContext, plan: FloodPlan, what_if, n: int, seed: int) -> dict:
    model = model_for(ctx, what_if)
    batch = run_monte_carlo(model, ctx.scenario, plan, n_samples=n, seed=seed)
    return batch_result(ctx, plan, batch)


def trace(ctx: DistrictContext, plan: FloodPlan, what_if, n: int, seed: int, pick: str) -> dict:
    """Pick one representative future (median or bad day) and return its hour-by-hour story."""
    model = model_for(ctx, what_if)
    batch = run_monte_carlo(model, ctx.scenario, plan, n_samples=n, seed=seed)
    values = batch.metric_array(KEY)
    target = np.percentile(values, 10 if pick == "bad_day" else 50)
    run = batch.runs[int(np.argmin(np.abs(values - target)))]
    story = model.trace(ctx.scenario, plan, run.conditions)
    story["pick"] = pick
    story["conditions"] = {name: run.conditions.get(name) for name in run.conditions.field_names()}
    story["boats_total"] = float(sum(plan.boats_at.values()))
    story["staging"] = {sp.id: plan.boats_at.get(sp.id, 0) for sp in ctx.scenario.staging}
    return story


def compare(ctx: DistrictContext, plans: dict[str, FloodPlan], what_if, n: int, seed: int) -> dict:
    model = model_for(ctx, what_if)
    batches = compare_plans(model, ctx.scenario, plans, KEY, n_samples=n, seed=seed)
    summary = compare_summary(batches, KEY)
    return {
        "plans": {
            name: {
                "plan": plan_to_dict(plans[name]),
                "summary": {k: _f(v) for k, v in summary[name].items()},
                "histogram": batches[name].histogram(KEY),
                "metric_means": {k: _f(np.mean(batches[name].metric_array(k))) for k in MEAN_METRICS},
            }
            for name in plans
        },
        "n_samples": n,
        "same_futures": True,
    }


def redteam(ctx: DistrictContext, plan: FloodPlan, what_if, n: int, seed: int, fail_below: float) -> dict:
    model = model_for(ctx, what_if)
    batch = run_monte_carlo(model, ctx.scenario, plan, n_samples=n, seed=seed)
    worst = find_worst_case(batch, KEY, top_n=5)
    spofs = find_single_points_of_failure(model, ctx.scenario, plan, KEY, n_nominal_samples=min(30, n))
    boxes = discover_failure_boxes(batch, KEY, fail_below)
    adversarial = adversarial_search(model, ctx.scenario, plan, KEY, fail_below)
    sens = sensitivity_analysis(batch, KEY)
    return {
        "plan": plan_to_dict(plan),
        "fail_below": fail_below,
        "failure_rate": _f(np.mean(batch.metric_array(KEY) < fail_below)),
        "worst_case_futures": [asdict(w) for w in worst],
        "single_points_of_failure": [asdict(s) for s in spofs if s.drop_pct > 0.05] or [asdict(s) for s in spofs[:3]],
        "failure_boxes": [_box(b) for b in boxes],
        "adversarial": asdict(adversarial),
        "sensitivity": [asdict(s) for s in sens],
    }


def sensitivity(ctx: DistrictContext, plan: FloodPlan, what_if, n: int, seed: int, method: str, sobol_n: int) -> dict:
    model = model_for(ctx, what_if)
    if method == "sobol":
        res = sobol_sensitivity(model, ctx.scenario, plan, KEY, n=sobol_n, seed=seed)
    else:
        res = sensitivity_analysis(run_monte_carlo(model, ctx.scenario, plan, n_samples=n, seed=seed), KEY)
    return {"method": method, "sensitivity": [asdict(s) for s in res]}


def voi(ctx: DistrictContext, plan: FloodPlan, what_if, n: int, seed: int) -> dict:
    model = model_for(ctx, what_if)
    plans = candidate_plans(ctx.scenario, plan)
    ranked = rank_variables_by_voi(model, ctx.scenario, plans, VOI_KEY, n_samples=n, seed=seed)
    return {
        "metric": VOI_KEY,
        "false_alarm_weight": FALSE_ALARM_WEIGHT,
        "candidate_plans": list(plans),
        "best_plan_now": ranked[0].best_plan_without_information if ranked else "",
        "check_next": [
            {
                "variable": r.variable,
                "action": action_for(r.variable, ctx.scenario),
                "voi_pct": _f(r.voi_pct),
                "voi_absolute": _f(r.voi_absolute),
                "baseline_value": _f(r.baseline_value),
                "adaptive_value": _f(r.adaptive_value),
                "best_plan_by_range": r.recommended_plan_by_bin,
            }
            for r in ranked
        ],
    }


def optimize(ctx: DistrictContext, what_if, n: int, pop: int, gens: int, seed: int) -> dict:
    model = model_for(ctx, what_if)
    codec = FloodPlanCodec(ctx.scenario)
    objectives = {
        "mean_evacuated": lambda b: float(np.mean(b.metric_array(KEY))),
        "worst10_evacuated": lambda b: float(b.resilience(KEY)),
        "boats_used": lambda b: float(b.runs[0].result.metrics["boats_used"]),
    }
    minimize = {"mean_evacuated": False, "worst10_evacuated": False, "boats_used": True}
    front = nsga2_optimize(model, ctx.scenario, codec, objectives, minimize, pop, gens, n, seed)
    base = baseline_plan(ctx.scenario)
    base_batch = run_monte_carlo(model, ctx.scenario, base, n_samples=n, seed=seed)
    options = []
    for cand in front:
        options.append({"plan": plan_to_dict(cand.plan), "objectives": {k: _f(v) for k, v in cand.objectives.items()}})
    options.sort(key=lambda o: -o["objectives"]["worst10_evacuated"])
    labelled = _label(options)
    return {
        "baseline": {"plan": plan_to_dict(base), "objectives": {
            "mean_evacuated": _f(np.mean(base_batch.metric_array(KEY))),
            "worst10_evacuated": _f(base_batch.resilience(KEY)),
            "boats_used": float(sum(base.boats_at.values())),
        }},
        "options": labelled,
        "n_samples": n,
    }


def _label(options: list[dict]) -> list[dict]:
    """Name up to three trade-off options: safest on a bad day, best on average, leanest."""
    if not options:
        return []
    picks = {
        "Safest on a bad day": max(options, key=lambda o: o["objectives"]["worst10_evacuated"]),
        "Best on average": max(options, key=lambda o: o["objectives"]["mean_evacuated"]),
        "Leanest (fewest boats)": min(options, key=lambda o: (o["objectives"]["boats_used"], -o["objectives"]["worst10_evacuated"])),
    }
    out, seen = [], set()
    for label, o in picks.items():
        key = id(o)
        if key in seen:
            continue
        seen.add(key)
        out.append({"label": label, **o})
    return out
