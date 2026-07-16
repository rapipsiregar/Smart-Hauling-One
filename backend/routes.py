from fastapi import APIRouter
from backend import routes_trucks, routes_crossings, routes_process

router = APIRouter()

# Include the modular sub-routers
router.include_router(routes_trucks.router)
router.include_router(routes_crossings.router)
router.include_router(routes_process.router)
