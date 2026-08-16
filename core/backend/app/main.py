"""FastAPI application factory and dev runner for the Integrated Smart Hauling System backend."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exception_handlers import http_exception_handler
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import DATA_DIR, ensure_directories
from app.repositories import run_write_repo
from app.routers import api_router
from app.services import backup_scheduler, device_status, live_sessions
from pathlib import Path


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run background jobs for the lifetime of a served application.

    Deliberately not called from ``create_app()``: ``app = create_app()`` executes
    at import time in every test module, and a sweep thread mutating device status
    underneath the suite would make tests flaky. ``TestClient`` only triggers this
    when used as a context manager, which the tests do not do.
    """
    device_status.start_background_sweep()
    live_sessions.start_stale_sweep()
    # Unattended, and first run is immediate: the likeliest moment to find out
    # there is no backup is the moment the database is already gone.
    backup_scheduler.start()
    yield
    device_status.stop_background_sweep()
    live_sessions.stop_stale_sweep()
    backup_scheduler.stop()


def create_app() -> FastAPI:
    ensure_directories()
    # Create every table before serving a single request. On a fresh deployment
    # the database file does not exist yet, and the read paths would otherwise
    # fail with "no such table" until the first pipeline run happened to create
    # them. run_write_repo owns the inference tables and cascades to the camera
    # and crossing-time migrations.
    run_write_repo.ensure_schema()
    app = FastAPI(title="Integrated Smart Hauling System — API Pusat", lifespan=lifespan)
    app.mount("/media", StaticFiles(directory=str(DATA_DIR)), name="media")

    static_dir = Path(__file__).parent / "static"
    if static_dir.exists():
        app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

    app.include_router(api_router)

    @app.exception_handler(StarletteHTTPException)
    async def _dict_detail_exception_handler(
        request: Request, exc: StarletteHTTPException
    ):
        """Return dict-shaped ``HTTPException`` details verbatim.

        The edge API's contract is ``{"error": "..."}``
        (``docs/edge-system/API_CONTRACT.md`` §0), not FastAPI's default
        ``{"detail": ...}`` envelope. Only exceptions raised with a dict detail
        (currently just device auth) are unwrapped; everything else -- including
        framework 404s carrying a plain string detail -- keeps FastAPI's default
        behaviour untouched.
        """
        if isinstance(exc.detail, dict):
            return JSONResponse(exc.detail, status_code=exc.status_code)
        return await http_exception_handler(request, exc)

    @app.get("/")
    def health_check() -> dict:
        return {
            "status": "online",
            "service": "Integrated Smart Hauling System",
            "frontend": "http://localhost:3000",
            "api_tester": "http://localhost:8000/static/api-tester.html",
        }

    return app


app = create_app()


def run(host: str = "127.0.0.1", port: int = 8000) -> None:
    import uvicorn

    print(f"\nIntegrated Smart Hauling System running at:  http://{host}:{port}\n")
    uvicorn.run(app, host=host, port=port, log_level="warning")
