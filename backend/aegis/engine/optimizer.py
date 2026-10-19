"""Multi-objective plan optimisation.

- random_search_optimize(): random plans, Pareto filter.
- nsga2_optimize(): NSGA-II (fast non-dominated sorting, crowding distance, SBX-style blend
  crossover, polynomial-style mutation) over a plan encoded as a vector in [0, 1]^n.

Both evaluate every candidate on the SAME futures, so differences come from the plan.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Protocol

import numpy as np

from aegis.engine.interfaces import DomainModel, Plan, Scenario
from aegis.engine.montecarlo import MonteCarloBatch, run_monte_carlo, sample_conditions_batch


@dataclass
class ParetoCandidate:
    plan: Plan
    objectives: dict[str, float]  # objective name -> value


class PlanCodec(Protocol):
    """Maps a gene vector in [0, 1]^n_genes to a domain Plan."""

    n_genes: int

    def decode(self, genes: np.ndarray) -> Plan: ...


def is_dominated(a: dict[str, float], b: dict[str, float], minimize: dict[str, bool]) -> bool:
    """True if `b` dominates `a`: at least as good everywhere, strictly better somewhere."""
    at_least_as_good = True
    strictly_better = False
    for key, should_minimize in minimize.items():
        av, bv = a[key], b[key]
        if should_minimize:
            at_least_as_good &= bv <= av
            strictly_better |= bv < av
        else:
            at_least_as_good &= bv >= av
            strictly_better |= bv > av
    return at_least_as_good and strictly_better


def pareto_front(candidates: list[ParetoCandidate], minimize: dict[str, bool]) -> list[ParetoCandidate]:
    """The non-dominated subset: the real trade-off curve to show the decision-maker."""
    return [
        c
        for i, c in enumerate(candidates)
        if not any(is_dominated(c.objectives, o.objectives, minimize) for j, o in enumerate(candidates) if j != i)
    ]


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
    """Random plans from `plan_sampler`, evaluated on shared futures, Pareto-filtered."""
    rng = np.random.default_rng(seed)
    futures = sample_conditions_batch(domain_model, scenario, n_samples_per_candidate, seed)
    candidates = []
    for _ in range(n_candidates):
        plan = plan_sampler(rng)
        batch = run_monte_carlo(domain_model, scenario, plan, conditions_override=futures)
        candidates.append(
            ParetoCandidate(plan, {k: float(np.mean(batch.metric_array(k))) for k in objective_keys})
        )
    return pareto_front(candidates, minimize)


def _fast_non_dominated_sort(objs: np.ndarray) -> list[list[int]]:
    """Fronts of indices; `objs` is (n, m) with every column already 'lower is better'."""
    n = len(objs)
    dominated_by: list[list[int]] = [[] for _ in range(n)]
    count = np.zeros(n, dtype=int)
    for i in range(n):
        for j in range(n):
            if i == j:
                continue
            if np.all(objs[i] <= objs[j]) and np.any(objs[i] < objs[j]):
                dominated_by[i].append(j)
            elif np.all(objs[j] <= objs[i]) and np.any(objs[j] < objs[i]):
                count[i] += 1
    fronts: list[list[int]] = [[i for i in range(n) if count[i] == 0]]
    while fronts[-1]:
        nxt = []
        for i in fronts[-1]:
            for j in dominated_by[i]:
                count[j] -= 1
                if count[j] == 0:
                    nxt.append(j)
        fronts.append(nxt)
    return fronts[:-1]


def _crowding(objs: np.ndarray, front: list[int]) -> dict[int, float]:
    dist = {i: 0.0 for i in front}
    for m in range(objs.shape[1]):
        ordered = sorted(front, key=lambda i: objs[i, m])
        dist[ordered[0]] = dist[ordered[-1]] = np.inf
        span = objs[ordered[-1], m] - objs[ordered[0], m]
        if span <= 0:
            continue
        for k in range(1, len(ordered) - 1):
            dist[ordered[k]] += (objs[ordered[k + 1], m] - objs[ordered[k - 1], m]) / span
    return dist


def nsga2_optimize(
    domain_model: DomainModel,
    scenario: Scenario,
    codec: PlanCodec,
    objectives: dict[str, Callable[[MonteCarloBatch], float]],
    minimize: dict[str, bool],
    pop_size: int = 16,
    generations: int = 6,
    n_samples: int = 20,
    seed: int | None = 42,
    seed_plans: list[np.ndarray] | None = None,
) -> list[ParetoCandidate]:
    """NSGA-II over `codec`. `objectives` maps a name to a function of a Monte Carlo batch."""
    rng = np.random.default_rng(seed)
    futures = sample_conditions_batch(domain_model, scenario, n_samples, seed)
    names = list(objectives)
    sign = np.array([1.0 if minimize[k] else -1.0 for k in names])

    def evaluate(genes: np.ndarray) -> tuple[Plan, dict[str, float]]:
        plan = codec.decode(genes)
        batch = run_monte_carlo(domain_model, scenario, plan, conditions_override=futures)
        return plan, {k: float(objectives[k](batch)) for k in names}

    pop = [np.asarray(g, dtype=float) for g in (seed_plans or [])][:pop_size]
    pop += [rng.random(codec.n_genes) for _ in range(pop_size - len(pop))]
    evaluated = [evaluate(g) for g in pop]

    def as_matrix(ev) -> np.ndarray:
        return np.array([[o[k] for k in names] for _, o in ev]) * sign

    for _ in range(generations):
        objs = as_matrix(evaluated)
        fronts = _fast_non_dominated_sort(objs)
        rank = {i: r for r, f in enumerate(fronts) for i in f}
        crowd: dict[int, float] = {}
        for f in fronts:
            crowd.update(_crowding(objs, f))

        def tournament() -> np.ndarray:
            i, j = rng.integers(0, len(pop), 2)
            better = i if (rank[i], -crowd[i]) < (rank[j], -crowd[j]) else j
            return pop[better]

        children = []
        while len(children) < pop_size:
            p1, p2 = tournament(), tournament()
            w = rng.random(codec.n_genes)
            child = w * p1 + (1 - w) * p2
            mutate = rng.random(codec.n_genes) < 1.5 / codec.n_genes
            child = np.where(mutate, np.clip(child + rng.normal(0, 0.2, codec.n_genes), 0, 1), child)
            children.append(np.clip(child, 0.0, 1.0))
        child_eval = [evaluate(g) for g in children]

        pop_all = pop + children
        eval_all = evaluated + child_eval
        objs_all = as_matrix(eval_all)
        chosen: list[int] = []
        for f in _fast_non_dominated_sort(objs_all):
            if len(chosen) + len(f) <= pop_size:
                chosen += f
            else:
                cd = _crowding(objs_all, f)
                chosen += sorted(f, key=lambda i: -cd[i])[: pop_size - len(chosen)]
                break
        pop = [pop_all[i] for i in chosen]
        evaluated = [eval_all[i] for i in chosen]

    candidates = [ParetoCandidate(p, o) for p, o in evaluated]
    return pareto_front(candidates, minimize)
