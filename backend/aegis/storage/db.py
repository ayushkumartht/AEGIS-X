"""SQLite storage (standard library sqlite3): runs, plans, field reports and the decision audit log."""

from __future__ import annotations

import json
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from aegis.settings import get_settings

SCHEMA = """
CREATE TABLE IF NOT EXISTS plan (
    id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL, district TEXT NOT NULL,
    origin TEXT NOT NULL, plan_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS run (
    id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL, district TEXT NOT NULL,
    plan_json TEXT NOT NULL, n_samples INTEGER NOT NULL, seed INTEGER,
    forecast_json TEXT NOT NULL, summary_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS field_report (
    id INTEGER PRIMARY KEY AUTOINCREMENT, received_at TEXT NOT NULL, district TEXT NOT NULL,
    source_type TEXT NOT NULL, raw_text TEXT NOT NULL, parsed_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS decision (
    id INTEGER PRIMARY KEY AUTOINCREMENT, decided_at TEXT NOT NULL, district TEXT NOT NULL,
    author TEXT NOT NULL, action TEXT NOT NULL, plan_json TEXT NOT NULL, run_id INTEGER,
    explanation TEXT NOT NULL, note TEXT NOT NULL
);
"""


def now_iso() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


def db_path() -> Path:
    url = get_settings().aegis_db_url
    if not url.startswith("sqlite:///"):
        raise ValueError("Only sqlite:/// database URLs are supported.")
    return Path(url.removeprefix("sqlite:///"))


@contextmanager
def connect() -> Iterator[sqlite3.Connection]:
    path = db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def dumps(obj: Any) -> str:
    return json.dumps(obj, default=str)
