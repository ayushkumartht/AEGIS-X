"""Shared HTTP helpers: one place for user agent, timeout, retries and the test transport."""

from __future__ import annotations

import time

import httpx

from aegis.exceptions import DataError
from aegis.settings import get_settings

TIMEOUT_S = 120.0
RETRIES = 3

_transport: httpx.BaseTransport | None = None


def use_transport(transport: httpx.BaseTransport | None) -> None:
    """Route every request through `transport` (tests); pass None to restore the network."""
    global _transport
    _transport = transport


def _request(method: str, url: str, **kwargs) -> httpx.Response:
    headers = {"User-Agent": get_settings().http_user_agent, "Accept": "application/json"}
    last: Exception | None = None
    for attempt in range(RETRIES):
        try:
            with httpx.Client(timeout=TIMEOUT_S, transport=_transport, headers=headers) as client:
                resp = client.request(method, url, **kwargs)
            if resp.status_code in (429, 502, 503, 504):
                raise DataError(f"{url} returned HTTP {resp.status_code}")
            resp.raise_for_status()
            return resp
        except (httpx.HTTPError, DataError) as exc:
            last = exc
            time.sleep(0 if _transport else 2 * (attempt + 1))
    raise DataError(f"Request to {url} failed after {RETRIES} attempts: {last}")


def get_json(url: str, params: dict | None = None):
    return _request("GET", url, params=params).json()


def post_form_json(url: str, data: dict):
    return _request("POST", url, data=data).json()
