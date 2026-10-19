"""Compare multiple plans on the SAME sampled futures (fair comparison)."""

from __future__ import annotations

from aegis.engine.interfaces import DomainModel, Scenario, Plan
from aegis.engine.montecarlo import (
    MonteCarloBatch,
    run_monte_carlo,
    sample_conditions_batch,
)


def compare_plans(
    domain_model: DomainModel,
    scenario: Scenario,
    plans: dict[str, Plan],
    key: str,
    n_samples: int = 1000,
    seed: int | None = 42,
) -> dict[str, MonteCarloBatch]:
    """Run every plan against an identical set of sampled futures.

    Returns {plan_name: MonteCarloBatch}. Use batch.summary(key) and
    batch.resilience(key) on each to build the Plan A vs Plan B comparison
    (mean / worst-case / resilience) shown in the demo.
    """
    shared_conditions = sample_conditions_batch(domain_model, scenario, n_samples, seed)

    results: dict[str, MonteCarloBatch] = {}
    for name, plan in plans.items():
        results[name] = run_monte_carlo(
            domain_model,
            scenario,
            plan,
            n_samples=n_samples,
            conditions_override=shared_conditions,
        )
    return results


def compare_summary(
    batches: dict[str, MonteCarloBatch], key: str
) -> dict[str, dict[str, float]]:
    """Convenience: {plan_name: {mean, p10, p90, worst, resilience}}."""
    out: dict[str, dict[str, float]] = {}
    for name, batch in batches.items():
        s = batch.summary(key)
        s["resilience"] = batch.resilience(key)
        out[name] = s
    return out
