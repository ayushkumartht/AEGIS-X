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


    def get(self, name: str) -> float:
        """Value of one named condition variable (see field_names())."""
        return float(getattr(self, name))


@dataclass
class Variable:
    """One uncertain input, described as a range so it can be sampled and shown to the officer.

    kind "continuous": triangular(low, mode, high) when `mode` is set, else uniform(low, high).
    kind "binary": value 1.0 with probability `p_true`, else 0.0.
    kind "empirical": quantiles of `samples` (for example forecast ensemble members).
    `source` says where the range came from and is shown in the UI.
    """

    name: str
    kind: str = "continuous"
    low: float = 0.0
    high: float = 1.0
    mode: float | None = None
    p_true: float = 0.5
    samples: list[float] = field(default_factory=list)
    source: str = "prior"

    def from_unit(self, u: float) -> float:
        """Map u in [0, 1] to a value of this variable (inverse CDF)."""
        u = min(max(float(u), 0.0), 1.0)
        if self.kind == "binary":
            return 1.0 if u < self.p_true else 0.0
        if self.kind == "empirical":
            return float(np.quantile(np.asarray(self.samples, dtype=float), u))
        if self.mode is None:
            return self.low + u * (self.high - self.low)
        lo, md, hi = self.low, self.mode, self.high
        cut = (md - lo) / (hi - lo) if hi > lo else 0.5
        if u < cut:
            return lo + float(np.sqrt(u * (hi - lo) * (md - lo)))
        return hi - float(np.sqrt((1 - u) * (hi - lo) * (hi - md)))

    def to_unit(self, value: float) -> float:
        """Approximate inverse of from_unit (used to express a value as a probability)."""
        if self.kind == "binary":
            return 0.0 if value >= 0.5 else 1.0
        if self.kind == "empirical":
            s = np.sort(np.asarray(self.samples, dtype=float))
            return float(np.searchsorted(s, value) / max(len(s), 1))
        if self.mode is None:
            return float((value - self.low) / (self.high - self.low)) if self.high > self.low else 0.5
        lo, md, hi = self.low, self.mode, self.high
        if value <= lo:
            return 0.0
        if value >= hi:
            return 1.0
        if value < md:
            return float((value - lo) ** 2 / ((hi - lo) * (md - lo)))
        return float(1 - (hi - value) ** 2 / ((hi - lo) * (hi - md)))

    def describe(self) -> dict[str, Any]:
        out: dict[str, Any] = {"name": self.name, "kind": self.kind, "source": self.source}
        if self.kind == "binary":
            out["p_true"] = self.p_true
        elif self.kind == "empirical":
            s = np.asarray(self.samples, dtype=float)
            out.update(low=float(s.min()), high=float(s.max()), median=float(np.median(s)), n=len(s))
        else:
            out.update(low=self.low, high=self.high)
            if self.mode is not None:
                out["mode"] = self.mode
        return out


@dataclass
class ConditionSpace:
    """The full set of uncertain inputs of a scenario: what the engine samples futures from."""

    variables: list[Variable]

    @property
    def names(self) -> list[str]:
        return [v.name for v in self.variables]

    @property
    def dim(self) -> int:
        return len(self.variables)

    def values_from_unit(self, unit: np.ndarray) -> dict[str, float]:
        return {v.name: v.from_unit(u) for v, u in zip(self.variables, unit, strict=True)}

    def unit_from_values(self, values: dict[str, float]) -> np.ndarray:
        return np.array([v.to_unit(values[v.name]) for v in self.variables])

    def sample_unit(self, n: int, method: str = "lhs", rng: np.random.Generator | None = None) -> np.ndarray:
        """n x dim matrix of points in the unit cube: Latin hypercube or plain random."""
        rng = rng or np.random.default_rng(0)
        if method == "lhs":
            from scipy.stats import qmc

            return qmc.LatinHypercube(d=self.dim, seed=rng).random(n)
        return rng.random((n, self.dim))


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

    def condition_space(self, scenario: Scenario) -> ConditionSpace | None:
        """The uncertain inputs as ranges. Return None to use sample_conditions() only."""
        return None

    def conditions_from_values(self, values: dict[str, float]) -> Conditions:
        """Build one Conditions from named values (needed when condition_space() is provided)."""
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
