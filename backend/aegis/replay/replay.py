"""Replay a past flood step by step and calibrate the river rating curve against it.

Honest limits, repeated in the output so the UI can show them:
- Only reanalysis (ERA5 rain, GloFAS discharge) exists for the past, not the forecasts that were
  actually issued. Each step builds a synthetic ensemble by perturbing the best estimate of the
  next days with a multiplicative error (`forecast_error_sigma`). Interval coverage computed
  from it checks the pipeline, not the quality of a real forecast.
- The rating curve is calibrated to a stated assumption (the share of people living in areas that
  flooded at the event peak), not to measured gauge levels or a satellite flood extent. Replace
  `target_flooded_population_share` when Sentinel-1 extent or CWC gauge data are added.
"""

from __future__ import annotations

import numpy as np

from aegis.domains.flood.hydrology import Rating
from aegis.domains.flood.model import FloodModel
from aegis.domains.flood.plans import baseline_plan
from aegis.domains.flood.types import FloodScenario
from aegis.domains.flood.uncertainty import forecast_space
from aegis.engine import coverage_rate, run_monte_carlo

KEY = "evacuated_pct"
FORECAST_DAYS = 3
START_OPTIONS_H = (0.0, 12.0, 24.0)
LIMITS = (
    "Synthetic forecast ensemble built from reanalysis; coverage checks the pipeline, not a real forecast.",
    "Rating curve calibrated on 16 years of GloFAS flows and an assumed flooded-population share, not on gauge or satellite data.",
    "The model floods areas from river level and local rain only. Embankment breaches (such as Bethukandi in 2022) are not modelled yet, so a breach-driven flood is under-predicted.",
)


def population_quantile_hand(scenario: FloodScenario, share: float) -> float:
    """Water level at which `share` of the population lives in a flooded cluster."""
    clusters = sorted(scenario.clusters, key=lambda c: c.hand_m)
    total = sum(c.population for c in clusters)
    acc = 0.0
    for c in clusters:
        acc += c.population
        if acc >= share * total:
            return c.hand_m + 0.01
    return clusters[-1].hand_m + 0.01


def calibrate_rating(scenario: FloodScenario, discharge: list[float], target_share: float) -> tuple[Rating, dict]:
    """Rating whose stage at the event's peak discharge floods `target_share` of the population."""
    q = np.asarray(discharge, dtype=float)
    q_normal = float(np.median(q[:5]))
    q_peak = float(q.max())
    if q_peak <= q_normal * 1.01:
        return Rating(), {"fitted": False, "reason": "no flood peak in the history"}
    stage_target = population_quantile_hand(scenario, target_share)
    k = stage_target / float(np.log(q_peak / q_normal))
    return Rating(q_normal, k), {
        "fitted": True,
        "q_normal": q_normal,
        "q_peak": q_peak,
        "target_flooded_population_share": target_share,
        "peak_stage_m": stage_target,
        "k": k,
    }


def calibrate_from_record(
    scenario: FloodScenario, dates: list[str], discharge: list[float], target_share: float
) -> tuple[Rating, dict]:
    """Rating from a multi-year discharge record.

    Normal level (stage 0) is the median annual maximum flow, about the 2-year flood, which a
    river carries without leaving its banks. The largest flow in the record is set to flood
    `target_flooded_population_share` of the population: a stated assumption, to be replaced by
    gauge levels or satellite flood extents.
    """
    q = np.asarray(discharge, dtype=float)
    years = sorted({d[:4] for d in dates})
    annual_max = np.array([q[[d.startswith(y) for d in dates]].max() for y in years])
    q_bankfull = float(np.median(annual_max))
    q_record = float(annual_max.max())
    if q_record <= q_bankfull * 1.01:
        return Rating(), {"fitted": False, "reason": "record has no flow above the 2-year flood"}
    stage_target = population_quantile_hand(scenario, target_share)
    k = stage_target / float(np.log(q_record / q_bankfull))
    return Rating(q_bankfull, k), {
        "fitted": True,
        "method": "median annual maximum = normal level; record maximum floods the target share",
        "years": f"{years[0]}-{years[-1]}",
        "q_bankfull": q_bankfull,
        "q_record": q_record,
        "record_year": years[int(annual_max.argmax())],
        "target_flooded_population_share": target_share,
        "record_stage_m": stage_target,
        "k": k,
    }


def _flooded_share(scenario: FloodScenario, level_m: float) -> float:
    total = max(scenario.total_population, 1)
    return sum(c.population for c in scenario.clusters if c.hand_m < level_m) / total


def run_replay(
    scenario: FloodScenario,
    dates: list[str],
    discharge: list[float],
    rain: list[float],
    rating: Rating,
    step_days: int = 1,
    n_samples: int = 100,
    n_members: int = 51,
    forecast_error_sigma: float = 0.15,
    seed: int = 0,
) -> dict:
    """Advise at every step using only what was known up to that day, then compare with what happened."""
    rng = np.random.default_rng(seed)
    q = np.asarray(discharge, dtype=float)
    r = np.asarray(rain, dtype=float)
    steps, predicted_peaks, actual_peaks = [], [], []

    for i in range(0, len(q) - FORECAST_DAYS, step_days):
        factor = rng.lognormal(0.0, forecast_error_sigma, size=(n_members, 1))
        flow = {"dates": dates[i : i + FORECAST_DAYS], "members": (q[i : i + FORECAST_DAYS][None, :] * factor).tolist()}
        rain_ens = {"dates": dates[i : i + 2], "members": (r[i : i + 2][None, :] * factor).tolist()}
        space, base, meta = forecast_space(scenario, rain_ens, flow, rating)
        model = FloodModel(space=space, base_stage_m=base)

        options = {}
        for start in START_OPTIONS_H:
            plan = baseline_plan(scenario, f"start +{start:.0f}h")
            plan.start_hour = start
            batch = run_monte_carlo(model, scenario, plan, n_samples=n_samples, seed=seed + i)
            options[f"{start:.0f}"] = {
                "mean": batch.summary(KEY)["mean"],
                "worst10": batch.resilience(KEY),
                "unneeded": float(np.mean(batch.metric_array("unneeded_evacuations"))),
                "flooded_share": float(np.mean(batch.metric_array("flooded_cluster_share"))),
            }
        best = max(options, key=lambda k: (options[k]["worst10"], -float(k)))
        peaks = meta["peak_stage_range_m"]
        predicted = np.array([rating.stage(float(m.max())) for m in np.asarray(flow["members"])])
        actual_peak = rating.stage(float(q[i : i + FORECAST_DAYS].max()))
        predicted_peaks.append(predicted)
        actual_peaks.append(actual_peak)
        steps.append(
            {
                "date": dates[i],
                "observed_discharge": float(q[i]),
                "observed_stage_m": rating.stage(float(q[i])),
                "predicted_peak_stage_m": {"low": float(np.percentile(predicted, 10)), "high": float(np.percentile(predicted, 90)), "range": peaks},
                "actual_peak_stage_m": actual_peak,
                "actual_flooded_population_share": _flooded_share(scenario, actual_peak),
                "options": options,
                "advice_start_hour": float(best),
            }
        )

    return {
        "steps": steps,
        "calibration": {
            "interval_coverage_10_90": coverage_rate(predicted_peaks, actual_peaks),
            "expected_coverage": 0.8,
            "n_steps": len(steps),
        },
        "rating": rating.to_dict(),
        "limits": list(LIMITS),
    }
