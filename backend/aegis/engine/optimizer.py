"""Multi-objective plan optimisation.

Full NSGA-II (via `pymoo`) is the obvious upgrade path, but it's a heavy
dependency for a prototype. This module implements the same core idea with
zero extra dependencies: random/guided search over a plan's parameter
space + Pareto-front extraction (non-dominated sorting). Swap
`random_search_optimize` for a pymoo-based optimizer later without
changing anything in core/engine that calls it — the return shape
(list of ParetoCandidate) stays the same.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable
import numpy as np

from aegis.engine.interfaces import DomainModel, Scenario, Plan
from aegis.engine.montecarlo import run_monte_carlo, sample_conditions_batch


@dataclass
class ParetoCandidate:
    plan: Plan
    objectives: dict[str, float]  # metric_name -> mean value across samples


def is_dominated(a: dict[str, float], b: dict[str, float], minimize: dict[str, bool]) -> bool:
    """True if candidate `b` dominates `a`: at least as good as `a` on
    every objective, and strictly better on at least one."""
    at_least_as_good = True
    strictly_better_on_one = False
    for key, should_minimize in minimize.items():
        av, bv = a[key], b[key]
        if should_minimize:
            if bv > av:
                at_least_as_good = False
            if bv < av:
                strictly_better_on_one = True
        else:
            if bv < av:
                at_least_as_good = False
            if bv > av:
                strictly_better_on_one = True
    return at_least_as_good and strictly_better_on_one


def pareto_front(
    candidates: list[ParetoCandidate], minimize: dict[str, bool]
) -> list[ParetoCandidate]:
    """Return the non-dominated subset of candidates — the actual
    risk/time/resource trade-off curve to show the human decision-maker."""
    front = []
    for i, cand in enumerate(candidates):
        dominated = any(
            is_dominated(cand.objectives, other.objectives, minimize)
            for j, other in enumerate(candidates)
            if j != i
        )
        if not dominated:
            front.append(cand)
    return front


def random_search_optimize(
    domain_model: DomainModel,
    scenario: Scenario,
    plan_sampler: Callable[[np.random.Generator], Plan],
    objective_keys: list[str],
    minimize: dict[str, bool],
    n_candidates: int = 50,
    n_samples_per_candidate: int = 30,
    seed: int | None = 42,
) -> list[ParetoCandidate]:
    """Randomly generate `n_candidates` plans (via `plan_sampler`),
    evaluate each under the SAME sampled futures, and return the
    Pareto-optimal subset across `objective_keys`.

    `plan_sampler(rng) -> Plan` should produce one randomly-parameterised
    plan per call (e.g. varying resource allocation, evacuation order,
    priority weights). This is intentionally domain-agnostic: the
    optimizer never needs to know what a "plan" contains.
    """
    rng = np.random.default_rng(seed)
    shared_conditions = sample_conditions_batch(
        domain_model, scenario, n_samples_per_candidate, seed
    )

    candidates: list[ParetoCandidate] = []
    for _ in range(n_candidates):
        plan = plan_sampler(rng)
        batch = run_monte_carlo(
            domain_model, scenario, plan,
            n_samples=n_samples_per_candidate,
            conditions_override=shared_conditions,
        )
        objectives = {key: float(np.mean(batch.metric_array(key))) for key in objective_keys}
        candidates.append(ParetoCandidate(plan=plan, objectives=objectives))

    return pareto_front(candidates, minimize)
