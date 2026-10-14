"""Active Intelligence — "what should we go check?"

Implements a simplified Expected Value of Information (EVPI-style)
calculation: a classic decision-analysis technique, not a heuristic.

Idea: right now we pick ONE plan without knowing the true value of some
uncertain variable (e.g. "is Bridge B passable?"). If we could learn that
variable's value before deciding, we could switch to whichever candidate
plan performs best for that specific value. The expected improvement from
being able to do that IS the value of resolving that uncertainty — i.e.
the value of sending a drone/scout/sensor to go check it.

    VOI(variable) = E[best plan performance | variable known]
                  - best single-plan performance (variable unknown)

A variable with high VOI is exactly the "most valuable next piece of
information" the system should recommend gathering.
"""

from __future__ import annotations

from dataclasses import dataclass
import numpy as np

from core.engine.interfaces import DomainModel, Scenario, Plan, Conditions
from core.engine.montecarlo import sample_conditions_batch


@dataclass
class VOIResult:
    variable: str
    baseline_value: float  # best outcome achievable with no extra info
    adaptive_value: float  # best outcome achievable if variable is known
    voi_absolute: float
    voi_pct: float
    recommended_plan_by_bin: list[tuple[str, str]]  # (bin_label, best_plan_name)


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
        raise ValueError("Need at least 2 candidate plans to compute value of information "
                          "(otherwise there is nothing to switch to).")

    shared_conditions = sample_conditions_batch(domain_model, scenario, n_samples, seed)

    if variable not in shared_conditions[0].field_names():
        raise ValueError(f"'{variable}' is not a numeric field on this domain's Conditions")

    plan_names = list(plans.keys())
    # outcomes[plan_name] = np.ndarray of shape (n_samples,)
    outcomes: dict[str, np.ndarray] = {}
    minimize = None
    for name, plan in plans.items():
        vals = np.empty(n_samples)
        for i, cond in enumerate(shared_conditions):
            res = domain_model.simulate(scenario, plan, cond)
            vals[i] = res.metrics[key]
            if minimize is None:
                minimize = res.success_metric_minimize
        outcomes[name] = vals

    def best_mean(indices: np.ndarray) -> tuple[float, str]:
        best_val, best_name = None, None
        for name in plan_names:
            m = float(np.mean(outcomes[name][indices])) if len(indices) else float("nan")
            if best_val is None or (m < best_val if minimize else m > best_val):
                best_val, best_name = m, name
        return best_val, best_name

    all_idx = np.arange(n_samples)
    baseline_value, _ = best_mean(all_idx)

    var_values = np.array([getattr(c, variable) for c in shared_conditions], dtype=float)
    quantiles = np.quantile(var_values, np.linspace(0, 1, n_bins + 1))
    quantiles[0] -= 1e-9  # make first edge inclusive

    adaptive_values = []
    weights = []
    recommended: list[tuple[str, str]] = []
    for b in range(n_bins):
        lo, hi = quantiles[b], quantiles[b + 1]
        idx = np.where((var_values > lo) & (var_values <= hi))[0]
        if len(idx) == 0:
            continue
        bin_best_value, bin_best_plan = best_mean(idx)
        adaptive_values.append(bin_best_value)
        weights.append(len(idx))
        recommended.append((f"{variable} in ({lo:.2f}, {hi:.2f}]", bin_best_plan))

    adaptive_value = float(np.average(adaptive_values, weights=weights))
    voi_absolute = (
        (baseline_value - adaptive_value) if minimize else (adaptive_value - baseline_value)
    )
    voi_pct = (voi_absolute / abs(baseline_value) * 100) if baseline_value else 0.0

    return VOIResult(
        variable=variable,
        baseline_value=baseline_value,
        adaptive_value=adaptive_value,
        voi_absolute=voi_absolute,
        voi_pct=voi_pct,
        recommended_plan_by_bin=recommended,
    )


def rank_variables_by_voi(
    domain_model: DomainModel,
    scenario: Scenario,
    plans: dict[str, Plan],
    key: str,
    n_samples: int = 500,
    seed: int | None = 42,
    n_bins: int = 4,
) -> list[VOIResult]:
    """Run expected_value_of_information for every numeric condition
    variable and return results sorted by VOI, descending — this is the
    "most valuable next piece of information" ranking for the demo.
    """
    sample_cond = sample_conditions_batch(domain_model, scenario, 1, seed)[0]
    results = []
    for variable in sample_cond.field_names():
        try:
            results.append(
                expected_value_of_information(
                    domain_model, scenario, plans, variable, key, n_samples, seed, n_bins
                )
            )
        except ValueError:
            continue
    results.sort(key=lambda r: r.voi_absolute, reverse=True)
    return results
