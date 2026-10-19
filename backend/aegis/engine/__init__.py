"""AEGIS-X engine package: public API surface."""

from aegis.engine.calibration import brier_score, coverage_rate, critical_success_index
from aegis.engine.compare import compare_plans, compare_summary
from aegis.engine.interfaces import ConditionSpace, Variable
from aegis.engine.montecarlo import (
    MonteCarloBatch,
    MonteCarloRun,
    run_monte_carlo,
    sample_conditions_batch,
)
from aegis.engine.optimizer import ParetoCandidate, nsga2_optimize, pareto_front, random_search_optimize
from aegis.engine.redteam import (
    adversarial_search,
    discover_failure_boxes,
    find_single_points_of_failure,
    find_worst_case,
)
from aegis.engine.sampling import sample_futures
from aegis.engine.sensitivity import sensitivity_analysis, sobol_sensitivity
from aegis.engine.voi import expected_value_of_information, rank_variables_by_voi

__all__ = [
    "ConditionSpace",
    "MonteCarloBatch",
    "MonteCarloRun",
    "ParetoCandidate",
    "Variable",
    "adversarial_search",
    "brier_score",
    "compare_plans",
    "compare_summary",
    "coverage_rate",
    "critical_success_index",
    "discover_failure_boxes",
    "expected_value_of_information",
    "find_single_points_of_failure",
    "find_worst_case",
    "nsga2_optimize",
    "pareto_front",
    "random_search_optimize",
    "rank_variables_by_voi",
    "run_monte_carlo",
    "sample_conditions_batch",
    "sample_futures",
    "sensitivity_analysis",
    "sobol_sensitivity",
]
