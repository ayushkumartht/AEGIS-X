"""Time-stepped evacuation simulation on the road graph.

Each tick (default 1 hour):
  1. the water level is computed from the river stage curve plus local ponding;
  2. edges whose flood threshold is below the level are cut, as are closed bridges;
  3. a multi-source Dijkstra from the dry shelters gives every node its nearest reachable shelter
     (cached by water level, so many futures share the work);
  4. once the order has been given and the warning has reached people, people leave:
       - on foot along dry routes (people who can walk),
       - by vehicle along dry routes (the vulnerable first),
       - by boat from the staging points, for flooded areas that have no dry route left;
  5. arrivals fill shelter capacity.

A person counts as evacuated when they leave before their area floods, or are rescued within
RESCUE_WINDOW_H of it flooding. People who refused the order ask for rescue once the water arrives.

Limitation: a person who sets out is counted as safe; routes that flood while they are still
travelling are not modelled.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import connected_components, dijkstra

from aegis.domains.flood.hydrology import LEVEL_STEP_M, ponding_m, quantise, stage_curve
from aegis.domains.flood.types import FloodConditions, FloodPlan, FloodScenario

WALK_FRACTION_PER_H = 0.35  # share of the remaining walkers who set out each hour
VEHICLE_CAPACITY_PER_H = 30.0  # people one vehicle moves per hour
BOAT_CAPACITY = 12.0  # people per boat trip
BOAT_SPEED_M_PER_H = 10_000.0
BOAT_LOAD_H = 0.5  # loading and unloading time per round trip
DETOUR = 1.3  # boat path length relative to the straight line
BASE_WARNING_DELAY_H = 3.0
PROTECT_BONUS_M = 1.0
# Value judgement used by `decision_score`: moving one person who did not need to move costs
# this fraction of failing to move one person at risk. Adjustable; shown in the UI.
FALSE_ALARM_WEIGHT = 0.3
# Someone still in a flooded area this long after the water arrives is not counted as evacuated
# in time, even if a boat reaches them later (they appear under `rescued_late`).
RESCUE_WINDOW_H = 6.0
LATE_SHARE = 0.6  # share of people who refused to leave who ask for rescue once their area floods
MAX_CACHE = 20_000

CHANNELS = {  # name: (share of the warning delay removed, compliance gained)
    "siren": (0.10, 0.00),
    "sms": (0.10, 0.00),
    "loudspeaker": (0.10, 0.02),
    "door_to_door": (0.25, 0.08),
}


class Routing:
    """Shortest dry routes to shelters, cached per scenario."""

    def __init__(self, scenario: FloodScenario):
        self.n = len(scenario.node_xy)
        self.u, self.v, self.length = scenario.edge_u, scenario.edge_v, scenario.edge_len_m
        self.cache: dict[tuple, tuple[np.ndarray, np.ndarray]] = {}

    def route(
        self, passable: np.ndarray, sources: np.ndarray, key: tuple
    ) -> tuple[np.ndarray, np.ndarray]:
        """(distance_m to the nearest dry shelter, connected-component label) for every node.

        Unreachable nodes get an infinite distance. Nodes share a label when a dry route joins them.
        """
        hit = self.cache.get(key)
        if hit is not None:
            return hit
        if not passable.any():
            result = (np.full(self.n, np.inf), np.arange(self.n))
        else:
            graph = csr_matrix(
                (self.length[passable], (self.u[passable], self.v[passable])), shape=(self.n, self.n)
            )
            _, comp = connected_components(graph, directed=False)
            if len(sources) == 0:
                dist = np.full(self.n, np.inf)
            else:
                dist = dijkstra(graph, directed=False, indices=sources, min_only=True)
            result = (dist, comp)
        if len(self.cache) > MAX_CACHE:
            self.cache.clear()
        self.cache[key] = result
        return result


def routing_for(scenario: FloodScenario) -> Routing:
    if scenario._routing is None:
        scenario._routing = Routing(scenario)
    return scenario._routing


@dataclass
class Prepared:
    """Everything about (scenario, plan) that does not depend on the sampled future."""

    sig: tuple
    start_hour: float
    order: np.ndarray  # cluster indices, most urgent first
    pop: np.ndarray
    vuln: np.ndarray
    hand: np.ndarray  # cluster flood thresholds including protection
    node: np.ndarray
    open_shelters: np.ndarray  # indices into scenario.shelters
    shelter_hand: np.ndarray
    shelter_cap: np.ndarray
    shelter_node: np.ndarray
    boat_staging: np.ndarray  # boats per staging point
    vehicles_total: float
    boat_cost_h: np.ndarray  # boat-hours per person rescued, per cluster (inf = no boats reach it)
    cluster_staging: np.ndarray  # staging index serving each cluster, -1 if none
    euclid_shelter_order: np.ndarray  # (clusters, open shelters): shelter positions, nearest first
    avoid_edges: np.ndarray  # bool mask of edges the plan avoids
    delay_cut: float
    compliance_gain: float
    boats_total: int


def prepare(scenario: FloodScenario, plan: FloodPlan) -> Prepared:
    clusters, shelters, staging = scenario.clusters, scenario.shelters, scenario.staging
    c_ids = [c.id for c in clusters]
    ordered = [c_ids.index(i) for i in plan.priority if i in c_ids]
    ordered += [i for i in range(len(clusters)) if i not in ordered]

    protected = {p.split(":", 1)[1] for p in plan.protected if p.startswith("cluster:")}
    hand = np.array([c.hand_m + (PROTECT_BONUS_M if c.id in protected else 0.0) for c in clusters])

    open_ids = set(plan.open_shelters) if plan.open_shelters else {s.id for s in shelters}
    open_idx = np.array([i for i, s in enumerate(shelters) if s.id in open_ids], dtype=int)

    boats = np.array([float(plan.boats_at.get(sp.id, 0)) for sp in staging])
    xy = scenario.node_xy
    c_xy = xy[[c.node for c in clusters]] if clusters else np.zeros((0, 2))
    s_xy = xy[[sp.node for sp in staging]] if staging else np.zeros((0, 2))
    cost = np.full(len(clusters), np.inf)
    serving = np.full(len(clusters), -1)
    for ci in range(len(clusters)):
        best = None
        for si in range(len(staging)):
            if boats[si] <= 0:
                continue
            d = float(np.hypot(*(c_xy[ci] - s_xy[si]))) * DETOUR
            if best is None or d < best[0]:
                best = (d, si)
        if best is not None:
            cost[ci] = (2 * best[0] / BOAT_SPEED_M_PER_H + BOAT_LOAD_H) / BOAT_CAPACITY
            serving[ci] = best[1]

    sh_xy = xy[[shelters[i].node for i in open_idx]] if len(open_idx) else np.zeros((0, 2))
    dist_cs = np.hypot(c_xy[:, None, 0] - sh_xy[None, :, 0], c_xy[:, None, 1] - sh_xy[None, :, 1])
    euclid = np.argsort(dist_cs, axis=1) if len(open_idx) else np.zeros((len(clusters), 0), dtype=int)

    avoid = np.zeros(len(scenario.edge_u), dtype=bool)
    for b in plan.route_avoid:
        avoid[scenario.bridges.get(b, [])] = True
    if scenario.closed_edges:
        avoid[list(scenario.closed_edges)] = True

    delay_cut = min(0.5, sum(CHANNELS[c][0] for c in plan.warning_channels if c in CHANNELS))
    comp_gain = sum(CHANNELS[c][1] for c in plan.warning_channels if c in CHANNELS)

    return Prepared(
        sig=plan.signature() + (tuple(sorted(scenario.closed_edges)),),
        start_hour=float(plan.start_hour),
        order=np.array(ordered, dtype=int),
        pop=np.array([c.population for c in clusters], dtype=float),
        vuln=np.array([c.vulnerable_pct for c in clusters]),
        hand=hand,
        node=np.array([c.node for c in clusters], dtype=int),
        open_shelters=open_idx,
        shelter_hand=np.array([shelters[i].hand_m for i in open_idx]),
        shelter_cap=np.array([shelters[i].capacity for i in open_idx], dtype=float),
        shelter_node=np.array([shelters[i].node for i in open_idx], dtype=int),
        boat_staging=boats,
        vehicles_total=float(sum(plan.vehicles_at.values())),
        boat_cost_h=cost,
        cluster_staging=serving,
        euclid_shelter_order=euclid,
        avoid_edges=avoid,
        delay_cut=delay_cut,
        compliance_gain=comp_gain,
        boats_total=int(boats.sum()),
    )


def _allocate(demand: np.ndarray, order: np.ndarray, pool: float) -> np.ndarray:
    """Give `pool` to `demand` in priority `order`; returns the amount each entry receives."""
    d = demand[order]
    before = np.cumsum(d) - d
    got = np.clip(pool - before, 0.0, d)
    out = np.zeros_like(demand)
    out[order] = got
    return out


def _fill_shelters(
    amounts: np.ndarray, order: np.ndarray, allowed: np.ndarray, load: np.ndarray, cap: np.ndarray
) -> None:
    """Send each cluster's movers to its nearest allowed shelter that still has room.

    `order` is (clusters, shelters) nearest first; `allowed` is (clusters, shelters) by shelter
    position. When no allowed shelter has room, people go to the nearest allowed one and show up
    as overflow. Clusters moving in the same tick may slightly overfill a shelter together.
    """
    movers = np.nonzero(amounts > 0)[0]
    if len(movers) == 0 or order.shape[1] == 0:
        return
    om = order[movers]
    rows = np.arange(len(movers))[:, None]
    al = allowed[movers][rows, om]
    ok = al & ((cap - load) > 1e-9)[om]
    reachable = al.any(axis=1)
    pick = np.where(ok.any(axis=1), ok.argmax(axis=1), al.argmax(axis=1))
    target = om[np.arange(len(movers)), pick]
    np.add.at(load, target[reachable], amounts[movers][reachable])


def level_series(
    cond: FloodConditions, base_stage_m: float, tick_h: float, horizon_h: float
) -> tuple[np.ndarray, np.ndarray]:
    """(times in hours, water level in metres above normal) for every tick."""
    times = np.arange(int(horizon_h / tick_h)) * tick_h
    peak = max(base_stage_m, cond.peak_stage_m + cond.stage_bias_m)
    level = stage_curve(base_stage_m, peak, cond.peak_time_h, times) + ponding_m(cond.local_rain_mm)
    return times, level


def run(
    scenario: FloodScenario,
    prep: Prepared,
    cond: FloodConditions,
    base_stage_m: float,
    tick_h: float,
    horizon_h: float,
    trace: dict | None = None,
) -> dict:
    """Simulate one future. Pass an empty dict as `trace` to receive the hour-by-hour story."""
    routing = routing_for(scenario)
    times, level = level_series(cond, base_stage_m, tick_h, horizon_h)
    lq_int = quantise(level)
    lq = lq_int * LEVEL_STEP_M
    n_c = len(prep.pop)

    closed_bridges = tuple(sorted(b for b, v in cond.bridge_open.items() if v < 0.5))
    edge_blocked = prep.avoid_edges.copy()
    for b in closed_bridges:
        edge_blocked[scenario.bridges.get(b, [])] = True

    delay = BASE_WARNING_DELAY_H * (1.0 + 1.5 * cond.comms_degradation_pct) * (1.0 - prep.delay_cut)
    start_h = prep.start_hour + delay
    boats_on_h = start_h + cond.boat_delay_h
    compliance = min(0.98, cond.compliance_pct + prep.compliance_gain)
    avail = cond.boat_availability_pct

    willing = prep.pop * compliance
    rem_vuln = willing * prep.vuln
    rem_walk = willing - rem_vuln
    moved = np.zeros(n_c)
    boat_moved = 0.0
    boat_offered = 0.0
    shelter_load = np.zeros(len(prep.open_shelters))
    done_at = np.full(n_c, np.nan)
    walk_frac = min(1.0, WALK_FRACTION_PER_H * tick_h)

    over = lq[:, None] > prep.hand[None, :]  # (ticks, clusters): is the area under water?
    ever_flooded = over.any(axis=0)
    flood_time = np.where(ever_flooded, times[over.argmax(axis=0)], np.inf)
    unwilling = prep.pop - willing
    late_added = np.zeros(n_c, dtype=bool)
    moved_in_time = np.zeros(n_c)

    if trace is not None:
        trace.update(times=times.tolist(), level=level.tolist(), remaining=[], by_boat=[], by_land=[])

    for t, t_h in enumerate(times):
        if trace is not None and t > 0:
            trace["remaining"].append(np.round(prep.pop - moved, 1).tolist())
        newly = ~late_added & (t_h >= flood_time)
        if newly.any():  # people who refused to leave ask for rescue once the water arrives
            extra = unwilling[newly] * LATE_SHARE
            rem_vuln[newly] += extra * prep.vuln[newly]
            rem_walk[newly] += extra * (1.0 - prep.vuln[newly])
            late_added |= newly
        if t_h < start_h or (rem_walk.sum() + rem_vuln.sum()) < 0.5:
            if trace is not None:
                trace["by_boat"].append([0.0] * n_c)
                trace["by_land"].append([0.0] * n_c)
            continue
        lvl = lq[t]
        flooded = lvl > prep.hand
        dry_shelters = prep.shelter_hand >= lvl
        key = (int(lq_int[t]), closed_bridges, prep.sig)
        passable = (scenario.edge_hand_m >= lvl) & ~edge_blocked
        dist, comp = routing.route(passable, prep.shelter_node[dry_shelters], key)
        walkable = np.isfinite(dist[prep.node])
        cluster_comp = comp[prep.node]
        shelter_comp = comp[prep.shelter_node]
        step = np.zeros(n_c)

        walk_move = np.where(walkable, rem_walk * walk_frac, 0.0)
        veh_pool = prep.vehicles_total * VEHICLE_CAPACITY_PER_H * tick_h * avail
        veh_vuln = _allocate(np.where(walkable, rem_vuln, 0.0), prep.order, veh_pool)
        left = veh_pool - veh_vuln.sum()
        veh_walk = _allocate(np.where(walkable, rem_walk - walk_move, 0.0), prep.order, max(left, 0.0))
        rem_walk -= walk_move + veh_walk
        rem_vuln -= veh_vuln
        by_land = walk_move + veh_walk + veh_vuln
        step += by_land
        allowed = dry_shelters[None, :] & (shelter_comp[None, :] == cluster_comp[:, None])
        _fill_shelters(by_land, prep.euclid_shelter_order, allowed, shelter_load, prep.shelter_cap)

        if t_h >= boats_on_h and prep.boats_total > 0:
            needs_boat = ~walkable & flooded
            demand = np.where(needs_boat, rem_walk + rem_vuln, 0.0)
            for si in range(len(prep.boat_staging)):
                group = prep.cluster_staging == si
                if prep.boat_staging[si] <= 0 or not (demand[group] > 0).any():
                    continue
                pool_h = prep.boat_staging[si] * avail * tick_h
                boat_offered += pool_h
                finite = np.isfinite(prep.boat_cost_h)
                cost = np.where(finite, prep.boat_cost_h, 1.0)
                hours_need = np.where(group & finite, demand * cost, 0.0)
                got_h = _allocate(hours_need, prep.order, pool_h)
                people = np.minimum(got_h / cost, demand)
                from_vuln = np.minimum(people, rem_vuln)
                rem_vuln -= from_vuln
                rem_walk -= people - from_vuln
                step += people
                boat_moved += people.sum()
                allowed = np.broadcast_to(dry_shelters, (n_c, len(dry_shelters)))
                _fill_shelters(people, prep.euclid_shelter_order, allowed, shelter_load, prep.shelter_cap)

        moved += step
        if trace is not None:
            trace["by_land"].append(np.round(by_land, 1).tolist())
            trace["by_boat"].append(np.round(step - by_land, 1).tolist())
        moved_in_time += np.where(t_h <= flood_time + RESCUE_WINDOW_H, step, 0.0)
        newly_done = np.isnan(done_at) & (willing > 0) & ((rem_walk + rem_vuln) < 0.5)
        done_at[newly_done] = t_h

    if trace is not None:
        trace["remaining"].append(np.round(prep.pop - moved, 1).tolist())
        trace["flood_time_h"] = [None if not np.isfinite(x) else float(x) for x in flood_time]
        trace["start_h"] = float(start_h)
        trace["boats_on_h"] = float(boats_on_h)
    overflow = float(np.maximum(shelter_load - prep.shelter_cap, 0.0).sum())
    total_moved = float(moved.sum())
    safe_share = 1.0 - overflow / total_moved if total_moved > 0 else 1.0
    safe_moved = moved_in_time * safe_share

    at_risk_pop = float(prep.pop[ever_flooded].sum())
    evacuated = float(safe_moved[ever_flooded].sum())
    rescued_late = float((moved - moved_in_time)[ever_flooded].sum())
    evac_pct = min(1.0, evacuated / at_risk_pop) if at_risk_pop > 0 else 1.0
    remaining_at_risk = max(0.0, at_risk_pop - evacuated)
    finished = done_at[ever_flooded & ~np.isnan(done_at)]

    unneeded = float(moved[~ever_flooded].sum())
    total_pop = max(float(prep.pop.sum()), 1.0)
    return {
        "evacuated_pct": evac_pct,
        "decision_score": evac_pct - FALSE_ALARM_WEIGHT * unneeded / total_pop,
        "people_at_risk_end": remaining_at_risk,
        "stranded_count": remaining_at_risk,
        "avg_evac_time_h": float(np.mean(finished)) if finished.size else float(horizon_h),
        "last_evac_time_h": float(np.max(finished)) if finished.size else float(horizon_h),
        "boat_utilisation": float(min(1.0, boat_moved / max(boat_offered * BOAT_CAPACITY, 1e-9))) if boat_offered else 0.0,
        "shelter_overflow": overflow,
        "unneeded_evacuations": unneeded,
        "rescued_late": rescued_late,
        "peak_level_m": float(level.max()),
        "flooded_cluster_share": float(ever_flooded.mean()) if n_c else 0.0,
        "boats_used": float(prep.boats_total),
        "_cluster_evacuated": (safe_moved / np.maximum(prep.pop, 1.0)).tolist(),
        "_cluster_flooded": ever_flooded.tolist(),
    }
