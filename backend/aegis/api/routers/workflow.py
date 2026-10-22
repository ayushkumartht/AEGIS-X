"""Explanations, field reports, beliefs, and the decision audit log."""

from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter, Depends, HTTPException

from aegis.api import context
from aegis.api.limits import rate_limited
from aegis.api.schemas import DecisionRequest, ExplainRequest, ReportRequest
from aegis.api.security import require
from aegis.auth import User
from aegis.domains.flood.plans import plan_from_dict, plan_to_dict
from aegis.llm.base import get_provider
from aegis.llm.explain import narrate
from aegis.llm.parse_report import parse_report
from aegis.storage import repo

router = APIRouter(tags=["workflow"])

# Who may change shared state that every visitor sees.
WRITERS = ("admin", "officer")


@router.post("/explain", dependencies=[Depends(rate_limited)])
def explain(req: ExplainRequest):
    """Plain-language narration of analysis results. Uses the LLM when configured, else a template."""
    return narrate(req.payload, get_provider())


@router.post("/reports", dependencies=[Depends(rate_limited)])
def add_report(req: ReportRequest, user: User = Depends(require(*WRITERS))):
    ctx = context.get_context(req.district)
    parsed = parse_report(req.text, get_provider(), ctx.scenario.bridge_names)
    report_id = repo.add_report(req.district, req.source_type, req.text, asdict(parsed), author=_signature(user))
    context.invalidate(req.district)
    fresh = context.get_context(req.district)
    return {"id": report_id, "parsed": asdict(parsed), "beliefs": fresh.beliefs}


@router.get("/districts/{district}/reports")
def reports(district: str):
    return repo.list_reports(district)


@router.get("/districts/{district}/beliefs")
def beliefs(district: str):
    return context.get_context(district).beliefs


@router.post("/decisions")
def add_decision(req: DecisionRequest, user: User = Depends(require(*WRITERS))):
    ctx = context.get_context(req.district)
    plan = plan_from_dict(ctx.scenario, req.plan.as_dict())
    if req.run_id is not None and repo.get_run(req.run_id) is None:
        raise HTTPException(status_code=404, detail=f"Run {req.run_id} not found.")
    decision_id = repo.add_decision(
        req.district, _signature(user), req.action, plan_to_dict(plan), req.run_id, req.explanation, req.note,
        req.evidence,
    )
    return {"id": decision_id}


@router.get("/decisions")
def decisions(district: str | None = None):
    return repo.list_decisions(district)


@router.get("/audit/integrity")
def audit_integrity():
    """Recompute the decision hash chain and report any decision that no longer verifies."""
    return repo.audit_integrity()


def _signature(user: User) -> str:
    """The name written into the audit log: taken from the login, never from the request body."""
    return f"{user.name} <{user.email}>"
