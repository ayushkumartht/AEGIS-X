"""Calibration: how good were the predicted ranges and the predicted flooded areas?"""

from __future__ import annotations

import numpy as np


def interval_coverage(samples: np.ndarray, actual: float, lower: float = 10, upper: float = 90) -> bool:
    """True when `actual` lies inside the [lower, upper] percentile interval of `samples`."""
    lo, hi = np.percentile(samples, [lower, upper])
    return bool(lo <= actual <= hi)


def coverage_rate(sample_sets: list[np.ndarray], actuals: list[float], lower: float = 10, upper: float = 90) -> float:
    """Share of cases whose actual value fell inside the predicted interval.

    A well calibrated 10-90 interval covers about 80% of cases.
    """
    if not sample_sets:
        return 0.0
    hits = [interval_coverage(s, a, lower, upper) for s, a in zip(sample_sets, actuals, strict=True)]
    return float(np.mean(hits))


def brier_score(probabilities: np.ndarray, outcomes: np.ndarray) -> float:
    """Mean squared error between predicted probabilities and 0/1 outcomes (lower is better)."""
    p = np.asarray(probabilities, dtype=float)
    o = np.asarray(outcomes, dtype=float)
    return float(np.mean((p - o) ** 2))


def critical_success_index(predicted: np.ndarray, observed: np.ndarray) -> float:
    """Overlap score of two boolean masks: hits / (hits + misses + false alarms), in [0, 1]."""
    p = np.asarray(predicted, dtype=bool)
    o = np.asarray(observed, dtype=bool)
    union = np.logical_or(p, o).sum()
    return float(np.logical_and(p, o).sum() / union) if union else 1.0
