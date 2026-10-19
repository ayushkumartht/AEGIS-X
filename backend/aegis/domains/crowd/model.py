"""Crowd / event security domain module — THIN STUB.

Purpose of this file: prove the core engine (core/engine/*) is genuinely
domain-agnostic, not just in theory. Fill in simulate() following the
same pattern as domains/flood/model.py and every Monte Carlo / Red Team /
sensitivity / VOI / optimizer call in core/engine works on crowd security
with zero changes.

Suggested approach (mirrors flood's grid + capacity-constrained loop):
  - CrowdScenario: venue layout grid, entry/exit gates, choke points,
    expected crowd density per zone, police/medical unit posts
    (like flood's shelters)
  - CrowdConditions: crowd_turnout_pct (vs. expected), panic_trigger_prob,
    resource_availability_pct, comms_degradation_pct
  - simulate(): density per zone over ticks (simple flow model: people
    move toward nearest open exit at a rate capped by choke-point
    capacity, like flood's BFS-to-shelter + capacity loop); a zone over a
    density threshold raises stampede-risk; police/medical units reduce
    response time to a triggered incident the same way boats reduce
    flood evacuation time
  - removable_elements / perturb_scenario: close a gate or remove a
    police post, same pattern as flood's shelter/bridge removal

See README.md milestone 7.
"""

from __future__ import annotations

from dataclasses import dataclass, field
import numpy as np

from aegis.engine.interfaces import DomainModel, Scenario, Plan, Conditions, SimulationResult


@dataclass
class CrowdScenario(Scenario):
    pass  # TODO: grid, gates, choke_points, unit_posts, expected_density


@dataclass
class CrowdPlan(Plan):
    pass  # TODO: unit allocation, gate open/close schedule, crowd-flow routing


@dataclass
class CrowdConditions(Conditions):
    crowd_turnout_pct: float = 100.0
    panic_trigger_prob: float = 0.0
    resource_availability_pct: float = 1.0
    comms_degradation_pct: float = 0.0


class CrowdModel(DomainModel):
    def sample_conditions(self, rng: np.random.Generator, scenario: Scenario) -> CrowdConditions:
        raise NotImplementedError("CrowdModel.sample_conditions: TODO, see module docstring")

    def simulate(
        self, scenario: CrowdScenario, plan: CrowdPlan, conditions: CrowdConditions
    ) -> SimulationResult:
        raise NotImplementedError("CrowdModel.simulate: TODO, see module docstring")
