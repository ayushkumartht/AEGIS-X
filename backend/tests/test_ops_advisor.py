"""Command Center: the advisor and its guardrail, the decision hash chain, and the /ops API."""

import json
import sqlite3

import pytest
from fastapi.testclient import TestClient

from aegis.api import context, limits
from aegis.api.main import create_app
from aegis.ops import advisor, store
from aegis.ops import districts as watch
from aegis.settings import get_settings
from aegis.storage import repo
from aegis.storage.db import db_path

P = "/api/v1"


def _indicator(level="warning", exceed5=0.5):
    return {
        "level": level, "forecast_dates": ["2026-10-22", "2026-10-23"], "flows": {"2": 1600.0, "5": 2100.0, "20": 2700.0},
        "exceed": {"2": 0.8, "5": exceed5, "20": 0.0}, "peak_day": "2026-10-23", "peak_median": 2300.0, "today_median": 900.0,
        "members": 51, "history": {"years": "2005-2025", "n_years": 21}, "cell": {"lat": 24.88, "lon": 92.73, "mean_flow": 855.0},
        "reason": "50% of forecast members pass the 5-year flood (2100 m3/s)",
    }


GAUGE_ALERT = {
    "uid": "sachet:1", "source": "NDMA SACHET", "hazard": "flood", "event": "Flood", "severity": "Severe", "urgency": "Future",
    "certainty": "Likely", "sender": "CWC", "state": "Bihar", "area": "Gandak, Dumariaghat, Gopalganj, Bihar",
    "headline": "River Gandak is above the danger level.", "description": "", "lat": 26.35, "lon": 84.76,
    "place_method": "gauge position in the alert", "district_id": "gopalganj", "effective": "2026-10-22T06:00:00+05:30",
    "expires": "2999-01-01T00:00:00+05:30", "sent": "2026-10-22T09:35:37+05:30", "url": "u",
    "gauge": {"level_m": 62.5, "warning_m": 61.22, "danger_m": 62.22, "highest_m": None, "trend": "rising"},
}


@pytest.fixture
def db(tmp_path, monkeypatch):
    monkeypatch.setenv("AEGIS_DB_URL", f"sqlite:///{(tmp_path / 'ops.db').as_posix()}")
    monkeypatch.setenv("LLM_PROVIDER", "none")
    monkeypatch.setenv("AEGIS_RATE_LIMIT_PER_MIN", "0")
    get_settings.cache_clear()
    watch.load_config.cache_clear()
    context.reset()
    limits.reset()
    yield
    get_settings.cache_clear()
    watch.load_config.cache_clear()
    context.reset()
    limits.reset()


def seed(level="warning"):
    store.add_indicator("cachar", level, _indicator(level))
    store.upsert_events([GAUGE_ALERT])


class FakeLLM:
    name = "fake"
    model = "fake-1"

    def __init__(self, reply):
        self.reply = reply

    def complete(self, system, user, *, json_mode=False, temperature=0.2):
        return self.reply if isinstance(self.reply, str) else json.dumps(self.reply)


def good_reply(ev):
    risk = ev.get("district_risk")[0]
    return {
        "situation": [{"text": "A river gauge shows flood conditions.", "evidence": [ev.get("summary")[0]["id"]]}],
        "worst": [{"text": f"{risk['data']['district']} is at {risk['data']['level']} level.", "evidence": [risk["id"]]}],
        "actions": [{"action": "Recommend pre-positioning boats.", "why": "The forecast passes the 5-year flood.",
                     "gain": "Not tested.", "cost": "Resources are committed early.", "risk": "River forecast only.",
                     "district_id": "cachar", "evidence": [risk["id"]]}],
        "check_first": [], "uncertainty": [{"text": "Global model, about 5 km.", "evidence": [risk["id"]]}],
    }


def test_rules_brief_cites_evidence_and_gauge_numbers(db):
    seed()
    ev = advisor.collect_evidence(include_engine=False)
    brief = advisor.rules_brief(ev, advisor.MODES["armed_forces"])
    assert set(brief) == set(advisor.SECTIONS)
    text = " ".join(i["text"] for i in brief["situation"])
    assert "62.5 m" in text and "danger level" in text
    action = brief["actions"][0]
    assert "flood-rescue columns" in action["action"] and "Cachar" in action["action"]
    assert "Not tested" in action["gain"]  # no engine evidence without include_engine
    ids = ev.ids()
    assert all(set(i["evidence"]) <= ids for s in brief.values() for i in s)


def test_quiet_day_gives_no_actions(db):
    store.add_indicator("cachar", "normal", _indicator("normal", exceed5=0.0))
    ev = advisor.collect_evidence(include_engine=False)
    brief = advisor.rules_brief(ev, advisor.MODES["administration"])
    assert brief["actions"] == [] and "No watched district" in brief["situation"][0]["text"]


def test_engine_evidence_supports_actions_with_tested_numbers(db):
    seed("severe")
    ev = advisor.collect_evidence(include_engine=True)
    engine = ev.get("engine", "cachar")
    assert engine and engine[0]["data"]["futures_tested"] == 150
    brief = advisor.rules_brief(ev, advisor.MODES["administration"])
    gain = brief["actions"][0]["gain"]
    assert f"{engine[0]['data']['evacuated_on_average_pct']}% on average" in gain


def test_llm_brief_is_accepted_when_grounded(db):
    seed()
    ev = advisor.collect_evidence(include_engine=False)
    out = advisor.build_brief("police", FakeLLM(good_reply(ev)), include_engine=False)
    assert out["source"] == "fake" and out["model"] == "fake-1"
    assert out["sections"]["actions"][0]["action"] == "Recommend pre-positioning boats."


def test_llm_brief_with_an_invented_number_is_replaced_by_rules(db):
    seed()
    ev = advisor.collect_evidence(include_engine=False)
    reply = good_reply(ev)
    reply["situation"][0]["text"] = "About 48213 people are in danger."
    out = advisor.build_brief("police", FakeLLM(reply), include_engine=False)
    assert out["source"] == "rules" and "48213" not in json.dumps(out["sections"])


@pytest.mark.parametrize("break_it", [
    lambda r: r["worst"][0].update(evidence=["E999"]),            # an evidence id that does not exist
    lambda r: r["actions"][0].update(district_id="atlantis"),     # a district that is not watched
    lambda r: r["actions"][0].pop("cost"),                         # a missing field
    lambda r: r["situation"][0].update(evidence=[]),               # a statement without evidence
    lambda r: r.update(actions=r["actions"] * 6),                  # too many actions
])
def test_malformed_llm_briefs_fall_back_to_rules(db, break_it):
    seed()
    ev = advisor.collect_evidence(include_engine=False)
    reply = good_reply(ev)
    break_it(reply)
    assert advisor.build_brief("police", FakeLLM(reply), include_engine=False)["source"] == "rules"
    assert advisor.build_brief("police", FakeLLM("not json at all"), include_engine=False)["source"] == "rules"


def test_actions_without_anything_at_watch_level_are_rejected(db):
    store.add_indicator("cachar", "normal", _indicator("normal", exceed5=0.0))
    ev = advisor.collect_evidence(include_engine=False)
    reply = good_reply(ev)
    assert advisor.validate(reply, ev, {"cachar"}) is None


# ---------------------------------------------------------------- exercise scenario


def _live(level="normal"):
    """A live indicator with real-looking flood flows for every watched district."""
    return {d.id: {**_indicator(level, exceed5=0.0), "level": level, "exceed": {"2": 0.0, "5": 0.0, "20": 0.0},
                   "flows": {"2": 1600.0 + i, "5": 2100.0 + i, "20": 2700.0 + i}}
            for i, d in enumerate(watch.load_config().districts)}


def test_exercise_scenario_is_labelled_complete_and_plausible(db):
    from aegis.ops import exercise
    inds = exercise.indicators(_live())
    levels = {k: v["level"] for k, v in inds.items()}
    assert levels["cachar"] == "severe" and levels["karimganj"] == "warning" and levels["hailakandi"] == "watch"
    assert levels["patna"] == "normal"  # districts outside the scenario keep their live level
    c = inds["cachar"]
    assert c["simulated"] and c["exceed"]["20"] > 0.3 and c["peak_median"] > c["flows"]["20"]  # severe: past the 20-year flood
    assert inds["karimganj"]["exceed"]["5"] > 0.3 > inds["karimganj"]["exceed"]["20"]
    rows = exercise.events()
    assert all(e["uid"].startswith("exercise:") and e["source"] == exercise.SOURCE for e in rows)
    assert all(e["lat"] is not None for e in rows) and any(e["gauge"] for e in rows)
    cachar_gauge = next(e for e in rows if e["uid"] == "exercise:cwc-barak-annapurnaghat")
    assert cachar_gauge["gauge"]["level_m"] > cachar_gauge["gauge"]["danger_m"]  # above danger, as a severe flood would be
    assert "0.43 m above its Danger Level of 21.43 m" in cachar_gauge["description"]
    active = exercise.filter_events(rows, hazard="flood", active=True)
    assert len(active) == len(rows) and active[0]["sent"] >= active[-1]["sent"]
    assert exercise.filter_events(rows, state="bihar") and not exercise.filter_events(rows, hazard="fire")


def test_exercise_is_per_viewer_and_never_mixed_with_live_data(db, monkeypatch):
    seed("normal")
    c = TestClient(create_app())
    live = c.get(f"{P}/ops/events").json()
    assert live["exercise"] is False and live["counts"]["total"] == 1 and live["events"][0]["uid"] == "sachet:1"
    sim = c.get(f"{P}/ops/events", params={"exercise": True}).json()
    assert sim["exercise"] and sim["counts"]["total"] >= 10 and all(e["uid"].startswith("exercise:") for e in sim["events"])
    assert sim["counts"]["located"] == sim["counts"]["total"]
    again = c.get(f"{P}/ops/events").json()
    assert again["counts"]["total"] == 1  # asking for the exercise changed nothing for anyone else
    feeds = c.get(f"{P}/ops/feeds", params={"exercise": True}).json()
    assert feeds["exercise"] and feeds["feeds"][0]["name"] == "SIMULATED EXERCISE"
    d = c.get(f"{P}/ops/districts", params={"exercise": True}).json()["districts"]
    assert d[0]["level"] == "severe" and d[0]["id"] == "cachar" and any(x["alerts"] for x in d[:3])


def test_exercise_brief_says_it_is_simulated_and_decisions_are_flagged(db, monkeypatch):
    store.add_indicator("cachar", "normal", _indicator("normal", 0.0))
    monkeypatch.setattr(advisor, "engine_facts", lambda *a, **k: None)  # the engine has its own tests
    with TestClient(create_app()) as c:
        brief = c.post(f"{P}/ops/brief", json={"mode": "armed_forces", "exercise": True, "author": "Ops desk"}).json()
        first = brief["sections"]["situation"][0]["text"]
        assert first.startswith("EXERCISE") and any(i["kind"] == "exercise" for i in brief["evidence"])
        assert brief["recommendations"] and any("simulated" in u["text"] for u in brief["sections"]["uncertainty"])
        rec = brief["recommendations"][0]
        c.post(f"{P}/ops/recommendations/{rec['id']}/decision", json={"action": "accept"})
        assert c.get(f"{P}/decisions").json()[0]["evidence"]["exercise"] is True
        live = c.post(f"{P}/ops/brief", json={"mode": "armed_forces"}).json()
        assert not any(i["kind"] == "exercise" for i in live["evidence"])


def test_engine_is_tested_against_the_simulated_flood(db):
    store.add_indicator("cachar", "normal", _indicator("normal", 0.0))  # the scenario builds on a district's real flood flows
    ev = advisor.collect_evidence(include_engine=True, simulated=True)
    engine = ev.get("engine", "cachar")[0]["data"]
    assert "simulated flood peaking" in engine["tested_against"] and "180 mm" in engine["tested_against"]
    live = advisor.engine_facts("cachar")
    assert live["tested_against"] == "the live forecast"
    assert engine["evacuated_on_a_bad_day_pct"] <= live["evacuated_on_a_bad_day_pct"]  # a bigger flood is no easier


# ---------------------------------------------------------------- hash chain


def test_decision_chain_detects_edits_and_deleted_rows(db):
    assert repo.audit_integrity()["status"] == "valid"
    ids = [repo.add_decision("cachar", "A", "accept", {"start_hour": h}, None, "x", "", {"n": h}) for h in range(4)]
    ok = repo.audit_integrity()
    assert ok["status"] == "valid" and ok["checked"] == 4 and ok["head"]
    con = sqlite3.connect(db_path())
    con.execute("UPDATE decision SET note = 'changed later' WHERE id = ?", (ids[1],))
    con.commit()
    assert repo.audit_integrity()["broken"] == [ids[1]]
    con.execute("UPDATE decision SET note = '' WHERE id = ?", (ids[1],))
    con.execute("DELETE FROM decision WHERE id = ?", (ids[2],))
    con.commit()
    bad = repo.audit_integrity()
    assert bad["status"] == "invalid" and bad["broken"] == [ids[3]]  # the row after the hole no longer follows


def test_decisions_made_before_the_chain_are_counted_as_legacy(db):
    repo.add_decision("cachar", "A", "accept", {}, None, "x", "")
    con = sqlite3.connect(db_path())
    con.execute("UPDATE decision SET decision_hash = NULL, previous_hash = NULL")
    con.commit()
    repo.add_decision("cachar", "A", "reject", {}, None, "y", "")
    out = repo.audit_integrity()
    assert out["status"] == "valid_with_legacy_records" and out["legacy"] == 1 and out["checked"] == 1


# ---------------------------------------------------------------- API


@pytest.fixture
def client(db):
    with TestClient(create_app()) as c:
        yield c


def test_ops_read_endpoints_are_public_and_report_feed_health(client):
    seed()
    store.feed_attempt("NDMA SACHET", True, 5)
    store.feed_attempt("GDACS", False, error="timeout")
    assert {h["id"]: h["enabled"] for h in client.get(f"{P}/ops/hazards").json()} == {"flood": True, "fire": False, "crowd": False}
    feeds = {f["name"]: f for f in client.get(f"{P}/ops/feeds").json()["feeds"]}
    assert feeds["NDMA SACHET"]["last_success"] and feeds["GDACS"]["last_error"] == "timeout"
    ev = client.get(f"{P}/ops/events", params={"hazard": "flood"}).json()
    assert ev["counts"]["total"] == 1 and ev["counts"]["located"] == 1 and ev["events"][0]["active"]
    assert ev["geojson"]["features"][0]["geometry"]["coordinates"] == [84.76, 26.35]
    d = client.get(f"{P}/ops/districts").json()["districts"]
    assert d[0]["id"] == "cachar" and d[0]["level"] == "warning" and len(d) >= 20
    assert any(x["level"] == "unknown" for x in d)  # districts without an indicator are shown, not hidden


def test_brief_is_stored_then_decided_once_by_a_named_person(client, monkeypatch):
    seed()
    monkeypatch.setattr(advisor, "collect_evidence", lambda include_engine=True, simulated=False: _collect())
    assert client.post(f"{P}/ops/brief", json={"mode": "nonsense"}).status_code == 422
    brief = client.post(f"{P}/ops/brief", json={"mode": "police"}).json()
    assert brief["source"] == "rules" and brief["recommendations"] and brief["evidence"]
    rec = brief["recommendations"][0]
    assert rec["status"] == "proposed"
    out = client.post(f"{P}/ops/recommendations/{rec['id']}/decision", json={"action": "accept", "note": "go", "author": "R. Kumar, DDMA"})
    assert out.status_code == 200 and out.json()["status"] == "accepted"
    assert client.post(f"{P}/ops/recommendations/{rec['id']}/decision", json={"action": "reject"}).status_code == 409
    log = client.get(f"{P}/decisions").json()
    assert log[0]["author"] == "R. Kumar, DDMA" and log[0]["evidence"]["kind"] == "command_center_recommendation"
    assert log[0]["evidence"]["evidence"]  # the cited evidence is stored with the decision
    assert client.get(f"{P}/audit/integrity").json()["status"] == "valid"
    assert client.get(f"{P}/ops/briefs").json()[0]["recommendations"][0]["status"] == "accepted"


def _collect():
    """A fixed evidence set (no feeds, no engine) so the API test is quick and exact."""
    ev = advisor.Evidence()
    indicators = store.latest_indicators()
    ev.add("summary", "Watch overview", {"districts_watched": 22, "severe": 0, "warning": 1, "watch": 0, "normal": 0, "no_indicator": 21,
                                         "active_flood_alerts": 1, "alerts_this_week": 1})
    ind = indicators["cachar"]
    ev.add("district_risk", "Cachar: warning", {
        "district": "Cachar (Silchar)", "state": "Assam", "river": "Barak", "level": ind["level"], "why": ind["reason"],
        "share_of_forecast_members_above_2_year_flood_pct": 80, "share_above_5_year_flood_pct": 50,
        "share_above_20_year_flood_pct": 0, "flow_peak_day": ind["peak_day"], "flow_peak_median_m3s": 2300,
        "flow_5_year_flood_m3s": 2100, "flow_history_years": "2005-2025"}, "cachar")
    return ev
