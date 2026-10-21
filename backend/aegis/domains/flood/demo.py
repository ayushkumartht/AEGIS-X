"""A small synthetic district for tests and the offline demo.

Two street lattices separated by a gap: the low, populated side (west, near the river) and the
high side with the shelters (east). One bridge is the only dry link between them, so it is a
genuine single point of failure. Everything is generated from a seed and is not real data.
"""

from __future__ import annotations

import numpy as np

from aegis.domains.flood.plans import baseline_plan
from aegis.domains.flood.types import Cluster, FloodPlan, FloodScenario, Shelter, StagingPoint

SPACING_M = 120.0
LAT0, LON0 = 24.83, 92.78


def _latlon(x: float, y: float) -> tuple[float, float]:
    lat = LAT0 + y / 110_540.0
    return lat, LON0 + x / (111_320.0 * np.cos(np.radians(LAT0)))


def generate_demo_scenario(seed: int = 7) -> FloodScenario:
    rng = np.random.default_rng(seed)
    left_cols, right_cols, rows = 8, 6, 8
    nodes: list[tuple[float, float]] = []
    hand: list[float] = []
    index: dict[tuple[str, int, int], int] = {}

    for side, cols, x0 in (("L", left_cols, 0), ("R", right_cols, left_cols + 2)):
        for i in range(cols):
            for j in range(rows):
                x, y = (x0 + i) * SPACING_M, j * SPACING_M
                frac = i / max(cols - 1, 1)
                h = 0.8 + 2.4 * frac if side == "L" else 5.0 + 3.0 * frac
                index[(side, i, j)] = len(nodes)
                nodes.append((x, y))
                hand.append(h + float(rng.normal(0, 0.12)))

    eu, ev, el, eh, ecls, ebr = [], [], [], [], [], []

    def add_edge(a: int, b: int, bridge: bool = False, deck: float = 0.0) -> int:
        eu.append(a)
        ev.append(b)
        el.append(float(np.hypot(nodes[a][0] - nodes[b][0], nodes[a][1] - nodes[b][1])))
        eh.append(deck if bridge else min(hand[a], hand[b]))
        ecls.append("bridge" if bridge else "residential")
        ebr.append(bridge)
        return len(eu) - 1

    for side, cols in (("L", left_cols), ("R", right_cols)):
        for i in range(cols):
            for j in range(rows):
                if i + 1 < cols:
                    add_edge(index[(side, i, j)], index[(side, i + 1, j)])
                if j + 1 < rows:
                    add_edge(index[(side, i, j)], index[(side, i, j + 1)])
    bridge_edge = add_edge(index[("L", left_cols - 1, 3)], index[("R", 0, 3)], bridge=True, deck=3.0)

    xy = np.array(nodes)
    latlon = np.array([_latlon(x, y) for x, y in nodes])

    clusters = []
    for k, (i, j) in enumerate([(0, 1), (1, 5), (2, 2), (3, 6), (4, 3), (5, 0)]):
        n = index[("L", i, j)]
        clusters.append(
            Cluster(f"c{k + 1}", f"Ward {k + 1}", n, *latlon[n], int(rng.integers(80, 260)), 0.12, max(0.3, hand[n] - 0.2))
        )
    shelters = []
    for k, (j, cap) in enumerate([(1, 450), (3, 400), (6, 500)]):
        n = index[("R", right_cols - 2, j)]
        shelters.append(Shelter(f"s{k + 1}", f"Shelter {k + 1}", n, *latlon[n], cap, hand[n], "school", "synthetic"))
    staging = [
        StagingPoint("sp1", "Base west", index[("L", left_cols - 1, 6)], *latlon[index[("L", left_cols - 1, 6)]]),
        StagingPoint("sp2", "Base east", index[("R", 0, 1)], *latlon[index[("R", 0, 1)]]),
    ]
    # the river runs through the gap between the two sides, under the bridge
    gap_x = (left_cols + 0.5) * SPACING_M
    river = [list(_latlon(gap_x + 25 * np.sin(y / 180), y)) for y in np.linspace(-3 * SPACING_M, (rows + 2) * SPACING_M, 60)]
    return FloodScenario(
        name="demo",
        metadata={"boats_total": 6, "vehicles_total": 4, "synthetic": True},
        node_xy=xy,
        node_latlon=latlon,
        node_hand_m=np.array(hand),
        edge_u=np.array(eu),
        edge_v=np.array(ev),
        edge_len_m=np.array(el),
        edge_hand_m=np.array(eh),
        edge_class=ecls,
        edge_bridge=np.array(ebr),
        bridges={"b_main": [bridge_edge]},
        bridge_names={"b_main": "Main bridge"},
        clusters=clusters,
        shelters=shelters,
        staging=staging,
        river_latlon=river,
    )


def generate_demo_plan(scenario: FloodScenario) -> FloodPlan:
    return baseline_plan(scenario, name="default-plan")
