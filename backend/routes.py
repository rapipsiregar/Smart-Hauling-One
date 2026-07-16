from fastapi import APIRouter
from backend import routes_trucks, routes_crossings, routes_process, routes_reports, routes_telemetry, routes_contractor_perf, routes_dispatches, routes_admin, routes_admin_audit

router = APIRouter()

# Include the modular sub-routers
router.include_router(routes_trucks.router)
router.include_router(routes_crossings.router)
router.include_router(routes_process.router)
router.include_router(routes_reports.router)
router.include_router(routes_telemetry.router)
router.include_router(routes_contractor_perf.router)
router.include_router(routes_dispatches.router)
router.include_router(routes_admin.router)
router.include_router(routes_admin_audit.router)
