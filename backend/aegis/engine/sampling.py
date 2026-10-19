"""Drawing futures (Conditions) for a scenario."""

from __future__ import annotations

import numpy as np

from aegis.engine.interfaces import Conditions, ConditionSpace, DomainModel, Scenario


def sample_futures(
    model: DomainModel,
    scenario: Scenario,
    n: int,
    seed: int | None = 42,
    method: str = "lhs",
) -> list[Conditions]:
    """Draw `n` futures. Uses the model's ConditionSpace (Latin hypercube or random) when it has
    one, otherwise falls back to the model's own sample_conditions()."""
    rng = np.random.default_rng(seed)
    space: ConditionSpace | None = model.condition_space(scenario)
    if space is None:
        return [model.sample_conditions(rng, scenario) for _ in range(n)]
    unit = space.sample_unit(n, method, rng)
    return [model.conditions_from_values(space.values_from_unit(row)) for row in unit]
