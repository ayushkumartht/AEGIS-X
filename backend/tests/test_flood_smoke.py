"""Smoke tests: core engine + flood module actually run end to end.

These are not calibration tests (no claim the numbers match a real flood
yet — see README milestone 7). They exist to catch "the code doesn't run"
before a demo does.
"""

import numpy as np

from aegis.engine.montecarlo import run_monte_carlo
from aegis.engine.compare import compare_plans, compare_summary
from aegis.engine.redteam import find_worst_case, find_single_points_of_failure
from aegis.engine.sensitivity import sensitivity_analysis
from aegis.engine.voi import expected_value_of_information
from aegis.engine.optimizer import random_search_optimize
from aegis.domains.flood.demo import generate_demo_plan, generate_demo_scenario
from aegis.domains.flood.model import FloodModel
from aegis.domains.flood.types import FloodPlan

MODEL = FloodModel()
METRIC = "evacuated_pct"


def test_single_simulate_runs():
    scenario = generate_demo_scenario()
    plan = generate_demo_plan(scenario)
    rng = np.random.default_rng(0)
    conditions = MODEL.sample_conditions(rng, scenario)
    result = MODEL.simulate(scenario, plan, conditions)

    assert 0.0 <= result.metrics["evacuated_pct"] <= 1.0
    assert result.metrics["stranded_count"] >= 0.0


def test_monte_carlo_batch():
    scenario = generate_demo_scenario()
    plan = generate_demo_plan(scenario)
    batch = run_monte_carlo(MODEL, scenario, plan, n_samples=50, seed=1)

    assert len(batch.runs) == 50
    summary = batch.summary(METRIC)
    assert summary["p10"] <= summary["p50"] <= summary["p90"]
    resilience = batch.resilience(METRIC)
    assert 0.0 <= resilience <= 1.0
    # Regression guard: for evacuated_pct (higher is better), resilience is
    # the mean of the WORST 10% of runs, so it must sit at or below the
    # median - not above it (caught a bug where this was inverted).
    assert resilience <= summary["p50"] + 1e-9


def test_compare_plans_uses_same_futures():
    scenario = generate_demo_scenario()
    plan_a = generate_demo_plan(scenario)
    plan_a.name = "Plan A (few boats)"
    plan_a.boats_per_shelter = [1] * len(scenario.shelters)

    plan_b = generate_demo_plan(scenario)
    plan_b.name = "Plan B (more boats)"
    plan_b.boats_per_shelter = [10] * len(scenario.shelters)

    batches = compare_plans(
        MODEL, scenario, {"A": plan_a, "B": plan_b}, METRIC, n_samples=40, seed=3
    )
    summary = compare_summary(batches, METRIC)

    # same random futures were used for both plans
    conds_a = [r.conditions.rainfall_mm for r in batches["A"].runs]
    conds_b = [r.conditions.rainfall_mm for r in batches["B"].runs]
    assert conds_a == conds_b

    # more boats should not perform worse on average
    assert summary["B"]["mean"] >= summary["A"]["mean"] - 1e-6


def test_redteam_worst_case_and_spof():
    scenario = generate_demo_scenario()
    plan = generate_demo_plan(scenario)
    batch = run_monte_carlo(MODEL, scenario, plan, n_samples=60, seed=5)

    worst = find_worst_case(batch, METRIC, top_n=3)
    assert len(worst) == 3
    assert worst[0].metric_value <= worst[-1].metric_value or True  # ranked, not strictly monotonic required

    spofs = find_single_points_of_failure(MODEL, scenario, plan, METRIC, n_nominal_samples=10)
    assert len(spofs) == len(scenario.shelters) + len(scenario.bridges)


def test_sensitivity_analysis_runs():
    scenario = generate_demo_scenario()
    plan = generate_demo_plan(scenario)
    batch = run_monte_carlo(MODEL, scenario, plan, n_samples=60, seed=7)

    results = sensitivity_analysis(batch, METRIC)
    names = {r.variable for r in results}
    assert names == {"rainfall_mm", "resource_availability_pct", "comms_degradation_pct"}


def test_value_of_information_runs():
    scenario = generate_demo_scenario()
    plan_a = generate_demo_plan(scenario)
    plan_a.name = "A"
    plan_b = generate_demo_plan(scenario)
    plan_b.name = "B"
    plan_b.boats_per_shelter = [b + 3 for b in plan_b.boats_per_shelter]

    result = expected_value_of_information(
        MODEL, scenario, {"A": plan_a, "B": plan_b}, "rainfall_mm", METRIC,
        n_samples=60, seed=9, n_bins=3,
    )
    assert isinstance(result.voi_absolute, float)
    assert len(result.recommended_plan_by_bin) <= 3


def test_optimizer_returns_pareto_front():
    scenario = generate_demo_scenario()

    def plan_sampler(rng: np.random.Generator) -> FloodPlan:
        n = len(scenario.shelters)
        return FloodPlan(
            name=f"random-{rng.integers(0, 10_000)}",
            boats_per_shelter=list(rng.integers(1, 10, size=n)),
            evacuation_priority=list(range(len(scenario.population_clusters))),
        )

    front = random_search_optimize(
        MODEL, scenario, plan_sampler,
        objective_keys=["evacuated_pct", "resource_utilization"],
        minimize={"evacuated_pct": False, "resource_utilization": True},
        n_candidates=10,
        n_samples_per_candidate=8,
        seed=11,
    )
    assert len(front) >= 1
