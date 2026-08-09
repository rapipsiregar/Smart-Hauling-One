"""Local FastAPI for one gate.

Runs on the Jetson beside the detection threads and serves the gate's own UI:
status, this gate's crossings, and the inference settings a technician can change
on the spot. Everything it reads comes from local storage, so it keeps working
when the link to the core is down -- which is the reason for running a stack at
the gate at all.

Deliberately NOT a copy of the core's API. The core owns fleet-wide reporting,
the authoritative master, and cross-gate reconciliation; this owns one gate.
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import store
from app.routers import gate

AGENT_ENABLED = os.environ.get("SMART_GATE_RUN_AGENT", "true").lower() in ("1", "true", "yes")


def _sync_from_core() -> None:
    """Ask the core who this gate is and which trucks exist, once, at boot.

    Two things, because both are needed before the first detection and neither
    can be worked out on the device:

    * **direction** -- whether this lane is an arrival or a departure. A camera
      code says nothing about it, it decides how every crossing this gate reports
      is filed, and it filters the clip list a technician is offered.
    * **the truck master** -- a device that has never synced holds no trucks, so
      every reading resolves to UNKNOWN however well the OCR did. The pipeline
      then looks broken when only the roster is missing.

    With the agent running, MasterSync pulls the roster anyway; this covers the
    case where it is not (SMART_GATE_RUN_AGENT=false), which is how the console
    is run on a machine with no camera. The pull is version-gated, so doing it in
    both places costs one cheap request rather than a second copy of the roster.

    Deliberately not fatal and deliberately not retried here: both answers are
    cached from last time, and a gate that refuses to start because the centre is
    unreachable defeats the point of running a stack at the gate at all.
    """
    from agent.config import Settings
    from agent.induk_client import IndukClient
    from app.services import clip_sources

    try:
        client = IndukClient(Settings.from_env())
    except Exception as err:
        print(f"edge: not configured to reach the core ({err})")
        return

    try:
        config = client.get_config()
        clip_sources.remember_direction(config.get("direction"))
        clip_sources.remember_core_contact()
        print(f"edge: gate direction from core -> {config.get('direction')!r}")
    except Exception as err:
        print(f"edge: gate direction not fetched ({err}); using the cached value")

    try:
        payload = client.get_master(known_version=store.master_version())
        clip_sources.remember_core_contact()
        if payload.get("changed"):
            stored = store.replace_master(payload["trucks"], payload["master_version"])
            print(f"edge: master replica updated -> {stored} units")
    except Exception as err:
        print(f"edge: master not fetched ({err}); using the local replica")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start the detection/sync threads alongside the API.

    Disabled with SMART_GATE_RUN_AGENT=false so the UI and its endpoints can be
    developed on a machine with no camera, no model, and no GPU.
    """
    store.ensure_schema()
    _sync_from_core()
    runner = None
    if AGENT_ENABLED:
        from app.services.agent_runner import AgentRunner

        runner = AgentRunner()
        runner.start()
        app.state.agent = runner
    else:
        print("edge: agent threads disabled (SMART_GATE_RUN_AGENT=false)")
        app.state.agent = None
    yield
    if runner is not None:
        runner.stop()


def create_app() -> FastAPI:
    app = FastAPI(title="Integrated Smart Hauling System — Perangkat Gate", lifespan=lifespan)
    # The local UI is served from a different port in development.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(gate.router, prefix="/api")

    @app.get("/")
    def health() -> dict:
        return {
            "status": "online",
            "service": "Integrated Smart Hauling System — Perangkat Gate",
            "camera_code": os.environ.get("SMART_GATE_CAMERA_CODE", "UNCONFIGURED"),
        }

    return app


app = create_app()


def run(host: str = "0.0.0.0", port: int = 8100) -> None:
    import uvicorn

    uvicorn.run(app, host=host, port=port, log_level="warning")
