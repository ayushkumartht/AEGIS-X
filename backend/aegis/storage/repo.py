"""Reads and writes for the AEGIS-X tables."""

from __future__ import annotations

import json
from typing import Any

from aegis.storage.db import connect, dumps, now_iso


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
    if row is None:
        return None
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


def add_report(district: str, source_type: str, raw_text: str, parsed: dict) -> int:
    with connect() as c:
        return c.execute(
            "INSERT INTO field_report (received_at, district, source_type, raw_text, parsed_json) VALUES (?,?,?,?,?)",
            (now_iso(), district, source_type, raw_text, dumps(parsed)),
        ).lastrowid


def list_reports(district: str) -> list[dict[str, Any]]:
    with connect() as c:
        rows = c.execute("SELECT * FROM field_report WHERE district = ? ORDER BY id DESC", (district,)).fetchall()
    return [
        {
            "id": r["id"],
            "received_at": r["received_at"],
            "source_type": r["source_type"],
            "raw_text": r["raw_text"],
            "parsed": json.loads(r["parsed_json"]),
        }
        for r in rows
    ]


def add_decision(
    district: str, author: str, action: str, plan: dict, run_id: int | None, explanation: str, note: str
) -> int:
    with connect() as c:
        return c.execute(
            "INSERT INTO decision (decided_at, district, author, action, plan_json, run_id, explanation, note) "
            "VALUES (?,?,?,?,?,?,?,?)",
            (now_iso(), district, author, action, dumps(plan), run_id, explanation, note),
        ).lastrowid


def list_decisions(district: str | None = None) -> list[dict[str, Any]]:
    with connect() as c:
        if district:
            rows = c.execute("SELECT * FROM decision WHERE district = ? ORDER BY id DESC", (district,)).fetchall()
        else:
            rows = c.execute("SELECT * FROM decision ORDER BY id DESC").fetchall()
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
            }
        )
    return out
