"""Uncertainty engine: which uncertain inputs actually matter?

Two methods:
- sensitivity_analysis(): fast, Pearson correlation of each input with the outcome across a
  Monte Carlo batch.
- sobol_sensitivity(): Sobol first-order (S1) and total-order (ST) indices with the Saltelli
  scheme and the Jansen estimators. It captures interactions (for example "rain only matters
  when the bridge is closed") but costs n * (dim + 2) simulations.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from aegis.engine.interfaces import ConditionSpace, DomainModel, Plan, Scenario
from aegis.engine.montecarlo import MonteCarloBatch


@dataclass
class SensitivityResult:
    variable: str
    correlation: float  # Pearson r with the outcome, in [-1, 1]
    abs_importance: float  # |correlation|, used for ranking
    s1: float | None = None  # Sobol first-order index
    st: float | None = None  # Sobol total-order index


def sensitivity_analysis(batch: MonteCarloBatch, key: str) -> list[SensitivityResult]:
    """Rank condition variables by correlation with the outcome (sorted, most important first)."""
    if not batch.runs:
        return []
    names = batch.runs[0].conditions.field_names()
    vectors = np.array([r.conditions.as_vector() for r in batch.runs])
    outcomes = batch.metric_array(key)

    results = []
    for i, name in enumerate(names):
        col = vectors[:, i]
        if np.std(col) < 1e-9 or np.std(outcomes) < 1e-9:
            corr = 0.0
        else:
            corr = float(np.corrcoef(col, outcomes)[0, 1])
        results.append(SensitivityResult(variable=name, correlation=corr, abs_importance=abs(corr)))
    results.sort(key=lambda r: r.abs_importance, reverse=True)
    return results


def sobol_sensitivity(
    model: DomainModel,
    scenario: Scenario,
    plan: Plan,
    key: str,
    n: int = 64,
    seed: int = 42,
) -> list[SensitivityResult]:
    """Sobol indices of `key` with respect to every variable of the model's ConditionSpace.

    Runs n * (dim + 2) simulations. Results are sorted by total-order index.
    """
    from scipy.stats import qmc

    space: ConditionSpace | None = model.condition_space(scenario)
    if space is None:
        raise ValueError("Sobol analysis needs a model that provides a ConditionSpace.")
    d = space.dim

    base = qmc.Sobol(d=2 * d, scramble=True, seed=seed).random(n)
    a, b = base[:, :d], base[:, d:]

    def evaluate(matrix: np.ndarray) -> np.ndarray:
        out = np.empty(len(matrix))
        for i, row in enumerate(matrix):
            cond = model.conditions_from_values(space.values_from_unit(row))
            out[i] = model.simulate(scenario, plan, cond).metrics[key]
        return out

    fa, fb = evaluate(a), evaluate(b)
    var = float(np.var(np.concatenate([fa, fb])))
    results = []
    for i, name in enumerate(space.names):
        ab = a.copy()
        ab[:, i] = b[:, i]
        fab = evaluate(ab)
        if var < 1e-12:
            s1 = st = 0.0
        else:
            s1 = float(1.0 - np.mean((fb - fab) ** 2) / (2 * var))
            st = float(np.mean((fa - fab) ** 2) / (2 * var))
        s1, st = float(np.clip(s1, -0.2, 1.0)), float(np.clip(st, 0.0, 1.5))
        results.append(SensitivityResult(variable=name, correlation=0.0, abs_importance=st, s1=s1, st=st))
    results.sort(key=lambda r: r.abs_importance, reverse=True)
    return results
