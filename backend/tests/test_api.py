import pytest
from fastapi.testclient import TestClient

from aegis.api import context, limits
from aegis.api.main import create_app
from aegis.settings import get_settings

P = "/api/v1"


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "none")
    monkeypatch.setenv("AEGIS_DB_URL", f"sqlite:///{(tmp_path / 'api.db').as_posix()}")
    monkeypatch.setenv("AEGIS_RATE_LIMIT_PER_MIN", "0")
    get_settings.cache_clear()
    context.reset()
    limits.reset()
    with TestClient(create_app()) as c:
        yield c
    get_settings.cache_clear()
    context.reset()
    limits.reset()


def test_health_and_districts(client):
    h = client.get(f"{P}/health").json()
    assert h["status"] == "ok" and h["llm_provider"] == "none"
    ids = [d["id"] for d in client.get(f"{P}/districts").json()]
    assert "demo" in ids and "cachar" in ids


def test_layers_conditions_and_flood_state(client):
    layers = client.get(f"{P}/districts/demo/layers").json()
    assert layers["totals"]["clusters"] == 6 and layers["roads"]["features"]
    cond = client.get(f"{P}/districts/demo/conditions").json()
    names = {v["name"] for v in cond["variables"]}
    assert {"peak_stage_m", "bridge_open:b_main"} <= names and all(v["source"] for v in cond["variables"])
    low = client.post(f"{P}/districts/demo/flood-state", json={"level_m": 0.5}).json()
    high = client.post(f"{P}/districts/demo/flood-state", json={"level_m": 5.0}).json()
    assert len(low["cut_edges"]) < len(high["cut_edges"])


def test_unknown_or_unbuilt_district_is_404_with_a_hint(client):
    assert client.get(f"{P}/districts/nowhere/layers").status_code == 404
    r = client.get(f"{P}/districts/cachar/layers")
    if r.status_code == 404:
        assert "build_scenario" in r.json()["detail"]


def test_simulate_returns_ranges_and_stores_the_run(client):
    r = client.post(f"{P}/simulate", json={"district": "demo", "n_samples": 100, "seed": 5}).json()
    s = r["summary"]
    assert s["p10"] <= s["p50"] <= s["p90"] and r["resilience_worst_10pct"] <= s["p50"] + 1e-9
    assert len(r["histogram"]["counts"]) == 20 and r["run_id"] >= 1
    again = client.post(f"{P}/simulate", json={"district": "demo", "n_samples": 100, "seed": 5}).json()
    assert again["summary"] == s


def test_what_if_changes_the_outcome(client):
    base = client.post(f"{P}/simulate", json={"n_samples": 100}).json()["summary"]["mean"]
    flood = client.post(f"{P}/simulate", json={"n_samples": 100, "what_if": {"peak_stage_m": 5.5}}).json()["summary"]["mean"]
    assert flood != base


def test_compare_uses_identical_futures(client):
    r = client.post(
        f"{P}/analysis/compare",
        json={"plans": {"A": {"start_hour": 0}, "B": {"start_hour": 24}}, "n_samples": 60},
    ).json()
    assert set(r["plans"]) == {"A", "B"} and r["same_futures"]


def test_compare_needs_two_plans(client):
    assert client.post(f"{P}/analysis/compare", json={"plans": {"A": {}}}).status_code == 422


def test_redteam_names_elements_and_boxes(client):
    r = client.post(f"{P}/analysis/redteam", json={"n_samples": 150}).json()
    assert r["single_points_of_failure"] and r["sensitivity"] and "adversarial" in r
    assert 0.0 <= r["failure_rate"] <= 1.0


def test_sensitivity_sobol_has_indices(client):
    r = client.post(f"{P}/analysis/sensitivity", json={"method": "sobol", "sobol_n": 16}).json()
    assert r["sensitivity"][0]["st"] is not None


def test_voi_gives_check_actions(client):
    r = client.post(f"{P}/analysis/voi", json={"n_samples": 80}).json()
    assert r["check_next"] and all(c["action"] for c in r["check_next"])
    assert len(r["candidate_plans"]) >= 2


def test_optimize_returns_labelled_options(client):
    r = client.post(f"{P}/analysis/optimize", json={"population": 6, "generations": 2, "n_samples": 10}).json()
    assert r["options"] and "plan" in r["options"][0] and "baseline" in r
    assert {"mean_evacuated", "worst10_evacuated", "boats_used"} == set(r["options"][0]["objectives"])


def test_explain_falls_back_to_template_without_an_llm(client):
    sim = client.post(f"{P}/simulate", json={"n_samples": 50}).json()
    out = client.post(f"{P}/explain", json={"payload": {"summary": sim["summary"], "resilience_worst_10pct": sim["resilience_worst_10pct"]}}).json()
    assert out["source"] == "template" and "evacuates" in out["text"]


def test_field_report_changes_beliefs_and_the_forecast_space(client):
    body = {"text": "Main bridge is under water", "source_type": "field_team", "author": "Control room"}
    r = client.post(f"{P}/reports", json=body).json()
    assert r["parsed"]["claim"] == "closed" and r["beliefs"]
    assert client.get(f"{P}/districts/demo/reports").json()[0]["author"] == "Control room"
    conds = client.get(f"{P}/districts/demo/conditions").json()
    bridge = next(v for v in conds["variables"] if v["name"] == "bridge_open:b_main")
    assert bridge["p_true"] < 0.5 and "field report" in bridge["source"]
    assert len(client.get(f"{P}/districts/demo/reports").json()) == 1


def test_decision_log_links_the_run_and_names_who_acted(client):
    run = client.post(f"{P}/simulate", json={"n_samples": 50, "seed": 3}).json()["run_id"]
    body = {"action": "accept", "plan": {"start_hour": 3}, "run_id": run, "note": "ok", "author": "A. Officer, Silchar EOC"}
    assert client.post(f"{P}/decisions", json=body).status_code == 200
    log = client.get(f"{P}/decisions", params={"district": "demo"}).json()
    assert log[0]["action"] == "accept" and log[0]["run"]["seed"] == 3 and log[0]["plan"]["start_hour"] == 3
    assert log[0]["author"] == "A. Officer, Silchar EOC"
    anonymous = client.post(f"{P}/decisions", json={"action": "reject", "plan": {}}).status_code
    assert anonymous == 200 and client.get(f"{P}/decisions").json()[0]["author"] == "Duty officer"  # the default name
    missing = {"action": "accept", "plan": {}, "run_id": 9999}
    assert client.post(f"{P}/decisions", json=missing).status_code == 404
    assert client.post(f"{P}/decisions", json={"action": "accept", "plan": {}, "author": ""}).status_code == 422
    assert client.get(f"{P}/audit/integrity").json()["status"] == "valid"


def test_there_is_no_login_and_no_account_endpoints(client):
    for path in ("/auth/login", "/auth/me", "/auth/users", "/admin/overview"):
        assert client.get(f"{P}{path}").status_code in (404, 405)

def test_heavy_endpoints_are_rate_limited(client, monkeypatch):
    monkeypatch.setenv("AEGIS_RATE_LIMIT_PER_MIN", "2")
    get_settings.cache_clear()
    codes = [client.post(f"{P}/simulate", json={"n_samples": 20}).status_code for _ in range(3)]
    assert codes == [200, 200, 429]


def test_websocket_streams_progress_then_the_result(client):
    with client.websocket_connect(f"{P}/ws/simulate") as ws:
        ws.send_json({"district": "demo", "n_samples": 120, "seed": 1})
        msgs = []
        while True:
            m = ws.receive_json()
            msgs.append(m)
            if m.get("done") or m.get("error"):
                break
    assert [m["progress"] for m in msgs[:-1]] == sorted(m["progress"] for m in msgs[:-1])
    assert msgs[-1]["done"] and msgs[-1]["result"]["n_samples"] == 120
    http = client.post(f"{P}/simulate", json={"district": "demo", "n_samples": 120, "seed": 1}).json()
    assert http["summary"] == msgs[-1]["result"]["summary"]


def test_replay_404_without_precomputed_result(client):
    assert client.get(f"{P}/replay/unknown_event").status_code == 404
