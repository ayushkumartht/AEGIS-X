"""Tests for Pareto-front extraction."""
from __future__ import annotations
import pytest
from aegis.engine.optimizer import is_dominated, pareto_front, ParetoCandidate


def cand(a, b):
    return ParetoCandidate(plan=object(), objectives={"a": a, "b": b})


MINIMIZE = {"a": True, "b": True}


def test_dominated_basic():
    assert is_dominated({"a": 1.0, "b": 1.0}, {"a": 0.0, "b": 0.0}, MINIMIZE)


def test_not_dominated_tradeoff():
    assert not is_dominated({"a": 0.0, "b": 1.0}, {"a": 1.0, "b": 0.0}, MINIMIZE)


def test_pareto_removes_dominated():
    front = pareto_front([cand(0, 1), cand(1, 0), cand(1, 1)], MINIMIZE)
    assert len(front) == 2
