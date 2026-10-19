"""Simple, explainable hydrology: river stage over time, flooding thresholds, local ponding.

This is not a hydraulic model. It is enough to compare evacuation plans, and the rating curve
is calibrated against a past event (see replay/). Water level is metres above the normal level.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np

STAGE_SIGMA_H = 10.0  # width of the flood wave around its peak
PONDING_M_PER_MM = 0.003  # extra water depth in low spots per mm of local rain
LEVEL_STEP_M = 0.2  # water levels are rounded to this step so routing results can be cached (DEM error is larger)


@dataclass(frozen=True)
class Rating:
    """stage_above_normal = k * ln(Q / q_normal), never below zero."""

    q_normal: float = 600.0  # discharge (m3/s) at which the river sits at its normal level
    k: float = 6.0  # metres per e-fold of discharge

    def stage(self, discharge: float) -> float:
        if discharge <= self.q_normal:
            return 0.0
        return float(self.k * np.log(discharge / self.q_normal))

    def discharge(self, stage: float) -> float:
        return float(self.q_normal * np.exp(max(stage, 0.0) / self.k))

    def to_dict(self) -> dict:
        return {"q_normal": self.q_normal, "k": self.k}


def load_rating(path: Path) -> Rating:
    """Calibrated rating from a JSON file, or the default when the file does not exist."""
    if path.exists():
        data = json.loads(path.read_text(encoding="utf-8"))
        return Rating(float(data["q_normal"]), float(data["k"]))
    return Rating()


def stage_curve(base_m: float, peak_m: float, peak_time_h: float, times_h: np.ndarray) -> np.ndarray:
    """River stage at each time: current level `base_m` rising to `peak_m` at `peak_time_h`."""
    amplitude = max(peak_m - base_m, 0.0)
    return base_m + amplitude * np.exp(-0.5 * ((times_h - peak_time_h) / STAGE_SIGMA_H) ** 2)


def ponding_m(local_rain_mm: float) -> float:
    return PONDING_M_PER_MM * max(local_rain_mm, 0.0)


def quantise(level_m: np.ndarray | float):
    return np.round(np.asarray(level_m) / LEVEL_STEP_M).astype(int)
