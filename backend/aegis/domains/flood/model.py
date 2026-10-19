"""Flood evacuation domain module: the primary AEGIS-X domain.

`simulate(scenario, plan, conditions)` runs the time-stepped evacuation simulation (evacuation.py)
on the district road graph. Everything generic (Monte Carlo, Red Team, sensitivity, VOI,
optimiser) lives in aegis.engine and only talks to this class through DomainModel.
"""

from __future__ import annotations

import numpy as np

from aegis.domains.flood import evacuation
from aegis.domains.flood.types import (
    KEY_BRIDGE_PREFIX,
    FloodConditions,
    FloodPlan,
    FloodScenario,
)
from aegis.domains.flood.uncertainty import prior_space
from aegis.engine.interfaces import ConditionSpace, DomainModel, Scenario, SimulationResult

PREP_CACHE_SIZE = 64


class FloodModel(DomainModel):
    def __init__(
        self,
        space: ConditionSpace | None = None,
        base_stage_m: float = 0.3,
        tick_h: float = 1.0,
        horizon_h: float = 48.0,
    ):
        self.space = space
        self.base_stage_m = base_stage_m
        self.tick_h = tick_h
        self.horizon_h = horizon_h
        self._prep: dict[tuple, tuple[FloodScenario, evacuation.Prepared]] = {}

    def condition_space(self, scenario: Scenario) -> ConditionSpace:
        return self.space if self.space is not None else prior_space(scenario)  # type: ignore[arg-type]

    def conditions_from_values(self, values: dict[str, float]) -> FloodConditions:
        bridges = {k[len(KEY_BRIDGE_PREFIX) :]: v for k, v in values.items() if k.startswith(KEY_BRIDGE_PREFIX)}
        scalars = {k: v for k, v in values.items() if not k.startswith(KEY_BRIDGE_PREFIX)}
        return FloodConditions(**scalars, bridge_open=bridges)

    def sample_conditions(self, rng: np.random.Generator, scenario: Scenario) -> FloodConditions:
        space = self.condition_space(scenario)
        return self.conditions_from_values(space.values_from_unit(rng.random(space.dim)))

    def _prepared(self, scenario: FloodScenario, plan: FloodPlan) -> evacuation.Prepared:
        key = (id(scenario), plan.signature())
        hit = self._prep.get(key)
        if hit is not None and hit[0] is scenario:
            return hit[1]
        prep = evacuation.prepare(scenario, plan)
        if len(self._prep) >= PREP_CACHE_SIZE:
            self._prep.clear()
        self._prep[key] = (scenario, prep)
        return prep

    def simulate(
        self, scenario: FloodScenario, plan: FloodPlan, conditions: FloodConditions
    ) -> SimulationResult:
        out = evacuation.run(
            scenario, self._prepared(scenario, plan), conditions, self.base_stage_m, self.tick_h, self.horizon_h
        )
        metrics = {k: float(v) for k, v in out.items() if not k.startswith("_")}
        details = {k[1:]: v for k, v in out.items() if k.startswith("_")}
        return SimulationResult(metrics=metrics, success_metric="evacuated_pct", details=details)

    def trace(self, scenario: FloodScenario, plan: FloodPlan, conditions: FloodConditions) -> dict:
        """The hour-by-hour story of one future, for playback: water level, people left, boat and land moves."""
        story: dict = {}
        out = evacuation.run(
            scenario, self._prepared(scenario, plan), conditions, self.base_stage_m, self.tick_h, self.horizon_h, story
        )
        story["metrics"] = {k: float(v) for k, v in out.items() if not k.startswith("_")}
        story["cluster_ids"] = [c.id for c in scenario.clusters]
        return story

    def removable_elements(self, scenario: FloodScenario) -> list[str]:
        return (
            [f"bridge:{b}" for b in sorted(scenario.bridges)]
            + [f"shelter:{s.id}" for s in scenario.shelters]
            + [f"staging:{sp.id}" for sp in scenario.staging]
        )

    def perturb_scenario(self, scenario: FloodScenario, removed_element: str) -> FloodScenario:
        kind, _, ident = removed_element.partition(":")
        if kind == "bridge" and ident in scenario.bridges:
            return scenario.with_changes(closed_edges=scenario.closed_edges | frozenset(scenario.bridges[ident]))
        if kind == "shelter":
            return scenario.with_changes(shelters=[s for s in scenario.shelters if s.id != ident])
        if kind == "staging":
            return scenario.with_changes(staging=[sp for sp in scenario.staging if sp.id != ident])
        raise ValueError(f"Unknown removable element: {removed_element}")
