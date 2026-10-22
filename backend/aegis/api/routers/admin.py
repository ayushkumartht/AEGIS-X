"""Command Center data (admin only): system state, live forecasts, and activity from the database."""

from __future__ import annotations

from collections import Counter
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends

from aegis import __version__
from aegis.api import context
from aegis.api.security import require
from aegis.exceptions import AegisError
from aegis.llm.base import get_provider
from aegis.settings import get_settings
from aegis.storage import repo

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require("admin"))])
ACTIVITY_DAYS = 14


def _district_status(info: dict) -> dict:
    out = {**info, "forecast": None, "error": None}
    if not info["built"]:
        return out
    try:
        ctx = context.get_context(info["id"])
    except AegisError as exc:
        out["error"] = str(exc)
        return out
    s = ctx.scenario
    out["forecast"] = ctx.forecast
    out["totals"] = {
        "population": int(sum(c.population for c in s.clusters)),
        "areas": len(s.clusters),
        "shelters": len(s.shelters),
        "shelter_capacity": int(sum(x.capacity for x in s.shelters)),
        "bridges": len(s.bridges),
        "boats": s.metadata.get("boats_total"),
    }
    out["beliefs"] = ctx.beliefs
    return out


def _activity(runs: list[dict], decisions: list[dict], reports: list[dict]) -> list[dict]:
    today = datetime.now(UTC).date()
    days = [today - timedelta(days=i) for i in range(ACTIVITY_DAYS - 1, -1, -1)]
    tally = {
        "runs": Counter(r["created_at"][:10] for r in runs),
        "decisions": Counter(d["decided_at"][:10] for d in decisions),
        "reports": Counter(r["received_at"][:10] for r in reports),
    }
    return [{"date": d.isoformat(), **{k: c.get(d.isoformat(), 0) for k, c in tally.items()}} for d in days]


@router.get("/overview")
def overview():
    s = get_settings()
    llm = get_provider(s)
    runs = repo.list_runs(limit=1000)
    decisions = repo.list_decisions(limit=500)
    reports = repo.list_reports(limit=500)
    return {
        "system": {
            "version": __version__,
            "env": s.aegis_env,
            "offline": s.aegis_offline,
            "llm_provider": llm.name,
            "llm_model": getattr(llm, "model", None),
            "rate_limit_per_min": s.aegis_rate_limit_per_min,
            "max_heavy_jobs": s.aegis_max_heavy_jobs,
            "server_time": datetime.now(UTC).isoformat(timespec="seconds"),
        },
        "counts": repo.counts(),
        "districts": [_district_status(d) for d in context.available_districts()],
        "activity": _activity(runs, decisions, reports),
        "recent_runs": [
            {k: r[k] for k in ("id", "created_at", "district", "n_samples", "seed", "summary")} for r in runs[:25]
        ],
        "recent_decisions": [
            {k: d[k] for k in ("id", "decided_at", "district", "author", "action", "run_id", "note")} for d in decisions[:25]
        ],
        "recent_reports": reports[:25],
    }
