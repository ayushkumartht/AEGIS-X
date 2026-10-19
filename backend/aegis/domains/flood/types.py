"""Flood domain data types: scenario (the map), plan (the decision), conditions (the unknowns)."""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from aegis.engine.interfaces import Conditions, Plan, Scenario


@dataclass
class FloodScenario(Scenario):
    elevation: np.ndarray = field(default_factory=lambda: np.zeros((1, 1)))
    roads: np.ndarray = field(default_factory=lambda: np.ones((1, 1), dtype=bool))
    shelters: list[tuple[int, int]] = field(default_factory=list)
    bridges: dict[str, tuple[int, int]] = field(default_factory=dict)
    population_clusters: list[dict] = field(default_factory=list)  # {"pos": (r,c), "count": int}
    always_blocked: frozenset[tuple[int, int]] = field(default_factory=frozenset)

    @property
    def grid_size(self) -> tuple[int, int]:
        return self.elevation.shape


@dataclass
class FloodPlan(Plan):
    # boats allocated to each shelter, by shelter index
    boats_per_shelter: list[int] = field(default_factory=list)
    # cluster indices in the order they should be evacuated when a shelter
    # must choose between clusters competing for the same capacity
    evacuation_priority: list[int] = field(default_factory=list)
    # road cells given extra flood tolerance before this plan is run
    reinforced_cells: list[tuple[int, int]] = field(default_factory=list)


@dataclass
class FloodConditions(Conditions):
    rainfall_mm: float = 0.0
    resource_availability_pct: float = 1.0
    comms_degradation_pct: float = 0.0
