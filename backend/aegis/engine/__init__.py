"""AEGIS-X engine package -- public API surface."""

from aegis.engine.montecarlo import (
    MonteCarloRun,
    MonteCarloBatch,
    run_monte_carlo,
    sample_conditions_batch,
)
from aegis.engine.compare import compare_plans, compare_summary
from aegis.engine.optimizer import (
    ParetoCandidate,
    pareto_front,
    random_search_optimize,
)
from aegis.engine.sensitivity import sensitivity_analysis
from aegis.engine.voi import value_of_information
from aegis.engine.redteam import red_team

__all__ = [
    "MonteCarloRun", "MonteCarloBatch", "run_monte_carlo", "sample_conditions_batch",
    "compare_plans", "compare_summary",
    "ParetoCandidate", "pareto_front", "random_search_optimize",
    "sensitivity_analysis", "value_of_information", "red_team",
]
