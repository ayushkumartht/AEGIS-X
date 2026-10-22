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
CREATE TABLE IF NOT EXISTS ops_event (
    uid TEXT PRIMARY KEY, source TEXT NOT NULL, hazard TEXT NOT NULL, event TEXT NOT NULL,
    severity TEXT NOT NULL, urgency TEXT NOT NULL, certainty TEXT NOT NULL, sender TEXT NOT NULL,
    state TEXT NOT NULL, area TEXT NOT NULL, headline TEXT NOT NULL, description TEXT NOT NULL,
    lat REAL, lon REAL, place_method TEXT NOT NULL, district_id TEXT, effective TEXT, expires TEXT,
    sent TEXT NOT NULL, gauge_json TEXT, url TEXT NOT NULL, fetched_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ops_event_sent ON ops_event (sent);
CREATE TABLE IF NOT EXISTS ops_indicator (
    id INTEGER PRIMARY KEY AUTOINCREMENT, district_id TEXT NOT NULL, computed_at TEXT NOT NULL,
    level TEXT NOT NULL, data_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ops_indicator_district ON ops_indicator (district_id, id);
CREATE TABLE IF NOT EXISTS ops_feed (
    name TEXT PRIMARY KEY, last_attempt TEXT, last_success TEXT, last_error TEXT, items INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS ops_brief (
    id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL, mode TEXT NOT NULL, author TEXT NOT NULL,
    source TEXT NOT NULL, model TEXT NOT NULL, evidence_json TEXT NOT NULL, sections_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ops_recommendation (
    id INTEGER PRIMARY KEY AUTOINCREMENT, brief_id INTEGER NOT NULL, district_id TEXT, action TEXT NOT NULL,
    detail_json TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'proposed', decided_by TEXT, decided_at TEXT,
    decision_id INTEGER
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
    _migrate(conn)
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def _migrate(conn: sqlite3.Connection) -> None:
    """Add columns introduced after a database was first created."""
    cols = {r["name"] for r in conn.execute("PRAGMA table_info(field_report)")}
    if "author" not in cols:
        conn.execute("ALTER TABLE field_report ADD COLUMN author TEXT NOT NULL DEFAULT ''")
    cols = {r["name"] for r in conn.execute("PRAGMA table_info(decision)")}
    for name, ddl in (("evidence_json", "TEXT NOT NULL DEFAULT '{}'"), ("previous_hash", "TEXT"), ("decision_hash", "TEXT")):
        if name not in cols:
            conn.execute(f"ALTER TABLE decision ADD COLUMN {name} {ddl}")


def dumps(obj: Any) -> str:
    return json.dumps(obj, default=str)
