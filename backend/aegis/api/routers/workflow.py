"""Explanations, field reports, beliefs, and the decision audit log."""

from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter, HTTPException

from aegis.api import context
from aegis.api.schemas import DecisionRequest, ExplainRequest, ReportRequest
from aegis.domains.flood.plans import plan_from_dict
from aegis.llm.base import get_provider
from aegis.llm.explain import narrate
from aegis.llm.parse_report import parse_report
from aegis.storage import repo

router = APIRouter(tags=["workflow"])


@router.post("/explain")
def explain(req: ExplainRequest):
    """Plain-language narration of analysis results. Uses the LLM when configured, else a template."""
    return narrate(req.payload, get_provider())


@router.post("/reports")
def add_report(req: ReportRequest):
    ctx = context.get_context(req.district)
    parsed = parse_report(req.text, get_provider(), ctx.scenario.bridge_names)
    report_id = repo.add_report(req.district, req.source_type, req.text, asdict(parsed))
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
def add_decision(req: DecisionRequest):
    ctx = context.get_context(req.district)
    plan = plan_from_dict(ctx.scenario, req.plan.as_dict())
    if req.run_id is not None and repo.get_run(req.run_id) is None:
        raise HTTPException(status_code=404, detail=f"Run {req.run_id} not found.")
    from aegis.domains.flood.plans import plan_to_dict

    decision_id = repo.add_decision(
        req.district, req.author, req.action, plan_to_dict(plan), req.run_id, req.explanation, req.note
    )
    return {"id": decision_id}


@router.get("/decisions")
def decisions(district: str | None = None):
    return repo.list_decisions(district)
