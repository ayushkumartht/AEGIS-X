"""Building, encoding and (de)serialising evacuation plans."""

from __future__ import annotations

import numpy as np

from aegis.domains.flood.types import FloodPlan, FloodScenario

DEFAULT_BOATS = 12
DEFAULT_VEHICLES = 6
PRIORITY_MODES = ("population", "lowest_first", "vulnerable_first")


def _split(total: int, staging_ids: list[str], shares: np.ndarray | None = None) -> dict[str, int]:
    """Split `total` units over staging points by `shares` (largest-remainder rounding)."""
    if not staging_ids or total <= 0:
        return {}
    w = np.ones(len(staging_ids)) if shares is None else np.asarray(shares, dtype=float) + 1e-9
    raw = total * w / w.sum()
    base = np.floor(raw).astype(int)
    for i in np.argsort(-(raw - base))[: total - base.sum()]:
        base[i] += 1
    return {sid: int(n) for sid, n in zip(staging_ids, base, strict=True)}


def priority_by(scenario: FloodScenario, mode: str) -> list[str]:
    cl = scenario.clusters
    if mode == "lowest_first":
        order = sorted(cl, key=lambda c: c.hand_m)
    elif mode == "vulnerable_first":
        order = sorted(cl, key=lambda c: -c.vulnerable_pct * c.population)
    else:
        order = sorted(cl, key=lambda c: -c.population)
    return [c.id for c in order]


def baseline_plan(scenario: FloodScenario, name: str = "Baseline") -> FloodPlan:
    """The plan a district team would typically write: boats split evenly, biggest area first."""
    ids = [sp.id for sp in scenario.staging]
    boats = int(scenario.metadata.get("boats_total", DEFAULT_BOATS))
    vehicles = int(scenario.metadata.get("vehicles_total", DEFAULT_VEHICLES))
    return FloodPlan(
        name=name,
        start_hour=6.0,
        priority=priority_by(scenario, "population"),
        open_shelters=[s.id for s in scenario.shelters],
        boats_at=_split(boats, ids),
        vehicles_at=_split(vehicles, ids),
        warning_channels=["loudspeaker"],
    )


def _copy(plan: FloodPlan, name: str, **changes) -> FloodPlan:
    data = plan_to_dict(plan) | {"name": name} | changes
    return FloodPlan(**{k: (list(v) if isinstance(v, list) else dict(v) if isinstance(v, dict) else v) for k, v in data.items()})


def candidate_plans(scenario: FloodScenario, plan: FloodPlan) -> dict[str, FloodPlan]:
    """The current plan plus alternatives that trade off against each other, used to value information.

    VOI asks: if we learned X, would we choose a different plan? That only makes sense between
    plans where each wins somewhere. Free improvements (protecting low areas, every warning
    channel) beat the current plan everywhere, so they are recommended outright and not listed.
    """
    out = {
        "current": _copy(plan, "current"),
        "start 12h earlier": _copy(plan, "start 12h earlier", start_hour=max(0.0, plan.start_hour - 12.0)),
        "start 12h later": _copy(plan, "start 12h later", start_hour=plan.start_hour + 12.0),
        "lowest areas first": _copy(plan, "lowest areas first", priority=priority_by(scenario, "lowest_first")),
    }
    boats, vehicles = sum(plan.boats_at.values()), sum(plan.vehicles_at.values())
    for sp in scenario.staging:  # where to keep the boats is a real trade-off, unlike free actions
        out[f"all boats at {sp.name}"] = _copy(
            plan, f"all boats at {sp.name}", boats_at={sp.id: boats}, vehicles_at={sp.id: vehicles}
        )
    return out


def plan_to_dict(plan: FloodPlan) -> dict:
    return {
        "name": plan.name,
        "start_hour": plan.start_hour,
        "priority": plan.priority,
        "open_shelters": plan.open_shelters,
        "route_avoid": plan.route_avoid,
        "boats_at": plan.boats_at,
        "vehicles_at": plan.vehicles_at,
        "protected": plan.protected,
        "warning_channels": plan.warning_channels,
    }


def plan_from_dict(scenario: FloodScenario, data: dict | None) -> FloodPlan:
    """A plan from an API payload: missing fields take the baseline plan's values."""
    plan = baseline_plan(scenario)
    if not data:
        return plan
    for key in ("name", "start_hour", "priority", "open_shelters", "route_avoid", "boats_at", "vehicles_at", "protected", "warning_channels"):
        if data.get(key) is not None:
            setattr(plan, key, data[key])
    return plan


class FloodPlanCodec:
    """Maps genes in [0, 1] to a FloodPlan for the optimiser.

    genes: start hour, share of boats used, boat split over staging points, three priority
    weights (population, lowness, vulnerability), number of low clusters to protect, and two
    warning-channel switches.
    """

    def __init__(self, scenario: FloodScenario):
        self.scenario = scenario
        self.n_staging = len(scenario.staging)
        self.n_genes = 2 + self.n_staging + 3 + 1 + 2

    def decode(self, genes: np.ndarray) -> FloodPlan:
        s = self.scenario
        g = np.clip(np.asarray(genes, dtype=float), 0.0, 1.0)
        total_boats = int(s.metadata.get("boats_total", DEFAULT_BOATS))
        total_veh = int(s.metadata.get("vehicles_total", DEFAULT_VEHICLES))
        ids = [sp.id for sp in s.staging]
        shares = g[2 : 2 + self.n_staging]
        w_pop, w_low, w_vuln = g[2 + self.n_staging : 5 + self.n_staging]
        n_protect = int(g[5 + self.n_staging] * 4.99)
        door, siren = g[6 + self.n_staging] > 0.5, g[7 + self.n_staging] > 0.5

        cl = s.clusters
        pops = np.array([c.population for c in cl], dtype=float)
        hands = np.array([c.hand_m for c in cl])
        vuln = np.array([c.vulnerable_pct * c.population for c in cl])
        score = (
            w_pop * pops / max(pops.max(), 1)
            + w_low * (1 - hands / max(hands.max(), 1e-9))
            + w_vuln * vuln / max(vuln.max(), 1)
        )
        channels = ["loudspeaker"] + (["door_to_door"] if door else []) + (["siren", "sms"] if siren else [])
        lowest = sorted(cl, key=lambda c: c.hand_m)[:n_protect]
        return FloodPlan(
            name="Optimised",
            start_hour=float(g[0] * 24.0),
            priority=[cl[i].id for i in np.argsort(-score)],
            open_shelters=[x.id for x in s.shelters],
            boats_at=_split(int(round(total_boats * (0.4 + 0.6 * g[1]))), ids, shares),
            vehicles_at=_split(total_veh, ids, shares),
            protected=[f"cluster:{c.id}" for c in lowest],
            warning_channels=channels,
        )
