"""AEGIS-X API. Run from backend/:  uvicorn aegis.api.main:app --reload  (docs at /docs)."""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from aegis import __version__
from aegis.api import context
from aegis.api.routers import analysis, districts, replay, simulate, workflow
from aegis.exceptions import AegisError, DataError, OfflineError
from aegis.llm.base import get_provider
from aegis.settings import get_settings

API_PREFIX = "/api/v1"


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="AEGIS-X", description="Test the decision before reality does.", version=__version__)
    app.add_middleware(
        CORSMiddleware, allow_origins=settings.cors_origins, allow_methods=["*"], allow_headers=["*"]
    )

    @app.exception_handler(DataError)
    @app.exception_handler(OfflineError)
    async def data_error(_: Request, exc: AegisError):
        return JSONResponse(status_code=404, content={"detail": str(exc)})

    @app.get("/")
    def root():
        return {"name": "AEGIS-X", "tagline": "Test the decision before reality does.", "version": __version__}

    @app.get(f"{API_PREFIX}/health")
    def health():
        s = get_settings()
        return {
            "status": "ok",
            "version": __version__,
            "env": s.aegis_env,
            "offline": s.aegis_offline,
            "llm_provider": get_provider(s).name,
            "districts": context.available_districts(),
        }

    for router in (districts.router, simulate.router, analysis.router, workflow.router, replay.router):
        app.include_router(router, prefix=API_PREFIX)
    return app


app = create_app()
