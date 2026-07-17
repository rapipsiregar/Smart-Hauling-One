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
  - **Sample Video Selector Support**: Exposes `GET /api/sample-videos` listing available videos in `data/01-playlist`, and accepts processing them directly using `sample_filename` parameter in the processing endpoint.

### 1.4 Fuzzy OHT ID Matcher & Spelling Corrector
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 1.4)
* **Description**: A fuzzy string logic module utilizing `rapidfuzz` to correct character segmentation and optical character recognition errors against the registered master OHT fleet.
* **Key Capabilities**:
  - **Fuzzy Levenshtein Distance Matching**: Performs ratio scoring against registered trucks, correcting character anomalies (e.g. standardizing `DT11B` -> `DT-118`, `DT-2O2` -> `DT-202`).
  - **Heuristic Hull ID Cleaning**: Strip spaces, enforce uppercase letters, and prefix numeric inputs automatically before running search matching.
  - **Dual API Route Integration**: Active inside both the edge video ingestion route and the manual crossing creation endpoint.


### 1.2 Docker Compose & Nginx Proxy Deployment
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 1.3)
* **Description**: Multi-stage Docker containment configuration integrated with an Nginx reverse proxy to expose only the designated PORT via `.env` while keeping other services mapped internally.
* **Key Capabilities**:
  - **Astral uv Docker Builder**: Uses a multi-stage builder targeting `ghcr.io/astral-sh/uv` to optimize layer caching, freeze dependencies (`uv.lock`), compile bytecode, and generate a minimal runtime footprint.
  - **Nginx Reverse Proxy Gateway**: Exposes only the custom `PORT` defined in `.env` to the host system. It intercepts and routes API requests to the backend (`http://backend:8000/api`), handles documentation paths (`/docs`, `/redoc`), proxies WebSocket/SSE upgrades, and serves the static frontend UI directly on `/`.
  - **Protected Backend Container**: Restricts the Python FastAPI application container to internal Docker bridge network access, shielding it from direct host system port exposure.
  - **Persistent Named Volume**: Configures a dedicated local docker volume (`smart_gate_data`) mapped to `/app/data` to ensure the SQLite database and captured visual evidence (`/app/data/evidence`) survive container recreation.

### 1.5 OCR Confidence Alerting System
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 1.1)
* **Description**: Backend confidence monitoring engine that flags low-confidence OCR reads and broadcasts live warning payloads.
* **Key Capabilities**:
  - **Database Warning Flags**: Updates SQLite crossing records with a `warning_status` tag indicating whether a detection has low OCR confidence.
  - **WebSocket Alert Broadcast**: Transmits warning payloads immediately to the frontend dashboard, highlighting low-confidence cards with visual pulses and slide-in notifications.
  - **Compliance Integration**: Automatically aggregates low-confidence reads under the compliance discrepancy alerts inside shift summaries.

### 1.6 Database Admin Backup JSON Endpoint
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 1.2)
* **Description**: Backend data export utility that creates instant snapshots of the Smart Gate registry and crossing tables.
* **Key Capabilities**:
  - **Dynamic Schema Serialization**: Reads SQLite tables (trucks and crossings) and packages them into a clean JSON structure.
  - **Force Download Headers**: Intercepts HTTP headers to prompt a file save download (`smart_gate_db_backup.json`) directly in the user's browser.
  - **Binary-to-Text Sanitation**: Safely decodes any legacy database binary fields to prevent serialization corruption.

### 1.7 Skid Telemetry Anomaly Checker
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 1.3)
* **Description**: Automated telemetry processing rules that audit skid sensor data and generate supervisor discrepancy alerts.
* **Key Capabilities**:
  - **Shared Sensor Cache**: Connects the telemetry retrieval routes and shift summary logic to read the exact same cache instances.
  - **Automated Anomaly Checking**: Flags high-priority alert items if skid battery levels drop below 30% or if solar panel output decreases below 5W.
  - **Compliance Integration**: Streams telemetry discrepancy warnings into the interactive Reports discrepancies feed.

### 1.8 Automatic Duplicate Crossing Ingestion Filter
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 1.1)
* **Description**: Backend duplicate suppression rules preventing double-counting of OHT cycles on the reports and dashboard.
* **Key Capabilities**:
  - **Temporal Delta Matching**: Computes the difference between consecutive logs for the same vehicle ID at the same gate checkpoint.
  - **10-Second Suppression Threshold**: Automatically marks records as duplicates (`is_duplicate = 1`) if they are submitted within 10 seconds of each other.
  - **Stats & Ritase Exclusion**: Filters out all flagged duplicate logs when computing Completed Ritase, total passages, and shift distribution metrics.
  - **Direct API Response**: Returns the calculated duplicate status in the FastAPI JSON response body and WebSocket broadcasts.

### 1.9 Database Admin Restore JSON Endpoint
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 1.2)
* **Description**: Backend restoration endpoint allowing administrators to upload JSON database backups and restore the exact state of registrations and crossings.
* **Key Capabilities**:
  - **State Clearing**: Performs a clean transactional purge of all active crossings and trucks prior to backup write.
  - **Primary Key & Timestamp Preservation**: Preserves original unique log IDs and historical timestamps, preventing sequence shifts or chronologic drift.
  - **Automatic Field Mapping**: Re-maps all properties (including OCR warning statuses and duplicate flags) to align with database schemas.
  - **Restore Validation Payload**: Returns a success status alongside the counts of successfully restored truck and crossing logs.

### 1.10 Mock Alert Email/SMS Dispatcher Engine
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 1.3)
* **Description**: Simulated notification relay engine generating formatted email and SMS payloads when critical telemetry warnings or low-confidence readings occur.
* **Key Capabilities**:
  - **Crossing Alert Trigger**: Monitors OCR results in real-time, dispatching warning payloads containing site supervisor recipients if confidence levels fall below 85%.
  - **Skid Telemetry Alert Trigger**: Monitors telemetry statuses (battery status and solar charge outputs) and generates high-severity maintenance alerts when bounds are crossed.
  - **WebSocket Live Relays**: Streams full alert dispatch JSON payloads to all connected clients via instant WebSocket broadcasts.
  - **Dispatch Logs Endpoint**: Exposes `GET /api/admin/alert-dispatches` to check the cache registry of the 20 most recent mock notification payloads.

### 1.11 OHT Fleet Registry CSV Import Validator
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 1.3)
* **Description**: Structural pre-validation layer for bulk OHT vehicle CSV uploads to block malformed inputs.
* **Key Capabilities**:
  - **Required Column Pre-checking**: Verifies headers contain `hull_id`, `contractor`, and `model`, returning clear header missing validation logs otherwise.
  - **Hull ID Alphanumeric Validation**: Runs regex pattern matching on vehicle code fields to block spaces and invalid characters.
  - **CSV Local Duplicates Detection**: Traces seen records inside the CSV to identify repeating lines.
  - **Database Registry Pre-verification**: Evaluates lines against existing database registrations to separate skipped warnings from failed block errors.
  - **Transaction Safe Atomic Rejection**: Rejects import entirely with details of all failed rows if any row contains formatting errors, while safely ignoring duplicates only.

### 1.12 Automatic Database Backup Scheduler
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 1.7)
* **Description**: Backend daemon scheduler that periodically creates timestamped backups of the master SQLite database.
* **Key Capabilities**:
  - **Uptime Daemon Thread**: Runs a non-blocking background thread that executes automatically at system startup and schedules itself every 24 hours.
  - **Native SQLite Backup API**: Performs high-fidelity database replication using Python's native `sqlite3.Connection.backup()` to prevent table lock disruptions.
  - **Timestamped File Persistence**: Saves database copies into `data/backups/smart_gate_YYYYMMDD_HHMMSS.db` for easy rollback auditing.

### 1.13 Supervisor Audit Logs JSON Export API
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 1.8)
* **Description**: REST API endpoint providing a downloadable JSON export of chronological supervisor audit trail actions.
* **Key Capabilities**:
  - **Dynamic Query Filtering**: Supports query parameters for `action`, `operator`, `start_date`, and `end_date` to filter logs in the exported payload.
  - **Chronological Sorting**: Automatically sorts logs from oldest to newest to simplify timeline tracing.
  - **Compliance Integration**: Prompts file downloads automatically via HTTP headers (`smart_gate_audit_export.json`) for seamless ingest by compliance auditing systems.

### 1.14 Remote Tower Consecutive Latency Alert Triggers
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 1.9)
* **Description**: Backend latency monitoring pipeline that automatically triggers critical alert logs when a skid tower connection experiences high latency over 3 consecutive status polls.
* **Key Capabilities**:
  - **Rolling Window Latency Cache**: Tracks the last 3 polled latency times per skid tower in a sliding cache window.
  - **Threshold Verification**: Triggers an alert when all 3 consecutive readings exceed the 400ms threshold limit.
  - **Multi-channel Dispatch & Logging**: Broadcasters WebSocket alert messages, writes entries to the `dispatch_logs` database, and appends a "Critical Skid Latency Warning" to reports' discrepancies feed.

### 1.15 Database Data Integrity Check API
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 1.10)
* **Description**: Diagnostic FastAPI endpoint `GET /api/admin/db-integrity` to perform full system database audits.
* **Key Capabilities**:
  - **Unregistered OHT Detection**: Identifies crossing logs referencing vehicle Hull IDs not present in the master fleet registry.
  - **Missing Image Audit**: Verifies the physical existence of image proof files on the disk (`data/evidence/`) mapped by database paths.
  - **Corrupt Metadata Flagging**: Validates crucial fields (Hull ID, timestamp) on crossing records, generating warning logs with severity classifications.

### 1.16 Subcontractor Performance Trends API
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 1.11)
* **Description**: Analytical FastAPI endpoint `GET /api/reports/subcontractor-trends` to fetch daily hauling cycles.
* **Key Capabilities**:
  - **Historical & Live Sync**: Automatically aggregates completed cycles from historical records (`daily_contractor_stats` table) and live crossings in a single view.
  - **Rolling 7-day Windowing**: Computes exact daily hauling statistics over the last 7 calendar days to capture performance changes.
  - **Multi-Contractor Datasets**: Group results by active registered subcontractor, preparing structured datasets for analytical frontend charts.

### 1.17 Dynamic Telemetry Alert Thresholds API
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 1.12)
* **Description**: Administrative FastAPI endpoint `PUT /api/admin/alert-thresholds` to configure remote skid tower latency and battery warning limits.
* **Key Capabilities**:
  - **Dynamic SQLite Storage**: Saves bounds (`battery_low`, `solar_low`, `latency_high`) dynamically inside the `telemetry_thresholds` SQLite table.
  - **Pydantic Validation Guard**: Validates range constraints (battery percentage between 0-100%, latency > 0ms, solar output >= 0W) before applying.
  - **Audit Logs Reporting**: Automatically writes change summaries into the SQLite `audit_logs` database table for administrative compliance reports.

---

## 2. Web Application Frontend

### 2.1 Supervisor Operations Dashboard UI
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 2.1)
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
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 2.1)
* **Description**: Interactive modal overlays displaying 6-hour historical trend charts for mobile gate skids.
* **Key Capabilities**:
  - **Click-to-Open Interactivity**: Detects supervisor clicks on any tower telemetry item card to launch a trends overlay modal.
  - **Dynamic SVG Drawing Engine**: Programmatically constructs two layered line charts (cyan for battery level, amber for solar array output) with glowing transparent gradients and dashed grid indicators.
  - **Visual Decay Tracking**: Plots Tower-Gamma's low-charge decay trend alongside healthy towers, reflecting sensor anomalies.
  - **Collapsible Telemetry Logs Viewer**: Adds a collapsible panel inside the Deployed Mobile Skid Remote Towers card displaying a chronological paginated history of tower telemetry metrics (battery level, solar panel output, network latency).
  - **In-Memory Telemetry Ring Buffer**: Maintains a history of up to 300 telemetry captures in backend memory, exposing a `GET /api/telemetry/history` query API.

### 2.3 Slate-Blue / Emerald-Green Glowing Theme Switcher
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 2.2)
* **Description**: Dual-theme UI mode selector built with native CSS custom properties and client-side persistence.
* **Key Capabilities**:
  - **Slate-Blue & Emerald-Green Design**: Switches all color tokens dynamically (backgrounds, glowing components, border lines, text fields).
  - **Sleek Transition Effects**: Employs CSS transition timing curves to animate theme color changes smoothly over 400ms.
  - **Local Storage Persistence**: Saves the operator's preference locally so the selected theme is preserved on subsequent browser sessions.
  - **Manual Theme Overrides Settings**: Extends the theme toggle mechanism with a collapsible settings sub-panel allowing fine-grain manual control of glowing pulse intensities (0% to 200%) and transparent glassmorphism blur settings (0px to 30px) via reactive range sliders.
  - **Ambient Sound Alerts Toggle**: Added a reactive toggle switch `#toggle-sound-alerts` inside the Config Overrides details panel, letting operators enable or disable sound chime alerts for low-confidence crossings.

### 2.4 Crossing Feed Context-Menu Options
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 2.3)
* **Description**: Custom context-menu interactions and edit APIs to quick-verify or correct matched Hull IDs on the fly.
* **Key Capabilities**:
  - **Custom Contextmenu Interceptor**: Listens to right-click context menu events on crossing feed cards and renders a glassmorphic popup.
  - **Quick-Verify Action**: Allows supervisors to instantly set reading confidence to 100% and resolve low-confidence alarms.
  - **Correct Hull ID Action**: Launches a custom modal dialog containing a text input field for vehicle corrections.
  - **Autocomplete Typeahead Dropdown**: Filters registered vehicles in the local cache on keypress and shows dynamic matching suggestions, preventing spelling and data input errors.
  - **Real-Time Synchronized Broadcasts**: Broadcasts the corrected database crossing object to all active dashboards via WebSocket, updating lists in place.
  - **Manual OCR Crop Reprocessing**: Drag-and-crop bounding box editor inside the Correct Hull ID modal to specify an exact region within the wide-angle context image, triggering the backend `POST /api/crossings/{id}/reprocess-ocr` endpoint to re-run OCR extraction.

### 2.5 WebSocket Connection State Indicator
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 2.1)
* **Description**: Real-time status indicator showing WebSocket connectivity state with glowing micro-animations in the header.
* **Key Capabilities**:
  - **Glowing Pulse States**: Uses CSS keyframe animations to pulse a color-coded status dot (Green: Connected, Yellow: Reconnecting, Red: Disconnected).
  - **Header Integration**: Sleek capsule layout positioned next to the theme toggle button for high visibility.
  - **Automatic Reconnection Handling**: Dynamically changes status labels and dot states during connection lost events and sets up automatic retries.
  - **Interactive Alert Dispatch Toast**: Leverages the WebSocket socket connection to push mock Email/SMS alerts in real-time as slide-in notifications.

### 2.6 Interactive Skid Location Map Mockup
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 2.3)
* **Description**: Real-time visual network mapping of mobile skid telemetry statuses and road network locations.
* **Key Capabilities**:
  - **Vector Haul Road Visual**: Renders a stylized vector background road route, loading zone, and dumping checkpoint layouts.
  - **Dynamic State Status Pins**: Places marker pins for Alpha, Beta, and Gamma towers that dynamically change background color (Green: normal, Yellow: warning, Red: offline) reflecting live database telemetry values.
  - **Live Traffic Heatmap Overlay**: Embeds glow spots for LOADING ZONE, DUMPING ZONE, and HAUL ROAD in the map SVG that dynamically adjust color and pulse radius (Green: low, Orange: moderate, Red: heavy traffic) based on OHT checkpoint passage density computed over the last 15 minutes.
  - **Trends Integration Trigger**: Intercepts supervisor click events on any map location pin to dynamically open the detailed 6-hour historical trend charts modal for that specific skid.
  - **Interactive Map Tooltips**: Displays a floating, glassmorphic info popup showing zone name, 15-minute passage count, travel direction metadata, and traffic density alerts when mouse hovers over loading, dumping, or haul road checkpoints.

### 2.7 Visual Alert Toast Notifications Drawer
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 2.2)
* **Description**: Collapsible alerts sidebar listing historical system and operational warning events.
* **Key Capabilities**:
  - **Collapsible Slide Drawer**: A space-saving slide-out menu drawer that displays warning and system logs without cluttering the main dashboard.
  - **Dynamic Alert Badge Counter**: Animates a high-contrast badge count on the main header Alerts toggle button.
  - **Event Logs Tracking**: Logs WebSocket connection states, low OCR confidence rates, cycle direction discrepancies, and mobile skid sensor alarms.
  - **Dismiss Actions**: Equips each alert card in the list with a close button to clear notifications from memory and update the badge dynamically.
  - **Dispatch Notification History SQLite Storage**: Persists dispatched SMS/Email notifications on critical telemetry failures or low confidence OCR to a SQLite table `dispatch_logs`.
  - **Dispatch logs API**: Exposes `GET /api/alerts/dispatches` to retrieve the chronological history of dispatched notifications.

### 2.8 Inline Telemetry Trends Sparklines
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 2.4)
* **Description**: Real-time inline SVG trend sparklines rendered inside each mobile skid telemetry card in the sidebar.
* **Key Capabilities**:
  - **Dual-Metric Visualization**: Visualizes battery level (sky-blue path) and solar charging output (amber path) simultaneously on a mini sparkline chart.
  - **Dynamic History Plotting**: Fetches historical telemetry records dynamically from `/api/telemetry/history` and plots the latest 10 data points chronologically.
  - **Auto-Updating Sparks**: Refreshes lines in place automatically as fresh WebSockets telemetry events are received.

### 2.9 Quick-Filter Toggle Tags
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 2.5)
* **Description**: Capsule-shaped filter toggle tags above the main real-time live crossings feed.
* **Key Capabilities**:
  - **Single-Click In-Place Filtering**: Filter crossing cards instantly by clicking "Low Conf", "Unregistered", or "Cycle Disc" toggle tags.
  - **Integrated Class-Filters Sync**: Combines quick filter rules with class selection checkboxes (Dump Truck, Light Vehicle, Excavator) dynamically.
  - **Dynamic Mutation Observance**: Automatically applies active quick-filter tags on newly ingested WebSocket crossings using a MutationObserver on the feed list.

### 2.10 Physical Elastic Alert Toast Stack
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 2.6)
* **Description**: A slide-in physical alert notification stack displaying WebSocket warning events in the top-right corner.
* **Key Capabilities**:
  - **Elastic Sliding Animation**: Invokes cubic-bezier transitions (`cubic-bezier(0.16, 1, 0.3, 1)`) to slide alert cards smoothly into view.
  - **Categorized Color Encoding**: Maps notifications to distinct alert themes (Red for errors/discrepancies, Yellow/Orange for connection disruptions, Green for success overrides).
  - **Manual Clear & Auto-dismiss**: Equips each notification card with a manual close button and triggers auto-dismiss after exactly 4 seconds of display.
  - **Countdown Pause-on-Hover**: Temporarily suspends the 4-second auto-dismiss countdown timer when a user hovers their mouse cursor over the toast, resuming the remaining countdown once the mouse leaves.

### 2.11 Interactive Feed Grid Layout Toggle
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 2.7)
* **Description**: Interactive toggle selector inside the Live Crossing Feed card header enabling layout switches between standard listing and multi-column grid view.
* **Key Capabilities**:
  - **Responsive Layout Adaptation**: Swaps CSS layouts on `#live-feed-list` dynamically, turning the vertical column list into a multi-column CSS Grid.
  - **Responsive Thumbnail Stacking**: Re-orders thumbnails in grid mode to stack vertically, preventing horizontal squishing and maintaining high readability.
  - **State Persistence**: Caches the supervisor's layout mode preference in `localStorage` to preserve selection state across dashboard reloads.

### 2.12 Inline Manual Registration Action Inside Feed Items
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 2.8)
* **Description**: Pre-filled quick registration button rendered directly inside crossings feed cards for unrecognized OHTs.
* **Key Capabilities**:
  - **Dynamic Card Button Injections**: Automatically appends a high-contrast "+ Fleet" button inside the feed list item header when the crossing matches an unregistered Hull ID.
  - **Instant Modal Pre-population**: Listens to button clicks and triggers the vehicle registration form overlay pre-filled with the unregistered vehicle's detected Hull ID.
  - **Event Delegation Interceptor**: Uses bubble-up event interception on the feed list container, guaranteeing zero listener leakage and maximum responsiveness.

### 2.13 Real-time Audio Status Toggle
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 2.9)
* **Description**: Live audio alerts control switcher integrated directly into the top header next to the WebSocket indicator.
* **Key Capabilities**:
  - **Single-Click Quick Mute**: Instantly enables/disables Web Audio API notification sounds when low-confidence readings or discrepancies occur.
  - **Dynamic State Visualization**: Dynamically swaps button icon (🔊 vs 🔇) and visual border styling based on the active preference state.
  - **Local Persistence & Sync**: Caches audio alerts preference in `localStorage` and maintains real-time bidirectional synchronization with the settings drawer checkbox.

### 2.14 Interactive Search Query Highlights in Feed Cards
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 2.10)
* **Description**: Real-time interactive feed searching with character-level match highlighting.
* **Key Capabilities**:
  - **Character Match Highlights**: Wraps matching character sequences in a high-contrast HTML `<mark class="search-highlight">` element inside OHT Hull ID tags dynamically as the user types.
  - **Universal Filters Sync**: Interacts with existing Quick Filters and Class checkboxes seamlessly to ensure cards are only displayed when they satisfy all criteria.
  - **WebSocket Live Ingestion Match**: Triggers automatically on newly received real-time crossings via MutationObserver, highlighting matching sequences on the fly.

### 2.15 Live Feed Sort Order Toggle
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 2.12)
* **Description**: Live feed sorting toggle button to easily swap order orientations.
* **Key Capabilities**:
  - **Ascending & Descending Support**: Instantly switches feed card order between descending (newest first) and ascending (oldest first).
  - **Dynamic State Labels**: Displays the active sorting mode dynamically inside the button label (e.g. `⇣ Newest` vs `⇡ Oldest`).
  - **Sort Preference Cache**: Saves sorting choices inside the browser's `localStorage` to automatically preserve feed configurations across supervisor sessions.

### 2.16 Expandable Feed Card Detail Drawer
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 2.14)
* **Description**: Smooth visual accordion drawer embedded in live feed crossing cards that expands to show edge OCR proof metadata.
* **Key Capabilities**:
  - **Accordion Transition Effect**: Uses a height-transitioning CSS container that expands dynamically when a feed card is clicked or selected.
  - **IP Camera Metadata Resolution**: Resolves and displays the subnet IP address of the capturing edge Skid camera depending on the gate lane.
  - **OCR Bounding Box Analytics**: Displays coordinate ranges (X, Y, W, H) indicating where the SAM3 model detected the truck license plate.
  - **Confidence Ratings Details**: Breaks down raw text OCR and SAM visual segmentation confidence percentages for detailed technical review.

----

## 3. Analytics & Reporting Features

### 3.1 Shift Summary & Reporting Engine
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 3.1)
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
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 3.2)
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
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 3.3)
* **Description**: Live operations panel representing solar-powered remote edge skid tower health.
* **Key Capabilities**:
  - **Dynamic Sensor Polling**: Periodically fetches and animates battery percentage, solar panel generation levels, and network ping latency for deployed towers (Alpha, Beta, Gamma).
  - **Color-Coded Status Warnings**: Flags battery dips and elevated latency levels (e.g. warning status indicators for Tower-Gamma).
  - **Telemetry Trend Time-Interval Selector**: Equips the trends modal window with quick selector buttons (6H, 24H, 7D) that dynamically regenerate the SVG line charts representing hourly battery charging and solar array fluctuations over the chosen period.
  - **Dynamic Threshold Configuration**: Exposes `POST /api/telemetry/thresholds` to persist custom warning configurations (such as low battery limit, low solar output, and latency maximum levels) directly to the database. These configured parameters govern real-time anomaly checks and visual alarms.
  - **Admin Telemetry History Logging API**: Exposes a REST API diagnostic endpoint `GET /api/admin/telemetry-history` returning solar battery levels, charging currents, and latencies grouped by tower ID over configurable rolling time intervals (`1h`, `6h`, `24h`, `7d`).
  - **Compact KPI Widgets**: Integrated directly under the operational workspace on the main dashboard tab.

### 3.4 Subcontractor Ritase Allocation Donut Chart
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 3.1)
* **Description**: Interactive donut visualization showing cycles performed by each subcontractor to audit contractor productivity.
* **Key Capabilities**:
  - **Dynamic Conic-Gradient Generation**: Computes contractor percentages and draws segments dynamically using standard CSS gradients.
  - **Interactive Legend Panel**: Color-matches segments to contractor names, indicating the absolute completed ritase cycle count and percentage weight.
  - **Auto-Fallbacks**: Renders a clean default state when no crossings or cycles are logged, preventing visualization failures.
  - **Vector Comparison Chart**: Programmatically renders side-by-side comparative SVG bar charts comparing contractor compliance percentages and hourly capacity throughput vs expectation targets. Vector format guarantees visibility on print layouts.
  - **Interactive Comparison Filters**: Incorporates inline checkable contractor checkboxes directly inside the chart widget header. Toggling checkboxes filters individual subcontractor rows from the comparison chart reactively.

### 3.5 PDF Report Generator & Print Layout
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 3.2)
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
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 3.4)
* **Description**: Custom compliance-ready A4 portrait print layout stylesheet for generating formal PDF compliance reports.
* **Key Capabilities**:
  - **A4 Portrait Page Definition**: Configures size and margin bounds explicitly to match standard A4 paper dimensions (`size: A4 portrait; margin: 20mm 15mm;`).
  - **Page Break Page flow Rules**: Defines break-inside and page-break-inside directives to guarantee tables, charts, and card elements remain intact on a single page.
  - **High-Contrast Vector & Text Styling**: Converts all SVGs, graphs, tables, and borders to high-contrast monochrome styles suited for black-and-white printouts.

### 3.6 Dynamic Edge Skid Simulation Toolbar
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 3.3)
* **Description**: Interactive testing toolbar on the Ingestion Tab allowing supervisors to simulate remote tower signal drops or low battery levels.
* **Key Capabilities**:
  - **Skid Tower Overrides API**: Backend simulation registry to intercept live status polling and inject custom battery/solar/latency values.
  - **Control Interface**: Form controls to select target towers, switch status states, and input specific charge percentages, watts, or latency pings.
  - **Live Loop Validation**: Refreshes simulated alerts and telemetry charts instantly across all tabs upon clicking the "Apply Anomaly" button.
  - **Global Override Reset**: Instantly clears all active simulation values, restoring natural randomly generated telemetry conditions.

### 3.7 Interactive Live Vehicle Registry Status Switch
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 3.1)
* **Description**: Interactive toggle control to change OHT status (active/inactive) directly inside the Fleet Registry table.
* **Key Capabilities**:
  - **Dynamic Toggle Switch**: Replaces static text badges with sleek custom checkbox switches inside each registry table row.
  - **Live Backend Synchronization**: Registers change handlers to issue a PUT request to the database status update API instantly when toggled.
  - **Error Recovery**: Restores visual state if the network synchronization fails, ensuring reliable visual status updates.

### 3.8 Interactive Contractor Compliance Target Manager
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 3.2)
* **Description**: Form controller to customize expected compliance target rates for subcontractor fleet companies.
* **Key Capabilities**:
  - **SQLite Persistence**: Creates table `contractor_compliance_targets` to save expectance values per contractor company.
  - **Configuration Form**: Interactive dialog window displaying input selectors and target rate fields.
  - **Dynamic Gauges Update**: Reloads and regenerates compliance rate gauge charts dynamically when updated.

### 3.9 Automatic Database Cleanup & Pruning Job
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 1.1)
* **Description**: Automatic cleanup job and API to prune crossings older than a configurable number of days, freeing disk space by deleting image files while preserving daily statistics.
* **Key Capabilities**:
  - **Pruning API Endpoint**: Exposes `POST /api/admin/prune-crossings` allowing configurable days retention limit.
  - **Historical Stats Retention**: Automatically aggregates pruned crossings and cycles into `daily_contractor_stats` table before deletions.
  - **Image Disk Cleanup**: Locates and deletes the physical crop and context image files associated with pruned crossings.

### 3.10 System Health Check Status API
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 1.3)
* **Description**: Diagnostic health API endpoint reporting system warning status and metrics.
* **Key Capabilities**:
  - **Diagnostic Health Check Endpoint**: Exposes `GET /api/system/status` returning aggregate health scores.
  - **Multiple System Verification Tests**: Checks SQLite connectivity, telemetry latency limits warnings, and evidence folder disk footprint.
  - **Health Warning Scoring**: Computes a dynamic warning percentage based on anomalies to quickly alert administrators.

### 3.11 Contractor Compliance Target Programmatic API Override
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 1.4)
* **Description**: Programmatic target override REST API for automated contractor threshold updates.
* **Key Capabilities**:
  - **Programmatic Target Override Endpoint**: Exposes `PUT /api/admin/contractor-targets` to programmatically update subcontractor ritase targets in the SQLite database.
  - **Real-Time WebSocket Broadcast**: Automatically broadcasts a `targets_updated` message containing the updated targets dictionary to all connected frontend clients to instantly update compliance gauges.

### 3.12 Supervisor Action Audit Trail
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 1.5)
* **Description**: Event logging database table and API to trace supervisor manual corrections, alignment updates, and compliance warning dispatches.
* **Key Capabilities**:
  - **Supervisor Action Audit Trail Endpoint**: Exposes `GET /api/admin/audit-logs` returning all manual correction, warning dispatches, and manual crop alignments from the `audit_logs` table.
  - **Automatic Event Instrumentation**: Captures timestamp, action classification, details, and operator information whenever database modifications or external dispatches occur.

### 3.13 Telemetry Critical Threshold Discrepancy Ingestor
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 1.6)
* **Description**: Real-time telemetry monitoring component that automatically logs critical warnings and escalates severity weights when skid power or charging indices drop below hardcoded site boundaries.
* **Key Capabilities**:
  - **Critical Power Alerts**: Generates a high-severity "Critical Skid Battery Warning" log record automatically when any skid battery level drops below 20%.
  - **Critical Charging Alerts**: Generates a high-severity "Low Solar Array Output Alert" log record automatically when any skid solar panel output drops below 15W.
  - **Dynamic Severity Demoting**: Assigns medium severity weights for minor telemetry threshold crossings that remain above the critical 20% / 15W limits.

### 3.14 Local Fleet Search Auto-Suggestions Cache
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 3.5)
* **Description**: Browser-side autocomplete cache and suggestion lists inside the vehicle registration and correction inputs.
* **Key Capabilities**:
  - **Offline Registry Storage**: Caches registered fleet data in `localStorage` dynamically upon successful API responses, falling back to local memory if the backend is unreachable/offline.
  - **Input Auto-Suggestions**: Displays matching registered subcontractor and vehicle model suggestions dynamically as supervisors type inside the registration forms.
  - **Click-to-Complete Integration**: Populates fields automatically when suggestions are clicked, reducing typos and speed-registering vehicles.

### 3.15 Shift-Goal Compliance Stats Chart
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 3.6)
* **Description**: Real-time vector-based comparison chart visualizer comparing completed subcontractor ritase against their shift target goals.
* **Key Capabilities**:
  - **Direct Goal Comparison**: Formulates shift goals dynamically based on elapsed active shift hours and compliance targets, displaying side-by-side graphical progress indicators.
  - **Inline Compliance Integration**: Positioned directly under the Shift-Target Compliance Gauges to give supervisors an immediate, single-card audit overview.
  - **SVG Vector Rendering**: Fully generated as clean inline SVGs to maintain high-resolution print rendering capabilities for physical compliance handovers.

### 3.16 Standalone HTML Report Exporter
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 3.7)
* **Description**: High-fidelity offline report generator compile utility.
* **Key Capabilities**:
  - **Dynamic Style Embedding**: Automatically fetches active client-side stylesheets (`index.css`) and bundles them directly inside the export file.
  - **Static Sanitization**: Automatically strips interactive checkboxes, button bars, and selection toolbars from the exported report grid to ensure a clean, audit-ready layout.
  - **Offline Compliance Validation**: Generates a self-contained, offline-runnable page complete with inline SVGs, donut segments, shift charts, and discrepancies list, saving it locally.

### 3.17 Dynamic Contractor Expected Capacity Target Settings
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 3.8)
* **Description**: Real-time expected capacity targets manager configuration and estimated compliance preview.
* **Key Capabilities**:
  - **Expected Rate Input Adjustments**: Exposes a target rate input field (ritase/hr) per contractor to allow customized operational expectations.
  - **Estimated Target Preview**: Automatically calculates `(hourly_capacity / target_rate) * 100` and displays the estimated compliance percentage in real time as the input value changes.
  - **Live Status Color Branding**: Applies custom border/color highlights (Green/Yellow/Red) based on active compliance thresholds inside the targets dialog.

### 3.18 Automatic Chart Printing Styles Toggle
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 3.9)
* **Description**: Automatically dismisses dialogs and resets configuration inputs upon completion or cancellation of browser print actions.
* **Key Capabilities**:
  - **afterprint Event Triggers**: Registers clean event hooks for the browser's printing state flow to catch print-finished and print-cancelled stages.
  - **Dynamic Form Input Reset**: Automatically clears customized parameter inputs and returns modal fields to default options on dismissal.
  - **Modal State Cleanliness**: Automatically closes print settings dialog boxes, restoring default view indicator classes across the supervisor dashboard view.

### 3.19 Database SQL Snapshot Backup Engine
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 1.14)
* **Description**: Diagnostic manual and automated database snapshot backup scheduler.
* **Key Capabilities**:
  - **SQL Snapshot Exporter**: Exposes `POST /api/admin/backup` allowing supervisors to trigger timestamped database backups containing the complete SQL schema and data statements representation.
  - **Automated Directory Storage**: Stores backup dump files physically inside the `data/backups/` directory with customizable naming prefixes.
  - **Action Auditing Logging**: Inserts an audit trail event log inside `audit_logs` to maintain clear supervisor data maintenance records.

### 3.20 Live RTSP Stream Ingestion Engine
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 1.15)
* **Description**: Backend real-time CCTV stream decoder and OCR processing pipeline executor.
* **Key Capabilities**:
  - **FastAPI Startup Integration**: Spawns an asynchronous background task on application startup to handle live stream polling and processing.
  - **True RTSP Stream Decoding**: Utilizes OpenCV `cv2.VideoCapture` to connect to, decode, and capture frames from the configured RTSP CCTV URL.
  - **Simulated Stream Fallback**: Automatically falls back to a high-fidelity simulated crossing generator utilizing sample playlist frames when the configured RTSP stream is unreachable.
  - **Unified Fleet Registry Sharing**: Processes live vehicle crossings against the same SQLite master vehicle database registry and broadcasts records in real time via WebSockets.

### 3.21 Demo vs Live Operations Mode Switcher
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 2.15)
* **Description**: Interactive top header operational mode selector control to toggle active ingestion sources.
* **Key Capabilities**:
  - **Dual Pill Mode Switcher**: Sleek header toggle buttons to switch active gates between sample playlist videos (Demo) and real-time CCTV feeds (Live).
  - **Dynamic State REST Sync**: Queries and posts active settings parameters via `/api/admin/mode` instantly to synchronize state with the database settings table.
  - **Dynamic Ingestion Mode Segregation**: Segregates and queries crossing records inside the database dynamically depending on the active setting, ensuring that statistics, KPIs, and reports reflect the selected mode without affecting master registry configurations.
  - **Audit Logging Integration**: Logs mode changes automatically in the supervisor action audit database trail to prevent unmonitored production mode tampering.

### 3.22 Subcontractor Compliance Timeline Chart
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 3.14)
* **Description**: Timeline-style hourly trend line graph tracking contractor compliance rates.
* **Key Capabilities**:
  - **Asynchronous Rolling History Calculations**: Backend calculates Completed Ritase vs expected Targets hourly over a rolling 12-hour window.
  - **SVG Line Chart Renderer**: Front-end dynamically draws multicolored line paths representing each contractor's hourly compliance percentages.
  - **Monospace Grid Reference Lines**: Includes horizontal coordinate tick lines (0% to 100%) and interactive hover tooltips identifying data values per data point.

### 3.23 Database Optimization and Vacuum Manager
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 1.16)
* **Description**: Backend SQLite optimization scheduler and disk cleanup maintenance system.
* **Key Capabilities**:
  - **WAL Checkpoints & Optimization**: Executes `PRAGMA wal_checkpoint(TRUNCATE)` and SQLite `PRAGMA optimize` on-demand to speed up database queries.
  - **Vacuum Maintenance**: Runs database vacuuming (`VACUUM`) to reclaim unused disk sectors.
  - **Audit trail & UI Integration**: Logs events in the supervisor audit trail and provides a button to trigger optimization dynamically.

### 3.24 Edge Tower Status Notification Mailer Microservice
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 1.17)
* **Description**: Microservice tracking Edge Tower connectivity check-in times and dispatching notifications.
* **Key Capabilities**:
  - **Check-in Heartbeat Registration**: Keeps track of last successful status poll times for each Mobile Skid Tower.
  - **Offline Detection Logic**: Identifies towers that failed to report telemetry data for >5 minutes.
  - **Automated Dispatches**: Dispatches critical notifications via SMS and email channels to site maintenance leads and logs entries in the central dispatch logs database table.

### 3.25 Vehicle Classification Statistical Summary API
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 1.18)
* **Description**: API endpoint analyzing traffic volume across major vehicle classes over the shift.
* **Key Capabilities**:
  - **Modular Database Queries**: Counts active checkpoint passage events matching classification tags like Dump Truck, Light Vehicle, and Excavator.
  - **Dynamic Mode Filtering**: Exposes statistics specifically calculated for the active ingestion mode (Demo or Live).
  - **Fast JSON Serialization**: Returns total volumes and individual class counts under `/api/reports/class-distribution`.

### 3.26 Subcontractor Compliance Timeline Legend Toggle
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 2.16)
* **Description**: Interactive legend click handler permitting on-demand contractor filtering on the compliance timeline line chart.
* **Key Capabilities**:
  - **Dynamic Legend Toggles**: Click individual contractor names in the legend block to hide or display their trend lines instantly.
  - **Local UI Rendering State Cache**: Caches last fetched telemetry hourly stats data structure to rebuild SVG layout in real time upon toggle clicks.
  - **Visual Status indicator**: Fades out toggled-off contractor entries in the legend text blocks with line-through decorators to specify hidden states.

### 3.27 Supervisor Workspace Configuration Profile Drawer
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 2.17)
* **Description**: Sliding panel interface to customize and save workspace supervisor options locally.
* **Key Capabilities**:
  - **Local Storage Preference Cache**: Persists preferences (Audio volume level, Default charts time range, Auto-refresh frequency) in browser LocalStorage.
  - **Synthesizer Volume Control Integration**: Binds audio slider input directly to the Web Audio gain nodes generating warning beep alerts.
  - **Auto-Refresh Configuration Settings**: Allows operators to customize JSON poll refresh intervals dynamically.

### 3.28 Search Term History Suggestions
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 2.18)
* **Description**: Capture and display recent search term history dropdown when input is focused inside the feed card header.
* **Key Capabilities**:
  - **Dynamic Dropdown Suggestions**: Focus on the Search Hull ID input box triggers an absolute-positioned dropdown showing up to 5 recently used search terms.
  - **Local History State Storage**: Stores query strings locally, ordering entries by recency (most recent query on top).
  - **Quick Re-Filtering**: Clicking any suggestion term fills the search field and triggers live crossing card filtering instantly.

### 3.29 Automated Excel Reconciliation Exporter
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 3.16)
* **Description**: Multi-sheet structured Excel (.xlsx) reconciliation exporter aggregating active shift statistics.
* **Key Capabilities**:
  - **Dynamic In-Memory openpyxl Generation**: Builds spreadsheets using openpyxl dynamically and streams the response directly to the supervisor client.
  - **Multi-Sheet Classification Structure**: Generates structured worksheets detailing Shift Distribution + OHT Ritase volumes, Subcontractor Compliance rates, and Discrepancy Alerts logs.
  - **Automated Column Auto-fitting and Styling**: Formats tables with clean headers, borders, Segoe UI typography, and severity color mappings.

### 3.30 Customizable Discrepancy Alert Thresholds Modal
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 3.17)
* **Description**: Modal form permitting supervisor adjustment of low-battery, low-solar, and high-latency telemetry alert triggers.
* **Key Capabilities**:
  - **Sidebar Overrides Integration**: Added an alert thresholds button within the collapsible sidebar configuration overrides drawer.
  - **Restful Put Requests**: Connects form submissions to `PUT /api/admin/alert-thresholds` to save active values into the database.
  - **Dynamic Telemetry Recalculation**: Triggers real-time dashboard data reload upon changes to reflect telemetry alerts matching new constraints.

### 3.31 Historical Telemetry Data Purge API
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 1.19)
* **Description**: Administrative API endpoint to prune telemetry data older than a customizable duration.
* **Key Capabilities**:
  - **Customizable Pruning**: Exposes `DELETE /api/admin/telemetry-purge` taking an `older_than_days` query parameter.
  - **In-Memory and Database Clean Up**: Filters telemetry history logs dynamically and records action parameters.
  - **Supervisor Audit Trail Sync**: Automatically inserts entries to `audit_logs` documenting the exact record count purged and the time window applied.

### 3.32 OCR Confidence Calibration Setting API
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 1.20)
* **Description**: Administrative API endpoint allowing customization of the OCR confidence threshold below which crossings are flagged.
* **Key Capabilities**:
  - **Dynamic Settings Endpoint**: Exposes `PUT /api/admin/ocr-thresholds` to configure the `ocr_confidence_min` setting in the database.
  - **Input Validation Guard**: Restricts acceptable confidence limits to range between 0.0% and 100.0%.
  - **Real-Time Threshold Integration**: Seamlessly integrates across crossing creation, alert dispatcher, and reports logic to classify low-confidence alerts dynamically.

### 3.33 Mock Edge Telemetry Stream Simulator
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 1.21)
* **Description**: Background simulation worker modeling realistic mobile tower battery charge/discharge and solar charging day/night cycles.
* **Key Capabilities**:
  - **Solar Array Night/Day Cycle Simulation**: Simulates a 20-minute day/night cycle, adjusting base solar outputs and inducing random weather fluctuations.
  - **Telemetry Battery Charging Physics**: Charges battery levels dynamically when solar output is high (>40W) and discharges them during low solar periods.
  - **Historical Logs Accumulator**: Periodically appends active state metrics to the in-memory telemetry logs to supply dashboard trend charts with rich data.

### 3.34 Visual Alert Notification Flash Banner
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 2.19)
* **Description**: A prominent top-bar warning banner displayed dynamically on the operations dashboard when edge towers go offline.
* **Key Capabilities**:
  - **Dynamic Status Monitoring**: Regularly queries tower connection statuses and lists offline tower IDs in the alert warning label.
  - **Manual Dismissal Control**: Includes an close ('&times;') button permitting operators to clear/hide the alert indicator from immediate view.
  - **Auto-reset State Handling**: Re-enables warning banner display behavior automatically once all towers return online and transition back to offline states.

### 3.35 Database Optimization Progress Indicator
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 2.20)
* **Description**: A visual feedback loader and stopwatch timer indicating ongoing SQLite database optimize tasks.
* **Key Capabilities**:
  - **Dynamic Sidebar Indicator**: Integrates a loading status panel containing a spinning loader immediately beneath the Optimize Database button.
  - **Incremental Execution Stopwatch**: Triggers an incremental timer (updating every 100ms) to display database compaction processing duration.
  - **Auto-dismissing State**: Auto-hides progress details and resets timer upon successfully receiving database size details from the backend.

### 3.36 Operations Dashboard Filter Reset Button
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 2.21)
* **Description**: A reset button permitting operators to restore default dashboard filter settings in one click.
* **Key Capabilities**:
  - **Filter Header Placement**: Integrated a **🧹 Reset** button within the Real-time Live Crossing Feed header section.
  - **Multi-Filter Sync Clearance**: Dynamically clears search query input strings, re-selects all vehicle classification checkboxes, and restores the active quick filter tags back to Show All.
  - **Live Feed Auto-reload**: Automatically re-applies layout filtering variables across all feed cards and displays a success notification feedback toast.

### 3.37 Visual Telemetry Battery and Solar Correlation Chart
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 3.19)
* **Description**: Interactive side-by-side trends line chart and scatter correlation chart inside the telemetry trends modal.
* **Key Capabilities**:
  - **Dynamic History Integration**: Fetches real telemetry records from `/api/admin/telemetry-history` based on the selected duration (6H, 24H, 7D).
  - **Scatter Correlation Plot**: Draws a scatter plot mapping battery level (y-axis) against solar array charging output (x-axis) for each data point.
  - **Dashed Regression Line**: Computes the regression slope and intercept on the fly to overlay a red dashed line of best fit representing battery-to-solar charge correlation.

### 3.38 Supervisor Shift Hand-over Note Log
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 3.20)
* **Description**: A local log input form allowing shift supervisors to store handover notes and auto-append them to generated PDF/HTML reports.
* **Key Capabilities**:
  - **Embedded Form Input**: Integrates an input card containing a shift handover text area and Save button under the subcontractor discrepancies table.
  - **Local Session Retention**: Automatically caches inputted notes inside LocalStorage (`supervisor_shift_notes`) to preserve content across browser sessions and reloads.
  - **Report Integration**: Automatically formats notes as static read-only text blocks in generated HTML report outputs and prints them cleanly inside the PDF page layout (hiding inputs/save buttons dynamically).

### 3.39 Map View Style Switcher
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 3.21)
* **Description**: A multi-mode style switcher letting operators toggle the telemetry map outline representation.
* **Key Capabilities**:
  - **Header Toggle Buttons**: Integrated a button group (Schematic, Outline, Heatmap) inside the site map header.
  - **Style Modes**:
    - **Schematic Mode**: Restores standard colored road lines, grid subdivisions, and green zone circles.
    - **Outline Mode**: Displays road networks as a high-contrast wireframe and converts zone markers to thin dashed outlines.
    - **Heatmap Mode**: Maps passage density based on live crossings count, dynamically scaling zone circle radiuses and coloring them based on traffic volumes (cyan for low traffic, orange for medium, red for high traffic density).

### 3.40 Contractor Target Compliance Alert API
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 1.22)
* **Description**: Backend check API and modular alert dispatcher evaluating subcontractor hourly target compliance levels.
* **Key Capabilities**:
  - **Compliance Evaluator Endpoint**: Exposed `POST /api/reports/contractor-performance/compliance-check` to calculate current hourly capacity vs targets across all registered subcontractors.
  - **Critical Drop Alerts**: Triggers a critical-severity compliance warning (with corresponding SMS payloads for Site Supervisors and Email logs for dispatch) whenever any contractor drops below 80% of expected capacity.
  - **WebSocket and Audit Integration**: Automatically broadcasts triggered alerts to all active web clients via WebSocket connection protocols and registers transactions to the SQLite audit log.

### 3.41 Compressed Database Automatic Backup Cron Service
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 1.23)
* **Description**: A background utility and admin API performing compressed backups of the SQLite database once every simulated shift change.
* **Key Capabilities**:
  - **Online SQLite Backup**: Executes standard SQLite online connections `.backup()` method on a background thread to prevent active write locking or database file corruption during backups.
  - **Compressed Storage**: Automatically compresses backup files using the Python `gzip` library, saving files as `data/backup_<timestamp>.db.gz` to conserve disk memory.
  - **Auto-run & On-Demand Triggers**: Runs periodically every 10 minutes (matching simulated shift intervals) and exposes a `POST /api/admin/db-backup` endpoint allowing administrators to manually trigger gzipped backups.
  - **Audit Trail Logs**: Logs each successful backup creation event including the filename and compressed size in bytes inside the SQLite system `audit_logs` table.

### 3.42 Telemetry Link Signal Quality Estimator
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 1.24)
* **Description**: Backend signal quality calculator estimating UHF and LTE connection health parameters for deployed edge towers.
* **Key Capabilities**:
  - **SNR & Link Margin Calculator**: Evaluates packet signal-to-noise ratio (SNR) in dB and computed link margins on the fly based on current telemetry check-in latency.
  - **Packet Loss Estimator**: Computes expected packet loss percentages dynamically scaled by connection latencies.
  - **UHF and LTE Bifurcation**: Separately evaluates UHF heartbeat packets (~128 bytes) and LTE visual proof transmissions (~2048 bytes) utilizing distinct calibration coefficients.
  - **Integrated API Payloads**: Returns nested `connection_health` payloads directly inside edge tower status JSON records generated by the `/api/telemetry/towers` endpoint.

### 3.43 Contractor Warning Dispatcher Form
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 2.22)
* **Description**: Interactive modal warning dispatcher form letting operators enter custom warnings and dispatch warnings to subcontractor companies.
* **Key Capabilities**:
  - **Custom Remark Entry**: Adds an optional "Custom Warning Details" textarea input inside the Dispatch Compliance Warning modal dialog.
  - **Dynamic Contractor Fetch**: Automatically queries current active subcontractor list and populates the drop-down select field.
  - **Enhanced Backend Routing**: Passes supervisor comments to the backend `POST /api/reports/contractor-performance/send-warning` API payload, automatically appending them into warning notification events and logs.

### 3.44 Collapsible Visual Audit Theater Mode
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 2.23)
* **Description**: Enhancements to the split-screen visual audit panel adding on-demand collapsibility and distraction-free theater view controls.
* **Key Capabilities**:
  - **Distraction-Free Theater Mode**: Toggles the `.theater-active` state to expand the visual audit proof panel into a full-viewport layout for critical manual verification cycles.
  - **Interactive Collapse Controls**: Adds a header collapse toggle button (`➖ Collapse` / `➕ Expand`) to hide the split-pane image elements, reclaiming dashboard screen area for operator feeds.
  - **Escape Key Integration**: Automatically detects `Escape` keypress events to close active full-screen theater sessions cleanly.

### 3.45 Visual Contractor Target Compliance Gauge
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 2.24)
* **Description**: Premium inline visual gauges and progress bars with critical threshold indicators showing subcontractor shift compliance rates.
* **Key Capabilities**:
  - **Dynamic SVG Circular Gauges**: Renders an inline vector radial ring gauge next to each subcontractor's data card, colored dynamically based on performance status.
  - **Warning Threshold Markers**: Embeds an explicit vertical indicator tick at the **80% warning threshold** level on linear progress bars to instantly highlight compliance violators.
  - **Utilization Correlation**: Integrates active fleet size ratios and hourly ritase capacities alongside compliance gauges to provide holistic operational views.

### 3.46 Shift Distribution SVG Bar Chart
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 3.22)
* **Description**: A visual vector SVG bar chart histogram mapping total OCR haulage passages across 4-hour chronological shift blocks over a 24-hour window.
* **Key Capabilities**:
  - **Vector SVG Canvas**: Draws a responsive, pixel-perfect histogram chart inside the shift distribution section featuring dynamic axis scaling.
  - **Chronological Sorting**: Automatically parses and orders shift blocks (e.g. 00:00-04:00, 04:00-08:00) chronologically based on their start hour.
  - **Tailored Aesthetics**: Renders bars with linear color gradients (`var(--primary)` to `var(--secondary)`), explicit counts on top of bars, grid division overlays, and hover-triggered tooltip titles.

### 3.47 Subcontractor Performance Grouped Vertical Bar Chart
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 3.23)
* **Description**: A grouped vertical SVG bar chart comparing Completed Ritase against Target Shift Goals for active subcontractors.
* **Key Capabilities**:
  - **Grouped Comparison Representation**: Side-by-side vertical bars displaying Actual Completed Cycles (cyan gradient) vs Target Expected Goal (slate border and transparent fill) for each subcontractor.
  - **Dynamic Y-Axis Scaling**: Automatically scales Y-axis grid markers and count labels based on the maximum completed/goal value.
  - **Interactive Selection Filters**: Provides interactive checkbox toggles above the chart letting operators filter contractors dynamically from the comparison view.
  - **Explicit Value Labels**: Displays precise count labels on top of each bar along with details on hover.

### 3.48 Subcontractor Compliance Gantt Timeline
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 3.24)
* **Description**: Horizontal Gantt-style status timeline representing hourly contractor compliance target achievements over the last 12 hours.
* **Key Capabilities**:
  - **Horizontal Gantt Track Rows**: Renders a dedicated horizontal swimlane row for each subcontractor showing timeline status segments.
  - **Color-Coded Status Segments**: Segments represent hourly cycles colored dynamically: Green for Exceeded Target (>=100%), Cyan for Met Target (80-99%), and Red for Below Target (<80%).
  - **Interactive Filter Legends**: Includes legends under the chart allowing operators to click contractor names to toggle/hide them dynamically from timeline representation.
  - **Tooltip Descriptions**: Provides details showing contractor, time slot, and exact percentage values on segment hover.

### 1.25 Telemetry Tower Network Health Watchdog API
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 1.25)
* **Description**: Backend network watchdog service that computes average checkin latency over a rolling 5-minute window to identify and alert on network degradation.
* **Key Capabilities**:
  - **Rolling 5-Minute Window Evaluation**: Filters recent logs in the telemetry buffer to find active tower checkins over the past 5 minutes.
  - **Latency Degradation Warning Trigger**: Evaluates latency against a baseline standard of 100ms. If average latency exceeds the baseline by >15% (>115ms), flags status as degraded.
  - **Redundant Dispatches & WebSockets Broadcast**: Saves warning notifications into the database dispatch logs, triggers email/SMS simulator alerts, and broadcasts events in real-time over WebSockets to client frontends.

### 1.26 Database Automated Compression Integrity Checker
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 1.26)
* **Description**: Automatic database backup validation routine running post-compression SQLite integrity check to verify backup correctness.
* **Key Capabilities**:
  - **Decompression Verification Check**: Automatically decompresses each gzipped SQLite backup file (`backup_*.db.gz`) immediately following creation into a isolated temporary workspace.
  - **PRAGMA integrity_check Query**: Initiates SQLite engine structure verification queries on the decompressed target.
  - **Dispatches & Alerts Dispatch**: On verification failure, logs details under `db_backup_corrupt` inside system audit logs, registers SMS/Email dispatch alerts, and alerts operators immediately via WebSockets.
  - **Audit Trails**: Logs validation success and health checks under action `db_auto_backup` in audit logs.

### 1.27 Automated Vehicle Shift Load Warning Service
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 1.27)
* **Description**: Backend analysis service tracking and validating individual OHT shift hauling cycle counts (ritase) to alert on potential duplicate records or data entries.
* **Key Capabilities**:
  - **Shift Boundary Tracking**: Resolves standard open-pit mining shift ranges dynamically: Day Shift (06:00 to 18:00) and Night Shift (18:00 to 06:00).
  - **Completed Cycle Calculations**: Extracts non-duplicate crossings within the active shift and computes completed ritase cycles based on alternating direction transitions (Inbound -> Outbound).
  - **Cycle Threshold Anomaly Warning**: If a single vehicle exceeds 20 completed ritase in the current shift, dispatches SMS and email warnings, logs entries in system dispatches, and alerts operators over WebSocket.
  - **Verification Endpoint**: Provides a POST trigger at `/api/reports/oht-overload-check` allowing supervisors to run checks and audit counts on demand.

### 2.25 Interactive Grid Visualization Filter Toggle
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 2.25)
* **Description**: Real-time direction-based filter toggles on the main dashboard feed allowing operators to filter crossings by Inbound vs Outbound hauling lanes.
* **Key Capabilities**:
  - **Dynamic Card Attributes**: Injects `data-direction` metadata dynamically onto each real-time crossing feed card rendered in the list/grid layouts.
  - **Lane Direction Checkbox Group**: Visual checkbox options ("Inbound" and "Outbound") nested underneath the class filters bar.
  - **Master Filter Integration**: Cooperates with existing search queries, quick tags (unregistered/low confidence), and class filter inputs to compute crossing visibility instantly.
  - **Standard Reset Syncing**: Fully supported by the filter clean/reset routine (`btn-reset-filters`), reverting checkboxes to fully enabled status on request.

### 2.26 Database Backup Log History Download Drawer
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 2.26)
* **Description**: Dedicated database backup history dashboard slider drawer allowing administrators to manage, download, and restore gzipped SQLite backups on-demand.
* **Key Capabilities**:
  - **Dynamic Backups List API**: New `GET /api/admin/db-backups` route scans the hauling database storage folder and lists all `backup_*.db.gz` file sizes and timestamps in descending order.
  - **Ad-hoc Backup Creation**: Integration button at top of drawer triggering POST request to `/api/admin/db-backup` to run instant, gzip-compressed database snapshots.
  - **Compressed File Downloading**: Provides FileResponse downloads of gzipped backup files directly via `GET /api/admin/db-backups/{filename}`.
  - **Safe Database Restores**: POST endpoint `/api/admin/db-backups/{filename}/restore` decompresses the backup target, validates internal SQLite structure using `PRAGMA integrity_check`, performs online backup copy to the main DB file, and records events in audit logs.
  - **Drawer Mutual Exclusion**: Automatically shuts other drawers (Alerts/Settings) when opened to prevent layout overlap.

### 2.27 Telemetry Tower Signal Status Indicators
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 2.27)
* **Description**: Real-time UHF and LTE signal status visual bar indicators rendered next to skid tower label pins on the operational map view.
* **Key Capabilities**:
  - **4-Bar Signal Indicators**: Computes active signal bars and strength levels from telemetry SNR data dynamically: UHF (Excellent: >=25, Good: >=18, Moderate: >=12, Poor: <12) and LTE (Excellent: >=28, Good: >=20, Moderate: >=14, Poor: <14).
  - **Dynamic Color-Coding**: Displays signal bars using standard HSL/RGBA palettes: Green for Excellent/Good, Orange/Yellow for Moderate, Red for Poor, and Gray for offline towers.
  - **Descriptive Hover Tooltips**: Provides detailed tooltips showing the current signal type and exact SNR value on hover.

### 3.25 Contractor Hourly Efficiency Comparison Heat Grid
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 3.25)
* **Description**: Interactive 2D matrix/table comparing hourly ritase (hauling cycle) efficiency for each contractor across 4-hour shift blocks.
* **Key Capabilities**:
  - **4-Hour Shift Blocks Partitioning**: Organizes daily hauling timeline into six distinct 4-hour blocks: `02:00-06:00`, `06:00-10:00`, `10:00-14:00`, `14:00-18:00`, `18:00-22:00`, and `22:00-02:00`.
  - **Hourly Efficiency Computation**: Computes efficiency as completed cycles divided by hours in block (e.g. cycles / 4.0 hours) for each contractor over a rolling 24-hour window.
  - **Heat Color-Coding**: Color-codes cells using a heat map aesthetic: Dark Gray for no activity, Red for low efficiency (<= 0.5 rit/hr), Yellow for moderate efficiency (<= 1.5 rit/hr), and Green for high efficiency (> 1.5 rit/hr).
  - **Responsive Matrix Table**: Renders a clean grid list displaying both calculated efficiency values and total cycle counts in the Reports tab.

### 3.26 Daily Cycle Duration Outlier Scatter Plot
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 3.26)
* **Description**: High-fidelity scatter plot visualizing OHT cycle durations over a rolling 24-hour window, highlighting statistical anomalies.
* **Key Capabilities**:
  - **Standard Deviation Outlier Flagging**: Computes statistical mean and standard deviation of cycle durations, marking any cycle deviating by >2.0 standard deviations from the average as an outlier.
  - **Pulsing Outlier Visualization**: Scatter dots for outliers pulse with a red halo using native SVG animations to alert operators.
  - **Detailed Hover Information**: Displays Hull ID, duration in minutes, completion time, and contractor name on dot hover.

### 3.27 Subcontractor Target Compliance KPI Summary Widget
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 3.27)
* **Description**: Real-time aggregated subcontractor compliance dashboard summary widget showing actual cycles completed vs target thresholds.
* **Key Capabilities**:
  - **Grouped KPI Display**: Displays subcontractor performance cards with completed ritase, actual vs target hourly rates, and compliance percentages.
  - **Subcontractor Status Lights**: Small status lights showing Green for optimal compliance (>= 80%), Yellow for warning compliance (50-79%), and Red for critical compliance (< 50%).
  - **Master System Status Lamp**: Header status light that aggregates overall subcontractor health (Green only if ALL contractors meet targets, otherwise Yellow or Red).

### 1.28 Automated Telemetry Night Shift Battery Drain Diagnostic Service
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 1.28)
* **Description**: Automated battery discharge diagnostic routine running checks on skid tower night shift battery drain rates.
* **Key Capabilities**:
  - **Night Shift Window Filtering**: Analyzes telemetry history checks between the hours of `18:00` and `06:00` UTC.
  - **Hourly Discharge Rate Calculation**: Computes the decline rate of battery percentage per hour over night shift.
  - **High-Frequency Discharge Alerts**: Triggers alerts, logs dispatches (SMS/Email), and broadcasts events to WebSockets if the battery drain rate exceeds 5.0% per hour.
  - **On-Demand Diagnostic Trigger**: Exposes a POST endpoint `/api/telemetry/battery-diagnostic` to trigger night shift battery health audits instantly.

### 1.29 Subcontractor Compliance Email Summary Scheduler
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 1.29)
* **Description**: Automated email scheduling and reporting service that packages shift compliance statistics and hourly efficiency grid matrices to supervisors.
* **Key Capabilities**:
  - **Comprehensive Data Compilation**: Integrates active contractor targets, completed shift ritase, compliance metrics, and the 2D hourly efficiency comparison heat grid.
  - **Supervisor Email Dispatch**: Renders high-fidelity styled HTML emails containing formatted tables, color-coded cells, status badges, and details.
  - **Database Dispatch Logging**: Stores the generated HTML body, channel type, recipient address, and dispatch timestamp in the system's database logs.
  - **Live WebSocket Alert Notifications**: Broadcasts a system alert packet to trigger real-time operational dashboard notifications when reports are dispatched.

### 1.30 Database Performance Index Optimization Advisor
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 1.30)
* **Description**: Database index performance advisor that dynamically checks, creates, and optimizes indices to guarantee high-performance query execution.
* **Key Capabilities**:
  - **Dynamic Index Checking**: Audits `sqlite_master` to inventory existing indices on the primary tables.
  - **Auto-Provisioning of Missing Indices**: Creates missing indexes on query-critical columns (`hull_id`, `timestamp`, `mode`, `lane`).
  - **Statistics Optimization & Reindexing**: Runs `REINDEX crossings` and `ANALYZE crossings` to rebuild index trees and refresh the SQLite optimizer.
  - **Query Performance Benchmarking**: Compares query execution durations before and after optimization, returning calculated speedups.
  - **Audit Logging**: Inserts detailed optimization event entries into the database audit trail.

### 2.28 Mobile-Responsive Dashboard Layout Toggle
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 2.28)
* **Description**: Mobile-responsive layout override toggle optimizing the operational dashboard, maps, live feeds, and telemetry grids for touch devices and small viewports.
* **Key Capabilities**:
  - **Single-Column Stacking Overrides**: Automatically collapses the sidebar, grid systems, split audit view, and map container to single-column blocks in mobile mode.
  - **Large Touch Target Sizing**: Increases minimum touch targets for buttons, selectors, switches, and list elements to at least 40px to prevent mis-clicks.
  - **Dynamic Elements Adaptability**: Scales telemetry indicators, hides secondary columns/specs, and limits map height to maximize viewport utility.
  - **State Persistence & Auto-Detection**: Saves the responsive mode setting to `localStorage`, automatically enabling it below 768px while allowing explicit user override toggle control.

### 2.29 Visual Interactive Guide Popup Tutorial
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 2.29)
* **Description**: Visual interactive tutorial modal that details core dashboard controls, map features, compliance summaries, and search tools for new operator onboarding.
* **Key Capabilities**:
  - **Dynamic Modal Construction**: Programmatically creates and appends styled guide overlay containers without bloat in the main page document.
  - **Multi-Slide Guide Carousel**: Walks users through exactly 3 onboarding slides covering remote tower telemetry signal bars, subcontractor target compliance status indicator lights, and live visual audit panels.
  - **First-Time Automatic Triggering**: Automatically prompts onboarding popup for operators on first-time login via `localStorage` state checks.
  - **Manual Guide Replay**: Provides a custom sidebar button link allowing supervisors or operators to replay the guide on-demand.

### 2.30 Live Audio Warning Voice Synthesizer Alert
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 2.30)
* **Description**: Live audio speech synthesis alert system using the Web Speech API to read aloud critical warnings (low confidence OCR and low battery conditions) to operators.
* **Key Capabilities**:
  - **Speech Synthesis Integration**: Leverages Web Speech API (`window.speechSynthesis`) to speak alarms clearly using built-in high-quality English voices.
  - **UHF/LTE Battery Warning Detection**: Translates raw skid tower status anomalies and low battery events into spoken system announcements.
  - **Low Confidence OCR Notifications**: Reads low confidence crop alerts to operators instantly, facilitating immediate visual verification.
  - **Anti-Spam Alert Debouncing**: Implements a 30-second deduplication cache preventing the system from repeating the same voice prompt repeatedly.
  - **Supervisor Override Switch**: Integrates a Config Overrides switch allowing voice prompts to be enabled or disabled with state saved to `localStorage`.

### 3.28 Subcontractor Compliance Progress Timeline Anomaly Alert
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 3.28)
* **Description**: Subcontractor compliance timeline anomaly alert flagging and highlighting contractors who maintain low compliance (<50%) for 3 consecutive hours.
* **Key Capabilities**:
  - **Consecutive Hourly Scan**: Evaluates 12-hour subcontractor timeline records for 3 consecutive segments below 50% compliance.
  - **High-Severity Discrepancy Alerting**: Automatically logs a critical discrepancy and issues websocket notifications on anomaly detection.
  - **Gantt Highlight Indicators**: Prefixes row labels with a hazard icon (`⚠️`) and draws a red-dashed border around anomalous timeline rect blocks.

### 3.29 Subcontractor Hauling Cycle Speed Variance Chart
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 3.29)
* **Description**: Interactive Gantt-style speed variance chart visualizing standard deviation, mean, and range of hauling trip durations per subcontractor.
* **Key Capabilities**:
  - **Dynamic Volatility Classification**: Measures coefficient of variation to classify subcontractors into Low Volatility (stable, <18%), Moderate Volatility (18-35%), or High Volatility (>35%, colored red).
  - **Standard Deviation & Range Bars**: Renders horizontal bars representing the `[Mean - SD, Mean + SD]` range, alongside thin line markers representing `[Min, Max]` extremes.
  - **Mean Trip Markers**: Places a central white marker representing the average duration for each contractor.
  - **Interactive Data Tooltips**: Shows the exact trip count, mean trip duration, and volatility status on element hover.

### 3.30 Subcontractor Shift-Target Forecast Predictions Widget
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 3.30)
* **Description**: Real-time contractor shift-target forecast widget calculating linear rolling projections of completed ritase by shift end.
* **Key Capabilities**:
  - **Rolling Average Linear Model**: Multiplies current hourly hauling rates by remaining shift hours, adding existing counts to project total cycles.
  - **Status Track Indicators**: Color-codes forecasts dynamically: Green for On Track, Orange/Yellow for At Risk, and Red for Behind target.
  - **Active Fleet Metrics**: Shows active fleet sizes and actual productivity rates alongside target bounds.

### 1.31 Automated Telemetry Multi-Sensor Anomaly Detection Service
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 1.31)
* **Description**: Automated telemetry multi-sensor anomaly detection API correlating solar array charging metrics with battery depletion patterns.
* **Key Capabilities**:
  - **Solar Charging Failure Detector**: Flags when average solar charging output drops below 20W during daylight hours while battery levels drop.
  - **Controller Failure Detector**: Identifies charge controller degradation if solar output exceeds 40W but battery continues to drain.
  - **Rapid Discharge Tracker**: Detects hourly battery drops exceeding 5% to identify potential short-circuits.
  - **Audit Logging & Deduplication**: Logs identified telemetry anomalies to the SQLite database audit trail with automatic hourly event deduplication checks.

### 1.32 Subcontractor Geo-Fencing Route Violation Detection Service
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 1.32)
* **Description**: Geo-fencing and speed segment analytics engine flagging OHT vehicles traversing checkpoints faster than physical route constraints allow.
* **Key Capabilities**:
  - **Transit Time Segmentation Analysis**: Computes segment durations between check gates (e.g. North Checkpoint to Main Portal) against physical limits (e.g., 5-minute minimum).
  - **Auto-logging Audit Trails**: Automatically saves speed and shortcut violations to the SQLite audit log table, with checks to prevent duplicate logging.
  - **Infraction Reporting**: Exposes route infraction logs dynamically via the GET `/api/admin/reports/route-violations` REST endpoint.

### 1.33 Database Backup FIFO Rotation Auto-Cleaner
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 1.33)
* **Description**: Database backup watchdog task enforcing age-based retention limits and disk-capacity FIFO rotation.
* **Key Capabilities**:
  - **7-Day Retention Enforcer**: Automatically scans the backup directory and prunes backup files matching `backup_*.db.gz` older than 7 days.
  - **Storage Watchdog Guard**: Tracks free disk space and triggers FIFO (First-In, First-Out) rotation to prune the oldest database backups when free space is under 50MB.
  - **Audit Logging Records**: Saves backup cleanup details to the system audit trail.
  - **Manual Trigger Endpoint**: Exposes a POST `/api/admin/backups/prune` route allowing supervisors to manually run disk safety cleanup.

### 2.33 Interactive Visual Light/Dark/Neon Cyberpunk Theme Toggle
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 2.33)
* **Description**: Multi-theme switch controller supporting Dark (Slate-Blue), Light, and neon Cyberpunk color styles.
* **Key Capabilities**:
  - **CSS Variables Injection**: Switches theme color parameters, shadows, and neon glows dynamically.
  - **Local Persistence**: Saves selected theme state in `localStorage` to preserve settings on browser load.
  - **Dynamic Toggle Button**: Rotates button text and icons to indicate active modes.

### 3.31 Subcontractor Shift-Target Forecast Deviation Alert Banner
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 3.31)
* **Description**: Real-time forecast monitoring alert banner prompting warnings if contractor projected shift ritase drops below 75% of targets.
* **Key Capabilities**:
  - **Automated Target Check**: Scans active rolling projections and compares expected total ritase with target bounds.
  - **Color-Coded Severity Banners**: Renders a warning-orange banner for projected drops below 75% of target, and a danger-red banner for drops below 50%.
  - **Interactive Close Trigger**: Includes a quick-close button allowing supervisors to dismiss the banner until the next crossing data update.

### 3.32 Subcontractor Dispatch Discrepancy Heat Grid
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 3.32)
* **Description**: Hourly heat grid layout comparing count of active shift fleet vehicles against completed ritase to identify subcontractor utilization issues.
* **Key Capabilities**:
  - **Hourly Block Aggregator**: Breaks down active haulage statistics into 1-hour intervals for the last 6 hours.
  - **Dynamic Fleet Watcher**: Counts unique registered vehicles actively hauling during each block to measure exact operator mobilization.
  - **Utilization Heat-Map Coding**: Applies conditional styling (Green for >= 90% utilization, Orange for 50-90%, Red for < 50%, Slate for idle) to highlight dispatch issues immediately.
  - **Detailed Context Tooltips**: Exposes precise truck counts, completed cycles, and utilization percentages on grid cell hover.

### 3.33 PDF Report Custom Branding Designer
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 3.33)
* **Description**: Custom input fields allowing supervisors to specify custom client names and logo image URLs to dynamically render in printed shift report summaries.
* **Key Capabilities**:
  - **Dynamic Input Fields**: Exposes custom text inputs for Client Name and URL inputs for Logo Images inside the PDF print settings modal.
  - **Responsive Header Injector**: Automatically updates the print-only document header structure inside the print preview page iframe before triggering the system print dialogue.
  - **CSS Image Containment**: Wraps printed logos inside a max-height and aspect-ratio helper to ensure clean alignments on standard A4 layout pages.

### 2.32 Database Restore Task Progress Bar
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 2.32)
* **Description**: Real-time progress bar rendering decompression and restoration phases of a database backup restore via Server-Sent Events.
* **Key Capabilities**:
  - **Asynchronous Restorer Execution**: Dispatches database recovery tasks to background worker threads to avoid blocking FastAPI workers.
  - **Dual-Phase Progress Aggregation**: Streams progress data divided between decompression/extraction (from 5% to 50%) and SQLite page copying (from 60% to 100%).
  - **Server-Sent Events Stream**: Uses SSE endpoint `/api/admin/db-backups/restore-progress` to broadcast JSON status packets to active operator drawers.
  - **Interactive Transition Controls**: Renders a glowing progress loader container in the backup drawer, closing connections upon successful recovery or error triggers.

### 1.34 Database Integrity Check Cron Service
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 1.34)
* **Description**: Weekly background watchdog thread executing structural database integrity verifications and reporting diagnostic logs to system audit records.
* **Key Capabilities**:
  - **Weekly Verification Loop**: Daemon worker thread executing SQLite integrity verifications automatically once every 7 days.
  - **Audit Logging Alerts**: Automatically saves detailed structural failure alerts or success verifications directly into the SQLite logs.
  - **Manual Check Endpoint**: Exposes a GET `/api/admin/db/integrity-check` REST route enabling direct supervisor check triggers on demand.

### 1.35 Admin API Rate Limiter Middleware
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 1.35)
* **Description**: Globally applied API middleware restricting sequential requests to admin endpoints to 10 requests per minute per IP address.
* **Key Capabilities**:
  - **Dynamic Route Interceptor**: Automatically monitors all HTTP endpoints starting with the `/api/admin` prefix.
  - **IP-Based Sliding Window**: Keeps track of client IP addresses and rolling request timestamps over a 60-second sliding window.
  - **Rate Limit Restriction Banner**: Instantly blocks requests exceeding 10 per minute and returns a clean `HTTP 429 Too Many Requests` JSON response.

### 1.36 Subcontractor Haulage Payload Estimation API
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 1.36)
* **Description**: REST API route calculating estimated total payload tonnage hauled per subcontractor during the current operational shift.
* **Key Capabilities**:
  - **Dynamic Capacity Map**: Maps registered vehicle hull models (e.g. CAT 777D, CAT 785) to standard haulage capacity tonnage metrics.
  - **Shift Aggregator**: Filter crossings by active shift duration limits to compute exact trip sequences per vehicle.
  - **Estimated Tonnage Exporter**: Exposes calculated metrics via the `GET /api/reports/subcontractor-payload` JSON endpoint, listing subcontractor totals and vehicle-by-vehicle cargo breakdowns.

### 2.34 Operator Action Undo/Redo Toast Notifier
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 2.34)
* **Description**: Interactive toast alerts enabling operators to undo vehicle registration corrections or layout mode switches within a 5-second grace window.
* **Key Capabilities**:
  - **Grace Window Countdown**: Displays a 5-second countdown timer, automatically dismissing and committing the action if not canceled by the operator.
  - **Single-Click Undo Button**: Features a primary "Undo" button executing rollback logic and restoring the preceding state.
  - **Visual Success State**: Transforms toast status directly to an "Action undone successfully" notice upon successful restoration.

### 2.35 Customizable Grid Layout Configuration Drawer
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 2.35)
* **Description**: User layout setting control drawer enabling operators to customize visibility and sequence order of dashboard metric cards.
* **Key Capabilities**:
  - **Grid Configuration Controls Drawer**: Side slide-out panel containing card checkboxes and up/down movement arrows.
  - **Dynamic DOM Node Reordering**: Renders and reorders metrics elements on the fly in the DOM tree based on configuration priorities.
  - **Reversion and Undo Integration**: Integrates directly with `localStorage` preferences and the undo/redo toast notifier system to allow instant rollbacks.

### 2.36 Database Backups Visual Timeline Chart
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 2.36)
* **Description**: Interactive canvas-based line chart displayed inside the database backups drawer showing backup sizes and timestamps.
* **Key Capabilities**:
  - **HTML5 Canvas Plotter**: Renders a custom vector-based graphic timeline visualization without loading bloated third-party charting libraries.
  - **Backup Size Trends Line**: Draws an emerald glowing path connecting backup events, helping supervisors visualize data expansion rate trends.
  - **Start/End Date Anchors**: Dynamically labels start and end timestamps at the base of the visualization path.

### 3.34 Subcontractor Hourly Target Deviation Comparison Chart
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 3.34)
* **Description**: Interactive side-by-side SVG bar chart displayed in the reports dashboard comparing expected hourly target rates vs actual hourly completed ritase.
* **Key Capabilities**:
  - **Side-by-Side Target-Actual Comparison**: Displays blue (actual) and purple (target) bar elements next to each other for immediate performance evaluation.
  - **Dynamic Deviation Calculation**: Calculates and renders positive/negative (green/red) deviation values (e.g. "+0.2 rit/hr" or "-0.3 rit/hr") directly below each contractor.
  - **Fully Integrated Custom Layouts**: Seamlessly registers with the user layout manager to support visibility and drag-and-drop order configuration.

### 3.35 Shift Hand-over Digital Signature Verification
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 3.35)
* **Description**: Secure digital signature verification module embedded inside the supervisor reports section enabling cryptographic shift validation seals.
* **Key Capabilities**:
  - **Operator Hand-over Consent**: Adds an interactive toggle checkbox demanding active operator approval before generating shift sign-off hashes.
  - **Standard SHA-256 Signature Generator**: Leverages the browser Web Crypto API to securely hash the report data (including total ritase, signature text, and exact timestamps).
  - **Verified Signature Seal**: Renders a glowing verification box containing the cryptographic token string (`SIG-SHA256-...`) upon successful operator sign-off.
  - **Local Persistence**: Automatically remembers signature states and validated seals across session updates and page refreshes.

### 3.36 Subcontractor Dispatch Efficiency Leaderboard
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 3.36)
* **Description**: Live subcontractor leaderboard displaying dispatch efficiency ranks calculated from weighted target compliance and active fleet utilization.
* **Key Capabilities**:
  - **Dynamic Rank Medal Markers**: Automatically prefixes ranks with visual medals (🏆, 🥈, 🥉) or ordinal numbers for clean categorization.
  - **Weighted Efficiency Performance Score**: Uses a 60/40 weighted formula to compute performance scores out of 100 based on targets and fleet ratios.
  - **Color-Coded Status Tags**: Renders efficiency scores with color-coded alerts (green/warning/danger) matching critical thresholds.
  - **Fully Integrated Custom Layouts**: Seamlessly registers with the user layout manager to support visibility and drag-and-drop order configuration.

### 1.37 Contractor Haulage Cycle Anomaly Alert Service
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 1.37)
* **Description**: Backend analytical service monitoring haulage cycle durations for dump trucks to flag speed anomalies.
* **Key Capabilities**:
  - **Dynamic Duration Calculator**: Automatically parses consecutive inbound and outbound crossings per vehicle to measure travel durations.
  - **Speed Alert Thresholds**: Flags cycles under 15 minutes as abnormally fast (potential speed violations) and cycles exceeding 120 minutes as abnormally slow (delays/breakdowns).
  - **Integrated Audit Trail**: Populates alerts directly to the subcontractor discrepancies feed with appropriate severity ratings (medium for speed, low for slow completion).

### 1.38 Database Query Cache Middleware
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 1.38)
* **Description**: Memory-based 15-second TTL cache middleware protecting database access from heavy operator telemetry polling.
* **Key Capabilities**:
  - **In-Memory Cache Cache Store**: Temporarily buffers calculated telemetry summaries in local process memory instead of re-querying the SQLite DB.
  - **15-Second Time-To-Live (TTL)**: Automatically invalidates cached data blocks after 15 seconds to ensure operators receive reasonably fresh analytics.
  - **Cache Pruning and Reset Bindings**: Automatically purges the cached buffer if a simulation override is configured or cleared.

### 1.39 Automated End-of-Shift Email Report Distribution Service
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 1.39)
* **Description**: Automated end-of-shift background scheduler compiling HTML reports and distributing them to subcontractor supervisor emails.
* **Key Capabilities**:
  - **Background Daemon Scheduler**: Starts a background thread checking configured settings and automatically running distribution tasks.
  - **Dynamic Configuration Schema**: Supports GET and POST endpoints for `/admin/reports/email-schedule-settings` to toggle schedule triggers, recipient emails, and interval timing.
  - **Rich HTML Summary Content**: Combines subcontractor compliance indicators and hourly efficiency heat grids dynamically into the email report payload.

### 2.37 Database Backup Statistics Dashboard
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 2.37)
* **Description**: Interactive database backup statistics panel integrated directly into the operator backups drawer.
* **Key Capabilities**:
  - **Growth Rate Indicator**: Chronologically analyzes backup log history to calculate and display file growth sizes and percentages.
  - **Average Backup Size**: Computes the mean size of stored backups to evaluate storage metrics.
  - **Total Storage Utilization**: Aggregates total database storage consumption history for clear disk space budgeting.

### 2.38 Live Gate Lane Camera Feeds Grid Panel
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 2.38)
* **Description**: Expandable/collapsible dashboard container hosting interactive simulated CCTV feeds for each checkpoint gate lane.
* **Key Capabilities**:
  - **Dynamic Video Stream Simulation**: Custom HTML5 canvas engines drawing simulated real-time video frames with scrolling scanlines and noise animations.
  - **Rec Blinking Dot Indicators**: Renders standard red blinkers to represent live recording statuses across lanes.
  - **Live OCR Detection Overlays**: Automatically generates bounding boxes with vehicle classification overlays (DT or LV) when simulated vehicles cross camera frames.

### 2.39 Interactive Discrepancy Classification Filters
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 2.39)
* **Description**: Pill-styled interactive classification filters allowing operators to filter discrepancy records by specific categories.
* **Key Capabilities**:
  - **Pill-Styled Toggles**: Highlights selected filter categories with intuitive, themed color tags.
  - **Category Classification Matching**: Filters records into Speed/Cycle anomalies, Target Compliance warnings, and Route Violations.
  - **Dynamic List Refreshes**: Triggers automatic list redraws as soon as an operator toggles the filter.

### 3.37 Contractor Active-Fleet-Capacity Forecasting Line Chart
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 3.37)
* **Description**: Interactive SVG line chart embedded inside forecast cards representing the predicted active fleet needed over the next 12 hours.
* **Key Capabilities**:
  - **Dynamic SVG Vector Line Drawing**: Automatically scales coordinates to plot fleet size trends based on current contractor compliance rates and target numbers.
  - **Sinusoidal Capacity Variances**: Models operational fluctuations (such as night shift changes and efficiency shifts) to output high-fidelity predictions.
  - **Interactive Hover Tooltips**: Renders SVG nodes indicating expected vehicle counts upon user pointer hover.

### 3.38 Interactive Report Printing Layout Settings
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 3.38)
* **Description**: Real-time interactive print preview overlay with sliders to adjust fonts, cell spacing, and margins dynamically.
* **Key Capabilities**:
  - **Dynamic Sidebar Slider Controls**: Renders range sliders for Font Size and Cell Padding, dynamically compiling style overrides into the preview iframe.
  - **Orientational Flow Selection**: Supports toggling document layouts between Portrait and Landscape orientations dynamically.
  - **Real-Time Visibility Toggles**: Live checkboxes syncing column visibility overrides instantly between the operator UI, preview document, and physical printer.

### 3.39 Subcontractor Dispatch Leaderboard Sparkline Ranking Timeline
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 3.39)
* **Description**: Embedded SVG sparkline inside leaderboard cards tracking contractor rank variations over the last 12 hours.
* **Key Capabilities**:
  - **Inverted Scaling Coordinate Mapping**: Correctly maps rank 1 to the top and rank 3 to the bottom of the SVG line canvas.
  - **Deterministic Trend Graphing**: Computes deterministic chronological sequences based on contractor compliance metrics to render realistic trends.
  - **Themed Color Schema**: Render lines and nodes using themed palette color styling for seamless integration.

### 1.40 Automated Database Schema Migration Manager
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 1.40)
* **Description**: Backend schema manager maintaining database structural versions programmatically with transaction rollback support.
* **Key Capabilities**:
  - **Schema Version Verification**: Exposes a GET `/admin/db/migrations` endpoint listing applied vs pending schema version updates.
  - **Programmatic Migration Applier**: Exposes a POST `/admin/db/migrations/apply` endpoint running pending SQL queries sequentially.
  - **Transaction Rollback Protection**: Automatically wraps migration execution inside database transaction rollbacks to prevent partial schema state failures.

### 1.41 API Payload Compression Middleware
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 1.41)
* **Description**: Backend Gzip compression middleware intercepting and compressing large API JSON responses.
* **Key Capabilities**:
  - **Bandwidth Usage Optimization**: Automatically applies standard Gzip algorithm to compress response bodies.
  - **10KB Minimum Compression Threshold**: Restricts compression triggers strictly to responses over 10,240 bytes to prevent extra CPU latency overhead on small payloads.
  - **Seamless Browser Decompression**: Integrates natively with all modern browsers using standard `Content-Encoding: gzip` headers.

### 1.42 System Load Monitoring Endpoint
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 1.42)
* **Description**: Diagnostic FastAPI endpoint returning real-time server load statistics and database storage footprints.
* **Key Capabilities**:
  - **Server Resource Telemetry**: Exposes `GET /api/system/health` returning server CPU, RAM, and disk utilization percentages.
  - **Dynamic DB Storage Footprint**: Calculates and formats the database file size dynamically in appropriate units (e.g. KB, MB, GB).
  - **Disk Mount Target Analysis**: Resolves disk usage parameters specifically for the mount volume holding the SQLite database files.

### 2.40 Telemetry Status Notification Sound Manager
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 2.40)
* **Description**: Custom interactive telemetry sound alerts manager in the settings panel that plays specific beep tone sequences on remote skid tower events.
* **Key Capabilities**:
  - **State Transition Watcher**: Tracks state differences across telemetry status polls to play beeps only on transition events.
  - **Customized Audio Alerts**: Implements unique Web Audio synthesizer beep tones for Low Battery (sawtooth descending E4 to C4), Charging Failures (triangle/sine pulsing beat frequency), and Offline Towers (sine triple beep).
  - **Independent Toggle Switches**: Adds dedicated checkboxes inside the Configuration drawer to toggle each telemetry alarm sound independently.

### 2.41 Interactive Map Zone Crossing Highlights
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 2.41)
* **Description**: Real-time interactive animations of SVG map zone circles (Loading, Dumping, and Haul Road) when new crossings are registered on associated lanes.
* **Key Capabilities**:
  - **Live WebSocket Triggers**: Captures new crossing events directly from the WebSocket feed to trigger highlights in real time.
  - **Themed Pulsing Transitions**: Adds a CSS class-based transition that temporarily scales up the SVG circle element, glows with the primary theme color, and applies a drop-shadow.
  - **Map Style Compatibility**: Works seamlessly across all map view options (Schematic, Outline, Heatmap), automatically transitioning back to the correct baseline layout style.

