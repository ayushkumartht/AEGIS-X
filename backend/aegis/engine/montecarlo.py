"""Generic Monte Carlo runner. Works for any domain that implements
DomainModel; this file never imports flood/fire/crowd code.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from aegis.engine.interfaces import Conditions, DomainModel, Plan, Scenario, SimulationResult
from aegis.engine.sampling import sample_futures


@dataclass
class MonteCarloRun:
    conditions: Conditions
    result: SimulationResult


@dataclass
class MonteCarloBatch:
    plan: Plan
    runs: list[MonteCarloRun]

    def metric_array(self, key: str) -> np.ndarray:
        return np.array([r.result.metrics[key] for r in self.runs], dtype=float)

    def summary(self, key: str) -> dict[str, float]:
        vals = self.metric_array(key)
        lower_is_worse = _lower_is_worse(self.runs, key)
        return {
            "mean": float(np.mean(vals)),
            "std": float(np.std(vals)),
            "p05": float(np.percentile(vals, 5)),
            "p10": float(np.percentile(vals, 10)),
            "p50": float(np.percentile(vals, 50)),
            "p90": float(np.percentile(vals, 90)),
            "p95": float(np.percentile(vals, 95)),
            "worst": float(np.min(vals)) if lower_is_worse else float(np.max(vals)),
            "best": float(np.max(vals)) if lower_is_worse else float(np.min(vals)),
        }

    def median(self, key: str) -> float:
        return float(np.median(self.metric_array(key)))

    def resilience(self, key: str, worst_fraction: float = 0.1) -> float:
        """Mean performance of the worst `worst_fraction` of runs (default: worst 10%).

        Low resilience means the plan looks fine on average but collapses in bad futures.
        """
        vals = np.sort(self.metric_array(key))
        n_worst = max(1, int(len(vals) * worst_fraction))
        worst = vals[:n_worst] if _lower_is_worse(self.runs, key) else vals[-n_worst:]
        return float(np.mean(worst))

    def histogram(self, key: str, bins: int = 20) -> dict[str, list[float]]:
        counts, edges = np.histogram(self.metric_array(key), bins=bins)
        return {"counts": counts.tolist(), "edges": edges.tolist()}


def _lower_is_worse(runs: list[MonteCarloRun], key: str) -> bool:
    """True when a LOWER value of `key` is the bad outcome."""
    if not runs:
        return False
    r = runs[0].result
    if key == r.success_metric:
        return r.success_metric_minimize is False
    return True  # default assumption for secondary metrics


def run_monte_carlo(
    domain_model: DomainModel,
    scenario: Scenario,
    plan: Plan,
    n_samples: int = 1000,
    seed: int | None = 42,
    conditions_override: list[Conditions] | None = None,
    method: str = "lhs",
) -> MonteCarloBatch:
    """Run `n_samples` simulations of `plan` against `scenario`.

    Pass `conditions_override` to replay an EXACT set of previously sampled futures, so that
    Plan A and Plan B are compared on identical futures (see compare.py).
    """
    if conditions_override is not None:
        samples = conditions_override
    else:
        samples = sample_futures(domain_model, scenario, n_samples, seed, method)
    runs = [
        MonteCarloRun(conditions=c, result=domain_model.simulate(scenario, plan, c)) for c in samples
    ]
    return MonteCarloBatch(plan=plan, runs=runs)


def sample_conditions_batch(
    domain_model: DomainModel,
    scenario: Scenario,
    n_samples: int,
    seed: int | None = 42,
    method: str = "lhs",
) -> list[Conditions]:
    """Pre-draw a fixed set of futures so several plans can be evaluated on the same ones."""
    return sample_futures(domain_model, scenario, n_samples, seed, method)
