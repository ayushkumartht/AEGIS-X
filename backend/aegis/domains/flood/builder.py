"""Builds a FloodScenario (road graph, flood thresholds, people, shelters) from district data.

Inputs are plain data (Overpass JSON, an elevation function, shelter records) so the builder is
testable offline and has no network code of its own.

Method:
  1. Roads become a graph. Nodes are kept at junctions, way ends and every ~100 m.
  2. Elevation at each node; the river's normal level is a low percentile of the river's elevation.
  3. HAND (height above the river's normal level) is the flood threshold: for a road, its lowest
     end; for a bridge, its highest end plus deck clearance.
  4. Population is spread over 500 m cells in proportion to road length (a proxy for building
     density) and scaled to the district total from its config.
  5. Shelters come from the district's shelter CSV and from OSM schools, colleges and halls.
     Listed shelters without a position are put on high ground and labelled as such; assumed
     assembly points top up the space when it covers less than half the population.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from collections.abc import Callable, Sequence
from typing import TYPE_CHECKING

import numpy as np
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import connected_components
from scipy.spatial import cKDTree

from aegis.domains.flood.types import Cluster, FloodScenario, Shelter, StagingPoint
from aegis.exceptions import DataError

if TYPE_CHECKING:  # typing only: the domain layer does not depend on the ingest layer at runtime
    from aegis.ingest.district import DistrictConfig
    from aegis.ingest.shelters import ShelterRecord

NODE_SPACING_M = 100.0
CELL_M = 750.0
MIN_CLUSTER_POP = 150
VULNERABLE_PCT = 0.12  # assumed share who cannot walk out: elderly, disabled, small children
BRIDGE_CLEARANCE_M = 2.0
MIN_HAND_M = 0.2
KEY_BRIDGE_CLASSES = {"trunk", "primary", "secondary", "tertiary"}
KEY_BRIDGE_MIN_LEN_M = 30.0
MAX_KEY_BRIDGES = 8
SHELTER_CAPACITY = {"school": 300, "college": 500, "university": 800, "community_centre": 200, "townhall": 300}
MIN_SHELTERS = 4
# Without an official shelter list, add assumed high-ground assembly points until shelter space
# covers this share of the population. They are labelled as assumed everywhere they appear.
MIN_SHELTER_CAPACITY_SHARE = 0.5
ASSEMBLY_CAPACITY = 2000
ASSEMBLY_SPACING_M = 800.0
# Listed shelters with no known position (real camps not on any map) go on the highest quarter
# of the town, at least this far apart; town schools are typically a few hundred metres apart.
CAMP_SPACING_M = 300.0
ELEVATION_FN = Callable[[list[tuple[float, float]]], list[float]]


class _Projection:
    def __init__(self, lat0: float, lon0: float):
        self.lat0, self.lon0 = lat0, lon0
        self.kx = 111_320.0 * np.cos(np.radians(lat0))
        self.ky = 110_540.0

    def xy(self, lat: float, lon: float) -> tuple[float, float]:
        return (lon - self.lon0) * self.kx, (lat - self.lat0) * self.ky


def _parse_graph(roads_raw: dict, proj: _Projection):
    nodes = {e["id"]: (e["lat"], e["lon"]) for e in roads_raw["elements"] if e["type"] == "node"}
    ways = [e for e in roads_raw["elements"] if e["type"] == "way" and len(e.get("nodes", [])) >= 2]
    counts = Counter(n for w in ways for n in set(w["nodes"]) if n in nodes)

    index: dict[int, int] = {}
    edges: list[tuple[int, int, float, str, bool, int, str]] = []

    def node_id(osm_id: int) -> int:
        return index.setdefault(osm_id, len(index))

    for w in ways:
        tags = w.get("tags", {})
        cls = tags.get("highway", "residential")
        bridge = tags.get("bridge", "no") not in ("no", "")
        name = tags.get("name", "")
        refs = [n for n in w["nodes"] if n in nodes]
        if len(refs) < 2:
            continue
        prev, acc = refs[0], 0.0
        for k in range(1, len(refs)):
            a, b = proj.xy(*nodes[refs[k - 1]]), proj.xy(*nodes[refs[k]])
            acc += float(np.hypot(a[0] - b[0], a[1] - b[1]))
            last = k == len(refs) - 1
            if last or counts[refs[k]] >= 2 or acc >= NODE_SPACING_M:
                if refs[k] != prev and acc > 0:
                    edges.append((node_id(prev), node_id(refs[k]), acc, cls, bridge, w["id"], name))
                prev, acc = refs[k], 0.0
    inverse = {v: k for k, v in index.items()}
    return nodes, edges, inverse


def _largest_component(n: int, edges: list) -> np.ndarray:
    u = np.array([e[0] for e in edges])
    v = np.array([e[1] for e in edges])
    graph = csr_matrix((np.ones(len(u)), (u, v)), shape=(n, n))
    _, labels = connected_components(graph, directed=False)
    return labels == np.bincount(labels).argmax()


def _river_base(features_raw: dict, elevations: ELEVATION_FN, fallback: float) -> tuple[float, list[list[float]], str]:
    river: list[list[float]] = []
    for e in features_raw.get("elements", []):
        if e.get("tags", {}).get("waterway") and e.get("geometry"):
            river += [[p["lat"], p["lon"]] for p in e["geometry"]]
    if len(river) < 2:
        return fallback, [], "no river geometry found: normal level taken from the lowest ground"
    step = max(1, len(river) // 40)
    sample = river[::step]
    elev = elevations([(la, lo) for la, lo in sample])
    return float(np.percentile(elev, 25)), river, "25th percentile of the river's elevation"


def _clusters(node_xy, node_elev, edges, base, total_pop, tree_nodes) -> list[Cluster]:
    weight = np.zeros(len(node_xy))
    for u, v, length, cls, *_ in edges:
        w = length * (1.0 if cls in ("residential", "unclassified") else 0.5)
        weight[u] += w / 2
        weight[v] += w / 2
    cell = np.floor(node_xy / CELL_M).astype(int)
    groups: dict[tuple[int, int], list[int]] = defaultdict(list)
    for i, c in enumerate(map(tuple, cell)):
        groups[c].append(i)
    cell_w = {c: weight[idx].sum() for c, idx in groups.items()}
    total_w = sum(cell_w.values())
    pops = {c: total_pop * w / total_w for c, w in cell_w.items()}
    kept = {c: p for c, p in pops.items() if p >= MIN_CLUSTER_POP}
    if not kept:
        raise DataError("No populated areas found: check the district bbox and population total.")
    scale = total_pop / sum(kept.values())

    out = []
    for n, (c, pop) in enumerate(sorted(kept.items(), key=lambda kv: -kv[1]), start=1):
        idx = np.array(groups[c])
        centroid = np.average(node_xy[idx], axis=0, weights=np.maximum(weight[idx], 1e-6))
        node = int(idx[np.argmin(np.hypot(*(node_xy[idx] - centroid).T))])
        hand = max(MIN_HAND_M, float(np.percentile(node_elev[idx], 20)) - base)
        out.append(
            Cluster(f"c{n}", f"Area {n}", node, float(tree_nodes[node][0]), float(tree_nodes[node][1]),
                    int(round(pop * scale)), VULNERABLE_PCT, hand)
        )
    return out


def _shelter_candidates(features_raw: dict, records: Sequence[ShelterRecord]) -> list[dict]:
    seen: set[tuple[str, int, int]] = set()
    out: list[dict] = []

    def add(sid, name, lat, lon, cap, kind, source):
        key = (name.lower(), round(lat * 2000), round(lon * 2000))
        if key not in seen:
            seen.add(key)
            out.append(dict(id=sid, name=name, lat=lat, lon=lon, capacity=cap, kind=kind, source=source))

    for r in records:
        if r.lat is not None and r.lon is not None:
            add(r.id, r.name, r.lat, r.lon, r.capacity, r.type, r.source)
    for e in features_raw.get("elements", []):
        tags = e.get("tags", {})
        kind = tags.get("amenity")
        if kind not in SHELTER_CAPACITY:
            continue
        pos = e if "lat" in e else e.get("center")
        if not pos:
            continue
        add(f"osm_{e['type'][0]}{e['id']}", tags.get("name", f"{kind} {e['id']}"), pos["lat"], pos["lon"],
            SHELTER_CAPACITY[kind], kind, f"OpenStreetMap {e['type']}/{e['id']}; capacity assumed for a {kind}")
    return out


def build_scenario(
    district: DistrictConfig,
    roads_raw: dict,
    features_raw: dict,
    elevations: ELEVATION_FN,
    shelter_records: Sequence[ShelterRecord] = (),
) -> FloodScenario:
    lon_min, lat_min, lon_max, lat_max = district.bbox
    proj = _Projection((lat_min + lat_max) / 2, (lon_min + lon_max) / 2)

    osm_nodes, edges, inverse = _parse_graph(roads_raw, proj)
    if not edges:
        raise DataError("No road edges found in the OSM data.")
    keep = _largest_component(len(inverse), edges)
    remap = {old: new for new, old in enumerate(np.nonzero(keep)[0])}
    edges = [(remap[u], remap[v], *rest) for u, v, *rest in edges if keep[u] and keep[v]]
    osm_ids = [inverse[i] for i in np.nonzero(keep)[0]]

    node_latlon = np.array([osm_nodes[i] for i in osm_ids])
    node_xy = np.array([proj.xy(la, lo) for la, lo in node_latlon])
    node_elev = np.array(elevations([(float(la), float(lo)) for la, lo in node_latlon]))

    base, river, base_note = _river_base(features_raw, elevations, float(np.percentile(node_elev, 5)))

    eu = np.array([e[0] for e in edges])
    ev = np.array([e[1] for e in edges])
    length = np.array([e[2] for e in edges])
    is_bridge = np.array([e[4] for e in edges])
    lo_e = np.minimum(node_elev[eu], node_elev[ev])
    hi_e = np.maximum(node_elev[eu], node_elev[ev])
    hand = np.where(is_bridge, hi_e + BRIDGE_CLEARANCE_M, lo_e) - base
    hand = np.maximum(hand, MIN_HAND_M)

    by_way: dict[int, list[int]] = defaultdict(list)
    for i, e in enumerate(edges):
        if e[4]:
            by_way[e[5]].append(i)
    candidates = []
    for way_id, idx in by_way.items():
        cls, name = edges[idx[0]][3], edges[idx[0]][6]
        total = float(length[idx].sum())
        if cls in KEY_BRIDGE_CLASSES and total >= KEY_BRIDGE_MIN_LEN_M:
            candidates.append((total, way_id, idx, name))
    bridges, bridge_names = {}, {}
    for total, way_id, idx, name in sorted(candidates, reverse=True)[:MAX_KEY_BRIDGES]:
        mid = node_latlon[eu[idx[0]]]
        bridges[f"b_{way_id}"] = [int(i) for i in idx]
        bridge_names[f"b_{way_id}"] = name or f"{edges[idx[0]][3]} bridge near {mid[0]:.3f}, {mid[1]:.3f}"

    tree = cKDTree(node_xy)
    clusters = _clusters(node_xy, node_elev, edges, base, district.population_total, node_latlon)

    shelters: list[Shelter] = []
    for cand in _shelter_candidates(features_raw, shelter_records):
        _, node = tree.query(proj.xy(cand["lat"], cand["lon"]))
        node = int(node)
        shelters.append(
            Shelter(cand["id"], cand["name"], node, *map(float, node_latlon[node]), int(cand["capacity"]),
                    max(0.5, float(node_elev[node]) - base + 0.5), cand["kind"], cand["source"])
        )
    def short_of_space() -> bool:
        capacity = sum(s.capacity for s in shelters)
        return len(shelters) < MIN_SHELTERS or capacity < MIN_SHELTER_CAPACITY_SHARE * district.population_total

    order = np.argsort(-node_elev)

    def free_high_ground(pool: int, spacing: float):
        """Among the `pool` highest nodes, those at least `spacing` from every shelter placed so far."""
        for node in order[:pool]:
            if all(np.hypot(*(node_xy[node] - node_xy[s.node])) > spacing for s in shelters):
                yield int(node)

    def place(node: int, sid: str, name: str, capacity: int, kind: str, source: str) -> None:
        shelters.append(Shelter(sid, name, node, *map(float, node_latlon[node]), capacity,
                                max(0.5, float(node_elev[node]) - base), kind, source))

    # Real shelters whose building is not on the map: a known name and capacity, an assumed position.
    unlocated = [r for r in shelter_records if r.lat is None or r.lon is None]
    spots = free_high_ground(max(1, len(order) // 4), CAMP_SPACING_M)
    for r in unlocated:
        node = next(spots, None)
        if node is None:
            break
        place(node, r.id, r.name, r.capacity, f"assumed_location_{r.type}",
              f"{r.source}; position assumed: high ground in the town (the building is not on the map)")

    if short_of_space():
        for node in free_high_ground(max(200, len(order) // 4), ASSEMBLY_SPACING_M):
            if not short_of_space():
                break
            place(node, f"assumed_{len(shelters)}", "Assumed assembly point (high ground)", ASSEMBLY_CAPACITY,
                  "assumed_assembly_point", "derived: high ground, not an official shelter")

    staging = []
    for sp in district.staging_points:
        _, node = tree.query(proj.xy(sp.lat, sp.lon))
        staging.append(StagingPoint(sp.id, sp.name, int(node), *map(float, node_latlon[int(node)])))

    return FloodScenario(
        name=district.id,
        metadata={
            "district": district.name,
            "boats_total": district.boats,
            "vehicles_total": district.vehicles,
            "resources_note": district.resources_note,
            "population_note": district.population_note,
            "river_base_m": base,
            "river_base_method": base_note,
            "n_nodes": int(len(node_xy)),
            "n_edges": int(len(edges)),
            "elevation_source": "Open-Meteo elevation (Copernicus DEM, ~90 m)",
        },
        node_xy=node_xy,
        node_latlon=node_latlon,
        node_hand_m=node_elev - base,
        edge_u=eu,
        edge_v=ev,
        edge_len_m=length,
        edge_hand_m=hand,
        edge_class=[e[3] for e in edges],
        edge_bridge=is_bridge,
        bridges=bridges,
        bridge_names=bridge_names,
        clusters=clusters,
        shelters=shelters,
        staging=staging,
        river_latlon=river,
    )
