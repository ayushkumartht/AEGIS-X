"""Generic Monte Carlo runner. Works for any domain that implements
DomainModel — this file never imports flood/fire/crowd code.
"""

from __future__ import annotations

from dataclasses import dataclass
import numpy as np

from core.engine.interfaces import DomainModel, Scenario, Plan, Conditions, SimulationResult


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
        return {
            "mean": float(np.mean(vals)),
            "std": float(np.std(vals)),
            "p10": float(np.percentile(vals, 10)),
            "p50": float(np.percentile(vals, 50)),
            "p90": float(np.percentile(vals, 90)),
            "worst": float(np.min(vals)) if _lower_is_worse(self.runs, key) else float(np.max(vals)),
            "best": float(np.max(vals)) if _lower_is_worse(self.runs, key) else float(np.min(vals)),
        }

    def resilience(self, key: str, worst_fraction: float = 0.1) -> float:
        """Resilience = mean performance of the worst `worst_fraction` of
        runs (e.g. worst 10%). Low resilience = plan looks fine on average
        but collapses in bad futures — this is the number that should
        distinguish a "robust" plan from a merely "optimal-on-average" one.
        """
        vals = self.metric_array(key)
        lower_is_worse = _lower_is_worse(self.runs, key)
        n_worst = max(1, int(len(vals) * worst_fraction))
        sorted_vals = np.sort(vals)
        if lower_is_worse:
            worst = sorted_vals[:n_worst]  # lowest values are worst
        else:
            worst = sorted_vals[-n_worst:]  # highest values are worst
        return float(np.mean(worst))


def _lower_is_worse(runs: list[MonteCarloRun], key: str) -> bool:
    """True if, for this metric, a LOWER value is the bad outcome
    (i.e. success_metric_minimize is False and key == success_metric),
    or the metric is the minimize-type success metric (higher = worse)."""
    if not runs:
        return False
    r = runs[0].result
    if key == r.success_metric:
        return r.success_metric_minimize is False
    return True  # default assumption for arbitrary secondary metrics


def run_monte_carlo(
    domain_model: DomainModel,
    scenario: Scenario,
    plan: Plan,
    n_samples: int = 1000,
    seed: int | None = 42,
    conditions_override: list[Conditions] | None = None,
) -> MonteCarloBatch:
    """Run `n_samples` simulations of `plan` against `scenario`.

    Pass `conditions_override` to replay an EXACT set of previously-sampled
    futures (e.g. so Plan A and Plan B are compared on the identical
    scenarios rather than independently-sampled ones — see compare.py).
    """
    rng = np.random.default_rng(seed)
    runs: list[MonteCarloRun] = []

    if conditions_override is not None:
        samples = conditions_override
    else:
        samples = [domain_model.sample_conditions(rng, scenario) for _ in range(n_samples)]

    for cond in samples:
        result = domain_model.simulate(scenario, plan, cond)
        runs.append(MonteCarloRun(conditions=cond, result=result))

    return MonteCarloBatch(plan=plan, runs=runs)


def sample_conditions_batch(
    domain_model: DomainModel,
    scenario: Scenario,
    n_samples: int,
    seed: int | None = 42,
) -> list[Conditions]:
    """Pre-draw a fixed set of condition samples, so multiple plans can be
    evaluated against the exact same futures (fair comparison)."""
    rng = np.random.default_rng(seed)
    return [domain_model.sample_conditions(rng, scenario) for _ in range(n_samples)]
