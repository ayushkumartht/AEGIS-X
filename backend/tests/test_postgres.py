"""The storage layer on PostgreSQL (e.g. Supabase).

The adapter tests always run. The database tests run only when AEGIS_TEST_PG_URL is set; each one
works in its own throwaway schema, which is dropped afterwards, so real tables are never touched.
"""

from __future__ import annotations

import os
import threading
import uuid

import pytest
from fastapi.testclient import TestClient

from aegis.api import context, limits
from aegis.api.main import create_app
from aegis.ops import store
from aegis.ops.feeds import sachet
from aegis.settings import Settings, get_settings
from aegis.storage import db, repo
from tests.test_ops import CWC_ALERT

PG_URL = os.environ.get("AEGIS_TEST_PG_URL", "")
needs_pg = pytest.mark.skipif(not PG_URL, reason="set AEGIS_TEST_PG_URL to run against PostgreSQL")
P = "/api/v1"


def test_sqlite_sql_is_translated_for_postgres():
    assert db._pg_sql("SELECT * FROM run WHERE id = ?") == "SELECT * FROM run WHERE id = %s"
    assert db._pg_sql("INSERT OR IGNORE INTO ops_feed (name) VALUES (?)") == "INSERT INTO ops_feed (name) VALUES (%s) ON CONFLICT DO NOTHING"


def test_rows_answer_by_name_and_by_position():
    r = db._Row(["id", "level"], (7, "watch"))
    assert r["level"] == "watch" and r[0] == 7 and dict(r) == {"id": 7, "level": "watch"}


def _drop(schema: str) -> None:
    import psycopg

    db.close_pool()
    with psycopg.connect(PG_URL, prepare_threshold=None, autocommit=True) as c:
        c.execute(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE')


@pytest.fixture
def pg(monkeypatch):
    schema = f"aegis_test_{uuid.uuid4().hex[:10]}"
    settings = Settings(_env_file=None, aegis_db_url=PG_URL, aegis_db_schema=schema)
    monkeypatch.setattr("aegis.storage.db.get_settings", lambda: settings)
    yield schema
    _drop(schema)


@needs_pg
def test_runs_plans_and_reports_round_trip(pg):
    run_id = repo.add_run("demo", {"start_hour": 3}, 50, 7, {"members": 51}, {"mean": 0.8})
    assert repo.get_run(run_id)["summary"] == {"mean": 0.8} and repo.list_runs("demo")[0]["seed"] == 7
    assert isinstance(repo.add_plan("demo", "edited", {"start_hour": 1}), int)
    repo.add_report("demo", "radio", "bridge_main closed", {"bridge": "closed"}, author="EOC")
    (r,) = repo.list_reports("demo")
    assert r["parsed"] == {"bridge": "closed"} and r["author"] == "EOC" and "T" in r["received_at"]
    assert repo.counts() == {"run": 1, "decision": 0, "field_report": 1}


@needs_pg
def test_decision_chain_is_valid_append_only_and_detects_tampering(pg):
    run_id = repo.add_run("demo", {}, 20, 1, {}, {})
    for i in range(3):
        repo.add_decision("demo", "Officer", "accept", {"start_hour": i, "z": [1, {"b": 2, "a": 1}]}, run_id, "why", f"n{i}", {"k": i})
    log = repo.list_decisions("demo")
    assert [d["note"] for d in log] == ["n2", "n1", "n0"] and log[0]["run"]["id"] == run_id
    assert log[0]["plan"] == {"start_hour": 2, "z": [1, {"b": 2, "a": 1}]}
    assert repo.audit_integrity()["status"] == "valid"

    import psycopg

    with pytest.raises(psycopg.errors.RaiseException), db.connect() as c:
        c.execute("UPDATE decision SET note = 'edited' WHERE note = 'n1'")  # blocked by the trigger
    with db.connect() as c:  # an owner who disables the trigger is still caught by the hash chain
        c.execute("ALTER TABLE decision DISABLE TRIGGER decision_no_change")
        c.execute("UPDATE decision SET note = 'edited' WHERE note = 'n1'")
    audit = repo.audit_integrity()
    assert audit["status"] == "invalid" and len(audit["broken"]) == 1


@needs_pg
def test_concurrent_decisions_never_share_a_predecessor(pg):
    errors: list[Exception] = []

    def decide(i: int) -> None:
        try:
            repo.add_decision("demo", f"Officer {i}", "accept", {}, None, "", "")
        except Exception as exc:  # noqa: BLE001 - surfaced by the assertion below
            errors.append(exc)

    threads = [threading.Thread(target=decide, args=(i,)) for i in range(6)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    audit = repo.audit_integrity()
    assert not errors and audit["status"] == "valid" and audit["checked"] == 6


@needs_pg
def test_command_center_store(pg):
    e = sachet.parse_cap(CWC_ALERT, "IN-1_5", "u")
    assert store.upsert_events([e]) == 1
    assert store.upsert_events([{**e, "lat": None, "lon": None, "place_method": "unlocated"}]) == 0
    (stored,) = store.list_events(days=1, hazard="flood")
    assert stored["lat"] == 26.35 and stored["gauge"]["danger_m"] == 62.22 and stored["sent"] == e["sent"]
    assert store.list_events(days=1, state="bihar") and store.list_events(days=1, hazard="fire") == []
    assert store.week_over_week()["this_week"] == 1

    unplaced = {**e, "uid": "IN-9", "lat": None, "lon": None, "place_method": "unlocated", "district_id": None}
    store.upsert_events([unplaced])
    assert [u["uid"] for u in store.unlocated_events(5)] == ["IN-9"]
    store.set_place("IN-9", 24.8, 92.8, "geocoded", "cachar")
    assert store.unlocated_events(5) == [] and store.list_events(days=1, district_id="cachar")[0]["lat"] == 24.8

    store.feed_attempt("sachet", True, items=4)
    store.feed_attempt("sachet", False, error="timeout")
    store.feed_attempt("gdacs", False, error="down")
    feeds = {f["name"]: f for f in store.feeds()}
    assert feeds["sachet"]["items"] == 4 and feeds["sachet"]["last_error"] == "timeout" and feeds["sachet"]["last_success"]
    assert feeds["gdacs"]["last_success"] is None

    store.add_indicator("cachar", "watch", {"members": 51})
    store.add_indicator("cachar", "severe", {"members": 51})
    store.add_indicator("patna", "normal", {})
    latest = store.latest_indicators()
    assert latest["cachar"]["level"] == "severe" and latest["cachar"]["members"] == 51 and set(latest) == {"cachar", "patna"}

    bid = store.add_brief("administration", "Officer", "rules", "none", [{"id": "E1"}], {"situation": "x"},
                          [{"action": "Pre-position boats", "district_id": "cachar"}, {"action": "Open camps"}])
    brief = store.get_brief(bid)
    assert brief["sections"] == {"situation": "x"} and [r["action"] for r in brief["recommendations"]] == ["Pre-position boats", "Open camps"]
    rec_id = brief["recommendations"][0]["id"]
    decision_id = repo.add_decision("cachar", "Officer", "accept", {}, None, "", "")
    store.decide_recommendation(rec_id, "accepted", "Officer", decision_id)
    assert store.get_recommendation(rec_id)["status"] == "accepted"
    assert store.list_briefs()[0]["recommendations"][0]["decision_id"] == decision_id


@needs_pg
def test_api_decision_flow_on_postgres(pg, monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "none")
    monkeypatch.setenv("AEGIS_RATE_LIMIT_PER_MIN", "0")
    get_settings.cache_clear()
    context.reset()
    limits.reset()
    with TestClient(create_app()) as client:
        run = client.post(f"{P}/simulate", json={"n_samples": 40, "seed": 3}).json()["run_id"]
        body = {"action": "accept", "plan": {"start_hour": 3}, "run_id": run, "note": "ok", "author": "A. Officer"}
        assert client.post(f"{P}/decisions", json=body).status_code == 200
        log = client.get(f"{P}/decisions", params={"district": "demo"}).json()
        assert log[0]["run"]["seed"] == 3 and log[0]["author"] == "A. Officer"
        assert client.post(f"{P}/decisions", json={"action": "accept", "plan": {}, "run_id": 999999}).status_code == 404
        assert client.get(f"{P}/audit/integrity").json()["status"] == "valid"
    get_settings.cache_clear()
    context.reset()
    limits.reset()
