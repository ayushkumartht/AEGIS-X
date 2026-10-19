from __future__ import annotations

from fastapi import APIRouter

from aegis.api import context, services
from aegis.api.schemas import (
    AnalysisRequest,
    CompareRequest,
    OptimizeRequest,
    RedTeamRequest,
    SensitivityRequest,
)

router = APIRouter(prefix="/analysis", tags=["analysis"])


@router.post("/compare")
def compare(req: CompareRequest):
    ctx = context.get_context(req.district)
    plans = {name: services.plan_of(ctx, p) for name, p in req.plans.items()}
    for name, plan in plans.items():
        plan.name = name
    return services.compare(ctx, plans, req.what_if, req.n_samples, req.seed)


@router.post("/redteam")
def redteam(req: RedTeamRequest):
    ctx = context.get_context(req.district)
    return services.redteam(ctx, services.plan_of(ctx, req.plan), req.what_if, req.n_samples, req.seed, req.fail_below)


@router.post("/sensitivity")
def sensitivity(req: SensitivityRequest):
    ctx = context.get_context(req.district)
    return services.sensitivity(
        ctx, services.plan_of(ctx, req.plan), req.what_if, req.n_samples, req.seed, req.method, req.sobol_n
    )


@router.post("/voi")
def voi(req: AnalysisRequest):
    ctx = context.get_context(req.district)
    return services.voi(ctx, services.plan_of(ctx, req.plan), req.what_if, min(req.n_samples, 300), req.seed)


@router.post("/optimize")
def optimize(req: OptimizeRequest):
    ctx = context.get_context(req.district)
    return services.optimize(ctx, req.what_if, req.n_samples, req.population, req.generations, req.seed)
