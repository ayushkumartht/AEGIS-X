"""Shared type aliases used across the AEGIS-X codebase."""
from __future__ import annotations
from typing import TypeAlias

MetricName: TypeAlias = str
PlanName: TypeAlias = str
SeedType: TypeAlias = int | None
MetricDict: TypeAlias = dict[str, float]

__all__ = ["MetricName", "PlanName", "SeedType", "MetricDict"]
