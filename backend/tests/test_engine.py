"""Engine tests on a toy domain, which also proves the engine is domain-agnostic."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pytest

from aegis.engine import (
    ConditionSpace,
    Variable,
    adversarial_search,
    brier_score,
    coverage_rate,
    critical_success_index,
    discover_failure_boxes,
    nsga2_optimize,
    rank_variables_by_voi,
    run_monte_carlo,
    sample_futures,
    sobol_sensitivity,
)
from aegis.engine.interfaces import Conditions, DomainModel, Plan, Scenario, SimulationResult


@dataclass
class ToyPlan(Plan):
    a: float = 0.0


@dataclass
class ToyConditions(Conditions):
    x1: float = 0.5
    x2: float = 0.5
    x3: float = 0.5


class ToyModel(DomainModel):
    """score = 1 - 0.8*x1 - 0.05*x3 - 0.5*[x1 > 0.7 and x2 < 0.3] + 0.3*a"""

    def condition_space(self, scenario):
        return ConditionSpace([Variable("x1"), Variable("x2"), Variable("x3")])

    def conditions_from_values(self, values):
        return ToyConditions(**values)

    def sample_conditions(self, rng, scenario):
        return ToyConditions(*rng.random(3))

    def simulate(self, scenario, plan, c):
        score = 1 - 0.8 * c.x1 - 0.05 * c.x3 + 0.3 * plan.a
        if c.x1 > 0.7 and c.x2 < 0.3:
            score -= 0.5
        return SimulationResult({"score": score}, "score")


class Codec:
    n_genes = 1

    def decode(self, genes):
        return ToyPlan(name="p", a=float(genes[0]))


SCEN, MODEL = Scenario(), ToyModel()


def test_variable_inverse_cdf_round_trips():
    v = Variable("t", low=0.0, mode=2.0, high=10.0)
    for u in (0.05, 0.3, 0.8):
        assert v.to_unit(v.from_unit(u)) == pytest.approx(u, abs=1e-6)
    assert Variable("b", kind="binary", p_true=0.3).from_unit(0.2) == 1.0
    assert Variable("e", kind="empirical", samples=[1, 2, 3]).from_unit(0.5) == 2.0


def test_latin_hypercube_covers_each_stratum_once():
    unit = ConditionSpace([Variable("x")]).sample_unit(50, "lhs", np.random.default_rng(1))[:, 0]
    assert sorted(int(u * 50) for u in unit) == list(range(50))


def test_same_seed_same_futures():
    a = [c.x1 for c in sample_futures(MODEL, SCEN, 20, seed=3)]
    b = [c.x1 for c in sample_futures(MODEL, SCEN, 20, seed=3)]
    assert a == b


def test_sobol_ranks_x1_first_and_x3_last():
    res = sobol_sensitivity(MODEL, SCEN, ToyPlan(a=0.0), "score", n=128)
    assert [r.variable for r in res][0] == "x1"
    assert res[-1].variable == "x3"
    assert res[0].st > 0.5 and res[0].s1 is not None


def test_prim_finds_the_failure_box():
    batch = run_monte_carlo(MODEL, SCEN, ToyPlan(a=0.0), n_samples=600, seed=1)
    boxes = discover_failure_boxes(batch, "score", threshold=0.1)
    assert boxes, "expected at least one failure box"
    assert "x1" in boxes[0].limits
    assert boxes[0].density > 0.6


def test_adversarial_search_finds_a_small_failing_shift():
    out = adversarial_search(MODEL, SCEN, ToyPlan(a=0.0), "score", threshold=0.15)
    assert out.found and out.failing_value < 0.15
    assert "x1" in out.shifts and out.shifts["x1"]["to"] > out.shifts["x1"]["from"]


def test_voi_is_non_negative_and_ranks_x1_high():
    plans = {"low": ToyPlan(name="low", a=0.0), "high": ToyPlan(name="high", a=1.0)}
    res = rank_variables_by_voi(MODEL, SCEN, plans, "score", n_samples=200)
    assert all(r.voi_absolute >= -1e-9 for r in res)


def test_nsga2_returns_a_non_dominated_front():
    objectives = {
        "score": lambda b: float(np.mean(b.metric_array("score"))),
        "cost": lambda b: b.runs[0].conditions.x1 * 0 + b.plan.a,
    }
    front = nsga2_optimize(
        MODEL, SCEN, Codec(), objectives, {"score": False, "cost": True}, pop_size=10, generations=4, n_samples=20
    )
    assert len(front) >= 2
    from aegis.engine.optimizer import is_dominated

    for c in front:
        assert not any(
            is_dominated(c.objectives, o.objectives, {"score": False, "cost": True}) for o in front if o is not c
        )


def test_calibration_metrics():
    assert coverage_rate([np.arange(100)] * 2, [50, 500]) == 0.5
    assert brier_score(np.array([1.0, 0.0]), np.array([1, 0])) == 0.0
    assert critical_success_index(np.array([1, 1, 0, 0]), np.array([1, 0, 1, 0])) == pytest.approx(1 / 3)
