"""The uncertain inputs of a flood, as ranges with their sources.

prior_space(): ranges from assumptions only (used for the offline demo).
forecast_space(): rain and river-discharge ensembles replace the priors for those variables, and
field-report beliefs (from the fusion layer, passed in as a plain dict) narrow the rest.
"""

from __future__ import annotations

import numpy as np

from aegis.domains.flood.hydrology import Rating
from aegis.domains.flood.types import KEY_BRIDGE_PREFIX, FloodScenario
from aegis.engine.interfaces import ConditionSpace, Variable

BRIDGE_P_OPEN_PRIOR = 0.95
HORIZON_DAYS = 3  # forecast days that fall inside the 48 h horizon, rounded up


def _bridge_variables(scenario: FloodScenario, overrides: dict | None) -> list[Variable]:
    beliefs = (overrides or {}).get("bridge_open", {})
    out = []
    for bid in sorted(scenario.bridges):
        if bid in beliefs:
            p, why = float(beliefs[bid]["p_open"]), beliefs[bid].get("source", "field reports")
        else:
            p, why = BRIDGE_P_OPEN_PRIOR, "prior: bridges close for reasons other than flooding about 5% of the time"
        out.append(Variable(KEY_BRIDGE_PREFIX + bid, kind="binary", p_true=p, source=why))
    return out


def _range(overrides: dict | None, key: str, default: tuple[float, float, float], why: str) -> tuple[float, float, float, str]:
    if overrides and key in overrides:
        lo, mode, hi = overrides[key]["range"]
        return lo, mode, hi, overrides[key].get("source", "field reports")
    return default[0], default[1], default[2], why


def _tri(name: str, spec: tuple[float, float, float, str]) -> Variable:
    lo, mode, hi, why = spec
    return Variable(name, low=lo, mode=mode, high=hi, source=why)


def _common(overrides: dict | None) -> list[Variable]:
    return [
        Variable("stage_bias_m", low=-0.5, high=0.5, source="assumed error of the rating curve and the coarse forecast"),
        Variable("peak_time_h", low=6.0, high=36.0, source="assumed: peak any time in the next 6 to 36 hours"),
        _tri("boat_availability_pct", _range(overrides, "boat_availability", (0.4, 0.8, 1.0), "prior: some boats are always unavailable")),
        _tri("boat_delay_h", _range(overrides, "boat_delay_h", (1.0, 3.0, 8.0), "prior: boats take hours to arrive")),
        _tri("comms_degradation_pct", _range(overrides, "comms_degradation", (0.0, 0.1, 0.5), "prior: networks degrade in floods")),
        _tri("compliance_pct", _range(overrides, "compliance", (0.4, 0.75, 0.95), "prior: many people refuse to leave (Bihar, Assam events)")),
    ]


def prior_space(
    scenario: FloodScenario,
    peak_stage: tuple[float, float, float] = (0.3, 2.0, 6.0),
    overrides: dict | None = None,
) -> ConditionSpace:
    lo, mode, hi = peak_stage
    variables = [
        Variable("peak_stage_m", low=lo, mode=mode, high=hi, source="prior: no forecast loaded"),
        Variable("local_rain_mm", low=10.0, mode=60.0, high=250.0, source="prior: no forecast loaded"),
        *_common(overrides),
        *_bridge_variables(scenario, overrides),
    ]
    return ConditionSpace(variables)


WHAT_IF_SCALARS = (
    "peak_stage_m",
    "stage_bias_m",
    "peak_time_h",
    "local_rain_mm",
    "boat_availability_pct",
    "boat_delay_h",
    "comms_degradation_pct",
    "compliance_pct",
)


def apply_what_if(space: ConditionSpace, what_if: dict | None) -> ConditionSpace:
    """A copy of `space` with some variables fixed: {"peak_stage_m": 3.0, "bridge_closed": ["b_1"]}.

    Fixed variables are shown with source "what-if" so nobody mistakes them for a forecast.
    """
    if not what_if:
        return space
    closed = set(what_if.get("bridge_closed") or [])
    out = []
    for v in space.variables:
        if v.name in WHAT_IF_SCALARS and what_if.get(v.name) is not None:
            x = float(what_if[v.name])
            out.append(Variable(v.name, low=x, high=x, source="what-if (set by the officer)"))
        elif v.name.startswith(KEY_BRIDGE_PREFIX) and v.name[len(KEY_BRIDGE_PREFIX) :] in closed:
            out.append(Variable(v.name, kind="binary", p_true=0.0, source="what-if: bridge closed"))
        else:
            out.append(v)
    return ConditionSpace(out)


def forecast_space(
    scenario: FloodScenario,
    rain: dict,
    flow: dict,
    rating: Rating,
    overrides: dict | None = None,
) -> tuple[ConditionSpace, float, dict]:
    """(ConditionSpace, base_stage_m, meta) from the rain and discharge ensembles.

    peak_stage_m: each discharge member's maximum over the first days, through the rating curve.
    local_rain_mm: each rain member's total over the first two days.
    base_stage_m: the stage at the ensemble's current (day 0) mean discharge.
    """
    q = np.asarray(flow["members"], dtype=float)  # (members, days)
    r = np.asarray(rain["members"], dtype=float)
    peaks = [rating.stage(float(m[:HORIZON_DAYS].max())) for m in q]
    base = rating.stage(float(q[:, 0].mean()))
    rain_totals = r[:, :2].sum(axis=1)

    variables = [
        Variable(
            "peak_stage_m",
            kind="empirical",
            samples=[float(p) for p in peaks],
            source=f"GloFAS ensemble {flow['dates'][0]} ({len(q)} members) via rating curve",
        ),
        Variable(
            "local_rain_mm",
            kind="empirical",
            samples=[float(x) for x in rain_totals],
            source=f"ECMWF ensemble {rain['dates'][0]} ({len(r)} members), 2-day total",
        ),
        *_common(overrides),
        *_bridge_variables(scenario, overrides),
    ]
    meta = {
        "forecast_date": flow["dates"][0],
        "n_discharge_members": len(q),
        "n_rain_members": len(r),
        "base_stage_m": base,
        "peak_stage_range_m": [float(min(peaks)), float(max(peaks))],
        "rain_range_mm": [float(rain_totals.min()), float(rain_totals.max())],
    }
    return ConditionSpace(variables), base, meta
