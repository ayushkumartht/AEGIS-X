"""Red Team engine: actively tries to break a plan. Every technique is computed, not guessed.

1. find_worst_case(): the worst futures of a Monte Carlo batch, with the inputs that were extreme.
2. find_single_points_of_failure(): remove one element at a time and measure the drop.
3. discover_failure_boxes(): PRIM scenario discovery, "the plan fails when A > x and B < y".
4. adversarial_search(): the smallest change from a typical future that makes the plan fail.

An LLM may turn the output into a sentence for the officer. It never invents a finding.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from aegis.engine.interfaces import ConditionSpace, DomainModel, Plan, Scenario
from aegis.engine.montecarlo import MonteCarloBatch, run_monte_carlo


@dataclass
class WorstCaseFinding:
    rank: int
    metric_value: float
    conditions_summary: dict[str, float]
    flagged_variables: list[str]


@dataclass
class SinglePointOfFailure:
    element_id: str
    baseline_value: float
    degraded_value: float
    drop_pct: float


@dataclass
class FailureBox:
    """A region of the input space where most futures fail."""

    limits: dict[str, list[float]]  # variable -> [low, high]
    density: float  # share of futures inside the box that fail
    coverage: float  # share of all failing futures that fall inside the box
    support: float  # share of all futures inside the box
    description: str = ""


@dataclass
class AdversarialFinding:
    found: bool
    baseline_value: float = 0.0
    failing_value: float = 0.0
    shifts: dict[str, dict[str, float]] = field(default_factory=dict)  # variable -> {from, to}


def find_worst_case(
    batch: MonteCarloBatch, key: str, top_n: int = 5, z_threshold: float = 1.0
) -> list[WorstCaseFinding]:
    """The worst `top_n` runs, with the inputs whose |z-score| exceeded `z_threshold`."""
    if not batch.runs:
        return []
    minimize_is_bad = batch.runs[0].result.success_metric_minimize
    values = batch.metric_array(key)
    order = np.argsort(values)
    worst_idx = order[-top_n:][::-1] if minimize_is_bad else order[:top_n]

    names = batch.runs[0].conditions.field_names()
    vectors = np.array([r.conditions.as_vector() for r in batch.runs])
    means, stds = vectors.mean(axis=0), vectors.std(axis=0)
    stds[stds == 0] = 1e-9

    findings = []
    for rank, idx in enumerate(worst_idx, start=1):
        vec = batch.runs[idx].conditions.as_vector()
        z = (vec - means) / stds
        findings.append(
            WorstCaseFinding(
                rank=rank,
                metric_value=float(values[idx]),
                conditions_summary=dict(zip(names, vec.tolist(), strict=True)),
                flagged_variables=[n for n, zi in zip(names, z, strict=True) if abs(zi) >= z_threshold],
            )
        )
    return findings


def find_single_points_of_failure(
    domain_model: DomainModel,
    scenario: Scenario,
    plan: Plan,
    key: str,
    nominal_conditions_sampler_seed: int = 0,
    n_nominal_samples: int = 30,
) -> list[SinglePointOfFailure]:
    """Disable each removable element in turn and compare with the baseline on the same futures."""
    baseline_batch = run_monte_carlo(
        domain_model, scenario, plan, n_samples=n_nominal_samples, seed=nominal_conditions_sampler_seed
    )
    minimize_is_bad = baseline_batch.runs[0].result.success_metric_minimize if baseline_batch.runs else False
    baseline_value = float(np.mean(baseline_batch.metric_array(key)))
    futures = [r.conditions for r in baseline_batch.runs]

    findings: list[SinglePointOfFailure] = []
    for element_id in domain_model.removable_elements(scenario):
        degraded = domain_model.perturb_scenario(scenario, element_id)
        batch = run_monte_carlo(domain_model, degraded, plan, conditions_override=futures)
        degraded_value = float(np.mean(batch.metric_array(key)))
        drop = (degraded_value - baseline_value) if minimize_is_bad else (baseline_value - degraded_value)
        drop_pct = (drop / abs(baseline_value) * 100) if baseline_value else 0.0
        findings.append(SinglePointOfFailure(element_id, baseline_value, degraded_value, drop_pct))

    findings.sort(key=lambda f: f.drop_pct, reverse=True)
    return findings


def _describe(limits: dict[str, list[float]]) -> str:
    parts = []
    for name, (lo, hi) in limits.items():
        if np.isneginf(lo) and np.isposinf(hi):
            continue
        if np.isneginf(lo):
            parts.append(f"{name} <= {hi:.2f}")
        elif np.isposinf(hi):
            parts.append(f"{name} >= {lo:.2f}")
        else:
            parts.append(f"{lo:.2f} <= {name} <= {hi:.2f}")
    return " and ".join(parts)


def _prim_once(x: np.ndarray, fail: np.ndarray, alpha: float, min_support: float):
    """One PRIM peeling run. Returns (box_limits, density, coverage, support) of the best box."""
    n, d = x.shape
    lo = np.full(d, -np.inf)
    hi = np.full(d, np.inf)
    inside = np.ones(n, dtype=bool)
    total_fail = max(int(fail.sum()), 1)
    best = (lo.copy(), hi.copy(), float(fail.mean()), 1.0, 1.0)

    while inside.sum() / n > min_support:
        cand = None
        for j in range(d):
            col = x[inside, j]
            if len(np.unique(col)) < 2:
                continue
            for side in ("low", "high"):
                cut = np.quantile(col, alpha if side == "low" else 1 - alpha)
                keep = inside & ((x[:, j] > cut) if side == "low" else (x[:, j] < cut))
                if keep.sum() == 0 or keep.sum() == inside.sum():
                    continue
                dens = fail[keep].mean()
                if cand is None or dens > cand[0]:
                    cand = (dens, j, side, cut, keep)
        if cand is None:
            break
        dens, j, side, cut, keep = cand
        if side == "low":
            lo[j] = max(lo[j], float(cut))
        else:
            hi[j] = min(hi[j], float(cut))
        inside = keep
        support = inside.sum() / n
        coverage = fail[inside].sum() / total_fail
        # prefer dense boxes that still cover a useful part of the failures
        if dens >= best[2] and (dens - fail.mean()) * np.sqrt(support) >= (best[2] - fail.mean()) * np.sqrt(best[3]):
            best = (lo.copy(), hi.copy(), float(dens), float(support), float(coverage))
    lo_b, hi_b, dens, support, coverage = best
    return lo_b, hi_b, dens, coverage, support


def discover_failure_boxes(
    batch: MonteCarloBatch,
    key: str,
    threshold: float,
    max_boxes: int = 2,
    alpha: float = 0.08,
    min_support: float = 0.05,
) -> list[FailureBox]:
    """PRIM scenario discovery: boxes in input space where `key` is worse than `threshold`.

    "Worse" means below `threshold` when higher is better, above it when the metric is minimised.
    """
    if not batch.runs:
        return []
    names = batch.runs[0].conditions.field_names()
    x = np.array([r.conditions.as_vector() for r in batch.runs])
    values = batch.metric_array(key)
    minimize = batch.runs[0].result.success_metric_minimize and key == batch.runs[0].result.success_metric
    fail = (values > threshold) if minimize else (values < threshold)
    if fail.sum() < 5 or fail.all():
        return []

    boxes: list[FailureBox] = []
    remaining = np.ones(len(x), dtype=bool)
    for _ in range(max_boxes):
        if fail[remaining].sum() < 5:
            break
        lo, hi, dens, _cov, support = _prim_once(x[remaining], fail[remaining], alpha, min_support)
        # keep only limits that actually exclude some futures (drop "<= max" and ">= min")
        lo = np.where(lo > x.min(axis=0), lo, -np.inf)
        hi = np.where(hi < x.max(axis=0), hi, np.inf)
        limits = {names[j]: [float(lo[j]), float(hi[j])] for j in range(len(names)) if np.isfinite(lo[j]) or np.isfinite(hi[j])}
        if not limits:
            break
        in_box = np.all((x >= lo) & (x <= hi), axis=1)
        coverage = float(fail[in_box].sum() / max(fail.sum(), 1))
        boxes.append(
            FailureBox(
                limits=limits,
                density=float(fail[in_box].mean()) if in_box.any() else dens,
                coverage=coverage,
                support=float(in_box.mean()),
                description=_describe({k: v for k, v in limits.items()}),
            )
        )
        remaining &= ~in_box
    return boxes


def adversarial_search(
    model: DomainModel,
    scenario: Scenario,
    plan: Plan,
    key: str,
    threshold: float,
    n_probe: int = 300,
    seed: int = 7,
) -> AdversarialFinding:
    """Smallest move from the median future (unit cube centre) that makes `key` fail.

    Probe random futures, take the failing one closest to the centre, then bisect along the line
    from the centre towards it to find the nearest failing point.
    """
    space: ConditionSpace | None = model.condition_space(scenario)
    if space is None:
        raise ValueError("Adversarial search needs a model that provides a ConditionSpace.")
    rng = np.random.default_rng(seed)
    centre = np.full(space.dim, 0.5)

    def run(unit: np.ndarray) -> float:
        cond = model.conditions_from_values(space.values_from_unit(unit))
        return model.simulate(scenario, plan, cond).metrics[key]

    base_val = run(centre)
    minimize = model.simulate(scenario, plan, model.conditions_from_values(space.values_from_unit(centre))).success_metric_minimize

    def fails(v: float) -> bool:
        return v > threshold if minimize else v < threshold

    if fails(base_val):
        return AdversarialFinding(True, base_val, base_val, {})
    best, best_dist = None, np.inf
    for unit in rng.random((n_probe, space.dim)):
        if fails(run(unit)):
            dist = float(np.linalg.norm(unit - centre))
            if dist < best_dist:
                best, best_dist = unit, dist
    if best is None:
        return AdversarialFinding(False, base_val)

    lo_t, hi_t = 0.0, 1.0
    for _ in range(12):
        mid = (lo_t + hi_t) / 2
        if fails(run(centre + mid * (best - centre))):
            hi_t = mid
        else:
            lo_t = mid
    point = centre + hi_t * (best - centre)
    base_values, fail_values = space.values_from_unit(centre), space.values_from_unit(point)
    shifts = {
        n: {"from": base_values[n], "to": fail_values[n]}
        for n in space.names
        if abs(base_values[n] - fail_values[n]) > 1e-9
    }
    return AdversarialFinding(True, base_val, run(point), shifts)
