"""Uncertainty Engine — which uncertain inputs actually matter?

Uses Pearson correlation between each condition variable and the outcome
metric across the Monte Carlo batch, as a fast, dependency-light stand-in
for a full Sobol sensitivity analysis. Documented as simplified: swap in
`SALib` for real Sobol indices once the demo needs the rigour (same
input/output shape, see `sobol_sensitivity` stub below).
"""

from __future__ import annotations

from dataclasses import dataclass
import numpy as np

from core.engine.montecarlo import MonteCarloBatch


@dataclass
class SensitivityResult:
    variable: str
    correlation: float  # Pearson r with the outcome metric, in [-1, 1]
    abs_importance: float  # |correlation|, for ranking


def sensitivity_analysis(batch: MonteCarloBatch, key: str) -> list[SensitivityResult]:
    """Rank condition variables by how strongly they correlate with the
    outcome metric. Returns results sorted by importance, descending —
    feed directly into a tornado chart.
    """
    if not batch.runs:
        return []

    field_names = batch.runs[0].conditions.field_names()
    vectors = np.array([r.conditions.as_vector() for r in batch.runs])
    outcomes = batch.metric_array(key)

    results = []
    for i, name in enumerate(field_names):
        col = vectors[:, i]
        if np.std(col) < 1e-9 or np.std(outcomes) < 1e-9:
            corr = 0.0
        else:
            corr = float(np.corrcoef(col, outcomes)[0, 1])
        results.append(SensitivityResult(variable=name, correlation=corr, abs_importance=abs(corr)))

    results.sort(key=lambda r: r.abs_importance, reverse=True)
    return results


def sobol_sensitivity(*args, **kwargs):
    """Placeholder for a real Sobol sensitivity analysis (via SALib).

    Swap this in once the uncertainty ranges are stable enough to justify
    the extra sampling cost (Sobol needs N*(2D+2) runs vs. this module's N).
    Not implemented yet — see README milestone 5.
    """
    raise NotImplementedError("Sobol sensitivity not implemented yet; use sensitivity_analysis().")
