# Smart Gate: Platform Feature List

This document lists all active and implemented features of the Smart Gate (Integrated Smart Hauling System - ISHS) platform.

---

## 1. Web Application Backend (Python)

### 1.1 Python API Server & SQLite Registry Database
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 1.1)
* **Description**: A robust Python backend built using FastAPI and SQLite to manage fleet registries, track haulage cycles, and log vehicle crossings.
* **Key Capabilities**:
  - **FastAPI REST Endpoint Router**: Handles CORS-enabled HTTP endpoints for OHT registration, crossing submissions, and statistics retrieval.
  - **SQLite Database Integration**: Direct row-mapped storage managing the schema for registered OHT trucks (hull ID, contractor, model, status) and crossing history.
  - **Static File Ingestion**: Configured static folder mounting under `/evidence` to serve crop frames and context photos directly to client browsers.
  - **Fleet Master Validation**: Checks crossing vehicle hull IDs against the registered OHT registry to flag unauthorized or unrecognized haulers.
  - **Shift Metrics Engine**: Computes real-time statistics including total passages, active fleet counts, unrecognized crossings, and lane distribution.

### 1.3 Edge OCR Video Ingestion & Processing API
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 1.2)
* **Description**: A video upload and processing endpoint (`POST /api/process-video`) that parses haulage videos, runs the computer vision OCR edge pipeline, and writes crossing logs and evidence files.
* **Key Capabilities**:
  - **Multipart Video File Uploads**: Accepts direct multipart/form-data video files along with lane context and travel direction parameters, writing raw videos to persistent storage.
  - **Dynamic Pipeline/Mock Hybrid Engine**: Integrates with the pre-extracted edge OCR datasets (PaddleOCR-VL and Nemotron OCR-v2 summaries) to run matching, and implements a fail-safe fallback generating mock OHT crossings for unrecognized uploads.
  - **Evidence Asset Replication**: Automatically populates cropped hull number images and wide-angle context photos inside the static `/evidence` path.
  - **Automated Fleet Auto-Registration**: Detects if an extracted truck hull number is unrecognized in the system registry, auto-enrolling it to prevent lost hauling records.

### 1.2 Docker Compose & Nginx Proxy Deployment
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 1.3)
* **Description**: Multi-stage Docker containment configuration integrated with an Nginx reverse proxy to expose only the designated PORT via `.env` while keeping other services mapped internally.
* **Key Capabilities**:
  - **Astral uv Docker Builder**: Uses a multi-stage builder targeting `ghcr.io/astral-sh/uv` to optimize layer caching, freeze dependencies (`uv.lock`), compile bytecode, and generate a minimal runtime footprint.
  - **Nginx Reverse Proxy Gateway**: Exposes only the custom `PORT` defined in `.env` to the host system. It intercepts and routes API requests to the backend (`http://backend:8000/api`), handles documentation paths (`/docs`, `/redoc`), proxies WebSocket/SSE upgrades, and serves the static frontend UI directly on `/`.
  - **Protected Backend Container**: Restricts the Python FastAPI application container to internal Docker bridge network access, shielding it from direct host system port exposure.
  - **Persistent Named Volume**: Configures a dedicated local docker volume (`smart_gate_data`) mapped to `/app/data` to ensure the SQLite database and captured visual evidence (`/app/data/evidence`) survive container recreation.

---

## 2. Web Application Frontend

### 2.1 Supervisor Operations Dashboard UI
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 2.1)
* **Description**: A premium, responsive single-page dashboard UI built with HTML5, Vanilla CSS, and JavaScript. It provides real-time situational awareness and administrative controls for mobile gate skids.
* **Key Capabilities**:
  - **KPI Dashboard**: Displays real-time operational statistics, including total crossings, active fleet size, unrecognized vehicle warnings, and lane traffic distribution.
  - **Live Ingest Form**: Supports drag-and-drop or select video file uploading, displaying real-time loading feedback while running the backend OCR pipeline.
  - **Real-Time Live Crossing Feed (WS-Powered)**: Prepend newly detected trucks immediately to the right-side feed panel using WebSocket broadcasts. Each card contains the cropped number crop, wide-angle context image, OCR text, log timestamp, and confidence rating.
  - **Split-Pane Verification Workspace**: Left-side layout presenting the crop OHT hull ID side-by-side with the wide-angle context photo of the selected crossing, auto-updating on click or arrival of new WebSocket events.
  - **Fleet Manager Control**: Displays registered vehicles and contractor information, with an OHT vehicle registration modal.


