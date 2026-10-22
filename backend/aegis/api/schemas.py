"""Request bodies for the API."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class PlanModel(BaseModel):
    """Every field is optional: missing fields take the baseline plan's values."""

    name: str | None = None
    start_hour: float | None = Field(default=None, ge=0, le=48)
    priority: list[str] | None = None
    open_shelters: list[str] | None = None
    route_avoid: list[str] | None = None
    boats_at: dict[str, int] | None = None
    vehicles_at: dict[str, int] | None = None
    protected: list[str] | None = None
    warning_channels: list[str] | None = None

    def as_dict(self) -> dict:
        return self.model_dump(exclude_none=True)


class WhatIf(BaseModel):
    """Conditions the officer fixes to ask "what if"."""

    peak_stage_m: float | None = None
    local_rain_mm: float | None = None
    boat_availability_pct: float | None = Field(default=None, ge=0, le=1)
    boat_delay_h: float | None = None
    comms_degradation_pct: float | None = Field(default=None, ge=0, le=1)
    compliance_pct: float | None = Field(default=None, ge=0, le=1)
    peak_time_h: float | None = None
    bridge_closed: list[str] | None = None

    def as_dict(self) -> dict | None:
        d = self.model_dump(exclude_none=True)
        return d or None


class AnalysisRequest(BaseModel):
    district: str = "demo"
    plan: PlanModel | None = None
    what_if: WhatIf | None = None
    n_samples: int = Field(default=300, ge=20, le=5000)
    seed: int = 42


class TraceRequest(AnalysisRequest):
    pick: Literal["median", "bad_day"] = "median"
    n_samples: int = Field(default=150, ge=20, le=1000)


class CompareRequest(BaseModel):
    district: str = "demo"
    plans: dict[str, PlanModel] = Field(min_length=2, max_length=6)
    what_if: WhatIf | None = None
    n_samples: int = Field(default=300, ge=20, le=5000)
    seed: int = 42


class RedTeamRequest(AnalysisRequest):
    fail_below: float = Field(default=0.5, gt=0, lt=1)


class SensitivityRequest(AnalysisRequest):
    method: Literal["correlation", "sobol"] = "correlation"
    sobol_n: int = Field(default=48, ge=16, le=256)


class OptimizeRequest(BaseModel):
    district: str = "demo"
    what_if: WhatIf | None = None
    n_samples: int = Field(default=20, ge=10, le=200)
    population: int = Field(default=16, ge=6, le=60)
    generations: int = Field(default=6, ge=1, le=30)
    seed: int = 42


class ExplainRequest(BaseModel):
    payload: dict


class ReportRequest(BaseModel):
    district: str = "demo"
    text: str = Field(min_length=3, max_length=1000)
    source_type: Literal["field_team", "control_room", "official_feed", "public_call", "social_media"] = "control_room"


class DecisionRequest(BaseModel):
    district: str = "demo"
    action: Literal["accept", "edit", "reject"]
    plan: PlanModel
    run_id: int | None = None
    explanation: str = Field(default="", max_length=5000)
    note: str = Field(default="", max_length=500)


class FloodStateRequest(BaseModel):
    level_m: float = Field(ge=0, le=20)
    closed_bridges: list[str] = []
