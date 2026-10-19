import time

import numpy as np
import pytest

from aegis.domains.flood.checks import action_for
from aegis.domains.flood.demo import generate_demo_plan, generate_demo_scenario
from aegis.domains.flood.hydrology import Rating, stage_curve
from aegis.domains.flood.model import FloodModel
from aegis.domains.flood.plans import FloodPlanCodec, baseline_plan, plan_from_dict, plan_to_dict
from aegis.domains.flood.types import FloodConditions
from aegis.domains.flood.uncertainty import forecast_space, prior_space
from aegis.engine import (
    compare_plans,
    compare_summary,
    find_single_points_of_failure,
    run_monte_carlo,
    sample_futures,
)

KEY = "evacuated_pct"
MODEL = FloodModel()
SCEN = generate_demo_scenario()


def cond(**kw) -> FloodConditions:
    base = dict(peak_stage_m=2.5, stage_bias_m=0.0, peak_time_h=20.0, local_rain_mm=40.0, boat_availability_pct=0.9,
                boat_delay_h=2.0, comms_degradation_pct=0.1, compliance_pct=0.8, bridge_open={"b_main": 1.0})
    base.update(kw)
    return FloodConditions(**base)


def test_rating_curve_round_trip_and_floor():
    r = Rating(q_normal=600, k=6.0)
    assert r.stage(500) == 0.0
    assert r.discharge(r.stage(1200)) == pytest.approx(1200)


def test_stage_curve_peaks_at_the_peak_time():
    t = np.arange(0, 48.0)
    s = stage_curve(0.5, 4.0, 20.0, t)
    assert s.argmax() == 20 and s.max() == pytest.approx(4.0) and s[0] < s[20]


def test_simulation_metrics_are_sane():
    out = MODEL.simulate(SCEN, generate_demo_plan(SCEN), cond())
    m = out.metrics
    assert 0.0 <= m[KEY] <= 1.0
    assert m["people_at_risk_end"] >= 0 and m["shelter_overflow"] >= 0 and m["boats_used"] == 6
    assert len(out.details["cluster_evacuated"]) == len(SCEN.clusters)


def test_no_flood_means_nothing_to_evacuate():
    out = MODEL.simulate(SCEN, generate_demo_plan(SCEN), cond(peak_stage_m=0.0, local_rain_mm=0.0))
    assert out.metrics[KEY] == 1.0 and out.metrics["flooded_cluster_share"] == 0.0


def test_same_conditions_same_result_and_same_seed_same_batch():
    plan = generate_demo_plan(SCEN)
    assert MODEL.simulate(SCEN, plan, cond()).metrics == MODEL.simulate(SCEN, plan, cond()).metrics
    a = run_monte_carlo(MODEL, SCEN, plan, n_samples=30, seed=4).metric_array(KEY)
    b = run_monte_carlo(MODEL, SCEN, plan, n_samples=30, seed=4).metric_array(KEY)
    assert np.array_equal(a, b)


def test_resilience_is_at_or_below_the_median():
    batch = run_monte_carlo(MODEL, SCEN, generate_demo_plan(SCEN), n_samples=100, seed=1)
    assert batch.resilience(KEY) <= batch.summary(KEY)["p50"] + 1e-9


def test_more_boats_never_hurt_on_identical_futures():
    few, many = baseline_plan(SCEN, "few"), baseline_plan(SCEN, "many")
    few.boats_at = {"sp1": 1, "sp2": 0}
    many.boats_at = {"sp1": 6, "sp2": 6}
    batches = compare_plans(MODEL, SCEN, {"few": few, "many": many}, KEY, n_samples=80, seed=2)
    summary = compare_summary(batches, KEY)
    assert summary["many"]["mean"] >= summary["few"]["mean"] - 1e-9
    assert [r.conditions.peak_stage_m for r in batches["few"].runs] == [r.conditions.peak_stage_m for r in batches["many"].runs]


def test_losing_an_element_never_improves_the_result():
    spofs = find_single_points_of_failure(MODEL, SCEN, generate_demo_plan(SCEN), KEY, n_nominal_samples=40)
    ids = {s.element_id for s in spofs}
    assert ids == {"bridge:b_main", "shelter:s1", "shelter:s2", "shelter:s3", "staging:sp1", "staging:sp2"}
    assert all(s.drop_pct >= -1e-6 for s in spofs)


def test_closed_bridge_is_respected_by_routing():
    plan = baseline_plan(SCEN)
    plan.boats_at, plan.vehicles_at = {}, {}  # only walking: the bridge is the only way out
    open_ = MODEL.simulate(SCEN, plan, cond(peak_stage_m=1.8, bridge_open={"b_main": 1.0})).metrics[KEY]
    closed = MODEL.simulate(SCEN, plan, cond(peak_stage_m=1.8, bridge_open={"b_main": 0.0})).metrics[KEY]
    assert closed < open_


def test_starting_later_lowers_unneeded_evacuations():
    early, late = baseline_plan(SCEN, "e"), baseline_plan(SCEN, "l")
    early.start_hour, late.start_hour = 0.0, 30.0
    c = cond(peak_stage_m=1.0)
    assert MODEL.simulate(SCEN, late, c).metrics["unneeded_evacuations"] <= MODEL.simulate(SCEN, early, c).metrics["unneeded_evacuations"]


def test_protecting_a_cluster_keeps_it_dry_longer():
    plan = baseline_plan(SCEN)
    low = min(SCEN.clusters, key=lambda c: c.hand_m)
    protected = baseline_plan(SCEN)
    protected.protected = [f"cluster:{low.id}"]
    c = cond(peak_stage_m=low.hand_m + 0.5)
    assert MODEL.simulate(SCEN, protected, c).metrics["flooded_cluster_share"] < MODEL.simulate(SCEN, plan, c).metrics["flooded_cluster_share"]


def test_500_futures_run_within_the_time_budget():
    start = time.perf_counter()
    run_monte_carlo(MODEL, SCEN, generate_demo_plan(SCEN), n_samples=500, seed=1)
    assert time.perf_counter() - start < 6.0


def test_prior_space_lists_every_variable_with_a_source():
    space = prior_space(SCEN)
    assert {"peak_stage_m", "local_rain_mm", "compliance_pct", "bridge_open:b_main"} <= set(space.names)
    assert all(v.source for v in space.variables)
    futures = sample_futures(MODEL, SCEN, 10, seed=1)
    assert set(futures[0].field_names()) == set(space.names)


def test_forecast_space_uses_ensembles_and_beliefs():
    rating = Rating(q_normal=600, k=6.0)
    flow = {"dates": ["2026-10-19", "2026-10-20", "2026-10-21"], "members": [[700, 900, 800], [650, 1200, 1000], [600, 700, 650]]}
    rain = {"dates": ["2026-10-19", "2026-10-20"], "members": [[10, 20], [0, 5], [50, 60]]}
    overrides = {"bridge_open": {"b_main": {"p_open": 0.2, "source": "2 field reports"}}}
    space, base, meta = forecast_space(SCEN, rain, flow, rating, overrides)
    peak = next(v for v in space.variables if v.name == "peak_stage_m")
    assert peak.kind == "empirical" and len(peak.samples) == 3 and "GloFAS" in peak.source
    assert max(peak.samples) == pytest.approx(rating.stage(1200))
    assert base == pytest.approx(rating.stage(np.mean([700, 650, 600])))
    bridge = next(v for v in space.variables if v.name == "bridge_open:b_main")
    assert bridge.p_true == 0.2 and bridge.source == "2 field reports"
    assert meta["n_discharge_members"] == 3
    model = FloodModel(space=space, base_stage_m=base)
    assert len(run_monte_carlo(model, SCEN, generate_demo_plan(SCEN), n_samples=20, seed=1).runs) == 20


def test_plan_codec_and_dict_round_trip():
    codec = FloodPlanCodec(SCEN)
    plan = codec.decode(np.full(codec.n_genes, 0.5))
    assert sum(plan.boats_at.values()) == round(6 * 0.7)
    assert sorted(plan.priority) == sorted(c.id for c in SCEN.clusters)
    again = plan_from_dict(SCEN, plan_to_dict(plan))
    assert again.signature() == plan.signature()
    assert plan_from_dict(SCEN, None).signature() == baseline_plan(SCEN).signature()


def test_check_actions_name_the_bridge():
    assert "Main bridge" in action_for("bridge_open:b_main", SCEN)
    assert "boat" in action_for("boat_availability_pct", SCEN).lower()
