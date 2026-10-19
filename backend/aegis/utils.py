"""General-purpose utilities used across the AEGIS-X backend."""
from __future__ import annotations

import hashlib
import json
import time
from typing import Any


def stable_hash(obj: Any, length: int = 8) -> str:
    """Return a short, stable hex hash of any JSON-serialisable object."""
    raw = json.dumps(obj, sort_keys=True, default=str).encode()
    return hashlib.sha256(raw).hexdigest()[:length]


def clamp(value: float, lo: float, hi: float) -> float:
    """Clamp *value* to the closed interval [lo, hi]."""
    return max(lo, min(hi, value))
