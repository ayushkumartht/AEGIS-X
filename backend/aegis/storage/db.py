"""Storage: runs, plans, field reports, the decision audit log and the Command Center tables.

SQLite (standard library sqlite3) by default. When AEGIS_DB_URL is a postgresql:// URL (for example
Supabase), the same SQL runs on PostgreSQL through a small adapter: `?` placeholders, `INSERT OR
IGNORE`, `lastrowid` and `row["col"]` / `row[0]` access all behave as they do on SQLite.
"""

from __future__ import annotations

import json
import re
import sqlite3
import threading
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


def is_postgres(url: str | None = None) -> bool:
    return (url or get_settings().aegis_db_url).startswith(("postgres://", "postgresql://"))


@contextmanager
def connect() -> Iterator[Any]:
    """A connection that commits on success and rolls back on error."""
    if is_postgres():
        with _pg_pool().connection() as conn:
            yield _PgConn(conn)
        return
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


def write_lock(c: Any, table: str) -> None:
    """Serialise writers of `table` until the transaction ends (the decision hash chain needs this)."""
    if isinstance(c, _PgConn):
        c.execute(f"LOCK TABLE {table} IN SHARE ROW EXCLUSIVE MODE")
    else:
        c.execute("BEGIN IMMEDIATE")


def dumps(obj: Any) -> str:
    return json.dumps(obj, default=str)


# ---------------------------------------------------------------- PostgreSQL adapter

PG_SCHEMA = Path(__file__).with_name("supabase_schema.sql")
# tables with an identity `id`; inserts into them return it, like sqlite's lastrowid
_ID_TABLES = {"plan", "run", "field_report", "decision", "ops_indicator", "ops_brief", "ops_recommendation"}
_INSERT_INTO = re.compile(r"^\s*INSERT\s+INTO\s+(\w+)", re.IGNORECASE)
_INSERT_OR_IGNORE = re.compile(r"^\s*INSERT\s+OR\s+IGNORE\s+", re.IGNORECASE)

_pool: Any = None
_pool_url = ""
_pool_lock = threading.Lock()


class _Row(dict):
    """A dict row that also answers row[0], like sqlite3.Row."""

    def __init__(self, names: list[str], values: Any):
        super().__init__(zip(names, values, strict=True))
        self._values = tuple(values)

    def __getitem__(self, key: Any) -> Any:
        return self._values[key] if isinstance(key, int) else super().__getitem__(key)


def _row_factory(cursor: Any):
    names = [d.name for d in cursor.description or ()]
    return lambda values: _Row(names, values)


def _pg_sql(sql: str) -> str:
    sql = sql.replace("?", "%s")
    if _INSERT_OR_IGNORE.match(sql):
        sql = _INSERT_OR_IGNORE.sub("INSERT ", sql) + " ON CONFLICT DO NOTHING"
    return sql


class _PgCursor:
    def __init__(self, cursor: Any, lastrowid: int | None):
        self._cursor = cursor
        self.lastrowid = lastrowid

    def fetchone(self) -> Any:
        return self._cursor.fetchone()

    def fetchall(self) -> list[Any]:
        return self._cursor.fetchall()

    def __iter__(self):
        return iter(self._cursor)


class _PgConn:
    """The slice of sqlite3.Connection the repositories use, on a psycopg connection."""

    def __init__(self, conn: Any):
        self._conn = conn

    def execute(self, sql: str, params: Any = ()) -> _PgCursor:
        sql = _pg_sql(sql)
        m = _INSERT_INTO.match(sql)
        returning = bool(m and m.group(1).lower() in _ID_TABLES and "RETURNING" not in sql.upper())
        if returning:
            sql += " RETURNING id"
        cur = self._conn.execute(sql, tuple(params))
        return _PgCursor(cur, cur.fetchone()[0] if returning else None)


def _configurer(schema: str):
    def configure(conn: Any) -> None:
        """Read jsonb back as its JSON text and timestamps as ISO strings, as SQLite stores them."""
        from psycopg.types.datetime import TimestamptzLoader
        from psycopg.types.string import TextLoader

        class IsoTimestamptz(TimestamptzLoader):
            def load(self, data: Any) -> str:  # type: ignore[override]
                return super().load(data).astimezone(UTC).isoformat(timespec="seconds")

        conn.adapters.register_loader("jsonb", TextLoader)
        conn.adapters.register_loader("json", TextLoader)
        conn.adapters.register_loader("timestamptz", IsoTimestamptz)
        conn.execute(f'SET search_path TO "{schema}"')
        conn.commit()  # a pooled connection must be handed back idle

    return configure


def _pg_pool() -> Any:
    """One pool per process (rebuilt if the URL or schema changes); the schema is applied when it opens."""
    global _pool, _pool_url
    settings = get_settings()
    url, schema = settings.aegis_db_url, settings.aegis_db_schema
    if not re.fullmatch(r"[a-z_][a-z0-9_]*", schema):
        raise ValueError("AEGIS_DB_SCHEMA must be a lower-case identifier.")
    with _pool_lock:
        if _pool is None or _pool_url != f"{url}#{schema}":
            from psycopg_pool import ConnectionPool

            if _pool is not None:
                _pool.close()
            # prepare_threshold=None: Supabase's pooler cannot keep prepared statements
            pool = ConnectionPool(url, min_size=1, max_size=5, timeout=30, configure=_configurer(schema),
                                  kwargs={"row_factory": _row_factory, "prepare_threshold": None}, open=True)
            with pool.connection() as conn:
                conn.execute(f'CREATE SCHEMA IF NOT EXISTS "{schema}"')
                conn.execute(f'SET search_path TO "{schema}"')
                conn.execute(PG_SCHEMA.read_text(encoding="utf-8"))
            _pool, _pool_url = pool, f"{url}#{schema}"
    return _pool


def close_pool() -> None:
    """Close the PostgreSQL pool (tests, shutdown)."""
    global _pool, _pool_url
    with _pool_lock:
        if _pool is not None:
            _pool.close()
        _pool, _pool_url = None, ""
