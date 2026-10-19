"""Combine field reports into beliefs, and turn them into overrides for the uncertainty ranges.

A report that says "closed" from a source with reliability r multiplies the odds of "closed" by
r / (1 - r). Older reports count less: the evidence is scaled by 0.5 ** (age / half_life).
Reports of the opposite claim push the odds the other way.
"""

from __future__ import annotations

import math
from datetime import UTC, datetime

from aegis.fusion.reports import DEFAULT_HALF_LIFE_H, HALF_LIFE_H, RELIABILITY, FieldReport

# A bridge someone bothers to report on is more likely to be in trouble than an average bridge
# (0.95 in the uncertainty prior), so the update starts from a lower prior.
BRIDGE_P_OPEN_PRIOR = 0.8


def _age_hours(received_at: str, now: datetime) -> float:
    return max(0.0, (now - datetime.fromisoformat(received_at)).total_seconds() / 3600.0)


def _weight(report: FieldReport, now: datetime) -> float:
    r = min(max(RELIABILITY.get(report.source_type, 0.5), 0.01), 0.99)
    half_life = HALF_LIFE_H.get(report.parsed.subject_type, DEFAULT_HALF_LIFE_H)
    return math.log(r / (1 - r)) * 0.5 ** (_age_hours(report.received_at, now) / half_life)


def _match_bridge(report: FieldReport, bridge_names: dict[str, str]) -> str | None:
    name = report.parsed.subject_name.lower()
    for bid, bname in bridge_names.items():
        if name and (name == bname.lower() or name in bname.lower() or bname.lower() in name):
            return bid
    return None


def compute_overrides(
    reports: list[FieldReport],
    bridge_names: dict[str, str],
    boats_total: int,
    now: datetime | None = None,
) -> dict:
    """Overrides for flood.uncertainty: {"bridge_open": {id: {p_open, source}}, ranges...}."""
    now = now or datetime.now(UTC)
    logit_open: dict[str, float] = {}
    counts: dict[str, int] = {}
    boats_claim: tuple[float, float] | None = None  # (weight, boats ready)
    network_w = 0.0

    for rep in reports:
        p, w = rep.parsed, _weight(rep, now)
        if p.subject_type == "bridge" and p.claim in ("closed", "flooded", "open", "dry"):
            bid = _match_bridge(rep, bridge_names)
            if bid is None:
                continue
            logit_open.setdefault(bid, math.log(BRIDGE_P_OPEN_PRIOR / (1 - BRIDGE_P_OPEN_PRIOR)))
            logit_open[bid] += w if p.claim in ("open", "dry") else -w
            counts[bid] = counts.get(bid, 0) + 1
        elif p.claim == "boats_ready" and p.value is not None:
            if boats_claim is None or w >= boats_claim[0]:
                boats_claim = (w, p.value)
        elif p.claim == "network_down":
            network_w += w

    overrides: dict = {}
    if logit_open:
        overrides["bridge_open"] = {
            bid: {
                "p_open": 1.0 / (1.0 + math.exp(-lo)),
                "source": f"{counts[bid]} field report{'s' if counts[bid] != 1 else ''}",
            }
            for bid, lo in logit_open.items()
        }
    if boats_claim is not None and boats_total > 0:
        share = min(1.0, boats_claim[1] / boats_total)
        overrides["boat_availability"] = {
            "range": [max(0.0, share * 0.85), share, min(1.0, share * 1.1 + 0.02)],
            "source": f"field report: {boats_claim[1]:.0f} boats ready",
        }
    if network_w > 0:
        overrides["comms_degradation"] = {"range": [0.4, 0.6, 0.9], "source": "field report: network down"}
    return overrides


def explain_beliefs(overrides: dict, bridge_names: dict[str, str]) -> list[dict]:
    """Human-readable list of what the reports changed."""
    out = []
    for bid, b in overrides.get("bridge_open", {}).items():
        out.append({"subject": bridge_names.get(bid, bid), "kind": "bridge", "p_open": round(b["p_open"], 3), "source": b["source"]})
    if "boat_availability" in overrides:
        out.append({"subject": "boats", "kind": "boats", "range": overrides["boat_availability"]["range"], "source": overrides["boat_availability"]["source"]})
    if "comms_degradation" in overrides:
        out.append({"subject": "mobile network", "kind": "network", "range": overrides["comms_degradation"]["range"], "source": overrides["comms_degradation"]["source"]})
    return out
