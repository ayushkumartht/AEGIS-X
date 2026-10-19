"""Tests for aegis.utils helpers."""
from __future__ import annotations
from aegis.utils import stable_hash, clamp


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
