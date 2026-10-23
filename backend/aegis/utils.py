"""General-purpose utilities used across the AEGIS-X backend."""
from __future__ import annotations

import hashlib
import json
from typing import Any


def stable_hash(obj: Any, length: int = 8) -> str:
    """Return a short, stable hex hash of any JSON-serialisable object."""
    raw = json.dumps(obj, sort_keys=True, default=str).encode()
    return hashlib.sha256(raw).hexdigest()[:length]


def clamp(value: float, lo: float, hi: float) -> float:
    """Clamp *value* to the closed interval [lo, hi]."""
    return max(lo, min(hi, value))


def normalize(value: float, lo: float, hi: float) -> float:
    """Min-max normalize *value* to [0, 1] given the range [lo, hi].

    Returns 0.0 if lo == hi to avoid division by zero.
    """
    if hi == lo:
        return 0.0
    return clamp((value - lo) / (hi - lo), 0.0, 1.0)


def percentage_change(old: float, new: float) -> float:
    """Return the percentage change from *old* to *new*.

    Returns 0.0 when *old* is zero to avoid division by zero.
    """
    if old == 0.0:
        return 0.0
    return ((new - old) / abs(old)) * 100.0

