"""Tests for aegis.utils helpers."""
from __future__ import annotations
from aegis.utils import stable_hash, clamp, normalize, percentage_change


def test_stable_hash_deterministic():
    assert stable_hash({"a": 1}) == stable_hash({"a": 1})


def test_stable_hash_differs():
    assert stable_hash({"a": 1}) != stable_hash({"a": 2})


def test_stable_hash_length():
    assert len(stable_hash("x", length=12)) == 12


def test_clamp_within():
    assert clamp(0.5, 0.0, 1.0) == 0.5


def test_clamp_lo():
    assert clamp(-1.0, 0.0, 1.0) == 0.0


def test_clamp_hi():
    assert clamp(2.0, 0.0, 1.0) == 1.0


# --- normalize ---

def test_normalize_midpoint():
    assert normalize(50.0, 0.0, 100.0) == 0.5


def test_normalize_at_lo():
    assert normalize(0.0, 0.0, 100.0) == 0.0


def test_normalize_at_hi():
    assert normalize(100.0, 0.0, 100.0) == 1.0


def test_normalize_clamps_below():
    assert normalize(-10.0, 0.0, 100.0) == 0.0


def test_normalize_clamps_above():
    assert normalize(110.0, 0.0, 100.0) == 1.0


def test_normalize_equal_range():
    assert normalize(5.0, 5.0, 5.0) == 0.0


# --- percentage_change ---

def test_percentage_change_increase():
    assert percentage_change(100.0, 150.0) == 50.0


def test_percentage_change_decrease():
    assert percentage_change(200.0, 100.0) == -50.0


def test_percentage_change_zero_old():
    assert percentage_change(0.0, 50.0) == 0.0


def test_percentage_change_no_change():
    assert percentage_change(100.0, 100.0) == 0.0

