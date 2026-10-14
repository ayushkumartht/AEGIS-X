"""
Core contract every domain module (flood, fire, crowd, ...) must implement.

The whole platform is built on top of ONE function per domain:

    simulate(scenario, plan, conditions) -> SimulationResult

Everything generic (Monte Carlo, Red Team, sensitivity analysis, plan
comparison, optimisation) lives in core/engine and only talks to domains
through this interface. A new domain = a new Scenario/Plan/Conditions
dataclass + a DomainModel subclass. Nothing in core/engine changes.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any
import numpy as np


@dataclass
class Scenario:
    """Static situation description (map, population, resources at t=0).

    Domain modules subclass this with their own fields (grid, roads,
    shelters, ...). Kept generic here so core/engine never has to know
    about grids, graphs, or anything domain-specific.
    """

    name: str = "unnamed-scenario"
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class Plan:
    """A candidate decision / resource allocation to be stress-tested."""

    name: str = "unnamed-plan"
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class Conditions:
    """One sampled 'future' — the uncertain inputs for a single run.

    Domain modules subclass this (e.g. FloodConditions has rainfall_mm,
    resource_availability_pct, comms_degradation_pct). Core engine only
    needs `as_vector()` so it can do sensitivity analysis / red-teaming
    without caring what the numbers mean.
    """

    def as_vector(self) -> np.ndarray:
        """Numeric view of this condition sample, for sensitivity analysis.

        Default implementation uses every float/int field on the dataclass,
        in declaration order. Override if you need custom ordering/filtering.
        """
        import dataclasses

        values = []
        for f in dataclasses.fields(self):
            v = getattr(self, f.name)
            if isinstance(v, (int, float)):
                values.append(float(v))
        return np.array(values, dtype=float)

    def field_names(self) -> list[str]:
        import dataclasses

        return [
            f.name
            for f in dataclasses.fields(self)
            if isinstance(getattr(self, f.name), (int, float))
        ]


@dataclass
class SimulationResult:
    """Output of a single simulate() call.

    `metrics` is the generic bag core/engine operates on (mean/percentile/
    sensitivity/optimisation all read from here). `success_metric` names
    which key is "higher is better" for ranking/optimisation; set
    `success_metric_minimize=True` for metrics like casualties/time where
    lower is better.
    """

    metrics: dict[str, float]
    success_metric: str
    success_metric_minimize: bool = False
    details: dict[str, Any] = field(default_factory=dict)

    def score(self) -> float:
        v = self.metrics[self.success_metric]
        return -v if self.success_metric_minimize else v


class DomainModel(ABC):
    """Base class every domain module (flood/fire/crowd/...) implements."""

    @abstractmethod
    def sample_conditions(self, rng: np.random.Generator, scenario: Scenario) -> Conditions:
        """Draw one random 'future' (uncertain inputs) for this scenario."""
        raise NotImplementedError

    @abstractmethod
    def simulate(
        self, scenario: Scenario, plan: Plan, conditions: Conditions
    ) -> SimulationResult:
        """Run exactly one deterministic simulation given fixed conditions."""
        raise NotImplementedError

    def perturb_scenario(self, scenario: Scenario, removed_element: str) -> Scenario:
        """Return a copy of `scenario` with one element removed/disabled.

        Used by Red Team's single-point-of-failure search (core/engine/
        redteam.py). Override to support it; default raises so callers get
        a clear error instead of silently skipping the check.
        """
        raise NotImplementedError(
            f"{type(self).__name__} does not support perturb_scenario()"
        )

    def removable_elements(self, scenario: Scenario) -> list[str]:
        """List of element ids that perturb_scenario() knows how to remove."""
        return []
