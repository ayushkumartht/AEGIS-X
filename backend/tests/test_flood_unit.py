"""Unit tests for FloodModel and MonteCarloBatch helpers."""
from __future__ import annotations
import pytest
from aegis.domains.flood.model import FloodModel
from aegis.engine.montecarlo import run_monte_carlo, MonteCarloBatch


@pytest.fixture
def model():
    return FloodModel()


def test_instantiates(model):
    assert model is not None


def test_run_returns_batch(model):
    batch = run_monte_carlo(model, model.default_scenario(), model.default_plan(), n_samples=20, seed=0)
    assert isinstance(batch, MonteCarloBatch)
    assert len(batch.runs) == 20


def test_summary_has_required_keys(model):
    batch = run_monte_carlo(model, model.default_scenario(), model.default_plan(), n_samples=10, seed=1)
    key = batch.runs[0].result.success_metric
    for k in ("mean", "std", "p10", "p50", "p90", "worst", "best"):
        assert k in batch.summary(key)


def test_resilience_in_range(model):
    batch = run_monte_carlo(model, model.default_scenario(), model.default_plan(), n_samples=50, seed=2)
    key = batch.runs[0].result.success_metric
    assert 0.0 <= batch.resilience(key) <= 1.0
