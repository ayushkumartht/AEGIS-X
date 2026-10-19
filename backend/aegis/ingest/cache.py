"""File cache for fetched data. Raw responses live under data/raw/<district>/<source>/."""

from __future__ import annotations

import json
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from aegis.exceptions import OfflineError
from aegis.settings import get_settings
from aegis.utils import stable_hash


def cache_path(district: str, source: str, params: dict) -> Path:
    base = get_settings().aegis_data_dir / "raw" / district / source
    return base / f"{stable_hash(params, 16)}.json"


def cached_json(
    district: str,
    source: str,
    params: dict,
    fetch: Callable[[], Any],
    *,
    refresh: bool = False,
    max_age: timedelta | None = None,
) -> Any:
    """Return cached data when present and fresh, otherwise call `fetch()` and store the result.

    In offline mode (AEGIS_OFFLINE=true) a cached file is always used, however old, and a
    missing file raises OfflineError.
    """
    path = cache_path(district, source, params)
    entry = json.loads(path.read_text(encoding="utf-8")) if path.exists() else None
    offline = get_settings().aegis_offline

    if entry is not None and not refresh:
        fresh = max_age is None or datetime.now(UTC) - datetime.fromisoformat(entry["fetched_at"]) <= max_age
        if fresh or offline:
            return entry["data"]
    if offline:
        if entry is not None:
            return entry["data"]
        raise OfflineError(f"{source} {params} is not cached and AEGIS_OFFLINE is set.")

    data = fetch()
    path.parent.mkdir(parents=True, exist_ok=True)
    record = {
        "source": source,
        "params": params,
        "fetched_at": datetime.now(UTC).isoformat(),
        "data": data,
    }
    path.write_text(json.dumps(record), encoding="utf-8")
    return data
