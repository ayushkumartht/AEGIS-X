from __future__ import annotations

import asyncio

import numpy as np
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import ValidationError

from aegis.api import context, limits, services
from aegis.api.limits import heavy
from aegis.api.schemas import AnalysisRequest, TraceRequest
from aegis.domains.flood.plans import plan_to_dict
from aegis.engine import sample_futures
from aegis.engine.montecarlo import MonteCarloBatch, MonteCarloRun
from aegis.exceptions import DataError
from aegis.storage import repo

router = APIRouter(tags=["simulate"])
CHUNK = 50


@router.post("/simulate", dependencies=[Depends(heavy)])
def simulate(req: AnalysisRequest):
    ctx = context.get_context(req.district)
    plan = services.plan_of(ctx, req.plan)
    result = services.simulate(ctx, plan, req.what_if, req.n_samples, req.seed)
    result["forecast"] = ctx.forecast
    result["run_id"] = repo.add_run(req.district, plan_to_dict(plan), req.n_samples, req.seed, ctx.forecast, result["summary"])
    return result


@router.post("/simulate/trace", dependencies=[Depends(heavy)])
def simulate_trace(req: TraceRequest):
    """Hour-by-hour playback of one representative future of the plan."""
    ctx = context.get_context(req.district)
    return services.trace(ctx, services.plan_of(ctx, req.plan), req.what_if, req.n_samples, req.seed, req.pick)


@router.websocket("/ws/simulate")
async def simulate_stream(ws: WebSocket):
    """Send {"progress": 0..1} while simulating, then {"done": true, "result": ...}.

    The simulation runs in a worker thread, so the server keeps answering other requests.
    """
    await ws.accept()
    slots = None
    try:
        limits.check_rate(ws.client.host if ws.client else "unknown")
        req = AnalysisRequest(**await ws.receive_json())
        slots = await asyncio.to_thread(limits.acquire_slot)
        ctx = await asyncio.to_thread(context.get_context, req.district)
        plan = services.plan_of(ctx, req.plan)
        model = services.model_for(ctx, req.what_if)
        futures = await asyncio.to_thread(sample_futures, model, ctx.scenario, req.n_samples, req.seed)

        def run_chunk(chunk):
            return [MonteCarloRun(cond, model.simulate(ctx.scenario, plan, cond)) for cond in chunk]

        runs: list[MonteCarloRun] = []
        for i in range(0, len(futures), CHUNK):
            runs.extend(await asyncio.to_thread(run_chunk, futures[i : i + CHUNK]))
            await ws.send_json({"progress": len(runs) / len(futures)})
        result = services.batch_result(ctx, plan, MonteCarloBatch(plan, runs))
        result["forecast"] = ctx.forecast
        result["run_id"] = repo.add_run(req.district, plan_to_dict(plan), req.n_samples, req.seed, ctx.forecast, result["summary"])
        await ws.send_json({"done": True, "result": result})
    except WebSocketDisconnect:
        return
    except HTTPException as exc:
        await ws.send_json({"error": exc.detail})
    except (ValidationError, DataError, ValueError, KeyError, np.linalg.LinAlgError) as exc:
        await ws.send_json({"error": str(exc)})
    finally:
        if slots is not None:
            slots.release()
        try:
            await ws.close()
        except RuntimeError:
            pass
