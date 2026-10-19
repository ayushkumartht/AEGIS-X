from __future__ import annotations

import numpy as np
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import ValidationError

from aegis.api import context, services
from aegis.api.schemas import AnalysisRequest, TraceRequest
from aegis.domains.flood.plans import plan_to_dict
from aegis.engine import sample_futures
from aegis.engine.montecarlo import MonteCarloBatch, MonteCarloRun
from aegis.exceptions import DataError
from aegis.storage import repo

router = APIRouter(tags=["simulate"])
CHUNK = 50


@router.post("/simulate")
def simulate(req: AnalysisRequest):
    ctx = context.get_context(req.district)
    plan = services.plan_of(ctx, req.plan)
    result = services.simulate(ctx, plan, req.what_if, req.n_samples, req.seed)
    result["forecast"] = ctx.forecast
    result["run_id"] = repo.add_run(req.district, plan_to_dict(plan), req.n_samples, req.seed, ctx.forecast, result["summary"])
    return result


@router.post("/simulate/trace")
def simulate_trace(req: TraceRequest):
    """Hour-by-hour playback of one representative future of the plan."""
    ctx = context.get_context(req.district)
    return services.trace(ctx, services.plan_of(ctx, req.plan), req.what_if, req.n_samples, req.seed, req.pick)


@router.websocket("/ws/simulate")
async def simulate_stream(ws: WebSocket):
    """Send {"progress": 0..1} while simulating, then {"done": true, "result": ...}."""
    await ws.accept()
    try:
        req = AnalysisRequest(**await ws.receive_json())
        ctx = context.get_context(req.district)
        plan = services.plan_of(ctx, req.plan)
        model = services.model_for(ctx, req.what_if)
        futures = sample_futures(model, ctx.scenario, req.n_samples, req.seed)
        runs: list[MonteCarloRun] = []
        for i in range(0, len(futures), CHUNK):
            for cond in futures[i : i + CHUNK]:
                runs.append(MonteCarloRun(cond, model.simulate(ctx.scenario, plan, cond)))
            await ws.send_json({"progress": len(runs) / len(futures)})
        result = services.batch_result(ctx, plan, MonteCarloBatch(plan, runs))
        result["forecast"] = ctx.forecast
        result["run_id"] = repo.add_run(req.district, plan_to_dict(plan), req.n_samples, req.seed, ctx.forecast, result["summary"])
        await ws.send_json({"done": True, "result": result})
    except WebSocketDisconnect:
        return
    except (ValidationError, DataError, ValueError, KeyError, np.linalg.LinAlgError) as exc:
        await ws.send_json({"error": str(exc)})
    finally:
        try:
            await ws.close()
        except RuntimeError:
            pass
