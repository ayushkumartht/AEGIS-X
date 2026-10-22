"""Watched districts: config, the GloFAS river cell for each, and their live flood indicator."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from functools import lru_cache

import numpy as np
import yaml

from aegis.ingest import open_meteo
from aegis.ops.risk import Indicator, LevelRule, assess, return_flows
from aegis.settings import get_settings

CACHE = "ops"
CELL_STEP = 0.05  # degrees; GloFAS cells are ~0.05 degrees
SEARCH_YEAR = "2024"
RETURN_YEARS = (2, 5, 20)
WIDEN_BELOW = 150.0  # m3/s: below this mean flow, search 25 cells instead of 9
MIN_RIVER_FLOW = 20.0  # m3/s: below this, GloFAS does not resolve a river at the town


@dataclass(frozen=True)
class WatchedDistrict:
    id: str
    name: str
    state: str
    river: str
    lat: float
    lon: float
    console: str | None


@dataclass(frozen=True)
class WatchConfig:
    districts: tuple[WatchedDistrict, ...]
    rule: LevelRule
    history_start: str
    min_years: int


@lru_cache
def load_config() -> WatchConfig:
    path = get_settings().aegis_data_dir / "ops" / "watched_districts.yaml"
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    lv = raw.get("levels", {})
    rule = LevelRule(
        float(lv.get("probability", 0.3)),
        int(lv.get("severe_return_years", 20)),
        int(lv.get("warning_return_years", 5)),
        int(lv.get("watch_return_years", 2)),
    )
    districts = tuple(
        WatchedDistrict(d["id"], d["name"], d["state"], d.get("river", ""), float(d["lat"]), float(d["lon"]), d.get("console"))
        for d in raw["districts"]
    )
    hist = raw.get("history", {})
    return WatchConfig(districts, rule, str(hist.get("start", "2005-01-01")), int(hist.get("min_years", 10)))


def by_id(district_id: str) -> WatchedDistrict | None:
    return next((d for d in load_config().districts if d.id == district_id), None)


def _best_cell(d: WatchedDistrict, radius: int) -> dict:
    best = None
    for i in range(-radius, radius + 1):
        for j in range(-radius, radius + 1):
            lat, lon = round(d.lat + i * CELL_STEP, 3), round(d.lon + j * CELL_STEP, 3)
            rec = open_meteo.discharge_history(CACHE, f"cell_{d.id}_{i}_{j}", lat, lon, f"{SEARCH_YEAR}-01-01", f"{SEARCH_YEAR}-12-31")
            mean = float(np.mean(rec["values"])) if rec["values"] else 0.0
            if best is None or mean > best["mean_flow"]:
                best = {"lat": lat, "lon": lon, "mean_flow": mean, "cells": (2 * radius + 1) ** 2}
    return best


def river_cell(d: WatchedDistrict) -> dict:
    """The GloFAS cell near the town with the largest mean flow over a year (the main river).

    Searches 9 cells, then 25 when even the best has a small flow (the river may sit one cell
    further out). A best cell below MIN_RIVER_FLOW means GloFAS does not resolve this river.
    """
    best = _best_cell(d, 1)
    if best["mean_flow"] < WIDEN_BELOW:
        best = _best_cell(d, 2)
    best["method"] = f"largest mean {SEARCH_YEAR} flow among {best['cells']} GloFAS cells around the town"
    return best


def history(d: WatchedDistrict, cell: dict) -> dict | None:
    cfg = load_config()
    end = f"{date.today().year - 1}-12-31"
    rec = open_meteo.discharge_history(CACHE, f"history_{d.id}", cell["lat"], cell["lon"], cfg.history_start, end)
    return return_flows(rec["dates"], rec["values"], RETURN_YEARS, cfg.min_years)


def indicator(d: WatchedDistrict, refresh: bool = False) -> tuple[Indicator, dict]:
    """Today's indicator for a district, and the river cell it was computed at."""
    cfg = load_config()
    cell = river_cell(d)
    if cell["mean_flow"] < MIN_RIVER_FLOW:
        raise ValueError(
            f"{d.name}: GloFAS (5 km) shows no river here (best nearby cell averages {cell['mean_flow']:.0f} m3/s), "
            "so no flood indicator is given"
        )
    hist = history(d, cell)
    if hist is None:
        raise ValueError(f"{d.name}: the GloFAS record is shorter than {cfg.min_years} complete years")
    fc = open_meteo.discharge_ensemble(CACHE, f"forecast_{d.id}", cell["lat"], cell["lon"], refresh=refresh)
    return assess(fc["dates"], fc["members"], hist, cfg.rule), cell
