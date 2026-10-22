"""Reads and writes for the Command Center tables (ops_*)."""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from typing import Any

from aegis.storage.db import connect, dumps, now_iso

EVENT_FIELDS = (
    "uid", "source", "hazard", "event", "severity", "urgency", "certainty", "sender", "state", "area",
    "headline", "description", "lat", "lon", "place_method", "district_id", "effective", "expires", "sent", "url",
)


# ---------------------------------------------------------------- feeds


def feed_attempt(name: str, ok: bool, items: int = 0, error: str = "") -> None:
    now = now_iso()
    with connect() as c:
        c.execute("INSERT OR IGNORE INTO ops_feed (name) VALUES (?)", (name,))
        if ok:
            c.execute("UPDATE ops_feed SET last_attempt=?, last_success=?, last_error=NULL, items=? WHERE name=?", (now, now, items, name))
        else:
            c.execute("UPDATE ops_feed SET last_attempt=?, last_error=? WHERE name=?", (now, error[:500], name))


def feeds() -> list[dict[str, Any]]:
    with connect() as c:
        return [dict(r) for r in c.execute("SELECT * FROM ops_feed ORDER BY name")]


# ---------------------------------------------------------------- events


def upsert_events(events: list[dict]) -> int:
    """Insert new events and refresh existing ones (same uid). Returns how many were new."""
    fetched = now_iso()
    new = 0
    with connect() as c:
        for e in events:
            exists = c.execute("SELECT 1 FROM ops_event WHERE uid=?", (e["uid"],)).fetchone()
            row = {k: e.get(k) for k in EVENT_FIELDS}
            row["gauge_json"] = dumps(e["gauge"]) if e.get("gauge") else None
            if exists:  # keep fetched_at as the first time it was seen, and any place found later
                if row["lat"] is None:
                    row = {k: v for k, v in row.items() if k not in ("lat", "lon", "place_method")}
                if row.get("district_id") is None:
                    row.pop("district_id", None)
                c.execute(f"UPDATE ops_event SET {', '.join(f'{k}=?' for k in row)} WHERE uid=?", (*row.values(), e["uid"]))
            else:
                row["fetched_at"] = fetched
                cols = list(row)
                c.execute(f"INSERT INTO ops_event ({', '.join(cols)}) VALUES ({', '.join('?' * len(cols))})", tuple(row.values()))
                new += 1
    return new


def unlocated_events(limit: int) -> list[dict]:
    with connect() as c:
        rows = c.execute("SELECT * FROM ops_event WHERE lat IS NULL ORDER BY sent DESC LIMIT ?", (limit,)).fetchall()
    return [_event(r) for r in rows]


def set_place(uid: str, lat: float, lon: float, method: str, district_id: str | None = None) -> None:
    with connect() as c:
        c.execute("UPDATE ops_event SET lat=?, lon=?, place_method=?, district_id=COALESCE(?, district_id) WHERE uid=?",
                  (lat, lon, method, district_id, uid))


def _event(r) -> dict[str, Any]:
    d = dict(r)
    d["gauge"] = json.loads(d.pop("gauge_json")) if d.get("gauge_json") else None
    return d


def _parse_time(text: str | None) -> datetime | None:
    if not text:
        return None
    try:
        t = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None
    return t if t.tzinfo else t.replace(tzinfo=UTC)


def is_active(e: dict, now: datetime | None = None) -> bool:
    now = now or datetime.now(UTC)
    expires = _parse_time(e.get("expires"))
    return expires is None or expires >= now


def list_events(*, hazard: str | None = None, severity: str | None = None, state: str | None = None,
                active: bool | None = None, days: int = 7, district_id: str | None = None, limit: int = 500) -> list[dict]:
    since = (datetime.now(UTC) - timedelta(days=days)).isoformat()
    sql, args = "SELECT * FROM ops_event WHERE fetched_at >= ?", [since]
    for col, val in (("hazard", hazard), ("severity", severity), ("district_id", district_id)):
        if val:
            sql, args = sql + f" AND {col} = ?", [*args, val]
    if state:
        sql, args = sql + " AND lower(state) = lower(?)", [*args, state]
    sql += " ORDER BY sent DESC LIMIT ?"
    with connect() as c:
        rows = [_event(r) for r in c.execute(sql, (*args, limit)).fetchall()]
    if active is not None:
        rows = [r for r in rows if is_active(r) == active]
    return rows


def week_over_week(hazard: str | None = None) -> dict:
    """Alerts received this week versus the week before (reported activity, not a risk measure)."""
    now = datetime.now(UTC)
    with connect() as c:
        def count(start: datetime, end: datetime) -> int:
            sql, args = "SELECT COUNT(*) FROM ops_event WHERE fetched_at >= ? AND fetched_at < ?", [start.isoformat(), end.isoformat()]
            if hazard:
                sql, args = sql + " AND hazard = ?", [*args, hazard]
            return c.execute(sql, args).fetchone()[0]
        this = count(now - timedelta(days=7), now + timedelta(seconds=1))
        last = count(now - timedelta(days=14), now - timedelta(days=7))
    return {"this_week": this, "last_week": last, "change_pct": None if last == 0 else (this - last) / last,
            "note": "Number of alerts received; it does not measure risk."}


# ---------------------------------------------------------------- indicators


def add_indicator(district_id: str, level: str, data: dict) -> None:
    with connect() as c:
        c.execute("INSERT INTO ops_indicator (district_id, computed_at, level, data_json) VALUES (?,?,?,?)",
                  (district_id, now_iso(), level, dumps(data)))


def latest_indicators() -> dict[str, dict]:
    with connect() as c:
        rows = c.execute(
            "SELECT * FROM ops_indicator WHERE id IN (SELECT MAX(id) FROM ops_indicator GROUP BY district_id)"
        ).fetchall()
    return {r["district_id"]: {"computed_at": r["computed_at"], "level": r["level"], **json.loads(r["data_json"])} for r in rows}


# ---------------------------------------------------------------- briefs


def add_brief(mode: str, author: str, source: str, model: str, evidence: list[dict], sections: dict,
              recommendations: list[dict]) -> int:
    with connect() as c:
        bid = c.execute(
            "INSERT INTO ops_brief (created_at, mode, author, source, model, evidence_json, sections_json) VALUES (?,?,?,?,?,?,?)",
            (now_iso(), mode, author, source, model, dumps(evidence), dumps(sections)),
        ).lastrowid
        for r in recommendations:
            c.execute("INSERT INTO ops_recommendation (brief_id, district_id, action, detail_json) VALUES (?,?,?,?)",
                      (bid, r.get("district_id"), r["action"], dumps(r)))
    return bid


def _recommendations(c, brief_id: int) -> list[dict]:
    rows = c.execute("SELECT * FROM ops_recommendation WHERE brief_id=? ORDER BY id", (brief_id,)).fetchall()
    return [{"id": r["id"], "status": r["status"], "decided_by": r["decided_by"], "decided_at": r["decided_at"],
             "decision_id": r["decision_id"], **json.loads(r["detail_json"])} for r in rows]


def get_brief(brief_id: int) -> dict | None:
    with connect() as c:
        r = c.execute("SELECT * FROM ops_brief WHERE id=?", (brief_id,)).fetchone()
        if r is None:
            return None
        return {"id": r["id"], "created_at": r["created_at"], "mode": r["mode"], "author": r["author"],
                "source": r["source"], "model": r["model"], "evidence": json.loads(r["evidence_json"]),
                "sections": json.loads(r["sections_json"]), "recommendations": _recommendations(c, r["id"])}


def list_briefs(limit: int = 10) -> list[dict]:
    with connect() as c:
        ids = [r[0] for r in c.execute("SELECT id FROM ops_brief ORDER BY id DESC LIMIT ?", (limit,))]
    return [b for b in (get_brief(i) for i in ids) if b]


def get_recommendation(rec_id: int) -> dict | None:
    with connect() as c:
        r = c.execute("SELECT * FROM ops_recommendation WHERE id=?", (rec_id,)).fetchone()
    if r is None:
        return None
    return {"id": r["id"], "brief_id": r["brief_id"], "status": r["status"], **json.loads(r["detail_json"])}


def decide_recommendation(rec_id: int, status: str, by: str, decision_id: int) -> None:
    with connect() as c:
        c.execute("UPDATE ops_recommendation SET status=?, decided_by=?, decided_at=?, decision_id=? WHERE id=?",
                  (status, by, now_iso(), decision_id, rec_id))
