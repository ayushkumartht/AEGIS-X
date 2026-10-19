"""Small synthetic flood scenario for tests and the offline demo."""

from __future__ import annotations

import numpy as np

from aegis.domains.flood.types import FloodPlan, FloodScenario


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
