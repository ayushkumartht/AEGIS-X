"""Tests for compare_plans and compare_summary."""
from __future__ import annotations
import pytest
from aegis.domains.flood.model import FloodModel
from aegis.engine.compare import compare_plans, compare_summary


@pytest.fixture
def model():
    return FloodModel()


def test_compare_returns_all_plans(model):
    results = compare_plans(
        model, model.default_scenario(),
        {"A": model.default_plan(), "B": model.default_plan()},
        key=model.success_metric_key, n_samples=20, seed=0,
    )
    assert set(results.keys()) == {"A", "B"}


def test_summary_has_resilience(model):
    batches = compare_plans(
        model, model.default_scenario(), {"A": model.default_plan()},
        key=model.success_metric_key, n_samples=20, seed=0,
    )
    summary = compare_summary(batches, model.success_metric_key)
    assert "resilience" in summary["A"]
