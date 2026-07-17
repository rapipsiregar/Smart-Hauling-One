import os

# Load environment variables from .env file if present
if os.path.exists(".env"):
    with open(".env") as f:
        for line in f:
            if line.strip() and not line.startswith("#") and "=" in line:
                key, val = line.strip().split("=", 1)
                os.environ[key.strip()] = val.strip()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from backend import database, routes

# Initialize database tables and seed values
database.init_db()
from backend.backup_scheduler import start_backup_scheduler
from backend.db_integrity_checker import start_integrity_scheduler
from backend.email_scheduler import start_email_scheduler
start_backup_scheduler()
start_integrity_scheduler()
start_email_scheduler()

# Create evidence directories
os.makedirs("data/evidence", exist_ok=True)

app = FastAPI(
    title="Smart Gate OCR & Hauling API",
    description="Python backend service for open-pit mining haulage tracking and Edge OCR telemetry",
    version="1.0.0"
)

# Set up CORS middleware to allow connection from the web dashboard
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from backend.rate_limiter import AdminRateLimitMiddleware
from fastapi.middleware.gzip import GZipMiddleware
app.add_middleware(AdminRateLimitMiddleware)
app.add_middleware(GZipMiddleware, minimum_size=10240)

# Serve cropped hull IDs and wide-angle context photos
app.mount("/evidence", StaticFiles(directory="data/evidence"), name="evidence")

# Serve sample videos from playlist
app.mount("/playlist", StaticFiles(directory="data/01-playlist"), name="playlist")

# Include the core API endpoints
app.include_router(routes.router, prefix="/api")

@app.on_event("startup")
async def startup_event():
    import asyncio
    from backend.rtsp_engine import rtsp_ingestion_loop
    from backend.telemetry_simulator import start_telemetry_simulator
    asyncio.create_task(rtsp_ingestion_loop())
    asyncio.create_task(start_telemetry_simulator())

from fastapi import WebSocket, WebSocketDisconnect
from backend.websocket_manager import manager

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Maintain connection alive, ignore client-side messages
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "Smart Gate OCR Ingestion & Fleet Registry API",
        "version": "1.0.0"
    }

if __name__ == "__main__":
    import uvicorn
    # Allow port mapping from env or default to 8000
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("backend.app:app", host="0.0.0.0", port=port, reload=True)
