"""Protection for the compute-heavy endpoints on a public deployment.

Two limits: each client IP gets a number of heavy requests per minute, and only a few heavy
jobs run at once so one visitor cannot starve the others (Monte Carlo runs take seconds of CPU).
"""

from __future__ import annotations

import threading
import time
from collections import deque
from collections.abc import Iterator

from fastapi import HTTPException, Request

from aegis.settings import get_settings

WINDOW_S = 60.0
QUEUE_WAIT_S = 30.0

_hits: dict[str, deque[float]] = {}
_hits_lock = threading.Lock()
_slots: threading.BoundedSemaphore | None = None
_slots_size = 0


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def check_rate(ip: str) -> None:
    """Raise 429 when `ip` has used up its heavy requests for the last minute."""
    limit = get_settings().aegis_rate_limit_per_min
    if limit <= 0:
        return
    now = time.monotonic()
    with _hits_lock:
        q = _hits.setdefault(ip, deque())
        while q and now - q[0] > WINDOW_S:
            q.popleft()
        if len(q) >= limit:
            wait = int(WINDOW_S - (now - q[0])) + 1
            raise HTTPException(429, f"Too many runs from your address. Try again in {wait} s.")
        q.append(now)


def _semaphore() -> threading.BoundedSemaphore:
    global _slots, _slots_size
    size = max(1, get_settings().aegis_max_heavy_jobs)
    if _slots is None or _slots_size != size:
        _slots, _slots_size = threading.BoundedSemaphore(size), size
    return _slots


def acquire_slot(timeout: float = QUEUE_WAIT_S) -> threading.BoundedSemaphore:
    """Wait for a free compute slot, or raise 503 if the server stays busy."""
    slots = _semaphore()
    if not slots.acquire(timeout=timeout):
        raise HTTPException(503, "The server is busy with other simulations. Try again in a moment.")
    return slots


def heavy(request: Request) -> Iterator[None]:
    """FastAPI dependency for compute-heavy endpoints: rate limit, then hold a compute slot."""
    check_rate(client_ip(request))
    slots = acquire_slot()
    try:
        yield
    finally:
        slots.release()


def rate_limited(request: Request) -> None:
    """FastAPI dependency for cheap endpoints that still cost something (LLM calls)."""
    check_rate(client_ip(request))


def reset() -> None:
    """Forget all counters (tests)."""
    global _slots
    with _hits_lock:
        _hits.clear()
    _slots = None
