import json
from datetime import UTC, datetime, timedelta

import httpx
import pytest

from aegis.fusion.beliefs import compute_overrides, explain_beliefs
from aegis.fusion.reports import FieldReport, ParsedReport, parse_rules
from aegis.llm.base import get_provider
from aegis.llm.parse_report import parse_report
from aegis.settings import Settings
from aegis.storage import repo

NAMES = {"b_1": "Annapurna Ghat Bridge", "b_2": "Test Bridge"}
NOW = datetime(2026, 10, 19, 12, tzinfo=UTC)


def rep(text, source="field_team", hours_ago=0.0, rid=1):
    return FieldReport(rid, (NOW - timedelta(hours=hours_ago)).isoformat(), source, text, parse_rules(text, NAMES))


def test_rule_parser_understands_bridge_boats_and_network():
    assert parse_rules("Test Bridge is under water", NAMES) == ParsedReport("bridge", "Test Bridge", "closed", None)
    assert parse_rules("annapurna ghat bridge is open again", NAMES).claim == "open"
    boats = parse_rules("We have 6 boats ready at the ghat", NAMES)
    assert boats.claim == "boats_ready" and boats.value == 6
    assert parse_rules("mobile network is down in ward 4", NAMES).claim == "network_down"
    assert parse_rules("lots of rain today", NAMES).claim == "unknown"


def test_two_reliable_closed_reports_beat_the_prior():
    o = compute_overrides([rep("Test Bridge is closed"), rep("Test Bridge is blocked", "control_room", rid=2)], NAMES, 12, NOW)
    assert o["bridge_open"]["b_2"]["p_open"] < 0.2
    assert "2 field reports" == o["bridge_open"]["b_2"]["source"]


def test_conflicting_reports_weigh_by_source_and_age():
    old_open = rep("Test Bridge is open", "social_media", hours_ago=48)
    fresh_closed = rep("Test Bridge is closed", "field_team", rid=2)
    p_closed = compute_overrides([old_open, fresh_closed], NAMES, 12, NOW)["bridge_open"]["b_2"]["p_open"]
    p_only_closed = compute_overrides([fresh_closed], NAMES, 12, NOW)["bridge_open"]["b_2"]["p_open"]
    assert p_closed < 0.5 and p_closed == pytest.approx(p_only_closed, abs=0.05)


def test_old_reports_lose_weight():
    fresh = compute_overrides([rep("Test Bridge is closed")], NAMES, 12, NOW)["bridge_open"]["b_2"]["p_open"]
    stale = compute_overrides([rep("Test Bridge is closed", hours_ago=24)], NAMES, 12, NOW)["bridge_open"]["b_2"]["p_open"]
    assert stale > fresh


def test_boats_and_network_overrides_and_explanation():
    o = compute_overrides([rep("We have 6 boats ready"), rep("phone network is down", rid=2)], NAMES, 12, NOW)
    assert o["boat_availability"]["range"][1] == pytest.approx(0.5)
    assert o["comms_degradation"]["range"][1] == 0.6
    assert {e["kind"] for e in explain_beliefs(o, NAMES)} == {"boats", "network"}


def test_unmatched_bridge_report_changes_nothing():
    assert compute_overrides([rep("Some Other Bridge is closed")], NAMES, 12, NOW) == {}


def _provider(content):
    transport = httpx.MockTransport(lambda r: httpx.Response(200, json={"choices": [{"message": {"content": content}}]}))
    return get_provider(Settings(_env_file=None, llm_provider="groq", groq_api_key="k"), transport)


def test_llm_parse_accepts_valid_json_and_falls_back_otherwise():
    good = json.dumps({"subject_type": "bridge", "subject_name": "Test Bridge", "claim": "closed", "value": None})
    assert parse_report("x", _provider(good), NAMES).method == "llm"
    bad = parse_report("Test Bridge is closed", _provider("not json"), NAMES)
    assert bad.method == "rules" and bad.claim == "closed"
    invalid = json.dumps({"subject_type": "bridge", "claim": "exploded"})
    assert parse_report("Test Bridge is closed", _provider(invalid), NAMES).method == "rules"


@pytest.fixture
def db(tmp_path, monkeypatch):
    settings = Settings(_env_file=None, aegis_db_url=f"sqlite:///{(tmp_path / 't.db').as_posix()}")
    monkeypatch.setattr("aegis.storage.db.get_settings", lambda: settings)


def test_audit_log_keeps_the_run_and_seed_with_each_decision(db):
    run_id = repo.add_run("demo", {"name": "p"}, 500, 42, {"forecast_date": None}, {"mean": 0.7})
    did = repo.add_decision("demo", "officer", "accept", {"name": "p"}, run_id, "because", "ok")
    log = repo.list_decisions("demo")
    assert log[0]["id"] == did and log[0]["action"] == "accept"
    assert log[0]["run"]["seed"] == 42 and log[0]["run"]["summary"] == {"mean": 0.7}
    assert repo.list_decisions("other") == []


def test_reports_round_trip_newest_first(db):
    repo.add_report("demo", "field_team", "bridge closed", {"claim": "closed"})
    repo.add_report("demo", "public_call", "bridge open", {"claim": "open"})
    reports = repo.list_reports("demo")
    assert [r["parsed"]["claim"] for r in reports] == ["open", "closed"]
