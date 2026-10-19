"""Urban fire domain module — THIN STUB.

Purpose of this file: prove the core engine (core/engine/*) is genuinely
domain-agnostic, not just in theory. Fill in simulate() following the
same pattern as domains/flood/model.py and every Monte Carlo / Red Team /
sensitivity / VOI / optimizer call in core/engine works on fire with zero
changes.

Suggested approach (mirrors flood's grid + BFS, swap the hazard model):
  - FireScenario: grid, building fuel-load/flammability per cell,
    fire stations (like flood's shelters), population clusters
  - FireConditions: wind_speed, wind_direction, humidity_pct,
    resource_availability_pct, comms_degradation_pct
  - simulate(): spread fire outward from an ignition point each tick
    (e.g. cellular automaton: a cell catches fire with probability driven
    by wind direction/speed + neighbour fuel), run firefighting resource
    allocation + evacuation same as flood's capacity-constrained loop,
    cells on fire become impassable (like flooded cells)
  - removable_elements / perturb_scenario: disable a fire station or a
    key access road, same pattern as flood's shelter/bridge removal

See README.md milestone 7.
"""

from __future__ import annotations

from dataclasses import dataclass, field
import numpy as np

from aegis.engine.interfaces import DomainModel, Scenario, Plan, Conditions, SimulationResult


@dataclass
class FireScenario(Scenario):
    pass  # TODO: grid, fuel_load, fire_stations, population_clusters


@dataclass
class FirePlan(Plan):
    pass  # TODO: truck allocation, evacuation priority, firebreak locations


@dataclass
class FireConditions(Conditions):
    wind_speed_kph: float = 0.0
    humidity_pct: float = 50.0
    resource_availability_pct: float = 1.0
    comms_degradation_pct: float = 0.0


class FireModel(DomainModel):
    def sample_conditions(self, rng: np.random.Generator, scenario: Scenario) -> FireConditions:
        raise NotImplementedError("FireModel.sample_conditions: TODO, see module docstring")

    def simulate(
        self, scenario: FireScenario, plan: FirePlan, conditions: FireConditions
    ) -> SimulationResult:
        raise NotImplementedError("FireModel.simulate: TODO, see module docstring")
