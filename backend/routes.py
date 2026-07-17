from fastapi import APIRouter
from backend import routes_trucks, routes_crossings, routes_process, routes_reports, routes_telemetry, routes_contractor_perf, routes_dispatches, routes_admin, routes_admin_audit, routes_admin_integrity, routes_reports_trends, routes_admin_thresholds, routes_reports_csv, routes_admin_telemetry, routes_admin_backup, routes_system_mode, routes_admin_db, routes_watchdog, routes_oht_load, routes_contractor_efficiency, routes_cycle_scatter, routes_admin_telemetry_diagnostic, routes_admin_email_schedule, routes_admin_db_index_optimize, routes_contractor_forecast, routes_telemetry_anomalies, routes_route_violations

router = APIRouter()

# Include the modular sub-routers
router.include_router(routes_trucks.router)
router.include_router(routes_crossings.router)
router.include_router(routes_process.router)
router.include_router(routes_reports.router)
router.include_router(routes_reports_csv.router)
router.include_router(routes_telemetry.router)
router.include_router(routes_contractor_perf.router)
router.include_router(routes_dispatches.router)
router.include_router(routes_admin.router)
router.include_router(routes_admin_audit.router)
router.include_router(routes_admin_integrity.router)
router.include_router(routes_reports_trends.router)
router.include_router(routes_admin_thresholds.router)
router.include_router(routes_admin_telemetry.router)
router.include_router(routes_admin_backup.router)
router.include_router(routes_system_mode.router)
router.include_router(routes_admin_db.router)
router.include_router(routes_watchdog.router)
router.include_router(routes_oht_load.router)
router.include_router(routes_contractor_efficiency.router)
router.include_router(routes_cycle_scatter.router)
router.include_router(routes_admin_telemetry_diagnostic.router)
router.include_router(routes_admin_email_schedule.router)
router.include_router(routes_admin_db_index_optimize.router)
router.include_router(routes_contractor_forecast.router)
router.include_router(routes_telemetry_anomalies.router)
router.include_router(routes_route_violations.router)


