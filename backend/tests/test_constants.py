"""Tests for aegis.constants — validate types and value ranges."""
from __future__ import annotations
import aegis.constants as C


# ── Monte Carlo constants ─────────────────────────────────────────────────────

def test_mc_default_samples_positive():
    assert C.MC_DEFAULT_SAMPLES > 0


def test_mc_default_seed_non_negative():
    assert C.MC_DEFAULT_SEED >= 0


def test_mc_worst_fraction_range():
    assert 0.0 < C.MC_WORST_FRACTION < 1.0


# ── Optimiser constants ───────────────────────────────────────────────────────

def test_opt_n_candidates_positive():
    assert C.OPT_N_CANDIDATES > 0


def test_opt_samples_per_candidate_positive():
    assert C.OPT_SAMPLES_PER_CANDIDATE > 0


# ── Alert thresholds ─────────────────────────────────────────────────────────

def test_alert_thresholds_ordered():
    assert (
        C.ALERT_LOW_THRESHOLD
        < C.ALERT_MEDIUM_THRESHOLD
        < C.ALERT_HIGH_THRESHOLD
        < C.ALERT_CRITICAL_THRESHOLD
    )


def test_alert_thresholds_in_unit_interval():
    for threshold in (
        C.ALERT_LOW_THRESHOLD,
        C.ALERT_MEDIUM_THRESHOLD,
        C.ALERT_HIGH_THRESHOLD,
        C.ALERT_CRITICAL_THRESHOLD,
    ):
        assert 0.0 < threshold < 1.0


# ── Evacuation constants ──────────────────────────────────────────────────────

def test_evacuation_priority_labels_non_empty():
    assert len(C.EVACUATION_PRIORITY_LABELS) > 0


def test_evacuation_priority_labels_uppercase():
    for label in C.EVACUATION_PRIORITY_LABELS:
        assert label == label.upper()


def test_evacuation_default_radius_positive():
    assert C.EVACUATION_DEFAULT_RADIUS_KM > 0.0


# ── __all__ completeness ─────────────────────────────────────────────────────

def test_all_exported():
    """Every name in __all__ must actually exist in the module."""
    for name in C.__all__:
        assert hasattr(C, name), f"{name!r} missing from aegis.constants"
