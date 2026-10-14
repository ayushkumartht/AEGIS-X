"""Flood evacuation domain module — the primary, deep AEGIS-X module.

Simplified on purpose for the prototype: a grid world instead of a real
OSM road network (see README milestone 7 for the upgrade path). Everything
else is real, working simulation logic:

  - flood rise is driven by rainfall vs. cell elevation
  - reachability uses actual multi-source BFS shortest paths over the
    (possibly flooded/blocked) road grid
  - evacuation is capacity-constrained over discrete time ticks, not a
    single formula — a plan that sends boats to the wrong shelter first
    genuinely performs worse in this model, not just on paper

Swap this grid for a real road graph later: everything in core/engine/
(Monte Carlo, Red Team, sensitivity, VOI, optimizer) is unaffected because
they only ever call `simulate()`.
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
import numpy as np

from core.engine.interfaces import DomainModel, Scenario, Plan, Conditions, SimulationResult

# --- tunable constants (document these; they stand in for calibration
# against real flood events later — see README milestone 7) ---
RAINFALL_TO_WATER_LEVEL = 1.0 / 50.0   # metres of water level per mm of rainfall
REINFORCEMENT_BONUS = 1.5              # extra metres of flood tolerance for reinforced cells
BOAT_SPEED_CELLS_PER_TICK = 2.0        # how fast a rescue trip covers distance
BASE_CAPACITY_PER_BOAT = 8             # people moved per boat per tick, at full resources
COMMS_PENALTY_WEIGHT = 0.5             # comms degradation cuts coordination efficiency
MAX_TICKS = 60


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


class FloodModel(DomainModel):
    def sample_conditions(self, rng: np.random.Generator, scenario: Scenario) -> FloodConditions:
        return FloodConditions(
            rainfall_mm=float(rng.triangular(20, 80, 250)),
            resource_availability_pct=float(rng.uniform(0.5, 1.0)),
            comms_degradation_pct=float(rng.uniform(0.0, 0.4)),
        )

    def sample_conditions_near(
        self,
        rng: np.random.Generator,
        point: dict[str, float],
        spread: float = 0.1,
    ) -> FloodConditions:
        """Draw one sample jittered +/-`spread` (fraction) around a fixed
        point instead of the full prior range. Used by the live-demo
        sliders: moving a slider should visibly shift the outcome
        distribution, which sampling from the full prior would wash out.

        Any field missing from `point` falls back to this model's normal
        prior for that field (via sample_conditions), so a partial point
        (e.g. only rainfall_mm) still produces a complete sample.
        """
        fallback = self.sample_conditions(rng, FloodScenario())

        def jittered(value: float, lo: float, hi: float) -> float:
            delta = value * spread
            return float(np.clip(rng.uniform(value - delta, value + delta), lo, hi))

        rainfall = point.get("rainfall_mm")
        resource = point.get("resource_availability_pct")
        comms = point.get("comms_degradation_pct")

        return FloodConditions(
            rainfall_mm=jittered(rainfall, 0.0, 400.0) if rainfall is not None else fallback.rainfall_mm,
            resource_availability_pct=(
                jittered(resource, 0.0, 1.0) if resource is not None else fallback.resource_availability_pct
            ),
            comms_degradation_pct=(
                jittered(comms, 0.0, 1.0) if comms is not None else fallback.comms_degradation_pct
            ),
        )

    def simulate(
        self, scenario: FloodScenario, plan: FloodPlan, conditions: FloodConditions
    ) -> SimulationResult:
        water_level = conditions.rainfall_mm * RAINFALL_TO_WATER_LEVEL

        reinforced = set(plan.reinforced_cells)
        tolerance = np.zeros(scenario.elevation.shape)
        for cell in reinforced:
            tolerance[cell] += REINFORCEMENT_BONUS

        flooded = scenario.elevation < (water_level - tolerance)
        for cell in scenario.always_blocked:
            flooded[cell] = True

        passable = scenario.roads & ~flooded

        # multi-source-style: one BFS per shelter (grids are small; fine for a prototype)
        distance_from_shelter = [
            _bfs_distance(passable, shelter) for shelter in scenario.shelters
        ]

        clusters = scenario.population_clusters
        n_clusters = len(clusters)
        assigned_shelter = [-1] * n_clusters
        delay_ticks = [0] * n_clusters
        remaining = [c["count"] for c in clusters]
        stranded = [False] * n_clusters

        for ci, cluster in enumerate(clusters):
            pos = cluster["pos"]
            best_shelter, best_dist = -1, float("inf")
            for si, dist_grid in enumerate(distance_from_shelter):
                d = dist_grid[pos]
                if d < best_dist:
                    best_dist, best_shelter = d, si
            if best_shelter == -1 or not np.isfinite(best_dist):
                stranded[ci] = True
                continue
            assigned_shelter[ci] = best_shelter
            delay_ticks[ci] = int(np.ceil(best_dist / BOAT_SPEED_CELLS_PER_TICK))

        efficiency = conditions.resource_availability_pct * (
            1.0 - COMMS_PENALTY_WEIGHT * conditions.comms_degradation_pct
        )
        efficiency = max(0.0, efficiency)

        capacity_per_shelter = [
            BASE_CAPACITY_PER_BOAT * boats * efficiency
            for boats in plan.boats_per_shelter
        ] if plan.boats_per_shelter else [0.0] * len(scenario.shelters)
        # pad in case plan has fewer entries than shelters
        while len(capacity_per_shelter) < len(scenario.shelters):
            capacity_per_shelter.append(0.0)

        priority = plan.evacuation_priority or list(range(n_clusters))
        priority = [ci for ci in priority if 0 <= ci < n_clusters]
        priority += [ci for ci in range(n_clusters) if ci not in priority]

        evac_time: list[float | None] = [None] * n_clusters
        total_evacuated = 0.0
        total_capacity_available = 0.0

        for tick in range(MAX_TICKS):
            remaining_capacity = list(capacity_per_shelter)
            total_capacity_available += sum(capacity_per_shelter)
            for ci in priority:
                if stranded[ci] or remaining[ci] <= 0:
                    continue
                if tick < delay_ticks[ci]:
                    continue
                si = assigned_shelter[ci]
                if remaining_capacity[si] <= 0:
                    continue
                amount = min(remaining_capacity[si], remaining[ci])
                remaining[ci] -= amount
                remaining_capacity[si] -= amount
                total_evacuated += amount
                if remaining[ci] <= 1e-6 and evac_time[ci] is None:
                    evac_time[ci] = float(tick)

        total_population = sum(c["count"] for c in clusters) or 1
        stranded_count = sum(
            clusters[ci]["count"] for ci in range(n_clusters) if stranded[ci]
        ) + sum(max(0.0, remaining[ci]) for ci in range(n_clusters) if not stranded[ci])

        finished = [t for t in evac_time if t is not None]
        avg_time = float(np.mean(finished)) if finished else float(MAX_TICKS)

        evacuated_pct = max(0.0, min(1.0, total_evacuated / total_population))
        resource_utilization = (
            total_evacuated / total_capacity_available if total_capacity_available > 0 else 0.0
        )

        metrics = {
            "evacuated_pct": evacuated_pct,
            "stranded_count": float(stranded_count),
            "avg_time_to_evacuate": avg_time,
            "resource_utilization": float(min(1.0, resource_utilization)),
            "water_level_m": float(water_level),
        }

        return SimulationResult(
            metrics=metrics,
            success_metric="evacuated_pct",
            success_metric_minimize=False,
            details={"assigned_shelter": assigned_shelter, "stranded": stranded},
        )

    def removable_elements(self, scenario: FloodScenario) -> list[str]:
        ids = [f"shelter_{i}" for i in range(len(scenario.shelters))]
        ids += [f"bridge_{name}" for name in scenario.bridges.keys()]
        return ids

    def perturb_scenario(self, scenario: FloodScenario, removed_element: str) -> FloodScenario:
        if removed_element.startswith("shelter_"):
            idx = int(removed_element.split("_", 1)[1])
            new_shelters = [s for i, s in enumerate(scenario.shelters) if i != idx]
            return FloodScenario(
                name=scenario.name,
                metadata=scenario.metadata,
                elevation=scenario.elevation,
                roads=scenario.roads,
                shelters=new_shelters,
                bridges=scenario.bridges,
                population_clusters=scenario.population_clusters,
                always_blocked=scenario.always_blocked,
            )
        if removed_element.startswith("bridge_"):
            name = removed_element.split("_", 1)[1]
            cell = scenario.bridges[name]
            return FloodScenario(
                name=scenario.name,
                metadata=scenario.metadata,
                elevation=scenario.elevation,
                roads=scenario.roads,
                shelters=scenario.shelters,
                bridges=scenario.bridges,
                population_clusters=scenario.population_clusters,
                always_blocked=frozenset(scenario.always_blocked | {cell}),
            )
        raise ValueError(f"Unknown removable element: {removed_element}")


def _bfs_distance(passable: np.ndarray, source: tuple[int, int]) -> np.ndarray:
    """Grid distance (in cells, 4-connectivity) from `source` to every
    cell, restricted to `passable` cells. Unreachable cells = np.inf.
    """
    rows, cols = passable.shape
    dist = np.full((rows, cols), np.inf)
    if not passable[source]:
        return dist  # shelter itself is cut off (e.g. flooded out)

    dist[source] = 0.0
    q = deque([source])
    while q:
        r, c = q.popleft()
        d = dist[r, c]
        for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nr, nc = r + dr, c + dc
            if 0 <= nr < rows and 0 <= nc < cols and passable[nr, nc] and not np.isfinite(dist[nr, nc]):
                dist[nr, nc] = d + 1.0
                q.append((nr, nc))
    return dist


def generate_demo_scenario(size: int = 20, seed: int = 7) -> FloodScenario:
    """Reproducible synthetic flood scenario for demos/tests.

    Elevation slopes down toward one 'river' edge so increasing rainfall
    floods a growing, visually sensible region rather than random noise.
    """
    rng = np.random.default_rng(seed)

    # elevation: higher on one side, lower (river-adjacent) on the other,
    # plus mild noise so the flood boundary isn't a perfectly straight line
    col_gradient = np.linspace(1.0, 10.0, size).reshape(1, size)
    elevation = np.tile(col_gradient, (size, 1)) + rng.normal(0, 0.4, (size, size))

    # Roads form two separate local lattices (left = population side,
    # right = shelter side) separated by a genuine 2-column GAP with no
    # lattice rules reaching into it, crossed only by the explicit bridge
    # cell pair below. (An earlier version had the two lattices' row-rules
    # abut directly at the boundary column, which made every even row a
    # full-width "highway" between the halves — no single cell was ever a
    # real bottleneck, so find_single_points_of_failure() correctly found
    # that removing the "bridge" changed nothing, because it wasn't
    # actually one. The gap here makes the bridge a genuine articulation
    # point, so the Red Team finding is real rather than scripted.)
    mid = size // 2
    left_end = mid - 1       # left lattice occupies columns [0, left_end)
    right_start = mid + 1    # right lattice occupies columns [right_start, size)
    # columns left_end and mid (= right_start - 1) are the gap: no road
    # cells except the explicit bridge below.

    roads = np.zeros((size, size), dtype=bool)
    roads[::2, :left_end] = True        # left-half rows
    roads[:, 0:left_end:2] = True       # left-half columns
    roads[::2, right_start:] = True     # right-half rows
    roads[:, right_start::2] = True     # right-half columns

    bridge_row = size // 2
    roads[bridge_row, left_end] = True  # = roads[bridge_row, mid - 1]
    roads[bridge_row, mid] = True
    bridges = {"main": (bridge_row, mid)}

    shelters = [(1, size - 2), (size - 2, size - 2), (size // 2, size - 2)]
    for shelter in shelters:
        roads[shelter] = True  # shelters always have road access, regardless of lattice parity

    population_clusters = []
    for i in range(6):
        r = rng.integers(0, size)
        c = rng.integers(0, left_end)  # keep clusters strictly inside the left lattice
        # Snap to a road cell so clusters are actually reachable: within
        # the left lattice, a cell is a road iff its row OR column is
        # even, so forcing the column even guarantees it regardless of
        # row.
        c -= c % 2
        pos = (int(r), int(c))
        roads[pos] = True  # population clusters always have road access to their own locality
        population_clusters.append({"pos": pos, "count": int(rng.integers(20, 120))})

    return FloodScenario(
        name="demo-flood-scenario",
        elevation=elevation,
        roads=roads,
        shelters=shelters,
        bridges=bridges,
        population_clusters=population_clusters,
    )


def generate_demo_plan(scenario: FloodScenario) -> FloodPlan:
    """A reasonable default plan: boats spread evenly, priority = cluster order."""
    n_shelters = len(scenario.shelters)
    return FloodPlan(
        name="default-plan",
        boats_per_shelter=[4] * n_shelters,
        evacuation_priority=list(range(len(scenario.population_clusters))),
        reinforced_cells=[],
    )
