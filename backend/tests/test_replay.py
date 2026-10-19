import numpy as np
import pytest

from aegis.domains.flood.demo import generate_demo_scenario
from aegis.replay.replay import calibrate_from_record, calibrate_rating, population_quantile_hand, run_replay

SCEN = generate_demo_scenario()
DATES = [f"2022-06-{d:02d}" for d in range(10, 25)]
Q = [580, 575, 570, 575, 590, 610, 640, 970, 1215, 1110, 1050, 1020, 1010, 990, 960]
RAIN = [15, 2, 4, 20, 16, 41, 37, 50, 46, 64, 15, 25, 23, 10, 5]


def test_calibration_floods_the_target_share_at_the_peak():
    rating, info = calibrate_rating(SCEN, Q, 0.8)
    assert info["fitted"] and rating.q_normal == pytest.approx(575, abs=10)
    stage = rating.stage(max(Q))
    flooded = sum(c.population for c in SCEN.clusters if c.hand_m < stage) / SCEN.total_population
    assert flooded >= 0.8
    assert stage == pytest.approx(population_quantile_hand(SCEN, 0.8))


def test_calibration_declines_without_a_flood_peak():
    rating, info = calibrate_rating(SCEN, [580] * 10, 0.8)
    assert not info["fitted"] and rating.k == 6.0


def test_replay_gives_advice_per_step_and_reports_its_limits():
    rating, _ = calibrate_rating(SCEN, Q, 0.8)
    out = run_replay(SCEN, DATES, Q, RAIN, rating, step_days=3, n_samples=20)
    assert len(out["steps"]) == 4
    for s in out["steps"]:
        assert s["advice_start_hour"] in (0.0, 12.0, 24.0)
        assert set(s["options"]) == {"0", "12", "24"}
        assert 0.0 <= s["actual_flooded_population_share"] <= 1.0
    assert 0.0 <= out["calibration"]["interval_coverage_10_90"] <= 1.0
    assert len(out["limits"]) == 3
    peak_step = max(out["steps"], key=lambda s: s["actual_peak_stage_m"])
    assert peak_step["actual_peak_stage_m"] == pytest.approx(rating.stage(1215))
    assert np.isfinite(peak_step["predicted_peak_stage_m"]["high"])


def test_record_calibration_uses_annual_maxima():
    dates = [f"{y}-07-{d:02d}" for y in range(2015, 2020) for d in range(1, 11)]
    flows = []
    for peak in (1000, 1400, 1800, 1200, 3000):
        flows += [500.0] * 9 + [float(peak)]
    rating, info = calibrate_from_record(SCEN, dates, flows, 0.8)
    assert info["fitted"] and info["q_bankfull"] == 1400 and info["record_year"] == "2019"
    assert rating.stage(1400) == 0.0 and rating.stage(900) == 0.0
    assert rating.stage(3000) == pytest.approx(population_quantile_hand(SCEN, 0.8))