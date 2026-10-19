"""Active intelligence: "what should we go and check first?"

Expected Value of Information (EVPI-style), a standard decision-analysis technique.

Right now we must pick ONE plan without knowing the true value of some uncertain variable
(for example "is the bridge passable?"). If we could learn that variable before deciding, we
could pick the best plan for its actual value. The expected improvement from that is the value
of resolving the uncertainty, that is, of sending someone to check it:

    VOI(variable) = E[best plan performance | variable known]
                  - best single-plan performance (variable unknown)
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from aegis.engine.interfaces import Conditions, DomainModel, Plan, Scenario
from aegis.engine.montecarlo import sample_conditions_batch


@dataclass
class VOIResult:
    variable: str
    baseline_value: float  # best outcome achievable with no extra information
    adaptive_value: float  # best outcome achievable if the variable is known
    voi_absolute: float
    voi_pct: float
    recommended_plan_by_bin: list[tuple[str, str]]  # (bin label, best plan name)
    best_plan_without_information: str = ""


def _outcomes(
    model: DomainModel,
    scenario: Scenario,
    plans: dict[str, Plan],
    key: str,
    conditions: list[Conditions],
) -> tuple[dict[str, np.ndarray], bool]:
    """Metric `key` per plan on shared futures, and whether the metric is minimised."""
    out: dict[str, np.ndarray] = {}
    minimize = False
    for name, plan in plans.items():
        vals = np.empty(len(conditions))
        for i, cond in enumerate(conditions):
            res = model.simulate(scenario, plan, cond)
            vals[i] = res.metrics[key]
            minimize = res.success_metric_minimize
        out[name] = vals
    return out, minimize


def _voi_for_variable(
    variable: str,
    outcomes: dict[str, np.ndarray],
    minimize: bool,
    conditions: list[Conditions],
    n_bins: int,
) -> VOIResult:
    names = list(outcomes)
    n = len(conditions)

    def best_mean(idx: np.ndarray) -> tuple[float, str]:
        means = {name: float(np.mean(outcomes[name][idx])) for name in names}
        pick = min(means, key=means.get) if minimize else max(means, key=means.get)
        return means[pick], pick

    baseline, baseline_plan = best_mean(np.arange(n))
    values = np.array([c.get(variable) for c in conditions], dtype=float)
    unique = np.unique(values)
    if len(unique) <= n_bins:  # binary or few-valued variable: one bin per value
        edges = [(v - 1e-9, v + 1e-9) for v in unique]
    else:
        q = np.quantile(values, np.linspace(0, 1, n_bins + 1))
        q[0] -= 1e-9  # make the first edge inclusive
        edges = [(q[b], q[b + 1]) for b in range(n_bins)]

    adaptive, weights, recommended = [], [], []
    for lo, hi in edges:
        idx = np.where((values > lo) & (values <= hi))[0]
        if len(idx) == 0:
            continue
        value, plan_name = best_mean(idx)
        adaptive.append(value)
        weights.append(len(idx))
        recommended.append((f"{variable} in ({lo:.2f}, {hi:.2f}]", plan_name))

    adaptive_value = float(np.average(adaptive, weights=weights))
    gain = (baseline - adaptive_value) if minimize else (adaptive_value - baseline)
    pct = (gain / abs(baseline) * 100) if baseline else 0.0
    return VOIResult(variable, baseline, adaptive_value, gain, pct, recommended, baseline_plan)


def expected_value_of_information(
    domain_model: DomainModel,
    scenario: Scenario,
    plans: dict[str, Plan],
    variable: str,
    key: str,
    n_samples: int = 500,
    seed: int | None = 42,
    n_bins: int = 4,
) -> VOIResult:
    if len(plans) < 2:
        raise ValueError("Need at least 2 candidate plans to compute value of information.")
    conditions = sample_conditions_batch(domain_model, scenario, n_samples, seed)
    if variable not in conditions[0].field_names():
        raise ValueError(f"'{variable}' is not a numeric field on this domain's Conditions")
    outcomes, minimize = _outcomes(domain_model, scenario, plans, key, conditions)
    return _voi_for_variable(variable, outcomes, minimize, conditions, n_bins)


def rank_variables_by_voi(
    domain_model: DomainModel,
    scenario: Scenario,
    plans: dict[str, Plan],
    key: str,
    n_samples: int = 500,
    seed: int | None = 42,
    n_bins: int = 4,
) -> list[VOIResult]:
    """VOI of every condition variable, highest first. Simulations are run once and shared."""
    if len(plans) < 2:
        raise ValueError("Need at least 2 candidate plans to compute value of information.")
    conditions = sample_conditions_batch(domain_model, scenario, n_samples, seed)
    outcomes, minimize = _outcomes(domain_model, scenario, plans, key, conditions)
    results = [
        _voi_for_variable(name, outcomes, minimize, conditions, n_bins)
        for name in conditions[0].field_names()
    ]
    results.sort(key=lambda r: r.voi_absolute, reverse=True)
    return results
