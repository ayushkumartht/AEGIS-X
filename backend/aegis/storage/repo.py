"""Reads and writes for the AEGIS-X tables."""

from __future__ import annotations

import hashlib
import json
from typing import Any

from aegis.storage.db import connect, dumps, now_iso, write_lock


def add_plan(district: str, origin: str, plan: dict) -> int:
    with connect() as c:
        return c.execute(
            "INSERT INTO plan (created_at, district, origin, plan_json) VALUES (?,?,?,?)",
            (now_iso(), district, origin, dumps(plan)),
        ).lastrowid


def add_run(district: str, plan: dict, n_samples: int, seed: int | None, forecast: dict, summary: dict) -> int:
    with connect() as c:
        return c.execute(
            "INSERT INTO run (created_at, district, plan_json, n_samples, seed, forecast_json, summary_json) "
            "VALUES (?,?,?,?,?,?,?)",
            (now_iso(), district, dumps(plan), n_samples, seed, dumps(forecast), dumps(summary)),
        ).lastrowid


def get_run(run_id: int) -> dict | None:
    with connect() as c:
        row = c.execute("SELECT * FROM run WHERE id = ?", (run_id,)).fetchone()
    return None if row is None else _run(row)


def list_runs(district: str | None = None, limit: int = 50) -> list[dict[str, Any]]:
    with connect() as c:
        if district:
            rows = c.execute("SELECT * FROM run WHERE district = ? ORDER BY id DESC LIMIT ?", (district, limit)).fetchall()
        else:
            rows = c.execute("SELECT * FROM run ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
    return [_run(r) for r in rows]


def _run(row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "created_at": row["created_at"],
        "district": row["district"],
        "plan": json.loads(row["plan_json"]),
        "n_samples": row["n_samples"],
        "seed": row["seed"],
        "forecast": json.loads(row["forecast_json"]),
        "summary": json.loads(row["summary_json"]),
    }


def add_report(district: str, source_type: str, raw_text: str, parsed: dict, author: str = "") -> int:
    with connect() as c:
        return c.execute(
            "INSERT INTO field_report (received_at, district, source_type, raw_text, parsed_json, author) "
            "VALUES (?,?,?,?,?,?)",
            (now_iso(), district, source_type, raw_text, dumps(parsed), author),
        ).lastrowid


def list_reports(district: str | None = None, limit: int | None = None) -> list[dict[str, Any]]:
    sql, args = "SELECT * FROM field_report", []
    if district:
        sql, args = sql + " WHERE district = ?", [district]
    sql += " ORDER BY id DESC"
    if limit:
        sql, args = sql + " LIMIT ?", [*args, limit]
    with connect() as c:
        rows = c.execute(sql, args).fetchall()
    return [
        {
            "id": r["id"],
            "received_at": r["received_at"],
            "district": r["district"],
            "source_type": r["source_type"],
            "raw_text": r["raw_text"],
            "parsed": json.loads(r["parsed_json"]),
            "author": r["author"],
        }
        for r in rows
    ]


HASHED = ("decided_at", "district", "author", "action", "plan_json", "run_id", "explanation", "note", "evidence_json")


def _decision_hash(previous: str, row: dict[str, Any]) -> str:
    """SHA-256 over the decision's fields (sorted keys) and the previous decision's hash."""
    body = json.dumps({k: row[k] for k in HASHED}, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(f"{previous}|{body}".encode()).hexdigest()


def add_decision(
    district: str, author: str, action: str, plan: dict, run_id: int | None, explanation: str, note: str,
    evidence: dict | None = None,
) -> int:
    """Store a decision, chained to the previous one so a later edit or deletion is detectable."""
    row = {
        "decided_at": now_iso(), "district": district, "author": author, "action": action,
        "plan_json": dumps(plan), "run_id": run_id, "explanation": explanation, "note": note,
        "evidence_json": dumps(evidence or {}),
    }
    with connect() as c:
        write_lock(c, "decision")  # one writer at a time, so two decisions cannot share a predecessor
        last = c.execute("SELECT decision_hash FROM decision ORDER BY id DESC LIMIT 1").fetchone()
        previous = (last["decision_hash"] if last and last["decision_hash"] else "")
        digest = _decision_hash(previous, row)
        return c.execute(
            f"INSERT INTO decision ({', '.join(HASHED)}, previous_hash, decision_hash) VALUES ({', '.join('?' * (len(HASHED) + 2))})",
            (*(row[k] for k in HASHED), previous, digest),
        ).lastrowid


def audit_integrity() -> dict[str, Any]:
    """Recompute the decision hash chain.

    Each hashed decision must match its own fields and point at the hash of the decision before it.
    Decisions made before the chain existed have no hash and are counted as legacy. Without an
    outside copy of the latest hash, deleting the newest decisions cannot be detected: this is
    tamper-evidence, not immutable storage.
    """
    with connect() as c:
        rows = [dict(r) for r in c.execute("SELECT * FROM decision ORDER BY id")]
    broken, legacy, checked, expected = [], 0, 0, ""
    for r in rows:
        if not r["decision_hash"]:
            legacy += 1
            expected = ""
            continue
        checked += 1
        if (r["previous_hash"] or "") != expected or _decision_hash(r["previous_hash"] or "", r) != r["decision_hash"]:
            broken.append(r["id"])
        expected = r["decision_hash"]
    status = "invalid" if broken else "valid_with_legacy_records" if legacy else "valid"
    return {"status": status, "total": len(rows), "checked": checked, "legacy": legacy, "broken": broken,
            "head": expected or None,
            "note": "Tamper-evident only: without an outside copy of the head hash, deleting the newest decisions is not detectable."}


def list_decisions(district: str | None = None, limit: int | None = None) -> list[dict[str, Any]]:
    sql, args = "SELECT * FROM decision", []
    if district:
        sql, args = sql + " WHERE district = ?", [district]
    sql += " ORDER BY id DESC"
    if limit:
        sql, args = sql + " LIMIT ?", [*args, limit]
    with connect() as c:
        rows = c.execute(sql, args).fetchall()
    out = []
    for r in rows:
        run = get_run(r["run_id"]) if r["run_id"] is not None else None
        out.append(
            {
                "id": r["id"],
                "decided_at": r["decided_at"],
                "district": r["district"],
                "author": r["author"],
                "action": r["action"],
                "plan": json.loads(r["plan_json"]),
                "run_id": r["run_id"],
                "run": run,
                "explanation": r["explanation"],
                "note": r["note"],
                "evidence": json.loads(r["evidence_json"] or "{}"),
                "hash": r["decision_hash"],
            }
        )
    return out


def counts() -> dict[str, int]:
    with connect() as c:
        return {t: c.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0] for t in ("run", "decision", "field_report")}
