# Smart Gate — Feature Inventory

This document lists all active and implemented features of the Smart Gate (Integrated Smart Hauling System - ISHS) platform. **Section 6 is the one exception** — it lists `[PLANNED]` edge-device features from `docs/edge-system/` that are not yet built; every other entry in this document is otherwise treated as `[DONE]` per its own status marker.

---

## 1. Web Application Backend (Python)

### 1.1 Python API Server & SQLite Registry Database
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 1.1)
* **Description**: A robust Python backend built using FastAPI and SQLite to manage fleet registries, track haulage cycles, and log vehicle crossings.
* **Key Capabilities**:
  - **FastAPI REST Endpoint Router**: Handles CORS-enabled HTTP endpoints for OHT registration, crossing submissions, and statistics retrieval.
  - **SQLite Database Integration**: Direct row-mapped storage managing the schema for registered OHT trucks (hull ID, contractor, model, status) and crossing history.
  - **Static File Ingestion**: Configured static folder mounting under `/evidence` to serve crop frames and context photos directly to client browsers.
  - **Fleet Master Validation**: Checks crossing vehicle hull IDs against the registered OHT registry to flag unauthorized or unrecognized haulers.
  - **Shift Metrics Engine**: Computes real-time statistics including total passages, active fleet counts, unrecognized crossings, and lane distribution.

### 1.3 Edge OCR Video Ingestion & Processing API
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 1.2)
* **Description**: A video upload and processing endpoint (`POST /api/process-video`) that parses haulage videos, runs the computer vision OCR edge pipeline, and writes crossing logs and evidence files.
* **Key Capabilities**:
  - **Multipart Video File Uploads**: Accepts direct multipart/form-data video files along with lane context and travel direction parameters, writing raw videos to persistent storage.
  - **Dynamic Pipeline/Mock Hybrid Engine**: Integrates with the pre-extracted edge OCR datasets (PaddleOCR-VL and Nemotron OCR-v2 summaries) to run matching, and implements a fail-safe fallback generating mock OHT crossings for unrecognized uploads.
  - **Evidence Asset Replication**: Automatically populates cropped hull number images and wide-angle context photos inside the static `/evidence` path.
  - **Automated Fleet Auto-Registration**: Detects if an extracted truck hull number is unrecognized in the system registry, auto-enrolling it to prevent lost hauling records.
  - **Sample Video Selector Support**: Exposes `GET /api/sample-videos` listing available videos in `data/01-playlist`, and accepts processing them directly using `sample_filename` parameter in the processing endpoint.

### 1.4 Fuzzy OHT ID Matcher & Spelling Corrector
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 1.4)
* **Description**: A fuzzy string logic module utilizing `rapidfuzz` to correct character segmentation and optical character recognition errors against the registered master OHT fleet.
* **Key Capabilities**:
  - **Fuzzy Levenshtein Distance Matching**: Performs ratio scoring against registered trucks, correcting character anomalies (e.g. standardizing `DT11B` -> `DT-118`, `DT-2O2` -> `DT-202`).
  - **Heuristic Hull ID Cleaning**: Strip spaces, enforce uppercase letters, and prefix numeric inputs automatically before running search matching.
  - **Dual API Route Integration**: Active inside both the edge video ingestion route and the manual crossing creation endpoint.


### 1.2 Docker Compose & Nginx Proxy Deployment
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 1.3)
* **Description**: Multi-stage Docker containment configuration integrated with an Nginx reverse proxy to expose only the designated PORT via `.env` while keeping other services mapped internally.
* **Key Capabilities**:
  - **Astral uv Docker Builder**: Uses a multi-stage builder targeting `ghcr.io/astral-sh/uv` to optimize layer caching, freeze dependencies (`uv.lock`), compile bytecode, and generate a minimal runtime footprint.
  - **Nginx Reverse Proxy Gateway**: Exposes only the custom `PORT` defined in `.env` to the host system. It intercepts and routes API requests to the backend (`http://backend:8000/api`), handles documentation paths (`/docs`, `/redoc`), proxies WebSocket/SSE upgrades, and serves the static frontend UI directly on `/`.
  - **Protected Backend Container**: Restricts the Python FastAPI application container to internal Docker bridge network access, shielding it from direct host system port exposure.
  - **Persistent Named Volume**: Configures a dedicated local docker volume (`smart_gate_data`) mapped to `/app/data` to ensure the SQLite database and captured visual evidence (`/app/data/evidence`) survive container recreation.

### 1.5 OCR Confidence Alerting System
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 1.1)
* **Description**: Backend confidence monitoring engine that flags low-confidence OCR reads and broadcasts live warning payloads.
* **Key Capabilities**:
  - **Database Warning Flags**: Updates SQLite crossing records with a `warning_status` tag indicating whether a detection has low OCR confidence.
  - **WebSocket Alert Broadcast**: Transmits warning payloads immediately to the frontend dashboard, highlighting low-confidence cards with visual pulses and slide-in notifications.
  - **Compliance Integration**: Automatically aggregates low-confidence reads under the compliance discrepancy alerts inside shift summaries.

### 1.6 Database Admin Backup JSON Endpoint
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 1.2)
* **Description**: Backend data export utility that creates instant snapshots of the Smart Gate registry and crossing tables.
* **Key Capabilities**:
  - **Dynamic Schema Serialization**: Reads SQLite tables (trucks and crossings) and packages them into a clean JSON structure.
  - **Force Download Headers**: Intercepts HTTP headers to prompt a file save download (`smart_gate_db_backup.json`) directly in the user's browser.
  - **Binary-to-Text Sanitation**: Safely decodes any legacy database binary fields to prevent serialization corruption.

### 1.7 Skid Telemetry Anomaly Checker
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 1.3)
* **Description**: Automated telemetry processing rules that audit skid sensor data and generate supervisor discrepancy alerts.
* **Key Capabilities**:
  - **Shared Sensor Cache**: Connects the telemetry retrieval routes and shift summary logic to read the exact same cache instances.
  - **Automated Anomaly Checking**: Flags high-priority alert items if skid battery levels drop below 30% or if solar panel output decreases below 5W.
  - **Compliance Integration**: Streams telemetry discrepancy warnings into the interactive Reports discrepancies feed.

### 1.8 Automatic Duplicate Crossing Ingestion Filter
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 1.1)
* **Description**: Backend duplicate suppression rules preventing double-counting of OHT cycles on the reports and dashboard.
* **Key Capabilities**:
  - **Temporal Delta Matching**: Computes the difference between consecutive logs for the same vehicle ID at the same gate checkpoint.
  - **10-Second Suppression Threshold**: Automatically marks records as duplicates (`is_duplicate = 1`) if they are submitted within 10 seconds of each other.
  - **Stats & Ritase Exclusion**: Filters out all flagged duplicate logs when computing Completed Ritase, total passages, and shift distribution metrics.
  - **Direct API Response**: Returns the calculated duplicate status in the FastAPI JSON response body and WebSocket broadcasts.

### 1.9 Database Admin Restore JSON Endpoint
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 1.2)
* **Description**: Backend restoration endpoint allowing administrators to upload JSON database backups and restore the exact state of registrations and crossings.
* **Key Capabilities**:
  - **State Clearing**: Performs a clean transactional purge of all active crossings and trucks prior to backup write.
  - **Primary Key & Timestamp Preservation**: Preserves original unique log IDs and historical timestamps, preventing sequence shifts or chronologic drift.
  - **Automatic Field Mapping**: Re-maps all properties (including OCR warning statuses and duplicate flags) to align with database schemas.
  - **Restore Validation Payload**: Returns a success status alongside the counts of successfully restored truck and crossing logs.

### 1.10 Mock Alert Email/SMS Dispatcher Engine
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 1.3)
* **Description**: Simulated notification relay engine generating formatted email and SMS payloads when critical telemetry warnings or low-confidence readings occur.
* **Key Capabilities**:
  - **Crossing Alert Trigger**: Monitors OCR results in real-time, dispatching warning payloads containing site supervisor recipients if confidence levels fall below 85%.
  - **Skid Telemetry Alert Trigger**: Monitors telemetry statuses (battery status and solar charge outputs) and generates high-severity maintenance alerts when bounds are crossed.
  - **WebSocket Live Relays**: Streams full alert dispatch JSON payloads to all connected clients via instant WebSocket broadcasts.
  - **Dispatch Logs Endpoint**: Exposes `GET /api/admin/alert-dispatches` to check the cache registry of the 20 most recent mock notification payloads.

### 1.11 OHT Fleet Registry CSV Import Validator
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 1.3)
* **Description**: Structural pre-validation layer for bulk OHT vehicle CSV uploads to block malformed inputs.
* **Key Capabilities**:
  - **Required Column Pre-checking**: Verifies headers contain `hull_id`, `contractor`, and `model`, returning clear header missing validation logs otherwise.
  - **Hull ID Alphanumeric Validation**: Runs regex pattern matching on vehicle code fields to block spaces and invalid characters.
  - **CSV Local Duplicates Detection**: Traces seen records inside the CSV to identify repeating lines.
  - **Database Registry Pre-verification**: Evaluates lines against existing database registrations to separate skipped warnings from failed block errors.
  - **Transaction Safe Atomic Rejection**: Rejects import entirely with details of all failed rows if any row contains formatting errors, while safely ignoring duplicates only.

### 1.12 Automatic Database Backup Scheduler
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 1.7)
* **Description**: Backend daemon scheduler that periodically creates timestamped backups of the master SQLite database.
* **Key Capabilities**:
  - **Uptime Daemon Thread**: Runs a non-blocking background thread that executes automatically at system startup and schedules itself every 24 hours.
  - **Native SQLite Backup API**: Performs high-fidelity database replication using Python's native `sqlite3.Connection.backup()` to prevent table lock disruptions.
  - **Timestamped File Persistence**: Saves database copies into `data/backups/smart_gate_YYYYMMDD_HHMMSS.db` for easy rollback auditing.
  - **Disable Options**: Supports bypassing automatic backups by setting the `DISABLE_AUTO_BACKUP=true` environment variable (in `.env`) or toggling the `auto_backup_enabled` system setting to `"false"` in the database.


### 1.13 Supervisor Audit Logs JSON Export API
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 1.8)
* **Description**: REST API endpoint providing a downloadable JSON export of chronological supervisor audit trail actions.
* **Key Capabilities**:
  - **Dynamic Query Filtering**: Supports query parameters for `action`, `operator`, `start_date`, and `end_date` to filter logs in the exported payload.
  - **Chronological Sorting**: Automatically sorts logs from oldest to newest to simplify timeline tracing.
  - **Compliance Integration**: Prompts file downloads automatically via HTTP headers (`smart_gate_audit_export.json`) for seamless ingest by compliance auditing systems.

### 1.14 Remote Tower Consecutive Latency Alert Triggers
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 1.9)
* **Description**: Backend latency monitoring pipeline that automatically triggers critical alert logs when a skid tower connection experiences high latency over 3 consecutive status polls.
* **Key Capabilities**:
  - **Rolling Window Latency Cache**: Tracks the last 3 polled latency times per skid tower in a sliding cache window.
  - **Threshold Verification**: Triggers an alert when all 3 consecutive readings exceed the 400ms threshold limit.
  - **Multi-channel Dispatch & Logging**: Broadcasters WebSocket alert messages, writes entries to the `dispatch_logs` database, and appends a "Critical Skid Latency Warning" to reports' discrepancies feed.

### 1.15 Database Data Integrity Check API
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 1.10)
* **Description**: Diagnostic FastAPI endpoint `GET /api/admin/db-integrity` to perform full system database audits.
* **Key Capabilities**:
  - **Unregistered OHT Detection**: Identifies crossing logs referencing vehicle Hull IDs not present in the master fleet registry.
  - **Missing Image Audit**: Verifies the physical existence of image proof files on the disk (`data/evidence/`) mapped by database paths.
  - **Corrupt Metadata Flagging**: Validates crucial fields (Hull ID, timestamp) on crossing records, generating warning logs with severity classifications.

### 1.16 Subcontractor Performance Trends API
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 1.11)
* **Description**: Analytical FastAPI endpoint `GET /api/reports/subcontractor-trends` to fetch daily hauling cycles.
* **Key Capabilities**:
  - **Historical & Live Sync**: Automatically aggregates completed cycles from historical records (`daily_contractor_stats` table) and live crossings in a single view.
  - **Rolling 7-day Windowing**: Computes exact daily hauling statistics over the last 7 calendar days to capture performance changes.
  - **Multi-Contractor Datasets**: Group results by active registered subcontractor, preparing structured datasets for analytical frontend charts.

### 1.17 Dynamic Telemetry Alert Thresholds API
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 1.12)
* **Description**: Administrative FastAPI endpoint `PUT /api/admin/alert-thresholds` to configure remote skid tower latency and battery warning limits.
* **Key Capabilities**:
  - **Dynamic SQLite Storage**: Saves bounds (`battery_low`, `solar_low`, `latency_high`) dynamically inside the `telemetry_thresholds` SQLite table.
  - **Pydantic Validation Guard**: Validates range constraints (battery percentage between 0-100%, latency > 0ms, solar output >= 0W) before applying.
  - **Audit Logs Reporting**: Automatically writes change summaries into the SQLite `audit_logs` database table for administrative compliance reports.

---

## 2. Web Application Frontend

### 2.1 Supervisor Operations Dashboard UI
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 2.1)
* **Description**: A premium, responsive single-page dashboard UI built with HTML5, Vanilla CSS, and JavaScript. It provides real-time situational awareness and administrative controls for mobile gate skids.
* **Key Capabilities**:
  - **KPI Dashboard**: Displays real-time operational statistics, including total crossings, active fleet size, unrecognized vehicle warnings, and lane traffic distribution.
  - **Live Ingest Form**: Supports drag-and-drop or select video file uploading, displaying real-time loading feedback while running the backend OCR pipeline.
  - **Sample Video Selection & Preview Layout**: Dynamically queries available videos from the playlist storage, displays a preview of the selected video, and presents the OCR extraction progress and results side-by-side next to the playing video. Ingested video processing extracts and copies the exact real crop and matching context frame from prior pipeline runs.
  - **Real-Time Live Crossing Feed (WS-Powered)**: Prepend newly detected trucks immediately to the right-side feed panel using WebSocket broadcasts. Each card contains the cropped number crop, wide-angle context image, OCR text, log timestamp, and confidence rating.
  - **Split-Pane Verification Workspace**: Left-side layout presenting the crop OHT hull ID side-by-side with the wide-angle context photo of the selected crossing, auto-updating on click or arrival of new WebSocket events.
  - **Fleet Master Data Management**: Displays registered OHT vehicles and contractor information in an interactive table, supporting full CRUD operations (adding new vehicles, editing existing registration details, toggling operational statuses, and deleting inactive OHTs) dynamically synced with the database.
  - **Dynamic Layout Mode Selector**: Toggles the dashboard between **Detailed Feed View** (larger card thumbnails, detailed metrics) and **Compact Grid View** (dense spacing, smaller preview frames, reduced gaps/paddings). Persists mode state in browser localStorage.
  - **Quick-Verify Badge Action**: Displays a clickable verification checkmark (`✔`) next to the confidence badge for unverified/low-confidence crossings in the Live Feed, allowing supervisors to confirm details in one click and bypass context menus.
  - **Vehicle Classification Filter**: Real-time checkbox filter toolbar above the Live Crossing Feed allowing supervisors to toggle crossings visibility by class (Dump Truck, Light Vehicle, Excavator) instantly.
  - **Fullscreen Theater Mode**: Allows operators to maximize the split-pane visual audit component into a distraction-free full-screen overlay for detailed verification, with Esc key exits.

### 2.2 Skid Telemetry Trend Charts Modal
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 2.1)
* **Description**: Interactive modal overlays displaying 6-hour historical trend charts for mobile gate skids.
* **Key Capabilities**:
  - **Click-to-Open Interactivity**: Detects supervisor clicks on any tower telemetry item card to launch a trends overlay modal.
  - **Dynamic SVG Drawing Engine**: Programmatically constructs two layered line charts (cyan for battery level, amber for solar array output) with glowing transparent gradients and dashed grid indicators.
  - **Visual Decay Tracking**: Plots Tower-Gamma's low-charge decay trend alongside healthy towers, reflecting sensor anomalies.
  - **Collapsible Telemetry Logs Viewer**: Adds a collapsible panel inside the Deployed Mobile Skid Remote Towers card displaying a chronological paginated history of tower telemetry metrics (battery level, solar panel output, network latency).
  - **In-Memory Telemetry Ring Buffer**: Maintains a history of up to 300 telemetry captures in backend memory, exposing a `GET /api/telemetry/history` query API.

### 2.3 Slate-Blue / Emerald-Green Glowing Theme Switcher
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 2.2)
* **Description**: Dual-theme UI mode selector built with native CSS custom properties and client-side persistence.
* **Key Capabilities**:
  - **Slate-Blue & Emerald-Green Design**: Switches all color tokens dynamically (backgrounds, glowing components, border lines, text fields).
  - **Sleek Transition Effects**: Employs CSS transition timing curves to animate theme color changes smoothly over 400ms.
  - **Local Storage Persistence**: Saves the operator's preference locally so the selected theme is preserved on subsequent browser sessions.
  - **Manual Theme Overrides Settings**: Extends the theme toggle mechanism with a collapsible settings sub-panel allowing fine-grain manual control of glowing pulse intensities (0% to 200%) and transparent glassmorphism blur settings (0px to 30px) via reactive range sliders.
  - **Ambient Sound Alerts Toggle**: Added a reactive toggle switch `#toggle-sound-alerts` inside the Config Overrides details panel, letting operators enable or disable sound chime alerts for low-confidence crossings.

### 2.4 Crossing Feed Context-Menu Options
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 2.3)
* **Description**: Custom context-menu interactions and edit APIs to quick-verify or correct matched Hull IDs on the fly.
* **Key Capabilities**:
  - **Custom Contextmenu Interceptor**: Listens to right-click context menu events on crossing feed cards and renders a glassmorphic popup.
  - **Quick-Verify Action**: Allows supervisors to instantly set reading confidence to 100% and resolve low-confidence alarms.
  - **Correct Hull ID Action**: Launches a custom modal dialog containing a text input field for vehicle corrections.
  - **Autocomplete Typeahead Dropdown**: Filters registered vehicles in the local cache on keypress and shows dynamic matching suggestions, preventing spelling and data input errors.
  - **Real-Time Synchronized Broadcasts**: Broadcasts the corrected database crossing object to all active dashboards via WebSocket, updating lists in place.
  - **Manual OCR Crop Reprocessing**: Drag-and-crop bounding box editor inside the Correct Hull ID modal to specify an exact region within the wide-angle context image, triggering the backend `POST /api/crossings/{id}/reprocess-ocr` endpoint to re-run OCR extraction.

### 2.5 WebSocket Connection State Indicator
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 2.1)
* **Description**: Real-time status indicator showing WebSocket connectivity state with glowing micro-animations in the header.
* **Key Capabilities**:
  - **Glowing Pulse States**: Uses CSS keyframe animations to pulse a color-coded status dot (Green: Connected, Yellow: Reconnecting, Red: Disconnected).
  - **Header Integration**: Sleek capsule layout positioned next to the theme toggle button for high visibility.
  - **Automatic Reconnection Handling**: Dynamically changes status labels and dot states during connection lost events and sets up automatic retries.
  - **Interactive Alert Dispatch Toast**: Leverages the WebSocket socket connection to push mock Email/SMS alerts in real-time as slide-in notifications.

### 2.6 Interactive Skid Location Map Mockup
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 2.3)
* **Description**: Real-time visual network mapping of mobile skid telemetry statuses and road network locations.
* **Key Capabilities**:
  - **Vector Haul Road Visual**: Renders a stylized vector background road route, loading zone, and dumping checkpoint layouts.
  - **Dynamic State Status Pins**: Places marker pins for Alpha, Beta, and Gamma towers that dynamically change background color (Green: normal, Yellow: warning, Red: offline) reflecting live database telemetry values.
  - **Live Traffic Heatmap Overlay**: Embeds glow spots for LOADING ZONE, DUMPING ZONE, and HAUL ROAD in the map SVG that dynamically adjust color and pulse radius (Green: low, Orange: moderate, Red: heavy traffic) based on OHT checkpoint passage density computed over the last 15 minutes.
  - **Trends Integration Trigger**: Intercepts supervisor click events on any map location pin to dynamically open the detailed 6-hour historical trend charts modal for that specific skid.
  - **Interactive Map Tooltips**: Displays a floating, glassmorphic info popup showing zone name, 15-minute passage count, travel direction metadata, and traffic density alerts when mouse hovers over loading, dumping, or haul road checkpoints.

### 2.7 Visual Alert Toast Notifications Drawer
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 2.2)
* **Description**: Collapsible alerts sidebar listing historical system and operational warning events.
* **Key Capabilities**:
  - **Collapsible Slide Drawer**: A space-saving slide-out menu drawer that displays warning and system logs without cluttering the main dashboard.
  - **Dynamic Alert Badge Counter**: Animates a high-contrast badge count on the main header Alerts toggle button.
  - **Event Logs Tracking**: Logs WebSocket connection states, low OCR confidence rates, cycle direction discrepancies, and mobile skid sensor alarms.
  - **Dismiss Actions**: Equips each alert card in the list with a close button to clear notifications from memory and update the badge dynamically.
  - **Dispatch Notification History SQLite Storage**: Persists dispatched SMS/Email notifications on critical telemetry failures or low confidence OCR to a SQLite table `dispatch_logs`.
  - **Dispatch logs API**: Exposes `GET /api/alerts/dispatches` to retrieve the chronological history of dispatched notifications.

### 2.8 Inline Telemetry Trends Sparklines
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 2.4)
* **Description**: Real-time inline SVG trend sparklines rendered inside each mobile skid telemetry card in the sidebar.
* **Key Capabilities**:
  - **Dual-Metric Visualization**: Visualizes battery level (sky-blue path) and solar charging output (amber path) simultaneously on a mini sparkline chart.
  - **Dynamic History Plotting**: Fetches historical telemetry records dynamically from `/api/telemetry/history` and plots the latest 10 data points chronologically.
  - **Auto-Updating Sparks**: Refreshes lines in place automatically as fresh WebSockets telemetry events are received.

### 2.9 Quick-Filter Toggle Tags
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 2.5)
* **Description**: Capsule-shaped filter toggle tags above the main real-time live crossings feed.
* **Key Capabilities**:
  - **Single-Click In-Place Filtering**: Filter crossing cards instantly by clicking "Low Conf", "Unregistered", or "Cycle Disc" toggle tags.
  - **Integrated Class-Filters Sync**: Combines quick filter rules with class selection checkboxes (Dump Truck, Light Vehicle, Excavator) dynamically.
  - **Dynamic Mutation Observance**: Automatically applies active quick-filter tags on newly ingested WebSocket crossings using a MutationObserver on the feed list.

### 2.10 Physical Elastic Alert Toast Stack
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 2.6)
* **Description**: A slide-in physical alert notification stack displaying WebSocket warning events in the top-right corner.
* **Key Capabilities**:
  - **Elastic Sliding Animation**: Invokes cubic-bezier transitions (`cubic-bezier(0.16, 1, 0.3, 1)`) to slide alert cards smoothly into view.
  - **Categorized Color Encoding**: Maps notifications to distinct alert themes (Red for errors/discrepancies, Yellow/Orange for connection disruptions, Green for success overrides).
  - **Manual Clear & Auto-dismiss**: Equips each notification card with a manual close button and triggers auto-dismiss after exactly 4 seconds of display.
  - **Countdown Pause-on-Hover**: Temporarily suspends the 4-second auto-dismiss countdown timer when a user hovers their mouse cursor over the toast, resuming the remaining countdown once the mouse leaves.

### 2.11 Interactive Feed Grid Layout Toggle
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 2.7)
* **Description**: Interactive toggle selector inside the Live Crossing Feed card header enabling layout switches between standard listing and multi-column grid view.
* **Key Capabilities**:
  - **Responsive Layout Adaptation**: Swaps CSS layouts on `#live-feed-list` dynamically, turning the vertical column list into a multi-column CSS Grid.
  - **Responsive Thumbnail Stacking**: Re-orders thumbnails in grid mode to stack vertically, preventing horizontal squishing and maintaining high readability.
  - **State Persistence**: Caches the supervisor's layout mode preference in `localStorage` to preserve selection state across dashboard reloads.

### 2.12 Inline Manual Registration Action Inside Feed Items
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 2.8)
* **Description**: Pre-filled quick registration button rendered directly inside crossings feed cards for unrecognized OHTs.
* **Key Capabilities**:
  - **Dynamic Card Button Injections**: Automatically appends a high-contrast "+ Fleet" button inside the feed list item header when the crossing matches an unregistered Hull ID.
  - **Instant Modal Pre-population**: Listens to button clicks and triggers the vehicle registration form overlay pre-filled with the unregistered vehicle's detected Hull ID.
  - **Event Delegation Interceptor**: Uses bubble-up event interception on the feed list container, guaranteeing zero listener leakage and maximum responsiveness.

### 2.13 Real-time Audio Status Toggle
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 2.9)
* **Description**: Live audio alerts control switcher integrated directly into the top header next to the WebSocket indicator.
* **Key Capabilities**:
  - **Single-Click Quick Mute**: Instantly enables/disables Web Audio API notification sounds when low-confidence readings or discrepancies occur.
  - **Dynamic State Visualization**: Dynamically swaps button icon (🔊 vs 🔇) and visual border styling based on the active preference state.
  - **Local Persistence & Sync**: Caches audio alerts preference in `localStorage` and maintains real-time bidirectional synchronization with the settings drawer checkbox.

### 2.14 Interactive Search Query Highlights in Feed Cards
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 2.10)
* **Description**: Real-time interactive feed searching with character-level match highlighting.
* **Key Capabilities**:
  - **Character Match Highlights**: Wraps matching character sequences in a high-contrast HTML `<mark class="search-highlight">` element inside OHT Hull ID tags dynamically as the user types.
  - **Universal Filters Sync**: Interacts with existing Quick Filters and Class checkboxes seamlessly to ensure cards are only displayed when they satisfy all criteria.
  - **WebSocket Live Ingestion Match**: Triggers automatically on newly received real-time crossings via MutationObserver, highlighting matching sequences on the fly.

### 2.15 Live Feed Sort Order Toggle
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 2.12)
* **Description**: Live feed sorting toggle button to easily swap order orientations.
* **Key Capabilities**:
  - **Ascending & Descending Support**: Instantly switches feed card order between descending (newest first) and ascending (oldest first).

---

## 9. Next.js 16 + Bun Mining HUD Frontend Application
* **Directory**: `webapp-next/`
* **Commands**: `cd webapp-next && bun install && bun run dev` (development) or `bun run build` (production)
* **Implementation Status**: `[DONE]`
* **Description**: A modern, full-stack React 19 / Next.js 16 frontend application designed to run on the **Bun runtime**. Serves as the high-fidelity GeoNex-style mining operation HUD, featuring warm charcoal/orange aesthetics, Orbitron/Rajdhani typography, live SVG pit contour rendering, animated haul roads, and real-time backend API integration.
* **Key Capabilities**:
  - **Bun Runtime Integration**: Fully compatible with `bun` package management and execution (`bun install`, `bun run dev`, `bun run build`), providing instant startup and fast bundle times.
  - **App Router Architecture (Next.js 16)**: Built using Next.js App Router (`src/app/`) with TypeScript strict mode, server components, and dynamic API proxies to the FastAPI backend (`http://127.0.0.1:8000`).
  - **Full GeoNex Mining HUD Redesign**:
    - **Dashboard** (`/`) — Interactive mine map with SVG open-pit contours, glowing animated haul roads, reticle truck markers with hover detail cards, 2x2 stat tiles, detection activity sparkline, gate efficiency bars, site overview radar, and interactive timeline scrubber.
    - **Live Site Plan** (`/site-plan`) — Yard visualizer showing inside/outside yard truck positioning and gate status control points.
    - **Production Video Processing** (`/process`) — Tabbed interface for choosing library videos or uploading new clips.
    - **Job Result / Polling Page** (`/result/[id]`) — Real-time job status polling with progress bars, returning the identified truck ID, certainty percentage, plate snapshot, and marked-up video overlay. Uses the **3-stage consensus result layout** (Process → Distribution → Final Decision) described in feature 9.1 below.
    - **Fleet Registry** (`/fleet`) — Sortable equipment log of registered hauling vehicles and trip counts.
    - **Reports & Analytics** (`/reports`) — Ritase bar chart per truck and full transaction audit log.
    - **Crossing Details** (`/crossing/[id]`) — Deep-dive inspection page for individual vehicle passages.
  - **Tailwind CSS v4 Integration**: Uses `@tailwindcss/postcss` with custom CSS variables, custom glassmorphism panels, and HUD corner ticks.

### 9.1 3-Stage Consensus Result Layout (Process → Distribution → Final Decision)
* **Directory**: `webapp-next/src/app/result/[id]/page.tsx`, `webapp-next/src/components/crossing/process-summary.tsx`, `webapp-next/src/components/crossing/vote-distribution.tsx`
* **Implementation Status**: `[DONE]`
* **Description**: Restores the informative multi-stage result experience on top of the current liquid-glass design system. Instead of only showing a single ID card, the result page now narrates *how* the pipeline reached its decision across three numbered stages, keeping visual consistency with the rest of the Next.js HUD (glass cards, amber accent, `var(--*)` design tokens, lucide icons).
* **Key Capabilities**:
  - **Stage 1 — Pipeline Process** (`ProcessSummary`): A 4-tile stat strip summarising evidence gathered before voting — Frames Scanned, Detections, OCR Reads, and Candidate count — each with a lucide icon and tabular figure.
  - **Stage 2 — Reading Distribution** (`VoteDistribution`): A ranked, weighted bar list of every competing hull-ID reading produced by the fuzzy consensus vote. Each row shows the candidate ID, its read count, and its share percentage; the winning cluster is highlighted amber with a trophy marker so operators can see *why* the final ID won and how close the runner-up was.
  - **Stage 3 — Final Decision** (`IdCard` + `EvidenceCards`): The winning hull ID, confidence pill, plate snapshot, and marked-up video overlay — visually badged as the confirmed outcome with an emerald check.
  - **Backend Vote Distribution Exposure**: `labs/custom_model/ocr_utils.py::fuzzy_vote_distribution()` returns the full ranked cluster distribution (`id`, `weight`, `reads`, `share`, `winner`). `video_processor.py` emits it as `vote_distribution` plus `ocr_reads`; `webapp/service.py` and `webapp/cache.py` forward `distribution`, `ocr_reads`, and `frames_scanned` through the `/api/jobs/{id}` result payload.
  - **Backward-Compatible Cache Reconstruction**: For saved runs recorded before the distribution field existed, `webapp/cache.py::_distribution_from_record()` rebuilds the candidate distribution from stored per-frame OCR reads, so historical videos still show the full breakdown.

  - **Dynamic State Labels**: Displays the active sorting mode dynamically inside the button label (e.g. `⇣ Newest` vs `⇡ Oldest`).
  - **Sort Preference Cache**: Saves sorting choices inside the browser's `localStorage` to automatically preserve feed configurations across supervisor sessions.

### 2.16 Expandable Feed Card Detail Drawer
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 2.14)
* **Description**: Smooth visual accordion drawer embedded in live feed crossing cards that expands to show edge OCR proof metadata.
* **Key Capabilities**:
  - **Accordion Transition Effect**: Uses a height-transitioning CSS container that expands dynamically when a feed card is clicked or selected.
  - **IP Camera Metadata Resolution**: Resolves and displays the subnet IP address of the capturing edge Skid camera depending on the gate lane.
  - **OCR Bounding Box Analytics**: Displays coordinate ranges (X, Y, W, H) indicating where the SAM3 model detected the truck license plate.
  - **Confidence Ratings Details**: Breaks down raw text OCR and SAM visual segmentation confidence percentages for detailed technical review.

----

## 3. Analytics & Reporting Features

### 3.1 Shift Summary & Reporting Engine
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 3.1)
* **Description**: A productivity computation engine that auto-identifies haulage cycles, categorizes gate movements into shifts, and audits contractor compliance.
* **Key Capabilities**:
  - **Completed Ritase Cycles**: Computes OHT loading/dumping rotations by analyzing consecutive inbound-outbound passage sequences.
  - **4-Hour Productivity shifts**: Groups crossings into six daily 4-hour slots to trace peak passage periods and skid activity.
  - **Subcontractor Compliance Audit**: Automatically alerts supervisors if unregistered OHTs cross, if inactive OHTs trigger logs, or if unauthorized contractor plates pass checkpoints.
  - **Expected Hourly Capacity calculations**: Divides contractor completed ritase cycles by operational operational hours dynamically, computing real-time hauling capacities.
  - **Compliance Gauge Bars**: Renders custom progress indicators that color-code compliance status (Green: >=85%, Yellow: 50-84%, Red: <50%) against target thresholds.
  - **Fleet Utilization Calculation**: Exposes `GET /api/reports/utilization` which calculates the fleet utilization rate by checking what fraction of registered active vehicles have participated in hauling crossings within the last 24 hours.
  - **Contractor Performance Calculation API**: Exposes `GET /api/reports/contractor-performance` to calculate active registered fleet size, average cycles per active truck, expected hourly capacities, and target compliance percentages dynamically for each subcontractor.
  - **Contractor Compliance Warning Email Dispatch**: Exposes endpoint `POST /api/reports/contractor-performance/send-warning` to log and broadcast warning emails to subcontractor supervisors detailing current hourly capacities, targets, and compliance percentages. Provides a form inside the Shift-Target Compliance Gauge card to specify the recipient.
  - **Subcontractor Utilization Score & Targets**: Exposes configured minimum active fleet thresholds inside the targets dialog box. Calculates contractor fleet utilization dynamically as the percentage of active registered trucks logged crossing in the last 24 hours against the configured threshold, and displays a dedicated utilization progress bar in the compliance gauges list.
  - **Visual Print-Friendly Shift Slots Summary Cards**: Displays 4-hour block shift distributions as grid-based visual summary cards instead of simple bars. Each card contains shift block hours, passage counts, relative progress, and print directive rules (`break-inside: avoid; page-break-inside: avoid;`) to prevent layout splitting across PDF pages.


### 3.2 Data Reconciliation, CSV Export, & Cloud Sync Mockup
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 3.2)
* **Description**: Interactive query toolbar allowing supervisors to filter, reconcile records, download CSV sheets, and trigger a cloud synchronization status indicator.
* **Key Capabilities**:
  - **Dynamic Client Search**: Instantly filters OHT haulage tables and discrepancy alerts by vehicle code or lane.
  - **Reconciliation CSV Exporter**: Generates a standard compliance-ready CSV log file, preserving user search queries and lane filters.
  - **HQ Cloud Sync Mockup**: Triggers a simulated synchronization request to a central headquarters database, returning transaction logs and updating status latency.
  - **Multi-Lane & Severity Discrepancy Checkbox Filters**: Adds an interactive sub-panel immediately above the Subcontractor Discrepancies listing, permitting supervisors to filter alerts by specific lanes, contractor names, or alert severity classifications (High, Medium, Low) using checkbox controls.
  - **Dynamic Contractor Checkboxes**: Regenerates contractor list checkboxes dynamically by evaluating active registered fleet data and actual logged alert entities.
  - **Print Layout Retention**: Hides the filter checkbox toolbar (`#disc-filters`) on print outputs using print CSS media configurations, while retaining the filtered state of subcontractor alert cards on the printed/PDF document.
  - **Automated PDF Export Print-Preview Frame**: Creates a high-fidelity iframe-based print preview modal displaying the exact linearized layout, white backgrounds, and charts, converting print CSS configurations into screen styles before launching the browser's native print dialog.

### 3.3 Remote Gate Skid Status & Telemetry Panel
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 3.3)
* **Description**: Live operations panel representing solar-powered remote edge skid tower health.
* **Key Capabilities**:
  - **Dynamic Sensor Polling**: Periodically fetches and animates battery percentage, solar panel generation levels, and network ping latency for deployed towers (Alpha, Beta, Gamma).
  - **Color-Coded Status Warnings**: Flags battery dips and elevated latency levels (e.g. warning status indicators for Tower-Gamma).
  - **Telemetry Trend Time-Interval Selector**: Equips the trends modal window with quick selector buttons (6H, 24H, 7D) that dynamically regenerate the SVG line charts representing hourly battery charging and solar array fluctuations over the chosen period.
  - **Dynamic Threshold Configuration**: Exposes `POST /api/telemetry/thresholds` to persist custom warning configurations (such as low battery limit, low solar output, and latency maximum levels) directly to the database. These configured parameters govern real-time anomaly checks and visual alarms.
  - **Admin Telemetry History Logging API**: Exposes a REST API diagnostic endpoint `GET /api/admin/telemetry-history` returning solar battery levels, charging currents, and latencies grouped by tower ID over configurable rolling time intervals (`1h`, `6h`, `24h`, `7d`).
  - **Compact KPI Widgets**: Integrated directly under the operational workspace on the main dashboard tab.

### 3.4 Subcontractor Ritase Allocation Donut Chart
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 3.1)
* **Description**: Interactive donut visualization showing cycles performed by each subcontractor to audit contractor productivity.
* **Key Capabilities**:
  - **Dynamic Conic-Gradient Generation**: Computes contractor percentages and draws segments dynamically using standard CSS gradients.
  - **Interactive Legend Panel**: Color-matches segments to contractor names, indicating the absolute completed ritase cycle count and percentage weight.
  - **Auto-Fallbacks**: Renders a clean default state when no crossings or cycles are logged, preventing visualization failures.
  - **Vector Comparison Chart**: Programmatically renders side-by-side comparative SVG bar charts comparing contractor compliance percentages and hourly capacity throughput vs expectation targets. Vector format guarantees visibility on print layouts.
  - **Interactive Comparison Filters**: Incorporates inline checkable contractor checkboxes directly inside the chart widget header. Toggling checkboxes filters individual subcontractor rows from the comparison chart reactively.

### 3.5 PDF Report Generator & Print Layout
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 3.2)
* **Description**: Print-ready engine formatting the entire reports workspace for high-fidelity paper or PDF generation.
* **Key Capabilities**:
  - **Modular print.css Stylesheet**: Dedicated CSS module matching print media to strip sidebar layouts, header menus, search fields, and buttons.
  - **Automatic Layout Restructuring**: Re-flows reports side-by-side grid panel layout into clean stacked linear sections optimized for single or multi-page PDF files.
  - **Page Break Avoidance**: Configures CSS print rules to prevent cards or tables from breaking in half across pages (`page-break-inside: avoid;`).
  - **High-Contrast Print Palettes**: Overrides dark backgrounds with clean, high-contrast dark text on white backgrounds.
  - **Interactive Print Settings Modal**: Prompts operators with a modal dialog upon clicking "Print PDF" to input a custom report title and define a filter date range before triggering standard browser print routines.
  - **Custom Column Configuration Form**: Provides checkboxes inside the Print Settings Modal enabling supervisors to explicitly select which columns (Timestamp, Hull ID, Lane, Direction, Confidence) to include in the generated PDF report table.
  - **Dynamic Print Header**: Generates a high-fidelity print header (`#print-custom-header`) displaying the customized title and formatted date ranges ("Report Period: YYYY-MM-DD to YYYY-MM-DD"), hidden on screen but visible during print outputs.

### 3.7 A4 PDF Print Stylesheet
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 3.4)
* **Description**: Custom compliance-ready A4 portrait print layout stylesheet for generating formal PDF compliance reports.
* **Key Capabilities**:
  - **A4 Portrait Page Definition**: Configures size and margin bounds explicitly to match standard A4 paper dimensions (`size: A4 portrait; margin: 20mm 15mm;`).
  - **Page Break Page flow Rules**: Defines break-inside and page-break-inside directives to guarantee tables, charts, and card elements remain intact on a single page.
  - **High-Contrast Vector & Text Styling**: Converts all SVGs, graphs, tables, and borders to high-contrast monochrome styles suited for black-and-white printouts.

### 3.6 Dynamic Edge Skid Simulation Toolbar
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 3.3)
* **Description**: Interactive testing toolbar on the Ingestion Tab allowing supervisors to simulate remote tower signal drops or low battery levels.
* **Key Capabilities**:
  - **Skid Tower Overrides API**: Backend simulation registry to intercept live status polling and inject custom battery/solar/latency values.
  - **Control Interface**: Form controls to select target towers, switch status states, and input specific charge percentages, watts, or latency pings.
  - **Live Loop Validation**: Refreshes simulated alerts and telemetry charts instantly across all tabs upon clicking the "Apply Anomaly" button.
  - **Global Override Reset**: Instantly clears all active simulation values, restoring natural randomly generated telemetry conditions.

### 3.7 Interactive Live Vehicle Registry Status Switch
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 3.1)
* **Description**: Interactive toggle control to change OHT status (active/inactive) directly inside the Fleet Registry table.
* **Key Capabilities**:
  - **Dynamic Toggle Switch**: Replaces static text badges with sleek custom checkbox switches inside each registry table row.
  - **Live Backend Synchronization**: Registers change handlers to issue a PUT request to the database status update API instantly when toggled.
  - **Error Recovery**: Restores visual state if the network synchronization fails, ensuring reliable visual status updates.

### 3.8 Interactive Contractor Compliance Target Manager
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 3.2)
* **Description**: Form controller to customize expected compliance target rates for subcontractor fleet companies.
* **Key Capabilities**:
  - **SQLite Persistence**: Creates table `contractor_compliance_targets` to save expectance values per contractor company.
  - **Configuration Form**: Interactive dialog window displaying input selectors and target rate fields.
  - **Dynamic Gauges Update**: Reloads and regenerates compliance rate gauge charts dynamically when updated.

### 3.9 Automatic Database Cleanup & Pruning Job
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 1.1)
* **Description**: Automatic cleanup job and API to prune crossings older than a configurable number of days, freeing disk space by deleting image files while preserving daily statistics.
* **Key Capabilities**:
  - **Pruning API Endpoint**: Exposes `POST /api/admin/prune-crossings` allowing configurable days retention limit.
  - **Historical Stats Retention**: Automatically aggregates pruned crossings and cycles into `daily_contractor_stats` table before deletions.
  - **Image Disk Cleanup**: Locates and deletes the physical crop and context image files associated with pruned crossings.

### 3.10 System Health Check Status API
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 1.3)
* **Description**: Diagnostic health API endpoint reporting system warning status and metrics.
* **Key Capabilities**:
  - **Diagnostic Health Check Endpoint**: Exposes `GET /api/system/status` returning aggregate health scores.
  - **Multiple System Verification Tests**: Checks SQLite connectivity, telemetry latency limits warnings, and evidence folder disk footprint.
  - **Health Warning Scoring**: Computes a dynamic warning percentage based on anomalies to quickly alert administrators.

### 3.11 Contractor Compliance Target Programmatic API Override
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 1.4)
* **Description**: Programmatic target override REST API for automated contractor threshold updates.
* **Key Capabilities**:
  - **Programmatic Target Override Endpoint**: Exposes `PUT /api/admin/contractor-targets` to programmatically update subcontractor ritase targets in the SQLite database.
  - **Real-Time WebSocket Broadcast**: Automatically broadcasts a `targets_updated` message containing the updated targets dictionary to all connected frontend clients to instantly update compliance gauges.

### 3.12 Supervisor Action Audit Trail
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 1.5)
* **Description**: Event logging database table and API to trace supervisor manual corrections, alignment updates, and compliance warning dispatches.
* **Key Capabilities**:
  - **Supervisor Action Audit Trail Endpoint**: Exposes `GET /api/admin/audit-logs` returning all manual correction, warning dispatches, and manual crop alignments from the `audit_logs` table.
  - **Automatic Event Instrumentation**: Captures timestamp, action classification, details, and operator information whenever database modifications or external dispatches occur.

### 3.13 Telemetry Critical Threshold Discrepancy Ingestor
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 1.6)
* **Description**: Real-time telemetry monitoring component that automatically logs critical warnings and escalates severity weights when skid power or charging indices drop below hardcoded site boundaries.
* **Key Capabilities**:
  - **Critical Power Alerts**: Generates a high-severity "Critical Skid Battery Warning" log record automatically when any skid battery level drops below 20%.
  - **Critical Charging Alerts**: Generates a high-severity "Low Solar Array Output Alert" log record automatically when any skid solar panel output drops below 15W.
  - **Dynamic Severity Demoting**: Assigns medium severity weights for minor telemetry threshold crossings that remain above the critical 20% / 15W limits.

### 3.14 Local Fleet Search Auto-Suggestions Cache
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 3.5)
* **Description**: Browser-side autocomplete cache and suggestion lists inside the vehicle registration and correction inputs.
* **Key Capabilities**:
  - **Offline Registry Storage**: Caches registered fleet data in `localStorage` dynamically upon successful API responses, falling back to local memory if the backend is unreachable/offline.
  - **Input Auto-Suggestions**: Displays matching registered subcontractor and vehicle model suggestions dynamically as supervisors type inside the registration forms.
  - **Click-to-Complete Integration**: Populates fields automatically when suggestions are clicked, reducing typos and speed-registering vehicles.

### 3.15 Shift-Goal Compliance Stats Chart
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 3.6)
* **Description**: Real-time vector-based comparison chart visualizer comparing completed subcontractor ritase against their shift target goals.
* **Key Capabilities**:
  - **Direct Goal Comparison**: Formulates shift goals dynamically based on elapsed active shift hours and compliance targets, displaying side-by-side graphical progress indicators.
  - **Inline Compliance Integration**: Positioned directly under the Shift-Target Compliance Gauges to give supervisors an immediate, single-card audit overview.
  - **SVG Vector Rendering**: Fully generated as clean inline SVGs to maintain high-resolution print rendering capabilities for physical compliance handovers.

### 3.16 Standalone HTML Report Exporter
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 3.7)
* **Description**: High-fidelity offline report generator compile utility.
* **Key Capabilities**:
  - **Dynamic Style Embedding**: Automatically fetches active client-side stylesheets (`index.css`) and bundles them directly inside the export file.
  - **Static Sanitization**: Automatically strips interactive checkboxes, button bars, and selection toolbars from the exported report grid to ensure a clean, audit-ready layout.
  - **Offline Compliance Validation**: Generates a self-contained, offline-runnable page complete with inline SVGs, donut segments, shift charts, and discrepancies list, saving it locally.

### 3.17 Dynamic Contractor Expected Capacity Target Settings
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 3.8)
* **Description**: Real-time expected capacity targets manager configuration and estimated compliance preview.
* **Key Capabilities**:
  - **Expected Rate Input Adjustments**: Exposes a target rate input field (ritase/hr) per contractor to allow customized operational expectations.
  - **Estimated Target Preview**: Automatically calculates `(hourly_capacity / target_rate) * 100` and displays the estimated compliance percentage in real time as the input value changes.
  - **Live Status Color Branding**: Applies custom border/color highlights (Green/Yellow/Red) based on active compliance thresholds inside the targets dialog.

### 3.18 Automatic Chart Printing Styles Toggle
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 3.9)
* **Description**: Automatically dismisses dialogs and resets configuration inputs upon completion or cancellation of browser print actions.
* **Key Capabilities**:
  - **afterprint Event Triggers**: Registers clean event hooks for the browser's printing state flow to catch print-finished and print-cancelled stages.
  - **Dynamic Form Input Reset**: Automatically clears customized parameter inputs and returns modal fields to default options on dismissal.
  - **Modal State Cleanliness**: Automatically closes print settings dialog boxes, restoring default view indicator classes across the supervisor dashboard view.

### 3.19 Database SQL Snapshot Backup Engine
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 1.14)
* **Description**: Diagnostic manual and automated database snapshot backup scheduler.
* **Key Capabilities**:
  - **SQL Snapshot Exporter**: Exposes `POST /api/admin/backup` allowing supervisors to trigger timestamped database backups containing the complete SQL schema and data statements representation.
  - **Automated Directory Storage**: Stores backup dump files physically inside the `data/backups/` directory with customizable naming prefixes.
  - **Action Auditing Logging**: Inserts an audit trail event log inside `audit_logs` to maintain clear supervisor data maintenance records.

### 3.20 Live RTSP Stream Ingestion Engine
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 1.15)
* **Description**: Backend real-time CCTV stream decoder and OCR processing pipeline executor.
* **Key Capabilities**:
  - **FastAPI Startup Integration**: Spawns an asynchronous background task on application startup to handle live stream polling and processing.
  - **True RTSP Stream Decoding**: Utilizes OpenCV `cv2.VideoCapture` to connect to, decode, and capture frames from the configured RTSP CCTV URL.
  - **Simulated Stream Fallback**: Automatically falls back to a high-fidelity simulated crossing generator utilizing sample playlist frames when the configured RTSP stream is unreachable.
  - **Unified Fleet Registry Sharing**: Processes live vehicle crossings against the same SQLite master vehicle database registry and broadcasts records in real time via WebSockets.

### 3.21 Demo vs Live Operations Mode Switcher
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 2.15)
* **Description**: Interactive top header operational mode selector control to toggle active ingestion sources.
* **Key Capabilities**:
  - **Dual Pill Mode Switcher**: Sleek header toggle buttons to switch active gates between sample playlist videos (Demo) and real-time CCTV feeds (Live).
  - **Dynamic State REST Sync**: Queries and posts active settings parameters via `/api/admin/mode` instantly to synchronize state with the database settings table.
  - **Dynamic Ingestion Mode Segregation**: Segregates and queries crossing records inside the database dynamically depending on the active setting, ensuring that statistics, KPIs, and reports reflect the selected mode without affecting master registry configurations.
  - **Audit Logging Integration**: Logs mode changes automatically in the supervisor action audit database trail to prevent unmonitored production mode tampering.

### 3.22 Subcontractor Compliance Timeline Chart
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 3.14)
* **Description**: Timeline-style hourly trend line graph tracking contractor compliance rates.
* **Key Capabilities**:
  - **Asynchronous Rolling History Calculations**: Backend calculates Completed Ritase vs expected Targets hourly over a rolling 12-hour window.
  - **SVG Line Chart Renderer**: Front-end dynamically draws multicolored line paths representing each contractor's hourly compliance percentages.
  - **Monospace Grid Reference Lines**: Includes horizontal coordinate tick lines (0% to 100%) and interactive hover tooltips identifying data values per data point.

### 3.23 Database Optimization and Vacuum Manager
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 1.16)
* **Description**: Backend SQLite optimization scheduler and disk cleanup maintenance system.
* **Key Capabilities**:
  - **WAL Checkpoints & Optimization**: Executes `PRAGMA wal_checkpoint(TRUNCATE)` and SQLite `PRAGMA optimize` on-demand to speed up database queries.
  - **Vacuum Maintenance**: Runs database vacuuming (`VACUUM`) to reclaim unused disk sectors.
  - **Audit trail & UI Integration**: Logs events in the supervisor audit trail and provides a button to trigger optimization dynamically.

### 3.24 Edge Tower Status Notification Mailer Microservice
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 1.17)
* **Description**: Microservice tracking Edge Tower connectivity check-in times and dispatching notifications.
* **Key Capabilities**:
  - **Check-in Heartbeat Registration**: Keeps track of last successful status poll times for each Mobile Skid Tower.
  - **Offline Detection Logic**: Identifies towers that failed to report telemetry data for >5 minutes.
  - **Automated Dispatches**: Dispatches critical notifications via SMS and email channels to site maintenance leads and logs entries in the central dispatch logs database table.

### 3.25 Vehicle Classification Statistical Summary API
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 1.18)
* **Description**: API endpoint analyzing traffic volume across major vehicle classes over the shift.
* **Key Capabilities**:
  - **Modular Database Queries**: Counts active checkpoint passage events matching classification tags like Dump Truck, Light Vehicle, and Excavator.
  - **Dynamic Mode Filtering**: Exposes statistics specifically calculated for the active ingestion mode (Demo or Live).
  - **Fast JSON Serialization**: Returns total volumes and individual class counts under `/api/reports/class-distribution`.

### 3.26 Subcontractor Compliance Timeline Legend Toggle
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 2.16)
* **Description**: Interactive legend click handler permitting on-demand contractor filtering on the compliance timeline line chart.
* **Key Capabilities**:
  - **Dynamic Legend Toggles**: Click individual contractor names in the legend block to hide or display their trend lines instantly.
  - **Local UI Rendering State Cache**: Caches last fetched telemetry hourly stats data structure to rebuild SVG layout in real time upon toggle clicks.
  - **Visual Status indicator**: Fades out toggled-off contractor entries in the legend text blocks with line-through decorators to specify hidden states.

### 3.27 Supervisor Workspace Configuration Profile Drawer
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 2.17)
* **Description**: Sliding panel interface to customize and save workspace supervisor options locally.
* **Key Capabilities**:
  - **Local Storage Preference Cache**: Persists preferences (Audio volume level, Default charts time range, Auto-refresh frequency) in browser LocalStorage.
  - **Synthesizer Volume Control Integration**: Binds audio slider input directly to the Web Audio gain nodes generating warning beep alerts.
  - **Auto-Refresh Configuration Settings**: Allows operators to customize JSON poll refresh intervals dynamically.

### 3.28 Search Term History Suggestions
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 2.18)
* **Description**: Capture and display recent search term history dropdown when input is focused inside the feed card header.
* **Key Capabilities**:
  - **Dynamic Dropdown Suggestions**: Focus on the Search Hull ID input box triggers an absolute-positioned dropdown showing up to 5 recently used search terms.
  - **Local History State Storage**: Stores query strings locally, ordering entries by recency (most recent query on top).
  - **Quick Re-Filtering**: Clicking any suggestion term fills the search field and triggers live crossing card filtering instantly.

### 3.29 Automated Excel Reconciliation Exporter
* **Implementation Status**: `[DONE]` (implemented in ad-hoc feature request)
* **Description**: Multi-sheet structured Excel (.xlsx) reconciliation exporter aggregating active shift statistics, daily recap, and company-specific selection filters.
* **Key Capabilities**:
  - **Pilihan Perusahaan / Konsesi (BIB & TIA)**: Menyediakan dropdown selektor pada toolbar laporan untuk memilih ekspor data khusus perusahaan (misal BIB atau TIA). Header utama sheet disesuaikan dinamis berdasarkan perusahaan terpilih (contoh: "OB DARI BIB" atau "OB DARI TIA").
  - **Penyaringan Data Terpadu Semua Sheet**: Seluruh data di semua sheet (Ringkasan, Per Gate, Per Nomor Lambung, Belum Berpasangan) otomatis disaring secara konsisten berdasarkan armada dan lintasan yang berasosiasi dengan perusahaan terpilih.
  - **Penyelarasan Gaya Visual Seragam**: Menerapkan gaya visual biru-kuning-border ke seluruh lembar kerja di dalam buku kerja Excel (header biru steel `#B4C6E7`, border hitam tipis penuh untuk setiap sel data, dan warna kuning `#FFFF00` untuk kolom ritase/total).
  - **Format Rekap Harian OB per Tanggal**: Menyusun lembar kerja pertama untuk merekap ritase harian dan unit OHT 777 dan 773 secara terpisah sepanjang bulan berjalan (*Month-to-Date*).

### 3.30 Customizable Discrepancy Alert Thresholds Modal
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 3.17)
* **Description**: Modal form permitting supervisor adjustment of low-battery, low-solar, and high-latency telemetry alert triggers.
* **Key Capabilities**:
  - **Sidebar Overrides Integration**: Added an alert thresholds button within the collapsible sidebar configuration overrides drawer.
  - **Restful Put Requests**: Connects form submissions to `PUT /api/admin/alert-thresholds` to save active values into the database.
  - **Dynamic Telemetry Recalculation**: Triggers real-time dashboard data reload upon changes to reflect telemetry alerts matching new constraints.

### 3.31 Historical Telemetry Data Purge API
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 1.19)
* **Description**: Administrative API endpoint to prune telemetry data older than a customizable duration.
* **Key Capabilities**:
  - **Customizable Pruning**: Exposes `DELETE /api/admin/telemetry-purge` taking an `older_than_days` query parameter.
  - **In-Memory and Database Clean Up**: Filters telemetry history logs dynamically and records action parameters.
  - **Supervisor Audit Trail Sync**: Automatically inserts entries to `audit_logs` documenting the exact record count purged and the time window applied.

### 3.32 OCR Confidence Calibration Setting API
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 1.20)
* **Description**: Administrative API endpoint allowing customization of the OCR confidence threshold below which crossings are flagged.
* **Key Capabilities**:
  - **Dynamic Settings Endpoint**: Exposes `PUT /api/admin/ocr-thresholds` to configure the `ocr_confidence_min` setting in the database.
  - **Input Validation Guard**: Restricts acceptable confidence limits to range between 0.0% and 100.0%.
  - **Real-Time Threshold Integration**: Seamlessly integrates across crossing creation, alert dispatcher, and reports logic to classify low-confidence alerts dynamically.

### 3.33 Mock Edge Telemetry Stream Simulator
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 1.21)
* **Description**: Background simulation worker modeling realistic mobile tower battery charge/discharge and solar charging day/night cycles.
* **Key Capabilities**:
  - **Solar Array Night/Day Cycle Simulation**: Simulates a 20-minute day/night cycle, adjusting base solar outputs and inducing random weather fluctuations.
  - **Telemetry Battery Charging Physics**: Charges battery levels dynamically when solar output is high (>40W) and discharges them during low solar periods.
  - **Historical Logs Accumulator**: Periodically appends active state metrics to the in-memory telemetry logs to supply dashboard trend charts with rich data.

### 3.34 Visual Alert Notification Flash Banner
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 2.19)
* **Description**: A prominent top-bar warning banner displayed dynamically on the operations dashboard when edge towers go offline.
* **Key Capabilities**:
  - **Dynamic Status Monitoring**: Regularly queries tower connection statuses and lists offline tower IDs in the alert warning label.
  - **Manual Dismissal Control**: Includes an close ('&times;') button permitting operators to clear/hide the alert indicator from immediate view.
  - **Auto-reset State Handling**: Re-enables warning banner display behavior automatically once all towers return online and transition back to offline states.

### 3.35 Database Optimization Progress Indicator
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 2.20)
* **Description**: A visual feedback loader and stopwatch timer indicating ongoing SQLite database optimize tasks.
* **Key Capabilities**:
  - **Dynamic Sidebar Indicator**: Integrates a loading status panel containing a spinning loader immediately beneath the Optimize Database button.
  - **Incremental Execution Stopwatch**: Triggers an incremental timer (updating every 100ms) to display database compaction processing duration.
  - **Auto-dismissing State**: Auto-hides progress details and resets timer upon successfully receiving database size details from the backend.

### 3.36 Operations Dashboard Filter Reset Button
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 2.21)
* **Description**: A reset button permitting operators to restore default dashboard filter settings in one click.
* **Key Capabilities**:
  - **Filter Header Placement**: Integrated a **🧹 Reset** button within the Real-time Live Crossing Feed header section.
  - **Multi-Filter Sync Clearance**: Dynamically clears search query input strings, re-selects all vehicle classification checkboxes, and restores the active quick filter tags back to Show All.
  - **Live Feed Auto-reload**: Automatically re-applies layout filtering variables across all feed cards and displays a success notification feedback toast.

### 3.37 Visual Telemetry Battery and Solar Correlation Chart
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 3.19)
* **Description**: Interactive side-by-side trends line chart and scatter correlation chart inside the telemetry trends modal.
* **Key Capabilities**:
  - **Dynamic History Integration**: Fetches real telemetry records from `/api/admin/telemetry-history` based on the selected duration (6H, 24H, 7D).
  - **Scatter Correlation Plot**: Draws a scatter plot mapping battery level (y-axis) against solar array charging output (x-axis) for each data point.
  - **Dashed Regression Line**: Computes the regression slope and intercept on the fly to overlay a red dashed line of best fit representing battery-to-solar charge correlation.

### 3.38 Supervisor Shift Hand-over Note Log
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 3.20)
* **Description**: A local log input form allowing shift supervisors to store handover notes and auto-append them to generated PDF/HTML reports.
* **Key Capabilities**:
  - **Embedded Form Input**: Integrates an input card containing a shift handover text area and Save button under the subcontractor discrepancies table.
  - **Local Session Retention**: Automatically caches inputted notes inside LocalStorage (`supervisor_shift_notes`) to preserve content across browser sessions and reloads.
  - **Report Integration**: Automatically formats notes as static read-only text blocks in generated HTML report outputs and prints them cleanly inside the PDF page layout (hiding inputs/save buttons dynamically).

### 3.39 Map View Style Switcher
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 3.21)
* **Description**: A multi-mode style switcher letting operators toggle the telemetry map outline representation.
* **Key Capabilities**:
  - **Header Toggle Buttons**: Integrated a button group (Schematic, Outline, Heatmap) inside the site map header.
  - **Style Modes**:
    - **Schematic Mode**: Restores standard colored road lines, grid subdivisions, and green zone circles.
    - **Outline Mode**: Displays road networks as a high-contrast wireframe and converts zone markers to thin dashed outlines.
    - **Heatmap Mode**: Maps passage density based on live crossings count, dynamically scaling zone circle radiuses and coloring them based on traffic volumes (cyan for low traffic, orange for medium, red for high traffic density).

### 3.40 Contractor Target Compliance Alert API
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 1.22)
* **Description**: Backend check API and modular alert dispatcher evaluating subcontractor hourly target compliance levels.
* **Key Capabilities**:
  - **Compliance Evaluator Endpoint**: Exposed `POST /api/reports/contractor-performance/compliance-check` to calculate current hourly capacity vs targets across all registered subcontractors.
  - **Critical Drop Alerts**: Triggers a critical-severity compliance warning (with corresponding SMS payloads for Site Supervisors and Email logs for dispatch) whenever any contractor drops below 80% of expected capacity.
  - **WebSocket and Audit Integration**: Automatically broadcasts triggered alerts to all active web clients via WebSocket connection protocols and registers transactions to the SQLite audit log.

### 3.41 Compressed Database Automatic Backup Cron Service
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 1.23)
* **Description**: A background utility and admin API performing compressed backups of the SQLite database once every simulated shift change.
* **Key Capabilities**:
  - **Online SQLite Backup**: Executes standard SQLite online connections `.backup()` method on a background thread to prevent active write locking or database file corruption during backups.
  - **Compressed Storage**: Automatically compresses backup files using the Python `gzip` library, saving files as `data/backup_<timestamp>.db.gz` to conserve disk memory.
  - **Auto-run & On-Demand Triggers**: Runs periodically every 10 minutes (matching simulated shift intervals) and exposes a `POST /api/admin/db-backup` endpoint allowing administrators to manually trigger gzipped backups.
  - **Audit Trail Logs**: Logs each successful backup creation event including the filename and compressed size in bytes inside the SQLite system `audit_logs` table.

### 3.42 Telemetry Link Signal Quality Estimator
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 1.24)
* **Description**: Backend signal quality calculator estimating UHF and LTE connection health parameters for deployed edge towers.
* **Key Capabilities**:
  - **SNR & Link Margin Calculator**: Evaluates packet signal-to-noise ratio (SNR) in dB and computed link margins on the fly based on current telemetry check-in latency.
  - **Packet Loss Estimator**: Computes expected packet loss percentages dynamically scaled by connection latencies.
  - **UHF and LTE Bifurcation**: Separately evaluates UHF heartbeat packets (~128 bytes) and LTE visual proof transmissions (~2048 bytes) utilizing distinct calibration coefficients.
  - **Integrated API Payloads**: Returns nested `connection_health` payloads directly inside edge tower status JSON records generated by the `/api/telemetry/towers` endpoint.

### 3.43 Contractor Warning Dispatcher Form
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 2.22)
* **Description**: Interactive modal warning dispatcher form letting operators enter custom warnings and dispatch warnings to subcontractor companies.
* **Key Capabilities**:
  - **Custom Remark Entry**: Adds an optional "Custom Warning Details" textarea input inside the Dispatch Compliance Warning modal dialog.
  - **Dynamic Contractor Fetch**: Automatically queries current active subcontractor list and populates the drop-down select field.
  - **Enhanced Backend Routing**: Passes supervisor comments to the backend `POST /api/reports/contractor-performance/send-warning` API payload, automatically appending them into warning notification events and logs.

### 3.44 Collapsible Visual Audit Theater Mode
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 2.23)
* **Description**: Enhancements to the split-screen visual audit panel adding on-demand collapsibility and distraction-free theater view controls.
* **Key Capabilities**:
  - **Distraction-Free Theater Mode**: Toggles the `.theater-active` state to expand the visual audit proof panel into a full-viewport layout for critical manual verification cycles.
  - **Interactive Collapse Controls**: Adds a header collapse toggle button (`➖ Collapse` / `➕ Expand`) to hide the split-pane image elements, reclaiming dashboard screen area for operator feeds.
  - **Escape Key Integration**: Automatically detects `Escape` keypress events to close active full-screen theater sessions cleanly.

### 3.45 Visual Contractor Target Compliance Gauge
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 2.24)
* **Description**: Premium inline visual gauges and progress bars with critical threshold indicators showing subcontractor shift compliance rates.
* **Key Capabilities**:
  - **Dynamic SVG Circular Gauges**: Renders an inline vector radial ring gauge next to each subcontractor's data card, colored dynamically based on performance status.
  - **Warning Threshold Markers**: Embeds an explicit vertical indicator tick at the **80% warning threshold** level on linear progress bars to instantly highlight compliance violators.
  - **Utilization Correlation**: Integrates active fleet size ratios and hourly ritase capacities alongside compliance gauges to provide holistic operational views.

### 3.46 Shift Distribution SVG Bar Chart
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 3.22)
* **Description**: A visual vector SVG bar chart histogram mapping total OCR haulage passages across 4-hour chronological shift blocks over a 24-hour window.
* **Key Capabilities**:
  - **Vector SVG Canvas**: Draws a responsive, pixel-perfect histogram chart inside the shift distribution section featuring dynamic axis scaling.
  - **Chronological Sorting**: Automatically parses and orders shift blocks (e.g. 00:00-04:00, 04:00-08:00) chronologically based on their start hour.
  - **Tailored Aesthetics**: Renders bars with linear color gradients (`var(--primary)` to `var(--secondary)`), explicit counts on top of bars, grid division overlays, and hover-triggered tooltip titles.

### 3.47 Subcontractor Performance Grouped Vertical Bar Chart
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 3.23)
* **Description**: A grouped vertical SVG bar chart comparing Completed Ritase against Target Shift Goals for active subcontractors.
* **Key Capabilities**:
  - **Grouped Comparison Representation**: Side-by-side vertical bars displaying Actual Completed Cycles (cyan gradient) vs Target Expected Goal (slate border and transparent fill) for each subcontractor.
  - **Dynamic Y-Axis Scaling**: Automatically scales Y-axis grid markers and count labels based on the maximum completed/goal value.
  - **Interactive Selection Filters**: Provides interactive checkbox toggles above the chart letting operators filter contractors dynamically from the comparison view.
  - **Explicit Value Labels**: Displays precise count labels on top of each bar along with details on hover.

### 3.48 Subcontractor Compliance Gantt Timeline
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 3.24)
* **Description**: Horizontal Gantt-style status timeline representing hourly contractor compliance target achievements over the last 12 hours.
* **Key Capabilities**:
  - **Horizontal Gantt Track Rows**: Renders a dedicated horizontal swimlane row for each subcontractor showing timeline status segments.
  - **Color-Coded Status Segments**: Segments represent hourly cycles colored dynamically: Green for Exceeded Target (>=100%), Cyan for Met Target (80-99%), and Red for Below Target (<80%).
  - **Interactive Filter Legends**: Includes legends under the chart allowing operators to click contractor names to toggle/hide them dynamically from timeline representation.
  - **Tooltip Descriptions**: Provides details showing contractor, time slot, and exact percentage values on segment hover.

### 1.25 Telemetry Tower Network Health Watchdog API
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 1.25)
* **Description**: Backend network watchdog service that computes average checkin latency over a rolling 5-minute window to identify and alert on network degradation.
* **Key Capabilities**:
  - **Rolling 5-Minute Window Evaluation**: Filters recent logs in the telemetry buffer to find active tower checkins over the past 5 minutes.
  - **Latency Degradation Warning Trigger**: Evaluates latency against a baseline standard of 100ms. If average latency exceeds the baseline by >15% (>115ms), flags status as degraded.
  - **Redundant Dispatches & WebSockets Broadcast**: Saves warning notifications into the database dispatch logs, triggers email/SMS simulator alerts, and broadcasts events in real-time over WebSockets to client frontends.

### 1.26 Database Automated Compression Integrity Checker
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 1.26)
* **Description**: Automatic database backup validation routine running post-compression SQLite integrity check to verify backup correctness.
* **Key Capabilities**:
  - **Decompression Verification Check**: Automatically decompresses each gzipped SQLite backup file (`backup_*.db.gz`) immediately following creation into a isolated temporary workspace.
  - **PRAGMA integrity_check Query**: Initiates SQLite engine structure verification queries on the decompressed target.
  - **Dispatches & Alerts Dispatch**: On verification failure, logs details under `db_backup_corrupt` inside system audit logs, registers SMS/Email dispatch alerts, and alerts operators immediately via WebSockets.
  - **Audit Trails**: Logs validation success and health checks under action `db_auto_backup` in audit logs.

### 1.27 Automated Vehicle Shift Load Warning Service
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 1.27)
* **Description**: Backend analysis service tracking and validating individual OHT shift hauling cycle counts (ritase) to alert on potential duplicate records or data entries.
* **Key Capabilities**:
  - **Shift Boundary Tracking**: Resolves standard open-pit mining shift ranges dynamically: Day Shift (06:00 to 18:00) and Night Shift (18:00 to 06:00).
  - **Completed Cycle Calculations**: Extracts non-duplicate crossings within the active shift and computes completed ritase cycles based on alternating direction transitions (Inbound -> Outbound).
  - **Cycle Threshold Anomaly Warning**: If a single vehicle exceeds 20 completed ritase in the current shift, dispatches SMS and email warnings, logs entries in system dispatches, and alerts operators over WebSocket.
  - **Verification Endpoint**: Provides a POST trigger at `/api/reports/oht-overload-check` allowing supervisors to run checks and audit counts on demand.

### 2.25 Interactive Grid Visualization Filter Toggle
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 2.25)
* **Description**: Real-time direction-based filter toggles on the main dashboard feed allowing operators to filter crossings by Inbound vs Outbound hauling lanes.
* **Key Capabilities**:
  - **Dynamic Card Attributes**: Injects `data-direction` metadata dynamically onto each real-time crossing feed card rendered in the list/grid layouts.
  - **Lane Direction Checkbox Group**: Visual checkbox options ("Inbound" and "Outbound") nested underneath the class filters bar.
  - **Master Filter Integration**: Cooperates with existing search queries, quick tags (unregistered/low confidence), and class filter inputs to compute crossing visibility instantly.
  - **Standard Reset Syncing**: Fully supported by the filter clean/reset routine (`btn-reset-filters`), reverting checkboxes to fully enabled status on request.

### 2.26 Database Backup Log History Download Drawer
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 2.26)
* **Description**: Dedicated database backup history dashboard slider drawer allowing administrators to manage, download, and restore gzipped SQLite backups on-demand.
* **Key Capabilities**:
  - **Dynamic Backups List API**: New `GET /api/admin/db-backups` route scans the hauling database storage folder and lists all `backup_*.db.gz` file sizes and timestamps in descending order.
  - **Ad-hoc Backup Creation**: Integration button at top of drawer triggering POST request to `/api/admin/db-backup` to run instant, gzip-compressed database snapshots.
  - **Compressed File Downloading**: Provides FileResponse downloads of gzipped backup files directly via `GET /api/admin/db-backups/{filename}`.
  - **Safe Database Restores**: POST endpoint `/api/admin/db-backups/{filename}/restore` decompresses the backup target, validates internal SQLite structure using `PRAGMA integrity_check`, performs online backup copy to the main DB file, and records events in audit logs.
  - **Drawer Mutual Exclusion**: Automatically shuts other drawers (Alerts/Settings) when opened to prevent layout overlap.

### 2.27 Telemetry Tower Signal Status Indicators
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 2.27)
* **Description**: Real-time UHF and LTE signal status visual bar indicators rendered next to skid tower label pins on the operational map view.
* **Key Capabilities**:
  - **4-Bar Signal Indicators**: Computes active signal bars and strength levels from telemetry SNR data dynamically: UHF (Excellent: >=25, Good: >=18, Moderate: >=12, Poor: <12) and LTE (Excellent: >=28, Good: >=20, Moderate: >=14, Poor: <14).
  - **Dynamic Color-Coding**: Displays signal bars using standard HSL/RGBA palettes: Green for Excellent/Good, Orange/Yellow for Moderate, Red for Poor, and Gray for offline towers.
  - **Descriptive Hover Tooltips**: Provides detailed tooltips showing the current signal type and exact SNR value on hover.

### 3.25 Contractor Hourly Efficiency Comparison Heat Grid
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 3.25)
* **Description**: Interactive 2D matrix/table comparing hourly ritase (hauling cycle) efficiency for each contractor across 4-hour shift blocks.
* **Key Capabilities**:
  - **4-Hour Shift Blocks Partitioning**: Organizes daily hauling timeline into six distinct 4-hour blocks: `02:00-06:00`, `06:00-10:00`, `10:00-14:00`, `14:00-18:00`, `18:00-22:00`, and `22:00-02:00`.
  - **Hourly Efficiency Computation**: Computes efficiency as completed cycles divided by hours in block (e.g. cycles / 4.0 hours) for each contractor over a rolling 24-hour window.
  - **Heat Color-Coding**: Color-codes cells using a heat map aesthetic: Dark Gray for no activity, Red for low efficiency (<= 0.5 rit/hr), Yellow for moderate efficiency (<= 1.5 rit/hr), and Green for high efficiency (> 1.5 rit/hr).
  - **Responsive Matrix Table**: Renders a clean grid list displaying both calculated efficiency values and total cycle counts in the Reports tab.

### 3.26 Daily Cycle Duration Outlier Scatter Plot
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 3.26)
* **Description**: High-fidelity scatter plot visualizing OHT cycle durations over a rolling 24-hour window, highlighting statistical anomalies.
* **Key Capabilities**:
  - **Standard Deviation Outlier Flagging**: Computes statistical mean and standard deviation of cycle durations, marking any cycle deviating by >2.0 standard deviations from the average as an outlier.
  - **Pulsing Outlier Visualization**: Scatter dots for outliers pulse with a red halo using native SVG animations to alert operators.
  - **Detailed Hover Information**: Displays Hull ID, duration in minutes, completion time, and contractor name on dot hover.

### 3.27 Subcontractor Target Compliance KPI Summary Widget
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 3.27)
* **Description**: Real-time aggregated subcontractor compliance dashboard summary widget showing actual cycles completed vs target thresholds.
* **Key Capabilities**:
  - **Grouped KPI Display**: Displays subcontractor performance cards with completed ritase, actual vs target hourly rates, and compliance percentages.
  - **Subcontractor Status Lights**: Small status lights showing Green for optimal compliance (>= 80%), Yellow for warning compliance (50-79%), and Red for critical compliance (< 50%).
  - **Master System Status Lamp**: Header status light that aggregates overall subcontractor health (Green only if ALL contractors meet targets, otherwise Yellow or Red).

### 1.28 Automated Telemetry Night Shift Battery Drain Diagnostic Service
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 1.28)
* **Description**: Automated battery discharge diagnostic routine running checks on skid tower night shift battery drain rates.
* **Key Capabilities**:
  - **Night Shift Window Filtering**: Analyzes telemetry history checks between the hours of `18:00` and `06:00` UTC.
  - **Hourly Discharge Rate Calculation**: Computes the decline rate of battery percentage per hour over night shift.
  - **High-Frequency Discharge Alerts**: Triggers alerts, logs dispatches (SMS/Email), and broadcasts events to WebSockets if the battery drain rate exceeds 5.0% per hour.
  - **On-Demand Diagnostic Trigger**: Exposes a POST endpoint `/api/telemetry/battery-diagnostic` to trigger night shift battery health audits instantly.

### 1.29 Subcontractor Compliance Email Summary Scheduler
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 1.29)
* **Description**: Automated email scheduling and reporting service that packages shift compliance statistics and hourly efficiency grid matrices to supervisors.
* **Key Capabilities**:
  - **Comprehensive Data Compilation**: Integrates active contractor targets, completed shift ritase, compliance metrics, and the 2D hourly efficiency comparison heat grid.
  - **Supervisor Email Dispatch**: Renders high-fidelity styled HTML emails containing formatted tables, color-coded cells, status badges, and details.
  - **Database Dispatch Logging**: Stores the generated HTML body, channel type, recipient address, and dispatch timestamp in the system's database logs.
  - **Live WebSocket Alert Notifications**: Broadcasts a system alert packet to trigger real-time operational dashboard notifications when reports are dispatched.

### 1.30 Database Performance Index Optimization Advisor
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 1.30)
* **Description**: Database index performance advisor that dynamically checks, creates, and optimizes indices to guarantee high-performance query execution.
* **Key Capabilities**:
  - **Dynamic Index Checking**: Audits `sqlite_master` to inventory existing indices on the primary tables.
  - **Auto-Provisioning of Missing Indices**: Creates missing indexes on query-critical columns (`hull_id`, `timestamp`, `mode`, `lane`).
  - **Statistics Optimization & Reindexing**: Runs `REINDEX crossings` and `ANALYZE crossings` to rebuild index trees and refresh the SQLite optimizer.
  - **Query Performance Benchmarking**: Compares query execution durations before and after optimization, returning calculated speedups.
  - **Audit Logging**: Inserts detailed optimization event entries into the database audit trail.

### 2.28 Mobile-Responsive Dashboard Layout Toggle
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 2.28)
* **Description**: Mobile-responsive layout override toggle optimizing the operational dashboard, maps, live feeds, and telemetry grids for touch devices and small viewports.
* **Key Capabilities**:
  - **Single-Column Stacking Overrides**: Automatically collapses the sidebar, grid systems, split audit view, and map container to single-column blocks in mobile mode.
  - **Large Touch Target Sizing**: Increases minimum touch targets for buttons, selectors, switches, and list elements to at least 40px to prevent mis-clicks.
  - **Dynamic Elements Adaptability**: Scales telemetry indicators, hides secondary columns/specs, and limits map height to maximize viewport utility.
  - **State Persistence & Auto-Detection**: Saves the responsive mode setting to `localStorage`, automatically enabling it below 768px while allowing explicit user override toggle control.

### 2.29 Visual Interactive Guide Popup Tutorial
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 2.29)
* **Description**: Visual interactive tutorial modal that details core dashboard controls, map features, compliance summaries, and search tools for new operator onboarding.
* **Key Capabilities**:
  - **Dynamic Modal Construction**: Programmatically creates and appends styled guide overlay containers without bloat in the main page document.
  - **Multi-Slide Guide Carousel**: Walks users through exactly 3 onboarding slides covering remote tower telemetry signal bars, subcontractor target compliance status indicator lights, and live visual audit panels.
  - **First-Time Automatic Triggering**: Automatically prompts onboarding popup for operators on first-time login via `localStorage` state checks.
  - **Manual Guide Replay**: Provides a custom sidebar button link allowing supervisors or operators to replay the guide on-demand.

### 2.30 Live Audio Warning Voice Synthesizer Alert
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 2.30)
* **Description**: Live audio speech synthesis alert system using the Web Speech API to read aloud critical warnings (low confidence OCR and low battery conditions) to operators.
* **Key Capabilities**:
  - **Speech Synthesis Integration**: Leverages Web Speech API (`window.speechSynthesis`) to speak alarms clearly using built-in high-quality English voices.
  - **UHF/LTE Battery Warning Detection**: Translates raw skid tower status anomalies and low battery events into spoken system announcements.
  - **Low Confidence OCR Notifications**: Reads low confidence crop alerts to operators instantly, facilitating immediate visual verification.
  - **Anti-Spam Alert Debouncing**: Implements a 30-second deduplication cache preventing the system from repeating the same voice prompt repeatedly.
  - **Supervisor Override Switch**: Integrates a Config Overrides switch allowing voice prompts to be enabled or disabled with state saved to `localStorage`.

### 3.28 Subcontractor Compliance Progress Timeline Anomaly Alert
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 3.28)
* **Description**: Subcontractor compliance timeline anomaly alert flagging and highlighting contractors who maintain low compliance (<50%) for 3 consecutive hours.
* **Key Capabilities**:
  - **Consecutive Hourly Scan**: Evaluates 12-hour subcontractor timeline records for 3 consecutive segments below 50% compliance.
  - **High-Severity Discrepancy Alerting**: Automatically logs a critical discrepancy and issues websocket notifications on anomaly detection.
  - **Gantt Highlight Indicators**: Prefixes row labels with a hazard icon (`⚠️`) and draws a red-dashed border around anomalous timeline rect blocks.

### 3.29 Subcontractor Hauling Cycle Speed Variance Chart
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 3.29)
* **Description**: Interactive Gantt-style speed variance chart visualizing standard deviation, mean, and range of hauling trip durations per subcontractor.
* **Key Capabilities**:
  - **Dynamic Volatility Classification**: Measures coefficient of variation to classify subcontractors into Low Volatility (stable, <18%), Moderate Volatility (18-35%), or High Volatility (>35%, colored red).
  - **Standard Deviation & Range Bars**: Renders horizontal bars representing the `[Mean - SD, Mean + SD]` range, alongside thin line markers representing `[Min, Max]` extremes.
  - **Mean Trip Markers**: Places a central white marker representing the average duration for each contractor.
  - **Interactive Data Tooltips**: Shows the exact trip count, mean trip duration, and volatility status on element hover.

### 3.30 Subcontractor Shift-Target Forecast Predictions Widget
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 3.30)
* **Description**: Real-time contractor shift-target forecast widget calculating linear rolling projections of completed ritase by shift end.
* **Key Capabilities**:
  - **Rolling Average Linear Model**: Multiplies current hourly hauling rates by remaining shift hours, adding existing counts to project total cycles.
  - **Status Track Indicators**: Color-codes forecasts dynamically: Green for On Track, Orange/Yellow for At Risk, and Red for Behind target.
  - **Active Fleet Metrics**: Shows active fleet sizes and actual productivity rates alongside target bounds.

### 1.31 Automated Telemetry Multi-Sensor Anomaly Detection Service
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 1.31)
* **Description**: Automated telemetry multi-sensor anomaly detection API correlating solar array charging metrics with battery depletion patterns.
* **Key Capabilities**:
  - **Solar Charging Failure Detector**: Flags when average solar charging output drops below 20W during daylight hours while battery levels drop.
  - **Controller Failure Detector**: Identifies charge controller degradation if solar output exceeds 40W but battery continues to drain.
  - **Rapid Discharge Tracker**: Detects hourly battery drops exceeding 5% to identify potential short-circuits.
  - **Audit Logging & Deduplication**: Logs identified telemetry anomalies to the SQLite database audit trail with automatic hourly event deduplication checks.

### 1.32 Subcontractor Geo-Fencing Route Violation Detection Service
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 1.32)
* **Description**: Geo-fencing and speed segment analytics engine flagging OHT vehicles traversing checkpoints faster than physical route constraints allow.
* **Key Capabilities**:
  - **Transit Time Segmentation Analysis**: Computes segment durations between check gates (e.g. North Checkpoint to Main Portal) against physical limits (e.g., 5-minute minimum).
  - **Auto-logging Audit Trails**: Automatically saves speed and shortcut violations to the SQLite audit log table, with checks to prevent duplicate logging.
  - **Infraction Reporting**: Exposes route infraction logs dynamically via the GET `/api/admin/reports/route-violations` REST endpoint.

### 1.33 Database Backup FIFO Rotation Auto-Cleaner
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 1.33)
* **Description**: Database backup watchdog task enforcing age-based retention limits and disk-capacity FIFO rotation.
* **Key Capabilities**:
  - **7-Day Retention Enforcer**: Automatically scans the backup directory and prunes backup files matching `backup_*.db.gz` older than 7 days.
  - **Storage Watchdog Guard**: Tracks free disk space and triggers FIFO (First-In, First-Out) rotation to prune the oldest database backups when free space is under 50MB.
  - **Audit Logging Records**: Saves backup cleanup details to the system audit trail.
  - **Manual Trigger Endpoint**: Exposes a POST `/api/admin/backups/prune` route allowing supervisors to manually run disk safety cleanup.

### 2.33 Interactive Visual Light/Dark/Neon Cyberpunk Theme Toggle
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 2.33)
* **Description**: Multi-theme switch controller supporting Dark (Slate-Blue), Light, and neon Cyberpunk color styles.
* **Key Capabilities**:
  - **CSS Variables Injection**: Switches theme color parameters, shadows, and neon glows dynamically.
  - **Local Persistence**: Saves selected theme state in `localStorage` to preserve settings on browser load.
  - **Dynamic Toggle Button**: Rotates button text and icons to indicate active modes.

### 3.31 Subcontractor Shift-Target Forecast Deviation Alert Banner
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 3.31)
* **Description**: Real-time forecast monitoring alert banner prompting warnings if contractor projected shift ritase drops below 75% of targets.
* **Key Capabilities**:
  - **Automated Target Check**: Scans active rolling projections and compares expected total ritase with target bounds.
  - **Color-Coded Severity Banners**: Renders a warning-orange banner for projected drops below 75% of target, and a danger-red banner for drops below 50%.
  - **Interactive Close Trigger**: Includes a quick-close button allowing supervisors to dismiss the banner until the next crossing data update.

### 3.32 Subcontractor Dispatch Discrepancy Heat Grid
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 3.32)
* **Description**: Hourly heat grid layout comparing count of active shift fleet vehicles against completed ritase to identify subcontractor utilization issues.
* **Key Capabilities**:
  - **Hourly Block Aggregator**: Breaks down active haulage statistics into 1-hour intervals for the last 6 hours.
  - **Dynamic Fleet Watcher**: Counts unique registered vehicles actively hauling during each block to measure exact operator mobilization.
  - **Utilization Heat-Map Coding**: Applies conditional styling (Green for >= 90% utilization, Orange for 50-90%, Red for < 50%, Slate for idle) to highlight dispatch issues immediately.
  - **Detailed Context Tooltips**: Exposes precise truck counts, completed cycles, and utilization percentages on grid cell hover.

### 3.33 PDF Report Custom Branding Designer
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 3.33)
* **Description**: Custom input fields allowing supervisors to specify custom client names and logo image URLs to dynamically render in printed shift report summaries.
* **Key Capabilities**:
  - **Dynamic Input Fields**: Exposes custom text inputs for Client Name and URL inputs for Logo Images inside the PDF print settings modal.
  - **Responsive Header Injector**: Automatically updates the print-only document header structure inside the print preview page iframe before triggering the system print dialogue.
  - **CSS Image Containment**: Wraps printed logos inside a max-height and aspect-ratio helper to ensure clean alignments on standard A4 layout pages.

### 2.32 Database Restore Task Progress Bar
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 2.32)
* **Description**: Real-time progress bar rendering decompression and restoration phases of a database backup restore via Server-Sent Events.
* **Key Capabilities**:
  - **Asynchronous Restorer Execution**: Dispatches database recovery tasks to background worker threads to avoid blocking FastAPI workers.
  - **Dual-Phase Progress Aggregation**: Streams progress data divided between decompression/extraction (from 5% to 50%) and SQLite page copying (from 60% to 100%).
  - **Server-Sent Events Stream**: Uses SSE endpoint `/api/admin/db-backups/restore-progress` to broadcast JSON status packets to active operator drawers.
  - **Interactive Transition Controls**: Renders a glowing progress loader container in the backup drawer, closing connections upon successful recovery or error triggers.

### 1.34 Database Integrity Check Cron Service
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 1.34)
* **Description**: Weekly background watchdog thread executing structural database integrity verifications and reporting diagnostic logs to system audit records.
* **Key Capabilities**:
  - **Weekly Verification Loop**: Daemon worker thread executing SQLite integrity verifications automatically once every 7 days.
  - **Audit Logging Alerts**: Automatically saves detailed structural failure alerts or success verifications directly into the SQLite logs.
  - **Manual Check Endpoint**: Exposes a GET `/api/admin/db/integrity-check` REST route enabling direct supervisor check triggers on demand.

### 1.35 Admin API Rate Limiter Middleware
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 1.35)
* **Description**: Globally applied API middleware restricting sequential requests to admin endpoints to 10 requests per minute per IP address.
* **Key Capabilities**:
  - **Dynamic Route Interceptor**: Automatically monitors all HTTP endpoints starting with the `/api/admin` prefix.
  - **IP-Based Sliding Window**: Keeps track of client IP addresses and rolling request timestamps over a 60-second sliding window.
  - **Rate Limit Restriction Banner**: Instantly blocks requests exceeding 10 per minute and returns a clean `HTTP 429 Too Many Requests` JSON response.

### 1.36 Subcontractor Haulage Payload Estimation API
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 1.36)
* **Description**: REST API route calculating estimated total payload tonnage hauled per subcontractor during the current operational shift.
* **Key Capabilities**:
  - **Dynamic Capacity Map**: Maps registered vehicle hull models (e.g. CAT 777D, CAT 785) to standard haulage capacity tonnage metrics.
  - **Shift Aggregator**: Filter crossings by active shift duration limits to compute exact trip sequences per vehicle.
  - **Estimated Tonnage Exporter**: Exposes calculated metrics via the `GET /api/reports/subcontractor-payload` JSON endpoint, listing subcontractor totals and vehicle-by-vehicle cargo breakdowns.

### 2.34 Operator Action Undo/Redo Toast Notifier
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 2.34)
* **Description**: Interactive toast alerts enabling operators to undo vehicle registration corrections or layout mode switches within a 5-second grace window.
* **Key Capabilities**:
  - **Grace Window Countdown**: Displays a 5-second countdown timer, automatically dismissing and committing the action if not canceled by the operator.
  - **Single-Click Undo Button**: Features a primary "Undo" button executing rollback logic and restoring the preceding state.
  - **Visual Success State**: Transforms toast status directly to an "Action undone successfully" notice upon successful restoration.

### 2.35 Customizable Grid Layout Configuration Drawer
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 2.35)
* **Description**: User layout setting control drawer enabling operators to customize visibility and sequence order of dashboard metric cards.
* **Key Capabilities**:
  - **Grid Configuration Controls Drawer**: Side slide-out panel containing card checkboxes and up/down movement arrows.
  - **Dynamic DOM Node Reordering**: Renders and reorders metrics elements on the fly in the DOM tree based on configuration priorities.
  - **Reversion and Undo Integration**: Integrates directly with `localStorage` preferences and the undo/redo toast notifier system to allow instant rollbacks.

### 2.36 Database Backups Visual Timeline Chart
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 2.36)
* **Description**: Interactive canvas-based line chart displayed inside the database backups drawer showing backup sizes and timestamps.
* **Key Capabilities**:
  - **HTML5 Canvas Plotter**: Renders a custom vector-based graphic timeline visualization without loading bloated third-party charting libraries.
  - **Backup Size Trends Line**: Draws an emerald glowing path connecting backup events, helping supervisors visualize data expansion rate trends.
  - **Start/End Date Anchors**: Dynamically labels start and end timestamps at the base of the visualization path.

### 3.34 Subcontractor Hourly Target Deviation Comparison Chart
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 3.34)
* **Description**: Interactive side-by-side SVG bar chart displayed in the reports dashboard comparing expected hourly target rates vs actual hourly completed ritase.
* **Key Capabilities**:
  - **Side-by-Side Target-Actual Comparison**: Displays blue (actual) and purple (target) bar elements next to each other for immediate performance evaluation.
  - **Dynamic Deviation Calculation**: Calculates and renders positive/negative (green/red) deviation values (e.g. "+0.2 rit/hr" or "-0.3 rit/hr") directly below each contractor.
  - **Fully Integrated Custom Layouts**: Seamlessly registers with the user layout manager to support visibility and drag-and-drop order configuration.

### 3.35 Shift Hand-over Digital Signature Verification
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 3.35)
* **Description**: Secure digital signature verification module embedded inside the supervisor reports section enabling cryptographic shift validation seals.
* **Key Capabilities**:
  - **Operator Hand-over Consent**: Adds an interactive toggle checkbox demanding active operator approval before generating shift sign-off hashes.
  - **Standard SHA-256 Signature Generator**: Leverages the browser Web Crypto API to securely hash the report data (including total ritase, signature text, and exact timestamps).
  - **Verified Signature Seal**: Renders a glowing verification box containing the cryptographic token string (`SIG-SHA256-...`) upon successful operator sign-off.
  - **Local Persistence**: Automatically remembers signature states and validated seals across session updates and page refreshes.

### 3.36 Subcontractor Dispatch Efficiency Leaderboard
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 3.36)
* **Description**: Live subcontractor leaderboard displaying dispatch efficiency ranks calculated from weighted target compliance and active fleet utilization.
* **Key Capabilities**:
  - **Dynamic Rank Medal Markers**: Automatically prefixes ranks with visual medals (🏆, 🥈, 🥉) or ordinal numbers for clean categorization.
  - **Weighted Efficiency Performance Score**: Uses a 60/40 weighted formula to compute performance scores out of 100 based on targets and fleet ratios.
  - **Color-Coded Status Tags**: Renders efficiency scores with color-coded alerts (green/warning/danger) matching critical thresholds.
  - **Fully Integrated Custom Layouts**: Seamlessly registers with the user layout manager to support visibility and drag-and-drop order configuration.

### 1.37 Contractor Haulage Cycle Anomaly Alert Service
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 1.37)
* **Description**: Backend analytical service monitoring haulage cycle durations for dump trucks to flag speed anomalies.
* **Key Capabilities**:
  - **Dynamic Duration Calculator**: Automatically parses consecutive inbound and outbound crossings per vehicle to measure travel durations.
  - **Speed Alert Thresholds**: Flags cycles under 15 minutes as abnormally fast (potential speed violations) and cycles exceeding 120 minutes as abnormally slow (delays/breakdowns).
  - **Integrated Audit Trail**: Populates alerts directly to the subcontractor discrepancies feed with appropriate severity ratings (medium for speed, low for slow completion).

### 1.38 Database Query Cache Middleware
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 1.38)
* **Description**: Memory-based 15-second TTL cache middleware protecting database access from heavy operator telemetry polling.
* **Key Capabilities**:
  - **In-Memory Cache Cache Store**: Temporarily buffers calculated telemetry summaries in local process memory instead of re-querying the SQLite DB.
  - **15-Second Time-To-Live (TTL)**: Automatically invalidates cached data blocks after 15 seconds to ensure operators receive reasonably fresh analytics.
  - **Cache Pruning and Reset Bindings**: Automatically purges the cached buffer if a simulation override is configured or cleared.

### 1.39 Automated End-of-Shift Email Report Distribution Service
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 1.39)
* **Description**: Automated end-of-shift background scheduler compiling HTML reports and distributing them to subcontractor supervisor emails.
* **Key Capabilities**:
  - **Background Daemon Scheduler**: Starts a background thread checking configured settings and automatically running distribution tasks.
  - **Dynamic Configuration Schema**: Supports GET and POST endpoints for `/admin/reports/email-schedule-settings` to toggle schedule triggers, recipient emails, and interval timing.
  - **Rich HTML Summary Content**: Combines subcontractor compliance indicators and hourly efficiency heat grids dynamically into the email report payload.

### 2.37 Database Backup Statistics Dashboard
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 2.37)
* **Description**: Interactive database backup statistics panel integrated directly into the operator backups drawer.
* **Key Capabilities**:
  - **Growth Rate Indicator**: Chronologically analyzes backup log history to calculate and display file growth sizes and percentages.
  - **Average Backup Size**: Computes the mean size of stored backups to evaluate storage metrics.
  - **Total Storage Utilization**: Aggregates total database storage consumption history for clear disk space budgeting.

### 2.38 Live Gate Lane Camera Feeds Grid Panel
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 2.38)
* **Description**: Expandable/collapsible dashboard container hosting interactive simulated CCTV feeds for each checkpoint gate lane.
* **Key Capabilities**:
  - **Dynamic Video Stream Simulation**: Custom HTML5 canvas engines drawing simulated real-time video frames with scrolling scanlines and noise animations.
  - **Rec Blinking Dot Indicators**: Renders standard red blinkers to represent live recording statuses across lanes.
  - **Live OCR Detection Overlays**: Automatically generates bounding boxes with vehicle classification overlays (DT or LV) when simulated vehicles cross camera frames.

### 2.39 Interactive Discrepancy Classification Filters
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 2.39)
* **Description**: Pill-styled interactive classification filters allowing operators to filter discrepancy records by specific categories.
* **Key Capabilities**:
  - **Pill-Styled Toggles**: Highlights selected filter categories with intuitive, themed color tags.
  - **Category Classification Matching**: Filters records into Speed/Cycle anomalies, Target Compliance warnings, and Route Violations.
  - **Dynamic List Refreshes**: Triggers automatic list redraws as soon as an operator toggles the filter.

### 3.37 Contractor Active-Fleet-Capacity Forecasting Line Chart
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 3.37)
* **Description**: Interactive SVG line chart embedded inside forecast cards representing the predicted active fleet needed over the next 12 hours.
* **Key Capabilities**:
  - **Dynamic SVG Vector Line Drawing**: Automatically scales coordinates to plot fleet size trends based on current contractor compliance rates and target numbers.
  - **Sinusoidal Capacity Variances**: Models operational fluctuations (such as night shift changes and efficiency shifts) to output high-fidelity predictions.
  - **Interactive Hover Tooltips**: Renders SVG nodes indicating expected vehicle counts upon user pointer hover.

### 3.38 Interactive Report Printing Layout Settings
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 3.38)
* **Description**: Real-time interactive print preview overlay with sliders to adjust fonts, cell spacing, and margins dynamically.
* **Key Capabilities**:
  - **Dynamic Sidebar Slider Controls**: Renders range sliders for Font Size and Cell Padding, dynamically compiling style overrides into the preview iframe.
  - **Orientational Flow Selection**: Supports toggling document layouts between Portrait and Landscape orientations dynamically.
  - **Real-Time Visibility Toggles**: Live checkboxes syncing column visibility overrides instantly between the operator UI, preview document, and physical printer.

### 3.39 Subcontractor Dispatch Leaderboard Sparkline Ranking Timeline
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 3.39)
* **Description**: Embedded SVG sparkline inside leaderboard cards tracking contractor rank variations over the last 12 hours.
* **Key Capabilities**:
  - **Inverted Scaling Coordinate Mapping**: Correctly maps rank 1 to the top and rank 3 to the bottom of the SVG line canvas.
  - **Deterministic Trend Graphing**: Computes deterministic chronological sequences based on contractor compliance metrics to render realistic trends.
  - **Themed Color Schema**: Render lines and nodes using themed palette color styling for seamless integration.

### 1.40 Automated Database Schema Migration Manager
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 1.40)
* **Description**: Backend schema manager maintaining database structural versions programmatically with transaction rollback support.
* **Key Capabilities**:
  - **Schema Version Verification**: Exposes a GET `/admin/db/migrations` endpoint listing applied vs pending schema version updates.
  - **Programmatic Migration Applier**: Exposes a POST `/admin/db/migrations/apply` endpoint running pending SQL queries sequentially.
  - **Transaction Rollback Protection**: Automatically wraps migration execution inside database transaction rollbacks to prevent partial schema state failures.

### 1.41 API Payload Compression Middleware
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 1.41)
* **Description**: Backend Gzip compression middleware intercepting and compressing large API JSON responses.
* **Key Capabilities**:
  - **Bandwidth Usage Optimization**: Automatically applies standard Gzip algorithm to compress response bodies.
  - **10KB Minimum Compression Threshold**: Restricts compression triggers strictly to responses over 10,240 bytes to prevent extra CPU latency overhead on small payloads.
  - **Seamless Browser Decompression**: Integrates natively with all modern browsers using standard `Content-Encoding: gzip` headers.

### 1.42 System Load Monitoring Endpoint
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 1.42)
* **Description**: Diagnostic FastAPI endpoint returning real-time server load statistics and database storage footprints.
* **Key Capabilities**:
  - **Server Resource Telemetry**: Exposes `GET /api/system/health` returning server CPU, RAM, and disk utilization percentages.
  - **Dynamic DB Storage Footprint**: Calculates and formats the database file size dynamically in appropriate units (e.g. KB, MB, GB).
  - **Disk Mount Target Analysis**: Resolves disk usage parameters specifically for the mount volume holding the SQLite database files.

### 1.43 Telemetry Data Export CSV Endpoint
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 1.43)
* **Description**: Backend data export utility that converts in-memory remote skid tower telemetry logs history into downloadable CSV format.
* **Key Capabilities**:
  - **Dynamic Stream Generation**: Uses Python's native `io.StringIO` and `csv.writer` to stream formatted CSV rows dynamically.
  - **Comprehensive Telemetry Metrics**: Includes Timestamp, Tower ID, Battery Level, Solar Output, Charging Current, and Latency fields.
  - **Standardized Download Headers**: Configures attachment disposition HTTP headers to prompt download saving in user browsers under `telemetry_history.csv`.

### 1.44 DB Vacuum and Defragment Scheduler
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 1.44)
* **Description**: Backend daemon service periodically defragmenting and optimizing the SQLite registry database.
* **Key Capabilities**:
  - **Dynamic Schedule Check**: Periodically runs checks based on the `db_vacuum_interval_days` setting.
  - **Storage Recovery optimization**: Executes `PRAGMA wal_checkpoint(TRUNCATE)`, `PRAGMA optimize`, and `VACUUM` queries to optimize storage footprint.
  - **Uptime Defragment Logs**: Computes disk savings dynamically and logs performance metrics into the `audit_logs` table.

### 1.45 YOLO Truck-ID Detection, Segmentation & OBB Model Trainer
* **Implementation Status**: `[DONE]` (implemented in ad-hoc feature request)
* **Description**: A dedicated training script (`labs/09-train-truck-id-detection.py`) to fine-tune YOLO detection (`yolo26n`), segmentation (`yolo26n-seg`), and oriented bounding box (`yolo26n-obb`) models specifically for Truck ID plate localization and extraction.
* **Key Capabilities**:
  - **Dynamic OBB Label Generator**: Generates oriented bounding box annotations (`labels_obb`) programmatically from segmentation polygons using OpenCV's `cv2.minAreaRect` algorithm.
  - **Dynamic Directory Swapping**: Dynamically swaps the target label folder names (`labels`, `labels_seg`, or `labels_obb`) in place within a `try...finally` block to match YOLO's sibling search structure, bypassing symlink resolution overrides.
  - **Task-Specific Execution**: Supports training either detection (`det`), segmentation (`seg`), oriented bounding box (`obb`), or all three (`all`) tasks via CLI arguments.
  - **Standardized Model Naming Schema**: Saves best-performing weights to the `models` folder following the convention: `truck-id-yolo26{variant}-{det/seg/obb}-v{version-number}-{yyyymmdd}.pt`.

### 1.46 SAM3 Video-Based Truck-ID Dataset Extractor
* **Implementation Status**: `[DONE]` (implemented in ad-hoc feature request)
* **Description**: An enhanced dataset extraction script ([labs/03-extract-truck-id.py](../labs/03-extract-truck-id.py)) supporting direct frame extraction and SAM3 segmentation annotation from converted MP4 video files under [data/01b-videos-converted-to-mp4/](../data/01b-videos-converted-to-mp4/).
* **Key Capabilities**:
  - **Direct Video Processing**: Extracts a customizable number of evenly-spaced frames from standard MP4 videos using `ffmpeg`/`ffprobe` and stores them in a temporary workspace directory before processing.
  - **SAM3 Segmentation & YOLO Export**: Runs Segment Anything Model 2/3 (SAM3) text-prompted segmentation to generate bounding boxes, segmentation polygons, and YOLO-compatible format labels (`labels/` and `labels_seg/`).
  - **Automatic Temporary Cleanup**: Cleans up all temporary extracted frames automatically post-processing to keep the dataset layout clean.
  - **Backward Compatibility**: Fully supports pre-extracted frame image directory processing (`--input-dir`) and exposes the core functions to other lab pipeline scripts.

### 1.47 YOLO Truck-ID Video Predictor
* **Implementation Status**: `[DONE]` (implemented in ad-hoc feature request)
* **Description**: A dedicated prediction script ([labs/10-detect-truck-id-using-yolo26.py](../labs/10-detect-truck-id-using-yolo26.py)) to run fine-tuned YOLO models on converted videos to detect, segment, or track truck IDs.
* **Key Capabilities**:
  - **Dynamic Model Task Identification**: Automatically determines the correct task type (`det` for standard detection, `seg` for segmentation, `obb` for oriented bounding box) from the loaded model's filename or attributes.
  - **Multi-Task Annotations Drawer**: Integrates drawing handlers for standard bounding box rectangles, semi-transparent segmentation polygon overlays, and oriented bounding box polygons.
  - **Structured Metadata Output**: Generates annotated video outputs alongside a corresponding JSON metadata summary containing processing stats.
  - **Dynamic Output Routing**: Automatically directs outputs to separate directories based on model task type (`data/10-detect-truck-id-using-yolo26-det`, `data/10-detect-truck-id-using-yolo26-seg`, or `data/10-detect-truck-id-using-yolo26-obb`).

### 1.48 PaddleOCR-VL Text Detection Dataset Generator
* **Implementation Status**: `[DONE]` (implemented in ad-hoc feature request)
* **Description**: A dedicated dataset generation script ([labs/11-detect-text-using-paddleocr-vl-16.py](../labs/11-detect-text-using-paddleocr-vl-16.py)) that runs PaddleOCR-VL 1.6 directly on extracted video frame images from [data/02-extracted-images-from-videos/](../data/02-extracted-images-from-videos/) to build a YOLO text detection dataset.
* **Key Capabilities**:
  - **Direct Frame OCR Processing**: Bypasses SAM3 requirements to run full-frame text detection directly using PaddleOCR-VL 1.6 layout-based segmentation.
  - **Multi-Format Label Export**: Exports standard axis-aligned bounding boxes (`labels/`), segmentation polygons (`labels_seg/`), and oriented bounding boxes (`labels_obb/`) in normalized YOLO format.
  - **Dataset Completeness**: Generates training components including images (`images/`), JSON annotations metadata (`annotations/`), visual verification overlays (`annotated/`), and class configurations (`data.yaml`).


### 2.40 Telemetry Status Notification Sound Manager
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 2.40)
* **Description**: Custom interactive telemetry sound alerts manager in the settings panel that plays specific beep tone sequences on remote skid tower events.
* **Key Capabilities**:
  - **State Transition Watcher**: Tracks state differences across telemetry status polls to play beeps only on transition events.
  - **Customized Audio Alerts**: Implements unique Web Audio synthesizer beep tones for Low Battery (sawtooth descending E4 to C4), Charging Failures (triangle/sine pulsing beat frequency), and Offline Towers (sine triple beep).
  - **Independent Toggle Switches**: Adds dedicated checkboxes inside the Configuration drawer to toggle each telemetry alarm sound independently.

### 2.41 Interactive Map Zone Crossing Highlights
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 2.41)
* **Description**: Real-time interactive animations of SVG map zone circles (Loading, Dumping, and Haul Road) when new crossings are registered on associated lanes.
* **Key Capabilities**:
  - **Live WebSocket Triggers**: Captures new crossing events directly from the WebSocket feed to trigger highlights in real time.
  - **Themed Pulsing Transitions**: Adds a CSS class-based transition that temporarily scales up the SVG circle element, glows with the primary theme color, and applies a drop-shadow.
  - **Map Style Compatibility**: Works seamlessly across all map view options (Schematic, Outline, Heatmap), automatically transitioning back to the correct baseline layout style.

### 2.42 Custom Metric Threshold Control Sliders
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 2.42)
* **Description**: Custom interactive range sliders inside the Workspace Settings drawer to configure remote skid tower warning and critical telemetry thresholds.
* **Key Capabilities**:
  - **Dynamic Range Customization**: Exposes sliders for low battery limits (0-100%), low solar array output (0-500W), and high network latency threshold (10-1000ms).
  - **Live Synchronization**: Updates numeric labels next to the sliders in real time on drag inputs.
  - **Backend API Integration**: Automatically synchronizes settings preferences by issuing a PUT request to `/api/admin/alert-thresholds` to store bounds in the backend database.

### 2.43 Telemetry CSV Export Button
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 2.43)
* **Description**: User interface action button added to the Deployed Mobile Skid Remote Towers & Site Map card header to trigger CSV telemetry logs downloads.
* **Key Capabilities**:
  - **Clean UI Placement**: Seamlessly nested within the diagnostics card header with standard styling.
  - **One-Click CSV Retrieval**: Binds click events directly to route telemetry CSV downloader routes, prompting instant download saves.

### 2.44 Interactive Search Highlights in Trucks List
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 2.44)
* **Description**: Live searching and character-level query highlighting within the Master OHT Fleet Registry table.
* **Key Capabilities**:
  - **Dynamic Row Filtering**: Filters matching OHT records in real time as supervisors type queries into the search bar.
  - **Visual Match Highlighting**: Wraps matching character sequences in high-contrast styling inside Hull ID table cells.

### 3.40 Fleet Utility Heatmap
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 3.40)
* **Description**: A visual 2D grid matrix chart mapping active Off-Highway Trucks against the hours of the shift to analyze fleet utilization density.
* **Key Capabilities**:
  - **Interactive 2D Matrix Grid**: Plots active OHT units horizontally and chronological shift hour intervals vertically.
  - **Dynamic Passage Count Heat Encoding**: Color-codes matrix cells dynamically (Idle, Low, Medium, High) to reflect passage intensity.
  - **Auto-Anchoring Reference Clock**: Reference intervals dynamically scale and align to the latest crossing timestamp in the database to guarantee data visibility.

### 3.41 Reports Export Scheduling Wizard
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 3.41)
* **Description**: Form-based modal dialog enabling mining operations supervisors to schedule automated shift compliance reports dispatches.
* **Key Capabilities**:
  - **Flexible Email Scheduling**: Allows operators to define recipient email address, interval in minutes, and toggle automatic report relays.
  - **API-Driven Configuration**: Persists schedule parameters directly to database settings via post-configuration endpoints.
  - **Automated Dispatch Integration**: Seamlessly maps parameters to the background email scheduling daemon.

### 3.42 Discrepancy Audit Resolution Workflow
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 3.42)
* **Description**: Operational workflow module allowing Field Auditors and Supervisors to resolve detected subcontractor compliance discrepancies with custom audit notes.
* **Key Capabilities**:
  - **Inline Audit Form Action**: Dynamically inserts text note inputs and verification buttons directly inside discrepancy cards.
  - **Database Persistence**: Stores resolutions inside a dedicated SQLite `discrepancy_resolutions` table.
  - **Visual Resolution Feedback**: Automatically hides resolution controls and overlays a green checkmark badge displaying the resolution notes once updated.

### 3.44 Dashboard Layout Reset Button
* **Implementation Status**: `[DONE]` (implemented in the enhancement plan task 3.44)
* **Description**: User action control to reset layout positions and card visibility configuration of the analytics dashboard.
* **Key Capabilities**:
  - **Single-Click Layout Reset**: Restores all dashboard widgets to default order and visibility preferences.
  - **Storage Deletion**: Clears cached grid configurations stored inside browser `localStorage`.
  - **Uptime Synchronization**: Automatically triggers page reloads to align DOM layout structures with default templates.

### 4.10 Global 21st.dev Style System & Liquid Glass Theme
* **Implementation Status**: `[DONE]`
* **Description**: Applied a clean, modern liquid-glass component aesthetic uniformly across every application page (Dashboard, Site Plan, Production, Fleet, Reports, Crossing Detail, Result). Features an atmospheric dark open-pit mining backdrop with amber rim-light glows, translucent glass cards with backdrop blur, and dense, information-first operational charts.
* **Key Capabilities**:
  - **Atmospheric Open-Pit Mine Backdrop**: `public/mine-bg.svg` rendered via fixed `body::before` backdrop layer with warm amber horizon glow (72%/88%) and slate atmospheric haze — placing the UI over a dark, industrial mining pit scene.
  - **Liquid Glass Surface System**: Translucent card surfaces (`rgba(19, 23, 34, 0.55)` in dark, `rgba(255, 255, 255, 0.62)` in light) with `backdrop-filter: blur(18px) saturate(140%)`, glossy top sheen, 16px radius, and smooth hover glow effects.
  - **Tokenized Theming**: All colors driven by CSS custom variables (`--bg`, `--bg-card`, `--bg-elevated`, `--border`, `--text-primary`, `--text-secondary`, `--text-dim`, `--accent`) defined under `:root` (dark) and `.light` in `src/app/globals.css`.
  - **Light / Dark Toggle**: `ThemeProvider` (`src/lib/theme-context.tsx`) persists preference in `localStorage` (`sg_theme`) and toggles `.light` class on `<html>` for instant theme swaps.
  - **Informative Operational Dashboard**: Streamlined dashboard layout featuring top KPI tiles, real-time Detection Activity sparklines (`ActivityChart`), a 10-row Recent Crossings table, Identification Rate donut chart, Gate Efficiency bars, Top Haulers leaderboard, and OCR Reads per Crossing histogram (`ReadsChart`).
  - **Collapsible Left Sidebar Shell**: `app-shell.tsx` provides a 260px/72px collapsible frosted glass sidebar with Sun/Moon theme toggle, system status indicator, top bar, and mobile drawer.

---

## 5. Smart Gate Reference Alignment (3-Tab IA, real-data)

Implements the frontend reference-alignment plan. Restructures the frontend to a 3-tab information architecture and extends the FastAPI backend with reference-shaped endpoints. **All data is derived from the real SQLite dataset (`data/smart_gate.db`: `video_results`, `detections`, `runs`) and `registered_trucks.json` — no fabricated telemetry or business targets.** Sensor-only reference modules (skidding-tower hardware telemetry, subcontractor-compliance targets) are intentionally excluded because they have no real data source.

### 5.1 Reference Real-Data Layer & Endpoints (Backend)
* **Implementation Status**: `[DONE]`
* **Description**: `webapp/reference_data.py` + `webapp/reference_routes.py` derive reference-shaped entities from the real DB and expose them via FastAPI. Covered by pytest TDD (`tests/test_reference_data.py`, `tests/test_reference_api.py`, 14 tests).
* **Key Capabilities**:
  - **`GET /api/crossings`**: List of `CrossingEvent` (hullId, confidence, lane, direction, ocrReads, isReconciled, real `processedAt` run timestamp, evidence URLs).
  - **`GET /api/cctv-detections`**: Per-video OCR detection records carrying **real per-frame reads** pulled from the 21,939-row `detections` table, plus consistency vote and real `aiModel` (`pak-shomad-v1.pt`).
  - **`GET /api/fleet-registry`**: `FleetUnit[]` from `registered_trucks.json` enriched with real passages/reads/best-confidence stats.
  - **`GET /api/performance-kpis`** & **`GET /api/shift-report`**: Real aggregations (per-gate breakdown, per-truck ritase) whose totals reconcile exactly with the crossing set.
  - **`POST /api/sync-ritase`**: Records a real sync receipt to `data/ritase_sync_log.json`.
  - **Auto-reconciliation semantics**: `isReconciled` is derived (known + confidence ≥ 95%) and kept distinct from OCR `known`.

### 5.2 3-Tab Information Architecture (Frontend)
* **Implementation Status**: `[DONE]`
* **Description**: `app-shell.tsx` navigation mirrors the reference `SidebarMenuData.ts` **exactly**: three sidebar items across two sections — **Real-Time Monitoring** (Dashboard Monitoring, Laporan Harian & Shift) and **Control Room Setup** (System Configuration). Fleet Registry, Reconciliation Ledger and CCTV History are reachable via the dashboard metric cards / detection-list actions (not in the sidebar), matching the reference navigation intents.
* **Pages removed to match the reference** (deleted — not present in `docs/front-end-references/`): `/site-plan` (3D isometric map), `/process` (video upload/analyze), `/result/[id]` (job result), and the operational-analytics dashboard section (`components/dashboard/*` — donut/gate-bars/top-haulers/reads-chart) plus the unused `hud-frame` component. Corresponding unused `api-client` methods were trimmed. The backend OCR pipeline endpoints (upload/jobs/SSE) remain intact for CLI/TUI use.

### 5.3 CCTV OCR Detection Monitoring (Dashboard)
* **Implementation Status**: `[DONE]`
* **Description**: `components/monitoring/` — metric cards (Total Passages / Active Fleet / Unrecognized OHTs), checkpoint-node selector derived from real tower IDs, `DetectionList` and `DetectionInspector` HUD showing the multi-frame OCR breakdown and frame-consensus voting from real `detections` data, plus a Sync Ritase action. Rendered above the existing operational analytics on `/`.

### 5.4 Reconciliation Ledger
* **Implementation Status**: `[DONE]`
* **Description**: `/ledger` — real crossing ledger with hull-ID search, all/reconciled/unresolved filter (deep-linkable via `?filter=`), and a **verification lock** indicator for unidentified or sub-95%-confidence scans. Links to the existing crossing-detail page.

### 5.5 Daily & Shift Report + System Configuration
* **Implementation Status**: `[DONE]`
* **Description**: `/reports` mirrors the reference `ShiftReportingModule` — view header ("Digital Shift-End Performance & Auditing Reports"), a dark module header ("Operations Performance Auditor / Shift End Reporting Module") with **Day / Night / Custom** shift presets, shift-date + start/end-hour controls, **Export CSV + Print**, a **4-KPI comparison grid** with target progress bars & an OCR-precision badge (Shift Ritase, Est. Tonnage, OCR Precision, Recon Rate), a **Ritase Load Profile** bar chart, and a **volume breakdown** table (`components/reports/shift-report-module.tsx`). `/settings` provides theme control, real inference-engine/run metadata, live Ritase sync, and local-preference reset.
* **Real-data note**: Measured values — ritase, OCR precision (avg vote confidence), reconciliation rate (real `reconciled` count added to `/api/shift-report`), and per-lane volumes — are 100% from the SQLite dataset. Fields the real dataset lacks (per-crossing wall-clock time, per-truck contractor & capacity) are handled honestly: **Tonnage is a labelled estimate** at 96 t/cycle (CAT 777) and **Ritase target is a labelled operational goal**, exactly as the reference uses target constants — no fabricated observations. The load profile is grouped by real lane instead of the reference's synthetic hourly axis.

### 5.6 CCTV History Archive
* **Implementation Status**: `[DONE]`
* **Description**: `/cctv-history` (reference `CctvHistoryView`) — searchable OCR detection archive over the real `detections` data with fuzzy OCR-text search, a minimum-confidence slider, consistent/divergent filter, and the multi-frame verification breakdown (reusing `DetectionInspector`). Reachable via the "History" action in the Dashboard Monitoring toolbar.

### 5.7 User Guide Mode (App-Wide Card Explanations)
* **Implementation Status**: `[DONE]`
* **Description**: A global "User Guide Mode" toggle in **System Configuration** (`/settings`), styled identically to the Display Theme segmented control (Guide On / Guide Off). When enabled, every card across the app swaps its live data for a plain-language explanation of what that card is for — **without changing any layout**: the card frame, grid position, and decorative icons stay put, only the inner content is replaced.
* **Key Capabilities**:
  - **Global state via React context**: `lib/guide-context.tsx` mirrors the theme-context pattern — `guideMode` boolean persisted to `localStorage` (`sg_guide`), provider mounted in `app/layout.tsx` inside `ThemeProvider`.
  - **`GuideSwap` / `GuideNote` primitives** (`components/ui/guide-note.tsx`): a single wrapper renders `children` normally, or an amber help-icon explanation block (title + copy) when guide mode is active. Cards opt in with a one-line change.
  - **Coverage**: Dashboard metric cards (Total Passages / Active Fleet / Unrecognized OHTs), CCTV OCR stream toolbar, `DetectionList` + `DetectionInspector` (shared → Dashboard & CCTV History), Fleet stat cards + registry table, Ledger filter bar + table, CCTV History filter bar, and all Reports KPI tiles + both chart panels. Settings cards also explain themselves; the User Guide toggle itself stays interactive so guide mode can always be switched off.

### 5.8 Per-Gate Camera Registry (Scalable Multi-Camera Deployment)
* **Implementation Status**: `[DONE]`
* **Description**: The Smart Gate is deployed at each mining gate, so the platform now manages a **master camera registry** — one record per installed camera. Cameras are real, operator-defined records in the `cameras` table of `data/smart_gate.db`; every processed video/crossing is attributed to a camera by the **playlist subfolder** its video file lives in (`data/01-playlist/<folder>/`). This tags each camera's data via `video_results.camera_id` inside a single database — no collisions, yet every gate remains viewable together. Backed by pytest TDD (`tests/test_cameras.py`, `tests/test_camera_api.py`, 13 tests).
* **Backend**:
  - **`webapp/cameras.py`**: idempotent schema (`cameras` table + additive `video_results.camera_id` column), CRUD, and folder→camera attribution (`playlist_folder_map`, `resolve_camera_for_video`, `sync_attribution`). Fields: Core identity (code, name, gate/location, direction, status) + Connection (rtsp_url, ip_host, username, resolution, fps) + Ops metadata (folder, install_date, last_seen, notes). Enums validated; `camera_code` and `folder` unique.
  - **`webapp/camera_routes.py`**: `GET/POST/PUT/DELETE /api/cameras`, `GET /api/cameras/{code}`, and `POST /api/cameras-sync-attribution` (re-tags crossings + invalidates the dataset cache).
  - **Real-data integrity**: the synthetic round-robin `Gate A/B/C/D` + `idx % 2` direction in `dashboard_data.py` is **replaced** by real camera attribution. `lane`, `direction`, camera identity, and RTSP now come from the registry; until a camera is registered and pointed at a folder, records read honestly as **"Unassigned Gate"** (no fabricated camera identity). `reference_data.py` surfaces `cameraId/cameraCode/cameraName/rtspUrl` on crossings & CCTV detections, and `camerasSeen` on the fleet.
* **Frontend**:
  - **Settings → Camera Registry** (`components/settings/camera-registry.tsx` + `camera-form.tsx`): full add/edit/delete table with status chips, folder mapping, connection details, and a **Re-sync** action that re-attributes crossings. Registering/editing/removing a camera auto-triggers attribution.
  - **Camera visibility across existing pages** (no new features — just "which camera"): a **camera filter** + **Camera/Gate column** on the Reconciliation Ledger, a **camera filter** on the CCTV History archive, camera identity on the crossing-detail card, and a **Cameras/Gates Seen** column on the Fleet registry. Reports' per-gate breakdown becomes real automatically (grouped by the registry's gate/location).

---

## Camera Filtering (backend query params) & 4-Gate Seeding

* **Description**: Server-side camera filtering on the reference read endpoints plus a reproducible seeding system that stands up a 4-gate demo from the real clips.
* **Implementation Status**: `[DONE]`
* **Backend**:
  - **Filter query params** (additive, backward-compatible — omit for the full list): `GET /api/crossings`, `GET /api/cctv-detections`, and `GET /api/fleet-registry` now accept optional `?camera_code=` and `?camera_id=`. Fleet is filtered to trucks actually observed at that camera. Implemented via a shared `filter_by_camera()` helper in `app/services/dataset.py`; the frozen response shapes are unchanged.
  - **Recursive playlist support**: `list_playlist_videos()` and analyze-existing resolution now recurse the playlist tree, so clips living in gate subfolders (which the folder-based camera attribution requires) remain visible to the OCR pipeline.
  - **Gate seeding system** (`app/seed.py`, run `uv run python -m app.seed`, reverse with `--undo`): deterministically splits the real playlist clips across `gate-a..d` subfolders (even split by sorted filename — never random), registers 4 cameras (`CAM-GATE-A..D`) each pointing at one folder, and runs the real `sync-attribution`. Attribution stays genuinely folder-derived, not fabricated.
* **Tests**: `tests/test_camera_filter.py` (helper + endpoint wiring); the folder-attribution tests in `tests/test_cameras.py` were made arrangement-independent so they pass with or without seeding.

---

## 6. Edge Device System (`docs/edge-system/`)

The backend/API and edge-agent portions are implemented (6.1–6.4). The dashboard pages (6.5–6.7)
remain planned and live on the `frontend` branch. 6.13 is the current state of the gate console
and supersedes 6.12's layout (the endpoints 6.12 added are all still there). Full specification:
`docs/edge-system/PRD.md`, `SRS.md`, `API_CONTRACT.md`. Build plan:
`plans/next-implementation/`.

### 6.1 Edge Device Ingestion API (Live Crossing Submission)
* **Implementation Status**: `[DONE]`
* **Description**: `POST /api/edge/crossings` — accepts one consensus-voted hull-ID result + snapshot per completed Detection Window from a Jetson edge agent, de-duplicated via an `Idempotency-Key`.
* **Key Capabilities**:
  - **Idempotent ingestion**: `Crossing.idempotency_key` `UNIQUE` constraint (not just an application check) prevents duplicate rows from retried submissions.
  - **Provenance tagging**: new `Crossing.source` column (`batch` vs `edge`) so existing reports can distinguish where a crossing came from without breaking any existing query.
  - **Reuses the existing consensus/OCR pipeline** (`labs/custom_model/ocr_utils.py`) unmodified, ported into a live, time-windowed loop instead of a whole-video batch loop.
* **Implementation notes**: crossings are rows in the existing `video_results` table tagged `source='edge'` — a new producer into one store, not a parallel data model. `idempotency_key` is nullable with a `UNIQUE` index, so pre-existing batch rows (all NULL) coexist with edge rows while non-NULL keys stay unique. Modules: `app/routers/edge.py`, `app/services/edge_ingest.py`, `app/repositories/run_write_repo.py::insert_edge_crossing`. Snapshots are written as `{video_stem}__edge.jpg` so the existing, unmodified `dataset.py::_snapshot_for` glob finds them.

### 6.2 Edge Device Heartbeat & Health Tracking
* **Implementation Status**: `[DONE]`
* **Description**: `POST /api/edge/heartbeat` (every 30s) plus a background sweep that flips a device to `offline` after 3 missed heartbeats — extends the existing `Camera.status` enum rather than introducing a new one.
* **Key Capabilities**:
  - **Fleet health visibility**: `last_heartbeat_at`, `agent_version`, `local_queue_depth` surfaced on the extended `GET /api/cameras`.
  - **No self-reported offline state**: a device only ever claims `online`/`maintenance`; `offline` is always inferred centrally from silence.
* **Implementation notes**: the 30s offline sweep (`app/services/device_status.py`) runs from the FastAPI `lifespan`, not from `create_app()` — `app = create_app()` executes at import time in every test module, and a sweep thread mutating device status underneath the suite would make tests flaky. Set `DISABLE_EDGE_SWEEP=true` to suppress it.

### 6.3 Per-Device Settings API (Edge Config Push)
* **Implementation Status**: `[DONE]`
* **Description**: `GET`/`PUT /api/cameras/{camera_code}/edge-config` — lets an operator tune `yolo_fps`/`ocr_fps`/`detect_window_sec`/`ocr_min_conf`/`dedup_iou` per gate from the dashboard; the device picks the change up on its next heartbeat via a `config_version` counter.
* **Key Capabilities**:
  - **Saved vs. pending state**: `applied_config_version` (reported by the device) vs. `config_version` (set by the write) lets the UI distinguish "device confirmed" from "waiting for the device to reconnect."
  - **Server-side range validation**: independent of whatever the settings form enforces client-side, returning the field-specific `400 {"error": "<field> must be between <lo> and <hi>"}`.
* **Implementation notes**: `applied_config_version` is a **stored** column, not derived. The API returns it but `SRS.md` §9 does not list it as stored — it cannot be derived reliably, because once `config_version` advances again a `last_config_applied_at` timestamp alone cannot say which version it referred to, forcing the API to report a wrong value in exactly the "pending" state the field exists to describe. Modules: `app/services/edge_config.py`, `app/schemas/edge_config.py`, routes on `app/routers/cameras.py`.

### 6.4 Live CCTV WebRTC Relay Orchestration (WHIP/WHEP Session Control)
* **Implementation Status**: `[DONE]` (session orchestration + relay scaffold; real TURN/public-IP deployment pending)
* **Description**: `POST /api/cameras/{camera_code}/live/start|heartbeat|stop` plus a matching edge-side long-poll (`GET /api/edge/live-session`) — lets an operator view one gate's **raw** camera feed in real time over WebRTC, on demand, without the induk ever touching video frames itself (a separate media relay does that).
* **Key Capabilities**:
  - **No detection overlay, ever**: architecturally separate from the crossing/consensus pipeline — this stream is the unmodified camera output only.
  - **On-demand only**: no edge streams continuously; a session starts only when an operator opens the view, and auto-ends after ~20s without a viewer keep-alive.
  - **Edge-initiated control**: since the 4 devices sit behind cellular NAT and can't be reached inbound, "start" is delivered via a long-poll response, not a push.
* **Implementation notes**: sessions are ephemeral, in-memory, and **threading**-based (`app/services/live_sessions.py`) — not asyncio. There is no `pytest-asyncio` dependency and the codebase's routes are sync; with only 4 devices at most 4 long-polls are ever parked, trivial against FastAPI's default threadpool. MediaMTX + coturn ship as a `live-view` Compose profile (`docker compose --profile live-view up -d`) with configs in `infra/`; `MEDIA_RELAY_BASE_URL` points the backend at the relay. Real TURN credentials, a public IP, and DNS remain a live-deployment step — orchestration is fully testable without them, actual video traversing cellular NAT is not. The edge agent's `WhipPusher._push` is deliberately left `NotImplementedError`: WebRTC negotiation written blind against no relay produces code that looks right and works never.

### 6.5 Edge Device Settings Page UI
* **Implementation Status**: `[PLANNED]`
* **Description**: New dashboard page (`/settings/devices`, IA PAGE-008) listing all 4 gates with per-device settings forms and saved/pending indicators.

### 6.6 Device Health Widget (Fleet-Wide + Per-Gate)
* **Implementation Status**: `[PLANNED]`
* **Description**: Online/offline/maintenance status, last-seen time, and local outbox queue depth per gate — shown both fleet-wide (all 4 at a glance) and on each gate's own settings panel. Reuses the existing Online/Warning/Offline semantic colors from `docs/design_system.md` §3.3 rather than introducing a new status palette.

### 6.7 Live CCTV Viewer (On-Demand Raw Feed)
* **Implementation Status**: `[PLANNED]`
* **Description**: New dashboard page (`/live/[camera_code]`, IA PAGE-009) with a WHEP-compatible video player for one gate's raw feed at a time. No overlay controls, no bounding boxes — deliberately the only page in the dashboard that never shows detection data.

### 6.8 Edge Agent (Jetson-side process)
* **Directory**: `edge/` (own `pyproject.toml`, ARM64/JetPack target — intended to become an independent repository)
* **Implementation Status**: `[DONE]` (all modules built; real-hardware validation pending, `docs/test_plan.md` §2.2 puts it out of scope)
* **Description**: The software that runs on each of the 4 Jetson Orin Nano Super devices: captures its gate's RTSP stream, runs YOLO+OCR locally, votes a consensus hull ID per Detection Window, and syncs results to the induk through network outages.
* **Key Capabilities**:
  - **Detection Window state machine** (`agent/pipeline.py`): opens on the first qualifying YOLO box, closes on the duration cap or a 1.5s no-detection grace period, with a 1s cooldown that stops a truck's trailing edge retriggering a spurious second window. Unit-tested against synthetic detections — no model or camera required.
  - **Shared consensus voting** (`agent/consensus.py`): calls `fuzzy_vote_distribution` from `labs/custom_model/ocr_utils.py` **unmodified**, so the live and batch pipelines can never silently drift apart on the voting math.
  - **Durable outbox** (`agent/outbox.py`): on-device SQLite queue, one-at-a-time in-order delivery, exponential backoff with jitter. Every non-2xx retries — including 401 and 422 — because a rotated key may not have propagated and a dropped crossing is worse than a stuck one. The only discard path is an explicit, loudly-logged 500 MB ceiling eviction.
  - **Heartbeat + config watcher** (`agent/heartbeat.py`): reports health every 30s and converges on central settings by atomic whole-object swap, never in-place mutation, so the inference loop never reads a half-updated config mid-frame.
  - **Shallow capture ring** (`agent/capture.py`): depth-3 buffer shared by inference, live view, and the local video writer — one RTSP connection, never a second one that could exceed the camera's client limit. `cv2.VideoCapture` takes a file path as readily as an RTSP URL, so the agent runs unmodified against a clip for local testing.
  - **Local video retention** (`agent/video_retention.py`): rotating 5-minute segments, evicted oldest-first past 7 days or under 10% free disk, on storage entirely separate from the outbox.
* **Verified end-to-end** against a live induk: config fetch → heartbeat → 3 crossings queued during a simulated outage (nothing lost) → all delivered in order on recovery → every key replayed returns `200 {"duplicate": true}` with no second row created.

### 6.9 Demo Dataset Seeder (no footage required)
* **Module**: `app/demo_data.py` — `uv run python -m app.demo_data` (`--undo` to remove)
* **Implementation Status**: `[DONE]`
* **Description**: Stands up a realistic 4-gate dataset — 9 haul cycles, 18 crossings, 7 trucks, per-frame OCR reads — **without needing any video files**. `app/seed.py` distributes real clips across playlist subfolders and therefore needs `data/01-playlist/` populated; that directory is gitignored, so a fresh checkout has no footage, renders an empty dashboard, and fails every test that indexes into a crossing list.
* **Key Capabilities**:
  - **No files on disk**: writes `video_results` rows with `camera_id` set directly, which works only because the read path prefers the stored FK over playlist-folder guessing.
  - **Realistic shape**: inbound/outbound gate pairs so `app/services/ritase.py` can pair completed ritase; OCR variants per hull (`830E` / `83OE`, `DT-118` / `DT118`) so the consensus and vote-distribution views have real data to render.
  - **Fully reversible**: every row is prefixed `demo-` and the run is tagged, so `--undo` removes exactly what was added.
* **Not a substitute for real footage** — it exists so the app is demonstrable and the suite runnable on a checkout with no data. Accuracy work still needs real clips through the real pipeline.

### 6.10 Attribution Fixes (two real defects)
* **Implementation Status**: `[DONE]`
* **Description**: Two independent defects in camera attribution, both of which would have silently mis-assigned or unassigned every edge-ingested crossing.
* **Read path** (`app/repositories/video_results_repo.py`, `app/services/dataset.py`): `load_video_results()` never selected the `camera_id` column that already existed on `video_results`, so `_build_crossing()` always re-derived the camera by guessing from playlist folder structure. Harmless for batch rows (their video really is a file in a gate folder) but wrong for edge crossings, which have no playlist file and would have read as "Unassigned Gate". Fixed by selecting the column and preferring it, with folder guessing retained as the fallback for un-attributed legacy rows.
* **Write path** (`app/services/cameras.py::sync_attribution`): the sync rewrote `camera_id` for **every** row, so any video without a playlist file was set to NULL — and a video with no file at all resolved to whichever camera claimed the playlist root, i.e. the wrong gate. Since `POST /api/cameras-sync-attribution` is exposed in the dashboard, one operator click would have stripped or scrambled the gate on every live crossing from the 4 devices. Fixed to skip rows whose video is not present in the playlist tree; legitimate clearing (a clip on disk in a folder no camera claims) still happens.
* **Tests**: `tests/test_camera_attribution_by_id.py` covers both directions. `tests/test_camera_api.py::test_sync_attribution_endpoint` was rewritten to create its own playlist clip — it previously passed only because of the write-path defect.

### 6.11 Truck Master Registry & Hull Matching
* **Modules**: `app/repositories/truck_master_repo.py`, `app/services/master_import.py`, `app/services/hull_matcher.py`
* **Implementation Status**: `[DONE]`
* **Description**: The operator's own fleet spreadsheet becomes the authoritative registry in a `trucks` table, and OCR readings are resolved against it. A gate camera can only see the 4-digit code on a unit's panel — the `HD` prefix isn't painted at readable size — so the pipeline reads 4 digits and matches them into the master.
* **Import** (`uv run python -m app.services.master_import`, `--dry-run`, `--replace`): parses `sources/*.xlsx`, locating the header row **by content** rather than a fixed offset so extra title rows don't break it. 276 units imported from the shipped sheet with zero warnings. Idempotent — re-importing a corrected sheet updates in place.
* **Two identifiers per unit**: `hull_id` (`"HD 2152"`, the operator's format, what the UI shows and reports reconcile against) and `hull_code` (`"2152"`, indexed, the key OCR matches into).
* **Matching is deliberately conservative** — this is the safety-critical part:
  - A fuzzy correction is applied **only when exactly one** master code lies within edit distance 1. Two equally-close candidates is *not* a 50/50 guess; it is recorded as unidentified.
  - **Why it matters, measured against the real master**: probing every single-character OCR error that doesn't land on another real code, **59.8% have two or more equally-close candidates**. One probe (`4560`) has 17 master codes within distance 1. A "nearest wins" matcher would have resolved the majority of corrections by coin flip — silently crediting one contractor's haul to another unit, the exact "ghost load" failure `docs/PRD.md` exists to eliminate.
  - Distance is Levenshtein via the shared `ocr_utils._levenshtein`, so the system has one distance definition rather than two that can drift.
  - Unresolved readings store the existing `UNKNOWN` sentinel, so nothing downstream learns a new value.
* **Optical-confusion repair**: because this fleet's hulls are purely numeric, any letter inside a reading is necessarily a misread digit (`215Z` → `2152`, `HD 2I52` → `2152`). The shared `normalize_hull_id` does this only inside its `DT-` branch and must stay unmodified, so the numeric-domain mapping lives in `hull_matcher` instead.
* **Where matching happens**: centrally, on ingestion (`app/services/edge_ingest.py`). The edge reports what it read; deciding which registered unit that *is* stays on the induk, so the 4 devices never hold a stale copy of the master.
* **Fleet roster**: `app/services/dataset.py::_load_registry` now prefers the master table, falling back to the legacy `registered_trucks.json` and then to observed hulls. The master's `Layak`/`Tidak Layak` maps onto the `active`/`inactive` status the fleet views already render, so the data source changed without changing the response contract.
* **Tests**: `tests/test_hull_matcher.py` (29), `tests/test_truck_master.py` (7) — including that an ambiguous correction is refused and that a device's raw `9911` is stored as the master's `ZZ 9911`.

### 6.12 OCR Inspection HUD on the gate (moved off the core)

* **Why it moved**: the gate is what detects; the core receives what the gate decided. A test
  bench on the core could only ever exercise a *second* copy of the pipeline, and two copies
  drifting apart is exactly what makes the same truck resolve one way at the gate and another
  way at the centre — the failure `edge/backend/tests/test_vendor_sync.py` exists to prevent.
* **Removed from the core**: `app/routers/testbench.py`, `app/services/batch_runs.py`,
  `app/services/run_store.py`, `app/services/video_sources.py`, `app/schemas/testbench.py`, and
  the frontend's `live-run-hud`, `ocr-hud-idle`, `live-run-queue`, `clip-list`, `use-test-run`,
  `source-mode`. `/api/test-runs*` and `/api/video-sources` no longer exist on the core.
* **The core's home page** is now the gate-watching wall plus `RecentCrossings` — raw camera
  views and the crossings the gates reported, with no inference view of its own.
* **Added on the edge** (`edge/backend/app/services/test_runs.py`): `GET /api/video-sources`,
  `POST /api/test-runs`, `GET /api/test-runs/active`, `GET /api/test-runs/{id}`,
  `POST /api/test-runs/{id}/cancel`, `GET /api/test-runs/{id}/stream` (SSE).
  Every stage is the shipped code — `InferenceLoop._detect`, `DetectionWindow`,
  `finalize_window`, `local_matcher.match_reading`, `Outbox` — not a parallel implementation.
* **The one deviation from live operation**: a run advances the window clock with *video* time
  (frame index / fps) rather than wall time. A recorded clip is not paced by a camera, and an
  OCR call costs far more than the `ocr_fps` budget on CPU, so wall-clock pacing would drop
  nearly every frame and measure the host instead of the pipeline.
* **Vote leaderboard**: `votes_json` was already stored per crossing and never rendered. Each
  row in the gate's crossing table now expands into the consensus candidates with their share,
  the raw OCR reading, the read count, and the window length.
* **Crossing snapshots** (`app/store.py::save_snapshot`): the finalizer wrote
  `snapshot_path=None` while the outbox had already saved the JPEG — and the outbox *deletes*
  its copy once the core acknowledges delivery. The gate now keeps its own copy in a separate
  directory, capped at `SMART_GATE_SNAPSHOT_KEEP` (500) newest, served by
  `GET /api/crossings/{id}/snapshot`.
* **Idle live view** (`app/services/idle_view.py`, `GET /api/idle-frame`): between runs the HUD
  shows the lane itself with no truck on it — the agent's current ring frame when a camera is
  connected (never a second RTSP connection, SRS §3.1), otherwise a stored empty-lane still.
  Raw frames only, no overlay, same rule as `agent/live_view.py`.
* **Tests**: `edge/backend/tests/test_inspection_api.py` (14) — snapshot served and surviving
  the outbox cleanup, pruning, clip-name traversal rejected, run lifecycle, idle fallback, and
  that a live ring frame is preferred over the still.

### 6.13 Asynchronous OCR + live detection HUD on the gate console
* **Implementation Status**: `[DONE]`
* **Description**: OCR moved off the detection thread, and the gate's own screen rebuilt around
  what the device is seeing right now — annotated feed, per-crop OCR samples, and the vote as it
  converges. Driven by `docs/sample-references/enhancement.md`.
* **Key Capabilities**:
  - **OCR no longer blocks detection** (`edge/backend/agent/ocr_worker.py`): `InferenceLoop.run`
    used to call `run_ocr_on_crop` inline between frames, so at ~0.5 s/crop capture stalled for
    half a second at a time and boxes froze on screen. Crops now go to a bounded pool and
    readings return through a queue the detection thread drains. Two invariants hold it
    together: results are folded in by the detection thread alone, so `DetectionWindow` stays
    the single-threaded state machine SRS §3.2 specifies; and the queue **drops rather than
    grows**, because a backlog would hand a window reads from a truck that left thirty seconds
    ago. Drops are counted, not hidden.
  - **Windows wait for their own OCR** (`OCR_DRAIN_GRACE_SEC`): a window that closed on schedule
    while its crops were still queued would record `UNKNOWN` for every truck. Closing is
    deferred while jobs are in flight, and capped at 4 s so one wedged worker cannot keep a
    window open forever. Both failures are silent, which is why it is bounded on both ends.
  - **Selectable OCR engine** (`agent/ocr_backends.py`): PP-OCRv6 tiny recognition (4.5 MB,
    ~15 ms/crop CPU) is the default; PaddleOCR-VL (1.8 GB, ~0.5 s/crop GPU) is opt-in per device
    via `SMART_GATE_OCR_BACKEND`. Both are adapted to PaddleOCR-VL's call signature and result
    shape **here**, so `vendor/ocr_utils.py` stays byte-identical to the core's copy (SRS §3.3).
    Measured comparison: `docs/sample-references/EVALUATION.md`.
  - **Live state bus** (`agent/live_state.py`, `GET /api/live/state`): frames, boxes, and per-track
    OCR samples, bounded at 8 tracks x 24 crops so a device running for months does not leak.
    Image bytes are deliberately excluded from the JSON and fetched by URL
    (`GET /api/live/crops/{track}/{index}`) — inlining them would put a megabyte into every poll.
  - **Annotated MJPEG feed** (`agent/annotate.py`, `GET /api/live/stream`): boxes and a `T#<id>`
    label drawn on a downscaled frame, served by the *gate's own* FastAPI over the LAN.
    multipart/x-mixed-replace rather than WebRTC: same box, no negotiation, no relay, and it
    degrades to a held frame instead of a black player. **PRD Goal 7 still holds** — the induk
    serves nothing annotated, `agent/live_view.py` stays raw, and neither the annotated frames
    nor the crops cross the satellite link.
  - **Track ids**: one Detection Window is one track, so a crop labelled `T#7 C#3` on screen
    traces to exactly the vote it fed.
  - **Rebuilt gate console** (`edge/frontend/src/app/page.tsx` + `components/`): laid out after
    `docs/sample-references/sample-ui.mp4` — crossings with thumbnails down the left, live view
    and OCR sample strip in the middle, the reading blown up plus per-track vote bars on the
    right, health along the bottom, controls on top. Same design tokens as the core console.
    Nothing was dropped in the move: the health tiles became the bottom strip, the tunables and
    the match probe moved into a Settings drawer, and the per-crossing vote/snapshot detail
    opens from the left rail.
  - **Clip runs drive the same HUD**: `test_runs._process_clip` publishes annotated frames and
    crops to the same bus and uses the same pool, paced to the clip's own fps so the console
    shows a lane with a truck crossing it rather than a slideshow.
* **Tests**: `test_live_state.py` (12), `test_ocr_worker.py` (7), `test_ocr_backends.py` (7),
  `test_live_api.py` (6) — bounded buffers, image bytes kept out of the snapshot, unreadable
  attempts retained, `submit` never blocking, drop-on-full, a throwing engine not killing the
  pool, and the adapter contract that keeps `vendor/ocr_utils.py` untouched. Edge suite: 150.
* **Two defects found by running it, not by reading it** — both invisible in tests and obvious in
  a browser:
  1. **MJPEG reconnect leaked connections.** The console reconnected the feed whenever
     `frame_seq` had not moved for ~12 polls — which is the normal state of a quiet lane. Each
     reconnect opened another `multipart/x-mixed-replace` response without reliably closing the
     old one, and a browser allows six connections per origin. The pool emptied, the polling
     fetches stalled, and the page froze on stale data while *any* other tab pointed at the
     device also hung. Now it reconnects only on evidence the socket is dead while the device is
     demonstrably producing (`frame_age_sec < 3` and our sequence stuck), clears the old `src`
     first, and the device caps concurrent viewers at 4 and releases the slot on disconnect.
  2. **Cached crops showed the previous session's truck.** `GET /api/live/crops/{track}/{index}`
     is cached for an hour — correct, since a crop never changes — but track ids restart from
     1001 every time the process does, so after a restart those URLs resolved to *different*
     images and the console drew the wrong truck's photograph beside the right number. `LiveState`
     now carries a per-process `session` that the crop URL includes, and `reset()` mints a new one.
     Regression tests: `test_each_bus_has_its_own_session`, `test_reset_starts_a_new_session`.
* **One browser behaviour worth knowing**: a `multipart/x-mixed-replace` part is only committed
  when the *next* boundary arrives, so a device that publishes one frame and goes quiet leaves the
  panel blank. `STREAM_KEEPALIVE_SEC` re-sends the current frame once a second, which flushes the
  previous part and keeps the last known picture on screen between trucks.
* **Core → edge direction, verified end to end.** `cameras.direction` is the owner;
  `GET /api/edge/config` returns it and the device caches it (`store` meta `gate_direction`) so it
  survives the link going down. Confirmed with two real edge processes against a real core:
  CAM-GATE-A learned `inbound`, CAM-GATE-B `outbound`, both replicated 276 master units at boot,
  both matched **5/5 hulls exactly** on their own operational clips, and both delivered every
  crossing (outbox 0, unsynced 0) — the core filed 10 as `inbound` and 7 as `outbound`.
  Three defects fixed along the way:
  1. **`list_clips` hid unlabelled footage.** It required an `IN`/`OUT` marker in the filename, so
     the moment a gate learned its direction a folder of reference clips became "Semua klip (0)"
     with nothing on screen to say why. A clip is now hidden only when it *claims the opposite*
     direction; a name that says nothing makes no claim and is offered. Each clip reports its own
     `direction` so the console can tell matched from merely unlabelled.
  2. **`core_reachable` was hardcoded `false` with the agent disabled**, so a device that had just
     fetched its config from the core reported "Pusat: Terputus". It now falls back to the recorded
     time of the last successful config/master fetch, also exposed as `core_last_contact`.
  3. **The master was not replicated at boot without the agent**, leaving a fresh console at
     `0 unit` — where every reading resolves to UNKNOWN however well the OCR did.
     `_learn_gate_direction` became `_sync_from_core` and pulls the version-gated roster too.
* **Known, pre-existing, and worth a decision**: `test_runs._worker` records *every* Detection
  Window as a crossing. The operational clips run ~8 s while `detect_window_sec` is 6, so one truck
  pass hits the duration cap, cools down, reopens, and ships **two crossings for one truck** —
  5 clips produced 10 crossings. Live video rarely hits the cap, but crossing counts from a clip
  run should not be read as ritase until this is settled.

### 6.14 Pit occupancy, ritase from IN→OUT, and unregistered trucks
* **Implementation Status**: `[DONE]`
* **Description**: A hull read at an IN gate puts that truck inside the mining area; the same hull
  read at an OUT gate closes the cycle and counts one ritase. Trucks the master has never heard of
  are recorded by number and flagged rather than discarded.
* **Key Capabilities**:
  - **The digits now reach the centre** (`raw_code` on `CrossingPayload`): the edge resolves
    against its own replica and sent `hull_id = "UNKNOWN"` whenever that failed, which threw the
    reading away at the gate. A truck genuinely on site but missing from the spreadsheet arrived
    as an anonymous UNKNOWN — indistinguishable from a window that read nothing — and could never
    be counted, paired, or chased up. The field is optional, so older firmware still submits.
  - **This also revived the OUT-gate narrowing.** `hull_matcher.match_outbound` prefers the trucks
    currently in the pit over the full 276, precisely so a reading that is ambiguous against the
    master resolves against the handful actually inside. It was being handed the string
    `"UNKNOWN"`, so it could only ever fail. It now matches on the raw digits.
  - **Confidently-read unregistered trucks are filed under their number**
    (`edge_ingest.unregistered_hull`): 4 digits exactly (already guaranteed by `extract_code`),
    at least one read, and ≥ `UNREGISTERED_MIN_CONFIDENCE` (0.70) of the consensus vote. Stricter
    than a registered match needs, because a registered match is corroborated by the master and
    this is not — and a phantom truck would count its own ritase.
  - **`registered` is now distinct from `known`** on every crossing (`dataset._build_crossing`,
    plus `/api/crossings`). `known` means a number was read; `registered` means that number is a
    master unit. Only registered units build the fleet view, so recording an unknown truck never
    silently grows the operator's roster. Both frozen key sets updated deliberately.
  - **`GET /api/pit-occupancy`**: who is inside right now, with the evidence — which gate, when,
    at what confidence — plus `unregisteredInside`. Same rule the outbound matcher uses, exposed
    so an operator can see the state it works from.
  - **`GET /api/ritase`** gains `registered` per hull, `unregisteredRitase`, and
    `unregisteredHulls`. An unregistered truck that crossed twice made a ritase and is counted:
    dropping it under-reports real haulage, and hiding the flag would grow the fleet by stealth.
  - **One clip, one crossing per truck** (`test_runs.select_crossings`): these clips run ~8 s
    against a 6 s `detect_window_sec`, so the cap split one pass into several windows and each
    became a crossing. That was not merely double-counting — the 2264 departure produced two
    windows, the first identified 2264 and took it out of the pit at the centre, and the second
    misread it as 2254 with nothing left to match against, filing a **phantom unregistered truck
    at full confidence**. Now: one crossing per distinct registered unit; unresolved windows are
    dropped when the clip identified someone, and the strongest one stands alone when it did not,
    so a genuinely unregistered truck still gets exactly one crossing. Live detection is
    untouched — there one window really is one pass.
* **Verified end to end**, two real gates against a real core, 12 clips including one truck
  (`8901`) absent from the 276-unit master:
  after the IN run, 6 trucks inside (1 flagged unregistered) and 0 ritase; after the OUT run,
  **6 ritase, 0 unpaired, 12 crossings for 12 passes, pit empty**, cycle times computed, and the
  unregistered truck counted and flagged. Before the `select_crossings` fix the same run produced
  23 crossings, 11 unpaired, and a phantom `2254`.
* **Tests**: `core/tests/test_unregistered_and_ritase.py` (18) — the confidence gate, four-digit
  rejection, older firmware without `raw_code`, IN+OUT pairing and cycle time, an unpaired IN,
  unregistered ritase counted and flagged, occupancy in/out. `edge/tests/test_select_crossings.py`
  (7) — repeat windows collapsing, the phantom-truck case, two real trucks staying two, and an
  unregistered truck still yielding one. Core 196, edge 179.
* **Central console page — `/ritase` "Ritase & Posisi Truk"** (`core/frontend/src/app/ritase/page.tsx`,
  nav section "Data Ritase"):
  - Four counters: ritase selesai, truk di dalam area, total lintasan, and **ritase belum
    terdaftar** — the last broken out rather than buried, because haulage by trucks the master has
    never heard of is a registry gap to go and close.
  - **Posisi Truk**: who is inside right now with the evidence — which gate, when, at what
    confidence. Fetched in the same `Promise.all` as the ritase report on purpose: the trucks
    listed as inside *are* the cycles that have not closed, so loading them on separate ticks
    would put a screen on the wall that contradicts itself.
  - **Ritase per Truk** with in/out counts and average cycle time, **Lintasan per Gate** split by
    direction, and **Lintasan Belum Berpasangan** with a plain-language reason per row (shown only
    when there are any).
  - Unregistered hulls carry a `BELUM TERDAFTAR` badge everywhere they appear. The number is real
    and the trip happened; the badge is what stops it being read as a fleet unit before somebody
    adds it to the master.
  - `TruckRitase.registered` defaults to `true` when absent in `shift-report.ts`, so an older
    backend does not mislabel every truck as unregistered purely because the field had not shipped.
  - Verified against the live stack in both states: 6 trucks inside / 0 ritase after the IN run,
    then 6 ritase / 0 unpaired / pit empty after the OUT run.

### 6.15 Detail ON/OFF, and no reader wording on screen
* **Implementation Status**: `[DONE]`
* **Description**: One switch separates the operator view from the diagnostic one, and the word
  "OCR" is gone from every screen. Requested by the site's IT: a score or a match outcome nobody
  asked about invites a question nobody wanted.
* **Key Capabilities**:
  - **`Detail: ON/OFF`** in the gate console top bar, replacing the old `BBox` toggle, **off by
    default**. Off is the resting screen; on is what a technician turns to when diagnosing.
  - **Off** — the green box stays (it says only "the system is looking here"), and everything that
    quantifies goes: the `T#id score` caption above the box, the `100% · exact` line under every
    crossing, the per-crop sample strip, the frame counters, the track/sample/confidence line and
    the match outcome in the right panel. Crossing rows stop expanding, since what they expand
    into is the vote breakdown. What is left is the lane, a box, a crop, and the number.
  - **On** — all of it returns, unchanged.
  - **The caption is burned into the JPEG by the device**, so the switch has to be asked of the
    device: `GET /api/live/stream?detail=1`. `annotate(..., detail=)` draws the rectangle always
    and the caption conditionally. The captioned frame is a **second JPEG encode, only performed
    while somebody is watching that way** (`LiveState.detail_wanted()`); the plain view is now the
    always-encoded one, since it is the common case. This replaces the earlier `boxes=0` raw
    variant, which no longer had a consumer once the box became unconditional.
  - **Wording, both consoles**: "Sampel OCR" → **"Truck ID"**; "Dibaca OCR" → "Nomor terbaca";
    "Mesin OCR" → "Mesin Pembaca Nomor"; the status chip `OCR` → `PEMBACA`; "Daftar Pembacaan OCR"
    → "Daftar Pembacaan Nomor Lambung"; "Presisi OCR" → "Presisi Pembacaan"; "OCR FPS" → "FPS
    Pembacaan"; "Ambang Keyakinan OCR" → "Ambang Keyakinan Pembacaan"; "No OCR detections
    recorded yet." and "multi-frame OCR breakdown" replaced with Indonesian equivalents; the
    shift-report PDF and XLSX columns renamed too.
  - **Engine names**: the status bar showed the raw id `ppocrv6-tiny`, which still spells the
    letters IT asked to remove — and means nothing to whoever reads the screen. `READER_NAMES`
    maps them to **Ringan / Sedang / Besar / Lengkap**, which say the thing that actually differs.
    The real id is still one `GET /api/status` away for debugging.
* **Tests**: `edge/tests/test_annotate.py` (6) — box drawn with detail off, no caption plate with
  it off, caption present with it on, the source frame never drawn on (it belongs to the capture
  ring), downscaling. `test_live_stream.py` updated: plain by default, captioned on request,
  fallback when the second encode had not happened, and the viewer counter released on disconnect.
  Edge 186, core 196.
* **The unregistered flag now reaches the exports.** `build_shift_report` was dropping
  `registered` even though `ritase["perHull"]` carried it, so the PDF and the spreadsheet — the
  artefacts that get signed and filed, and the one place the flag is meant to prompt action —
  showed a truck the master has never heard of as though it were a fleet unit. Now:
  - `perTruck[].registered` plus top-level `unregisteredRitase` / `unregisteredHulls` on
    `GET /api/shift-report` (both frozen key sets updated deliberately).
  - **PDF**: a `— di antaranya belum terdaftar` row directly under the headline ritase figure, a
    `Status` column in Ritase per Nomor Lambung (`BELUM TERDAFTAR` / `terdaftar`), and the
    closing disclaimer names the count and the hull ids outright, so a reader who only scans the
    prose still learns part of the shift was hauled by unregistered units.
  - **Excel**: `Ritase belum terdaftar` and `Nomor belum terdaftar` rows on Ringkasan, and a
    `Status` column on Per Nomor Lambung.
  - The flag is its own column rather than a mark on the hull id, so the number stays clean to
    sort, filter, and copy into the master — which is the action the flag exists to prompt.
  - `shift-report.ts` defaults `unregisteredRitase` to 0 and `registered` to true when the fields
    are absent, so an older backend does not mislabel every truck.
