"""Red Team engine — actively tries to break a plan.

Two independent techniques, both COMPUTED (not an LLM guessing):

1. find_worst_case(): from the Monte Carlo batch, pull out the sampled
   futures that produced the worst outcomes, then report which condition
   variables were abnormally high/low in those futures (simple z-score
   attribution). Answers: "which combination of bad luck breaks this plan?"

2. find_single_points_of_failure(): for each removable scenario element
   (a bridge, a shelter, a unit...), disable it and re-run under NOMINAL
   conditions. Large performance drop => the plan has a hidden hard
   dependency on that element. Answers: "what one thing, if it fails,
   takes the whole plan down?"

An LLM may turn the output of these two functions into a sentence for the
human reviewer. It never invents the finding itself.
"""

from __future__ import annotations

from dataclasses import dataclass
import numpy as np

from core.engine.interfaces import DomainModel, Scenario, Plan
from core.engine.montecarlo import MonteCarloBatch, run_monte_carlo


@dataclass
class WorstCaseFinding:
    rank: int
    metric_value: float
    conditions_summary: dict[str, float]
    flagged_variables: list[str]  # condition fields that are unusually extreme


@dataclass
class SinglePointOfFailure:
    element_id: str
    baseline_value: float
    degraded_value: float
    drop_pct: float  # how much worse things got with this element removed


def find_worst_case(
    batch: MonteCarloBatch, key: str, top_n: int = 5, z_threshold: float = 1.0
) -> list[WorstCaseFinding]:
    """Identify the worst `top_n` runs in an existing Monte Carlo batch and
    flag which uncertain inputs were extreme (|z-score| > z_threshold)
    in those runs, relative to the full batch's distribution of inputs.
    """
    if not batch.runs:
        return []

    minimize_is_bad = batch.runs[0].result.success_metric_minimize
    values = batch.metric_array(key)

    # worst = highest value if minimize_is_bad (e.g. casualties), else lowest
    order = np.argsort(values)
    worst_idx = order[-top_n:][::-1] if minimize_is_bad else order[:top_n]

    field_names = batch.runs[0].conditions.field_names()
    all_vectors = np.array([r.conditions.as_vector() for r in batch.runs])
    means = all_vectors.mean(axis=0)
    stds = all_vectors.std(axis=0)
    stds[stds == 0] = 1e-9

    findings = []
    for rank, idx in enumerate(worst_idx, start=1):
        run = batch.runs[idx]
        vec = run.conditions.as_vector()
        z = (vec - means) / stds
        flagged = [
            field_names[i]
            for i in range(len(field_names))
            if abs(z[i]) >= z_threshold
        ]
        cond_summary = dict(zip(field_names, vec.tolist()))
        findings.append(
            WorstCaseFinding(
                rank=rank,
                metric_value=float(values[idx]),
                conditions_summary=cond_summary,
                flagged_variables=flagged,
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
    """For each removable element in the scenario, disable it and compare
    plan performance under the SAME nominal (non-extreme) conditions used
    for the baseline. Returns elements sorted by how damaging their
    removal is (biggest drop first).
    """
    baseline_batch = run_monte_carlo(
        domain_model, scenario, plan, n_samples=n_nominal_samples,
        seed=nominal_conditions_sampler_seed,
    )
    minimize_is_bad = (
        baseline_batch.runs[0].result.success_metric_minimize
        if baseline_batch.runs
        else False
    )
    baseline_value = float(np.mean(baseline_batch.metric_array(key)))

    findings: list[SinglePointOfFailure] = []
    for element_id in domain_model.removable_elements(scenario):
        degraded_scenario = domain_model.perturb_scenario(scenario, element_id)
        degraded_batch = run_monte_carlo(
            domain_model, degraded_scenario, plan, n_samples=n_nominal_samples,
            seed=nominal_conditions_sampler_seed,
        )
        degraded_value = float(np.mean(degraded_batch.metric_array(key)))

        if minimize_is_bad:
            # lower is better -> removal is bad if degraded_value went UP
            drop = degraded_value - baseline_value
            drop_pct = (drop / baseline_value * 100) if baseline_value else 0.0
        else:
            # higher is better -> removal is bad if degraded_value went DOWN
            drop = baseline_value - degraded_value
            drop_pct = (drop / baseline_value * 100) if baseline_value else 0.0

        findings.append(
            SinglePointOfFailure(
                element_id=element_id,
                baseline_value=baseline_value,
                degraded_value=degraded_value,
                drop_pct=drop_pct,
            )
        )

    findings.sort(key=lambda f: f.drop_pct, reverse=True)
    return findings
