"""Flood domain data types: scenario (the map), plan (the decision), conditions (the unknowns)."""

from __future__ import annotations

import dataclasses
from dataclasses import dataclass, field
from typing import Any

import numpy as np

from aegis.engine.interfaces import Conditions, Plan, Scenario

KEY_BRIDGE_PREFIX = "bridge_open:"


@dataclass
class Cluster:
    """A settlement area: people who must be evacuated when it floods."""

    id: str
    name: str
    node: int
    lat: float
    lon: float
    population: int
    vulnerable_pct: float  # share who cannot walk out (elderly, disabled, small children)
    hand_m: float  # height above the river's normal level; floods when the water level exceeds it


@dataclass
class Shelter:
    id: str
    name: str
    node: int
    lat: float
    lon: float
    capacity: int
    hand_m: float
    kind: str  # school, college, community_centre, assumed_assembly_point, ...
    source: str


@dataclass
class StagingPoint:
    id: str
    name: str
    node: int
    lat: float
    lon: float


@dataclass
class FloodScenario(Scenario):
    """The district as a road graph plus people, shelters and boat bases.

    Water level is expressed as metres above the river's normal level. Every edge, cluster and
    shelter has a `hand` threshold in the same unit: it is cut or flooded when the level exceeds it.
    """

    node_xy: np.ndarray = field(default_factory=lambda: np.zeros((0, 2)))  # metres
    node_latlon: np.ndarray = field(default_factory=lambda: np.zeros((0, 2)))
    node_hand_m: np.ndarray = field(default_factory=lambda: np.zeros(0))  # ground height above normal river level
    edge_u: np.ndarray = field(default_factory=lambda: np.zeros(0, dtype=int))
    edge_v: np.ndarray = field(default_factory=lambda: np.zeros(0, dtype=int))
    edge_len_m: np.ndarray = field(default_factory=lambda: np.zeros(0))
    edge_hand_m: np.ndarray = field(default_factory=lambda: np.zeros(0))
    edge_class: list[str] = field(default_factory=list)
    edge_bridge: np.ndarray = field(default_factory=lambda: np.zeros(0, dtype=bool))
    bridges: dict[str, list[int]] = field(default_factory=dict)  # key bridge id -> edge indices
    bridge_names: dict[str, str] = field(default_factory=dict)
    clusters: list[Cluster] = field(default_factory=list)
    shelters: list[Shelter] = field(default_factory=list)
    staging: list[StagingPoint] = field(default_factory=list)
    closed_edges: frozenset[int] = frozenset()  # permanently closed (used by the knockout test)
    river_latlon: list[list[float]] = field(default_factory=list)
    _routing: Any = field(default=None, repr=False, compare=False)

    def with_changes(self, **changes: Any) -> FloodScenario:
        """Copy with some fields replaced; the route cache is not shared with the copy."""
        return dataclasses.replace(self, _routing=None, **changes)

    @property
    def total_population(self) -> int:
        return sum(c.population for c in self.clusters)


@dataclass
class FloodPlan(Plan):
    start_hour: float = 6.0  # D1 when to start moving people
    priority: list[str] = field(default_factory=list)  # D2 cluster ids, first = most urgent
    open_shelters: list[str] = field(default_factory=list)  # D3 shelter ids in use
    route_avoid: list[str] = field(default_factory=list)  # D4 key bridge ids not to route over
    boats_at: dict[str, int] = field(default_factory=dict)  # D5 staging id -> boats
    vehicles_at: dict[str, int] = field(default_factory=dict)  # D5 staging id -> vehicles
    protected: list[str] = field(default_factory=list)  # D6 "cluster:<id>" raised or guarded
    warning_channels: list[str] = field(default_factory=list)  # D7 siren, sms, loudspeaker, door_to_door

    def signature(self) -> tuple:
        return (
            round(self.start_hour, 3),
            tuple(self.priority),
            tuple(sorted(self.open_shelters)),
            tuple(sorted(self.route_avoid)),
            tuple(sorted(self.boats_at.items())),
            tuple(sorted(self.vehicles_at.items())),
            tuple(sorted(self.protected)),
            tuple(sorted(self.warning_channels)),
        )


@dataclass
class FloodConditions(Conditions):
    peak_stage_m: float = 2.0  # forecast peak water level above normal (from the discharge ensemble)
    stage_bias_m: float = 0.0  # error of the rating curve and the coarse forecast
    peak_time_h: float = 18.0
    local_rain_mm: float = 50.0
    boat_availability_pct: float = 0.8
    boat_delay_h: float = 3.0
    comms_degradation_pct: float = 0.1
    compliance_pct: float = 0.75  # share of people who obey the evacuation order
    bridge_open: dict[str, float] = field(default_factory=dict)  # key bridge id -> 1.0 open / 0.0 closed

    _SCALARS = (
        "peak_stage_m",
        "stage_bias_m",
        "peak_time_h",
        "local_rain_mm",
        "boat_availability_pct",
        "boat_delay_h",
        "comms_degradation_pct",
        "compliance_pct",
    )

    def field_names(self) -> list[str]:
        return list(self._SCALARS) + [KEY_BRIDGE_PREFIX + b for b in sorted(self.bridge_open)]

    def as_vector(self) -> np.ndarray:
        return np.array([self.get(n) for n in self.field_names()], dtype=float)

    def get(self, name: str) -> float:
        if name.startswith(KEY_BRIDGE_PREFIX):
            return float(self.bridge_open[name[len(KEY_BRIDGE_PREFIX) :]])
        return float(getattr(self, name))
