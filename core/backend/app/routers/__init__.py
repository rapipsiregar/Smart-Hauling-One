"""HTTP routers. Aggregated into a single API router mounted by the app."""

from __future__ import annotations

from fastapi import APIRouter

from app.routers import (
    analysis, backup, cameras, dashboard, edge, live, reference,
)

api_router = APIRouter(prefix="/api")
api_router.include_router(dashboard.router)
api_router.include_router(analysis.router)
api_router.include_router(reference.router)
api_router.include_router(cameras.router)
api_router.include_router(edge.router)
api_router.include_router(live.router)
api_router.include_router(backup.router)

# There is deliberately no test bench here. The gate is what detects; the core
# receives what the gate decided. A bench on this side could only ever exercise a
# second implementation of the pipeline, which is the drift that
# edge/backend/tests/test_vendor_sync.py exists to prevent. It lives on the
# device instead: edge/backend/app/services/test_runs.py.
