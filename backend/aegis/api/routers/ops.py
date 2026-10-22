"""Command Center API: live alerts, district flood risk, the AI strategy advisor and its decisions."""

from __future__ import annotations

import asyncio
import threading
import time
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from aegis.api.limits import heavy, rate_limited
from aegis.api.schemas import OperatorName
from aegis.exceptions import AegisError
from aegis.ingest import geocode
from aegis.llm.base import get_provider
from aegis.ops import advisor, hazards, poller, store
from aegis.ops import districts as watch
from aegis.ops import exercise as exercise_data
from aegis.settings import get_settings
from aegis.storage import repo

router = APIRouter(prefix="/ops", tags=["command-center"])
INDIA = (68.0, 6.0, 98.0, 38.0)
SEARCH_GAP_S = 1.1
_search_lock = threading.Lock()
_last_search = 0.0


def _alert_json(e: dict) -> dict:
    return {**e, "active": store.is_active(e)}


@router.get("/hazards")
def hazard_list():
    return hazards.describe()


@router.get("/feeds")
def feed_health(exercise: bool = False):
    if exercise:
        return {"feeds": exercise_data.feeds(), "offline": False, "exercise": True}
    return {"feeds": store.feeds(), "offline": get_settings().aegis_offline, "exercise": False}


@router.get("/exercise")
def exercise_info():
    """The simulated scenario a viewer can switch to (`?exercise=true` on the other endpoints)."""
    return {"title": exercise_data.TITLE, "notice": exercise_data.NOTICE, "source": exercise_data.SOURCE}


@router.get("/events")
def events(hazard: str | None = None, severity: str | None = None, state: str | None = None,
           active: bool | None = None, days: int = Query(3, ge=1, le=30), district_id: str | None = None,
           exercise: bool = False):
    if exercise:
        found = exercise_data.filter_events(exercise_data.events(), hazard=hazard, severity=severity, state=state,
                                            active=active, district_id=district_id)
        week = exercise_data.week_over_week()
    else:
        found = store.list_events(hazard=hazard, severity=severity, state=state, active=active, days=days, district_id=district_id)
        week = store.week_over_week(hazard)
    rows = [_alert_json(e) for e in found]
    features = [
        {"type": "Feature", "geometry": {"type": "Point", "coordinates": [e["lon"], e["lat"]]},
         "properties": {k: e[k] for k in ("uid", "event", "severity", "hazard", "area", "state", "sender", "headline", "place_method", "active")}
         | {"gauge": e["gauge"]}}
        for e in rows if e["lat"] is not None
    ]
    by_severity: dict[str, int] = {}
    for e in rows:
        by_severity[e["severity"]] = by_severity.get(e["severity"], 0) + 1
    return {
        "events": rows,
        "geojson": {"type": "FeatureCollection", "features": features},
        "counts": {"total": len(rows), "located": len(features), "active": sum(e["active"] for e in rows), "by_severity": by_severity},
        "week_over_week": week,
        "exercise": exercise,
    }


@router.get("/districts")
def district_list(exercise: bool = False):
    if exercise:
        indicators = exercise_data.indicators(store.latest_indicators())
        alerts = [e for e in exercise_data.filter_events(exercise_data.events(), hazard="flood", active=True) if e.get("district_id")]
    else:
        indicators = store.latest_indicators()
        alerts = [e for e in store.list_events(hazard="flood", days=3, active=True) if e.get("district_id")]
    out = []
    for d in watch.load_config().districts:
        ind = indicators.get(d.id)
        mine = [a for a in alerts if a["district_id"] == d.id]
        out.append({
            "id": d.id, "name": d.name, "state": d.state, "river": d.river, "lat": d.lat, "lon": d.lon, "console": d.console,
            "level": ind["level"] if ind else "unknown", "indicator": ind,
            "alerts": [{"event": a["event"], "severity": a["severity"], "headline": a["headline"], "gauge": a["gauge"]} for a in mine],
        })
    order = {"severe": 0, "warning": 1, "watch": 2, "normal": 3, "unknown": 4}
    out.sort(key=lambda x: (order.get(x["level"], 4), x["name"]))
    return {"districts": out, "rule": watch.load_config().rule.__dict__, "exercise": exercise}


@router.post("/refresh", dependencies=[Depends(heavy)])
def refresh(risk: bool = False):
    result = {"alerts": poller.refresh_alerts()}
    if risk:
        result["risk"] = poller.refresh_risk()
    return result


class BriefRequest(BaseModel):
    author: str = OperatorName
    mode: str = advisor.DEFAULT_MODE
    include_engine: bool = True
    exercise: bool = False  # build the brief from the simulated scenario instead of live data


@router.get("/modes")
def modes():
    return [{"id": m.id, "name": m.name, "focus": m.focus} for m in advisor.MODES.values()]


@router.post("/brief", dependencies=[Depends(heavy)])
async def make_brief(req: BriefRequest):
    if req.mode not in advisor.MODES:
        raise HTTPException(422, f"Unknown mode {req.mode!r}.")
    result = await asyncio.to_thread(advisor.build_brief, req.mode, get_provider(), req.include_engine, req.exercise)
    brief_id = store.add_brief(result["mode"], req.author.strip(), result["source"], result["model"],
                               result["evidence"], result["sections"], result["recommendations"])
    return store.get_brief(brief_id)


@router.get("/briefs")
def briefs(limit: int = Query(10, ge=1, le=50)):
    return store.list_briefs(limit)


class DecisionBody(BaseModel):
    author: str = OperatorName
    action: Literal["accept", "reject"]
    note: str = Field(default="", max_length=500)


@router.post("/recommendations/{rec_id}/decision", dependencies=[Depends(rate_limited)])
def decide(rec_id: int, body: DecisionBody):
    rec = store.get_recommendation(rec_id)
    if rec is None:
        raise HTTPException(404, "No such recommendation.")
    if rec["status"] != "proposed":
        raise HTTPException(409, f"This recommendation was already {rec['status']}.")
    brief = store.get_brief(rec["brief_id"])
    cited = {i["id"]: i for i in brief["evidence"] if i["id"] in rec["evidence"]}
    signature = body.author.strip()
    decision_id = repo.add_decision(
        rec.get("district_id") or "all", signature, body.action, {}, None,
        f"Command Center recommendation: {rec['action']}", body.note,
        {"kind": "command_center_recommendation", "brief_id": brief["id"], "mode": brief["mode"], "source": brief["source"],
         "exercise": any(i["kind"] == "exercise" for i in brief["evidence"]),
         "recommendation": {k: rec[k] for k in ("action", "why", "gain", "cost", "risk")}, "evidence": list(cited.values())},
    )
    store.decide_recommendation(rec_id, "accepted" if body.action == "accept" else "rejected", signature, decision_id)
    return {"decision_id": decision_id, "status": "accepted" if body.action == "accept" else "rejected"}


@router.get("/search", dependencies=[Depends(rate_limited)])
def search(q: str = Query(min_length=2, max_length=100)):
    """Place search across India (OpenStreetMap Nominatim, cached; at most one live request a second)."""
    global _last_search
    if get_settings().aegis_offline:
        raise HTTPException(503, "Place search is off in offline mode.")
    with _search_lock:
        wait = SEARCH_GAP_S - (time.monotonic() - _last_search)
        if wait > 0:
            time.sleep(wait)
        try:
            hits = geocode.search("ops", q.strip(), INDIA)
        except AegisError as exc:
            raise HTTPException(502, f"The place search service did not answer: {exc}") from exc
        finally:
            _last_search = time.monotonic()
    return [{"name": h["name"], "lat": h["lat"], "lon": h["lon"], "type": h["type"]} for h in hits]
