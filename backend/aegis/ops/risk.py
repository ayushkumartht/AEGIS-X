"""District flood risk from GloFAS: flood flows from the historical record, and how much of
today's 7-day ensemble forecast exceeds them.

Return periods use a Gumbel distribution fitted to the annual maxima by the method of moments:
    Q_T = mu - (sqrt(6)/pi) * sigma * (gamma + ln(-ln(1 - 1/T)))
"""

from __future__ import annotations

import math
from dataclasses import asdict, dataclass

import numpy as np

EULER_GAMMA = 0.5772156649
LEVELS = ("normal", "watch", "warning", "severe")


@dataclass(frozen=True)
class LevelRule:
    probability: float = 0.3
    severe_return_years: int = 20
    warning_return_years: int = 5
    watch_return_years: int = 2


def annual_maxima(dates: list[str], values: list[float]) -> dict[str, float]:
    by_year: dict[str, float] = {}
    for d, v in zip(dates, values, strict=True):
        if v is None:
            continue
        y = d[:4]
        by_year[y] = max(by_year.get(y, 0.0), float(v))
    return by_year


def gumbel_flow(maxima: list[float], return_years: float) -> float:
    a = np.asarray(maxima, dtype=float)
    mu, sigma = float(a.mean()), float(a.std(ddof=1))
    reduced = -math.log(-math.log(1.0 - 1.0 / return_years))
    return mu - (math.sqrt(6.0) / math.pi) * sigma * (EULER_GAMMA - reduced)


def return_flows(dates: list[str], values: list[float], years: tuple[int, ...], min_years: int) -> dict | None:
    """{T: flow} from complete years of the record, or None when the record is too short."""
    maxima = annual_maxima(dates, values)
    complete = {y: q for y, q in maxima.items() if sum(d.startswith(y) for d in dates) >= 360}
    if len(complete) < min_years:
        return None
    flows = {t: gumbel_flow(list(complete.values()), t) for t in years}
    return {"flows": flows, "years": f"{min(complete)}-{max(complete)}", "n_years": len(complete),
            "record_max": max(complete.values()), "record_year": max(complete, key=complete.get)}


@dataclass
class Indicator:
    level: str
    forecast_dates: list[str]
    flows: dict[int, float]  # return period (years) -> flow (m3/s)
    exceed: dict[int, float]  # return period -> share of ensemble members that exceed it within the horizon
    peak_day: str
    peak_median: float
    today_median: float
    members: int
    history: dict
    reason: str

    def as_dict(self) -> dict:
        d = asdict(self)
        d["flows"] = {str(k): v for k, v in self.flows.items()}
        d["exceed"] = {str(k): v for k, v in self.exceed.items()}
        return d


def assess(forecast_dates: list[str], members: list[list[float]], history: dict, rule: LevelRule) -> Indicator:
    """Level from the ensemble's exceedance of the flood flows."""
    m = np.asarray(members, dtype=float)
    if m.ndim != 2 or m.size == 0:
        raise ValueError("forecast has no ensemble members")
    peak_per_member = m.max(axis=1)
    flows = {int(k): float(v) for k, v in history["flows"].items()}
    exceed = {t: float(np.mean(peak_per_member > q)) for t, q in flows.items()}
    median = np.median(m, axis=0)
    level, reason = "normal", "fewer than {:.0f}% of forecast members pass the {}-year flood".format(rule.probability * 100, rule.watch_return_years)
    for name, years in (("severe", rule.severe_return_years), ("warning", rule.warning_return_years), ("watch", rule.watch_return_years)):
        if exceed.get(years, 0.0) >= rule.probability:
            level = name
            reason = f"{exceed[years] * 100:.0f}% of forecast members pass the {years}-year flood ({flows[years]:.0f} m3/s)"
            break
    k = int(median.argmax())
    return Indicator(level, list(forecast_dates), flows, exceed, forecast_dates[k], float(median[k]), float(median[0]),
                     int(m.shape[0]), {k2: v for k2, v in history.items() if k2 != "flows"}, reason)


def raise_level(level: str, to_at_least: str) -> str:
    return LEVELS[max(LEVELS.index(level), LEVELS.index(to_at_least))]
