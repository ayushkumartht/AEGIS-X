"""AI strategy advisor: evidence first, then words.

1. `collect_evidence` gathers facts deterministically (live alerts, district flood risk, the
   engine's tested numbers for built districts). Each fact gets an id E1, E2, ...
2. The LLM writes a brief as JSON, every statement citing evidence ids. It never sees anything
   but the evidence and never decides: people accept or reject each recommendation.
3. `validate` rejects an answer with bad JSON, an unknown evidence id, an unknown district, or any
   number that is not in the evidence. A rejected answer is replaced by `rules_brief`, which fills
   the same sections from the evidence alone.
"""

from __future__ import annotations

import json
import threading
import time
from dataclasses import dataclass

from aegis.llm.base import LLMError, LLMProvider
from aegis.llm.explain import numbers_are_grounded
from aegis.ops import districts as watch
from aegis.ops import exercise, store

SEVERITY_RANK = {"Extreme": 4, "Severe": 3, "Moderate": 2, "Minor": 1}
LEVEL_RANK = {"severe": 3, "warning": 2, "watch": 1, "normal": 0}
MAX_ALERTS = 12
MAX_DISTRICTS = 6
MAX_ACTIONS = 5
SECTIONS = ("situation", "worst", "actions", "check_first", "uncertainty")


@dataclass(frozen=True)
class Mode:
    id: str
    name: str
    focus: str  # one sentence given to the model, and used to word the mode action
    action: str  # the mode's own first action for the worst district ({d} = district)


MODES = {
    m.id: m
    for m in (
        Mode("administration", "Administration", "orders, relief camps, public warnings and coordination between departments",
             "Issue the flood warning for {d} through the district administration and confirm relief camps are open and staffed."),
        Mode("disaster_response", "Disaster Response", "rescue boats, rescue teams and shelters",
             "Pre-position NDRF/SDRF rescue teams and boats close to the low-lying areas of {d}."),
        Mode("emergency_management", "Emergency Management", "the control room, resource inventory and information flow",
             "Activate the emergency operations centre for {d} and confirm the boat and vehicle inventory."),
        Mode("armed_forces", "Armed Forces", "flood-rescue columns, boats, engineer support and airlift readiness",
             "Alert flood-rescue columns and boats for {d} and check bridge and road access for their movement."),
        Mode("police", "Police", "traffic control, cordons and escort of evacuation routes",
             "Plan traffic control and cordons on the evacuation routes out of {d} and keep the bridges clear."),
        Mode("capf", "CAPF / Response", "reserve rescue teams and rapid deployment",
             "Place a reserve rescue team on standby for {d} and agree where it would deploy first."),
    )
}
DEFAULT_MODE = "administration"

ADVISOR_SYSTEM = """You are a staff officer writing a flood situation brief for {audience}. You are \
given EVIDENCE as JSON: official alerts, river-flood risk per district, and tested evacuation-engine \
results. Write the brief as ONE JSON object with exactly these keys, each a list of items:
  "situation":   [{{"text": str, "evidence": [ids]}}]
  "worst":       [{{"text": str, "evidence": [ids]}}]
  "actions":     [{{"action": str, "why": str, "gain": str, "cost": str, "risk": str, "district_id": str or null, "evidence": [ids]}}]  (at most {max_actions})
  "check_first": [{{"text": str, "evidence": [ids]}}]
  "uncertainty": [{{"text": str, "evidence": [ids]}}]
Rules:
- Use ONLY facts and numbers in EVIDENCE. Copy numbers exactly as written; never invent or compute a new number.
- Every item cites the evidence ids it rests on, for example ["E2", "E5"].
- An action needs support in the evidence. If the evidence shows no district at watch level or above and no gauge near or above its warning level, "actions" is [].
- Choose actions only from this list, worded for the place in the evidence: pre-position rescue boats and teams; open and staff relief camps; evacuate low-lying areas; warn the public; check bridges and evacuation routes; verify a gauge reading with the district; traffic control and cordons; activate the control room; put reserve teams on standby.
- "why" restates the cited evidence. "gain", "cost" and "risk" may only state what the evidence says (engine results, forecast shares, gauge levels). Where the evidence does not say, write "Not tested" or "Not in the evidence". Do not add facts such as weather, access problems or crew needs.
- "district_id" is the district_id given in the evidence (for example "cachar"), or null when the evidence has none.
- Plain wording only: do not add judgements such as "imminent", "critical" or "dangerous" that the evidence does not state.
- Put your emphasis on {focus}, which affects which listed actions come first, not what the facts are.
- You advise; people decide. Do not use orders ("must", "shall"); use "recommend".
Output the JSON object only."""


# ---------------------------------------------------------------- evidence


class Evidence:
    """Numbered facts. `data` is what the model sees; `kind` and `title` are for the screen."""

    def __init__(self) -> None:
        self.items: list[dict] = []

    def add(self, kind: str, title: str, data: dict, district_id: str | None = None) -> str:
        eid = f"E{len(self.items) + 1}"
        self.items.append({"id": eid, "kind": kind, "title": title, "district_id": district_id, "data": data})
        return eid

    def ids(self) -> set[str]:
        return {i["id"] for i in self.items}

    def get(self, kind: str, district_id: str | None = None) -> list[dict]:
        return [i for i in self.items if i["kind"] == kind and (district_id is None or i["district_id"] == district_id)]

    def model_view(self) -> list[dict]:
        return [{"id": i["id"], "kind": i["kind"], "title": i["title"], "district_id": i["district_id"], "data": i["data"]}
                for i in self.items]


def _gauge_data(e: dict) -> dict:
    g = e["gauge"]
    out = {"gauge_level_m": g["level_m"], "warning_level_m": g["warning_m"], "danger_level_m": g["danger_m"], "trend": g["trend"] or "unknown"}
    if g["warning_m"] is not None:
        out["above_warning_level_m"] = round(g["level_m"] - g["warning_m"], 2)
    if g["danger_m"] is not None:
        out["below_danger_level_m"] = round(g["danger_m"] - g["level_m"], 2)
    return out


def _alert_rank(e: dict) -> tuple:
    g = e["gauge"] or {}
    over = g.get("danger_m") is not None and g["level_m"] >= g["danger_m"]
    return (-int(over), -SEVERITY_RANK.get(e["severity"], 0), e["sent"])


_engine_cache: dict[str, tuple[float, dict]] = {}
_engine_lock = threading.Lock()
ENGINE_TTL_S = 1800.0


def engine_facts(district_id: str, samples: int = 150, scenario: dict | None = None) -> dict | None:
    """Tested numbers for a built district: baseline plan, Red Team and the top "check first" item.

    `scenario` ({"peak_flow": m3/s, "rain_mm": mm}) tests the plan against a stated flood instead of the
    live forecast; the exercise uses it so its numbers match its simulated river level.

    The run takes about 40 s, so the result is kept for 30 minutes (the forecast changes every 6 hours)
    and the background poller warms it after each river-risk refresh.
    """
    d = watch.by_id(district_id)
    if d is None or not d.console:
        return None
    key = f"{district_id}:{json.dumps(scenario, sort_keys=True)}"
    with _engine_lock:
        hit = _engine_cache.get(key)
        if hit and time.monotonic() - hit[0] < ENGINE_TTL_S:
            return hit[1]
        facts = _compute_engine_facts(d, samples, scenario)
        _engine_cache[key] = (time.monotonic(), facts)
        return facts


def _compute_engine_facts(d: watch.WatchedDistrict, samples: int, scenario: dict | None = None) -> dict:
    from aegis.api import context, services
    from aegis.api.schemas import WhatIf
    from aegis.domains.flood.hydrology import Rating
    from aegis.domains.flood.plans import baseline_plan

    ctx = context.get_context(d.console)
    plan = baseline_plan(ctx.scenario)
    what_if, tested = None, "the live forecast"
    if scenario:
        stage = round(Rating(**ctx.forecast["rating"]).stage(float(scenario["peak_flow"])), 2)
        what_if = WhatIf(peak_stage_m=stage, local_rain_mm=scenario["rain_mm"])
        tested = f"a simulated flood peaking {stage} m above normal with {scenario['rain_mm']:.0f} mm of local rain"
    sim = services.simulate(ctx, plan, what_if, samples, 42)
    red = services.redteam(ctx, plan, what_if, samples, 42, 0.6)
    voi = services.voi(ctx, plan, what_if, min(samples, 80), 42)
    names = ctx.scenario.bridge_names
    spof = [{"element": names.get(s["element_id"], s["element_id"]), "drop_pct": round(s["drop_pct"], 1)}
            for s in red["single_points_of_failure"] if s["drop_pct"] > 0.05][:2]
    box = next((b["description"] for b in red["failure_boxes"] if b.get("description")), None)
    check = voi["check_next"][0] if voi["check_next"] else None
    estimates = []
    kinds = [s.kind for s in ctx.scenario.shelters]
    if any(k.startswith("assumed") for k in kinds):
        estimates.append("some shelter positions and all shelter capacities are estimates")
    if ctx.scenario.metadata.get("resources_note", "").startswith("Assumed"):
        estimates.append("the number of boats and vehicles is assumed")
    return {
        "plan": "baseline plan",
        "tested_against": tested,
        "futures_tested": samples,
        "evacuated_on_average_pct": round(sim["summary"]["mean"] * 100),
        "evacuated_on_a_bad_day_pct": round(sim["resilience_worst_10pct"] * 100),
        "plan_fails_in_pct_of_futures": round(red["failure_rate"] * 100),
        "single_points_of_failure": spof,
        "plan_tends_to_fail_when": box,
        "people_moved_unnecessarily_on_average": round(sim["metric_means"]["unneeded_evacuations"]),
        "check_first": ({"action": check["action"], "expected_gain_pct": round(check["voi_pct"])} if check else None),
        "estimates": estimates,
    }


def collect_evidence(include_engine: bool = True, simulated: bool = False) -> Evidence:
    """The facts a brief may use. `simulated` swaps live feeds for the labelled exercise scenario."""
    ev = Evidence()
    if simulated:
        indicators = exercise.indicators(store.latest_indicators())
        alerts = exercise.filter_events(exercise.events(), hazard="flood", active=True)
        week = exercise.week_over_week()
    else:
        indicators = store.latest_indicators()
        alerts = store.list_events(hazard="flood", days=3, active=True)
        week = store.week_over_week("flood")
    cfg = watch.load_config()
    levels = {d.id: indicators.get(d.id, {}).get("level", "unknown") for d in cfg.districts}
    counts = {lv: sum(1 for v in levels.values() if v == lv) for lv in ("severe", "warning", "watch", "normal", "unknown")}
    alerts.sort(key=_alert_rank)
    ev.add("summary", "Watch overview", {
        "districts_watched": len(cfg.districts), "severe": counts["severe"], "warning": counts["warning"],
        "watch": counts["watch"], "normal": counts["normal"], "no_indicator": counts["unknown"],
        "active_flood_alerts": len(alerts), "alerts_this_week": week["this_week"],
    })
    if simulated:
        ev.add("exercise", "Simulated exercise scenario", {"scenario": exercise.TITLE, "notice": exercise.NOTICE})
    for e in alerts[:MAX_ALERTS]:
        data = {"event": e["event"], "severity": e["severity"], "certainty": e["certainty"], "sender": e["sender"],
                "area": e["area"], "state": e["state"], "expires": e["expires"], "headline": e["headline"][:200]}
        if e["gauge"]:
            data.update(_gauge_data(e))
        ev.add("alert", f"{e['event']}: {e['area'][:60]}", data, e.get("district_id"))
    ranked = sorted((d for d in cfg.districts if d.id in indicators and levels[d.id] in LEVEL_RANK),
                    key=lambda d: (-LEVEL_RANK[levels[d.id]], -indicators[d.id]["exceed"].get("2", 0.0)))
    shown = [d for d in ranked if levels[d.id] != "normal"][:MAX_DISTRICTS] or ranked[:3]
    for d in shown:
        ind = indicators[d.id]
        ev.add("district_risk", f"{d.name}: {ind['level']}", {
            "district": d.name, "state": d.state, "river": d.river, "level": ind["level"], "why": ind["reason"],
            "share_of_forecast_members_above_2_year_flood_pct": round(ind["exceed"].get("2", 0.0) * 100),
            "share_above_5_year_flood_pct": round(ind["exceed"].get("5", 0.0) * 100),
            "share_above_20_year_flood_pct": round(ind["exceed"].get("20", 0.0) * 100),
            "flow_peak_day": ind["peak_day"], "flow_peak_median_m3s": round(ind["peak_median"]),
            "flow_5_year_flood_m3s": round(ind["flows"]["5"]), "flow_history_years": ind["history"].get("years"),
        }, d.id)
    if include_engine:
        for d in cfg.districts:
            if d.console and levels.get(d.id) in LEVEL_RANK:
                scenario = None
                rain = exercise.engine_rain_mm(levels[d.id]) if simulated else None
                if rain:
                    scenario = {"peak_flow": float(indicators[d.id]["peak_median"]), "rain_mm": rain}
                facts = engine_facts(d.id, scenario=scenario)
                if facts:
                    ev.add("engine", f"{d.name}: tested plan", {"district": d.name, **facts}, d.id)
    for feed in ([] if simulated else store.feeds()):
        if feed["last_error"]:
            ev.add("feed_down", f"{feed['name']} unavailable", {"feed": feed["name"], "error": feed["last_error"][:160],
                                                                  "last_success": feed["last_success"] or "never"})
    return ev


# ---------------------------------------------------------------- rules brief


def _item(text: str, *ids: str) -> dict:
    return {"text": text, "evidence": [i for i in ids if i]}


def _first(ev: Evidence, kind: str, district_id: str | None = None) -> dict | None:
    found = ev.get(kind, district_id)
    return found[0] if found else None


def rules_brief(ev: Evidence, mode: Mode) -> dict:
    """The brief from the evidence alone: no language model."""
    summary = _first(ev, "summary")
    s = summary["data"]
    risky = [i for i in ev.get("district_risk") if i["data"]["level"] != "normal"]
    sections: dict[str, list] = {k: [] for k in SECTIONS}

    # situation
    if risky:
        sections["situation"].append(_item(
            f"{s['severe']} severe, {s['warning']} warning and {s['watch']} watch districts out of {s['districts_watched']} watched, "
            "from the river-flow forecast.", summary["id"]))
    else:
        sections["situation"].append(_item(
            f"No watched district is at watch level or above: all {s['normal']} with a forecast are normal "
            f"({s['no_indicator']} have no river indicator).", summary["id"]))
    sections["situation"].append(_item(f"{s['active_flood_alerts']} official flood alerts are active.", summary["id"]))
    for a in [i for i in ev.get("alert") if "gauge_level_m" in i["data"]][:3]:
        d = a["data"]
        text = f"River gauge in {d['area']}: {d['gauge_level_m']} m"
        if d.get("above_warning_level_m") is not None:
            text += f", {abs(d['above_warning_level_m'])} m {'above' if d['above_warning_level_m'] >= 0 else 'below'} its warning level"
        if d.get("below_danger_level_m") is not None:
            text += f" and {abs(d['below_danger_level_m'])} m {'below' if d['below_danger_level_m'] >= 0 else 'above'} its danger level"
        sections["situation"].append(_item(text + f", trend {d['trend']} ({d['sender']}).", a["id"]))

    # worst: districts above normal; on a quiet day only the one closest to a watch level, if any is
    for r in risky[:5]:
        d = r["data"]
        sections["worst"].append(_item(
            f"{d['district']}, {d['state']} ({d['river']}): {d['level']}. {d['why'].capitalize()}. "
            f"Median peak flow {d['flow_peak_median_m3s']} m3/s on {d['flow_peak_day']}.", r["id"]))
    if not risky:
        close = max(ev.get("district_risk"), key=lambda i: i["data"]["share_of_forecast_members_above_2_year_flood_pct"], default=None)
        if close and close["data"]["share_of_forecast_members_above_2_year_flood_pct"] > 0:
            d = close["data"]
            sections["worst"].append(_item(
                f"Closest to a watch level: {d['district']}, {d['state']}, where {d['share_of_forecast_members_above_2_year_flood_pct']}% "
                "of forecast members pass the 2-year flood (a watch level needs 30%).", close["id"]))

    # actions
    verbs = {
        "severe": "Recommend starting evacuation of the low-lying areas and opening relief camps in {d}.",
        "warning": "Recommend pre-positioning rescue boats and vehicles, opening relief camps and warning the low-lying areas of {d}.",
        "watch": "Recommend putting the {d} control room on watch and checking shelters, boats and bridge access.",
    }
    for n, r in enumerate(risky[:MAX_ACTIONS]):
        d = r["data"]
        eng = _first(ev, "engine", r["district_id"])
        text = (mode.action if n == 0 else verbs[d["level"]]).format(d=d["district"])
        if n == 0 and mode.id == DEFAULT_MODE:
            text = verbs[d["level"]].format(d=d["district"])
        ids = [r["id"]]
        if eng:
            e = eng["data"]
            ids.append(eng["id"])
            gain = (f"The baseline plan evacuates {e['evacuated_on_average_pct']}% on average and "
                    f"{e['evacuated_on_a_bad_day_pct']}% on a bad day ({e['futures_tested']} futures tested against {e['tested_against']}).")
            cost = f"On average {e['people_moved_unnecessarily_on_average']} people would be moved who did not need to be."
            risk = f"The plan fails in {e['plan_fails_in_pct_of_futures']}% of futures."
            if e["single_points_of_failure"]:
                top = e["single_points_of_failure"][0]
                risk += f" Biggest single point of failure: {top['element']} (result drops {top['drop_pct']}%)."
        else:
            gain = "Not tested: no evacuation scenario is built for this district, so this is a standard preparedness step."
            cost = f"Resources are committed before the flood, and {d['share_above_5_year_flood_pct']}% of forecast members pass the 5-year flood."
            risk = "River forecast only: local drainage and embankment breaches are not in the model."
        sections["actions"].append({"action": text, "why": d["why"].capitalize() + ".", "gain": gain, "cost": cost, "risk": risk,
                                    "district_id": r["district_id"], "evidence": ids})
    for a in [i for i in ev.get("alert") if i["data"].get("below_danger_level_m") is not None and i["data"]["below_danger_level_m"] <= 0][:2]:
        d = a["data"]
        if len(sections["actions"]) >= MAX_ACTIONS:
            break
        sections["actions"].append({
            "action": f"Recommend treating the area around the {d['area']} gauge as in flood and confirming evacuation readiness with the district.",
            "why": f"The gauge is at {d['gauge_level_m']} m, above its danger level of {d['danger_level_m']} m ({d['sender']}).",
            "gain": "Not tested: no evacuation scenario is built for this area.",
            "cost": "Early movement of people who may be safe on higher ground.",
            "risk": "A single gauge reading; the area it protects may differ from the alert's area text.",
            "district_id": a["district_id"], "evidence": [a["id"]]})

    # check first
    for e in ev.get("engine"):
        c = e["data"]["check_first"]
        if c and c["expected_gain_pct"] >= 1:  # a check worth 0% would only add noise
            sections["check_first"].append(_item(f"{e['data']['district']}: {c['action']} (expected gain {c['expected_gain_pct']}%).", e["id"]))
        if e["data"]["plan_tends_to_fail_when"]:
            sections["check_first"].append(_item(f"{e['data']['district']}: the plan tends to fail when {e['data']['plan_tends_to_fail_when']}.", e["id"]))

    # uncertainty
    sections["uncertainty"].append(_item(
        "River risk comes from a global forecast (GloFAS, about 5 km): local drainage and embankment breaches are not in it.", summary["id"]))
    for x in ev.get("exercise"):
        sections["uncertainty"].append(_item("All alerts and river levels in this brief are simulated for an exercise.", x["id"]))
    for e in ev.get("engine"):
        for est in e["data"]["estimates"]:
            sections["uncertainty"].append(_item(f"{e['data']['district']}: {est}.", e["id"]))
    for f in ev.get("feed_down"):
        sections["uncertainty"].append(_item(f"{f['data']['feed']} is unavailable (last worked: {f['data']['last_success']}).", f["id"]))
    if s["no_indicator"]:
        sections["uncertainty"].append(_item(f"{s['no_indicator']} watched districts have no river indicator (the river is not resolved by the forecast model).", summary["id"]))
    return sections


# ---------------------------------------------------------------- LLM brief and its guardrail


def _texts(item: dict) -> list[str]:
    return [v for k, v in item.items() if isinstance(v, str) and k not in ("district_id",)]


def _sentence(action: str) -> str:
    """Make a model's bare action phrase read as a recommendation: "warn the public" -> "Recommend: warn the public."."""
    text = action.strip().rstrip(".")
    if not text.lower().startswith("recommend"):
        text = "Recommend: " + text[0].lower() + text[1:]
    return text[0].upper() + text[1:] + "."


def validate(raw: object, ev: Evidence, district_ids: set[str]) -> dict | None:
    """The model's brief if it is well formed and grounded in the evidence, else None."""
    if not isinstance(raw, dict):
        return None
    known = ev.ids()
    # fixed definitions the text may mention, besides the evidence itself
    shown = [*ev.model_view(), {"definitions": {"flood return periods in years": [2, 5, 20], "forecast days": 7}}]
    out: dict[str, list] = {}
    for key in SECTIONS:
        items = raw.get(key, [])
        if not isinstance(items, list) or (key == "actions" and len(items) > MAX_ACTIONS):
            return None
        clean = []
        for it in items:
            if not isinstance(it, dict) or not isinstance(it.get("evidence"), list) or not it["evidence"]:
                return None
            if not all(isinstance(i, str) and i in known for i in it["evidence"]):
                return None
            required = ("action", "why", "gain", "cost", "risk") if key == "actions" else ("text",)
            if not all(isinstance(it.get(r), str) and it[r].strip() for r in required):
                return None
            if key == "actions" and it.get("district_id") not in (None, *district_ids):
                return None
            if not all(numbers_are_grounded(t, shown) for t in _texts(it)):
                return None
            keep = {k: it[k] for k in (*required, "evidence") if k in it}
            if key == "actions":
                keep["district_id"] = it.get("district_id")
                keep["action"] = _sentence(keep["action"])
            clean.append(keep)
        out[key] = clean
    if out["actions"] and not any(i["data"].get("level") in ("watch", "warning", "severe") for i in ev.get("district_risk")) \
            and not any("gauge_level_m" in i["data"] for i in ev.get("alert")):
        return None  # actions with nothing at watch level or above in the evidence
    return out


def llm_brief(ev: Evidence, mode: Mode, provider: LLMProvider) -> dict | None:
    if provider.name == "none":
        return None
    system = ADVISOR_SYSTEM.format(audience=mode.name, focus=mode.focus, max_actions=MAX_ACTIONS)
    try:
        text = provider.complete(system, json.dumps(ev.model_view(), default=str), json_mode=True, temperature=0.2)
        raw = json.loads(text)
    except (LLMError, ValueError):
        return None
    return validate(raw, ev, {i["district_id"] for i in ev.items if i["district_id"]})


def build_brief(mode_id: str, provider: LLMProvider, include_engine: bool = True, simulated: bool = False) -> dict:
    """{"sections", "source", "model", "evidence", "recommendations"} for the current evidence."""
    mode = MODES.get(mode_id) or MODES[DEFAULT_MODE]
    ev = collect_evidence(include_engine, simulated)
    sections = llm_brief(ev, mode, provider)
    source = provider.name if sections else "rules"
    if sections is None:
        sections = rules_brief(ev, mode)
    if simulated:  # whoever wrote the brief, it must say what it is built on
        marker = ev.get("exercise")[0]
        sections["situation"].insert(0, _item("EXERCISE: this brief is built on a simulated scenario, not on real alerts or river levels.", marker["id"]))
    model = getattr(provider, "model", "") if source != "rules" else ""
    return {"mode": mode.id, "sections": sections, "source": source, "model": model,
            "evidence": ev.items, "recommendations": sections["actions"]}
