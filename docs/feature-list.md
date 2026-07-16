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

---

## 2. Web Application Frontend

### 2.1 Supervisor Operations Dashboard UI
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 2.1)
* **Description**: A premium, responsive single-page dashboard UI built with HTML5, Vanilla CSS, and JavaScript. It provides real-time situational awareness and administrative controls for mobile gate skids.
* **Key Capabilities**:
  - **KPI Dashboard**: Displays real-time operational statistics, including total crossings, active fleet size, unrecognized vehicle warnings, and lane traffic distribution.
  - **Live Ingest Form**: Supports drag-and-drop or select video file uploading, displaying real-time loading feedback while running the backend OCR pipeline.
  - **Sample Video Selection & Preview Layout**: Dynamically queries available videos from the playlist storage, displays a preview of the selected video, and presents the OCR extraction progress and results side-by-side next to the playing video.
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




---

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
  - **Visual Print-Friendly Shift Slots Summary Cards**: Displays 4-hour block shift distributions as grid-based visual summary cards instead of simple bars. Each card contains shift block hours, passage counts, relative progress, and print directive rules (`break-inside: avoid; page-break-inside: avoid;`) to prevent layout splitting across PDF pages.


### 3.2 Data Reconciliation, CSV Export, & Cloud Sync Mockup
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 3.2)
* **Description**: Interactive query toolbar allowing supervisors to filter, reconcile records, download CSV sheets, and trigger a cloud synchronization status indicator.
* **Key Capabilities**:
  - **Dynamic Client Search**: Instantly filters OHT haulage tables and discrepancy alerts by vehicle code or lane.
  - **Reconciliation CSV Exporter**: Generates a standard compliance-ready CSV log file, preserving user search queries and lane filters.
  - **HQ Cloud Sync Mockup**: Triggers a simulated synchronization request to a central headquarters database, returning transaction logs and updating status latency.
  - **Multi-Lane Discrepancy Checkbox Filters**: Adds an interactive sub-panel immediately above the Subcontractor Discrepancies listing, permitting supervisors to filter alerts by specific lanes or contractor names using checkbox controls.
  - **Dynamic Contractor Checkboxes**: Regenerates contractor list checkboxes dynamically by evaluating active registered fleet data and actual logged alert entities.
  - **Print Layout Retention**: Hides the filter checkbox toolbar (`#disc-filters`) on print outputs using print CSS media configurations, while retaining the filtered state of subcontractor alert cards on the printed/PDF document.

### 3.3 Remote Gate Skid Status & Telemetry Panel
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 3.3)
* **Description**: Live operations panel representing solar-powered remote edge skid tower health.
* **Key Capabilities**:
  - **Dynamic Sensor Polling**: Periodically fetches and animates battery percentage, solar panel generation levels, and network ping latency for deployed towers (Alpha, Beta, Gamma).
  - **Color-Coded Status Warnings**: Flags battery dips and elevated latency levels (e.g. warning status indicators for Tower-Gamma).
  - **Telemetry Trend Time-Interval Selector**: Equips the trends modal window with quick selector buttons (6H, 24H, 7D) that dynamically regenerate the SVG line charts representing hourly battery charging and solar array fluctuations over the chosen period.
  - **Dynamic Threshold Configuration**: Exposes `POST /api/telemetry/thresholds` to persist custom warning configurations (such as low battery limit, low solar output, and latency maximum levels) directly to the database. These configured parameters govern real-time anomaly checks and visual alarms.
  - **Compact KPI Widgets**: Integrated directly under the operational workspace on the main dashboard tab.

### 3.4 Subcontractor Ritase Allocation Donut Chart
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 3.1)
* **Description**: Interactive donut visualization showing cycles performed by each subcontractor to audit contractor productivity.
* **Key Capabilities**:
  - **Dynamic Conic-Gradient Generation**: Computes contractor percentages and draws segments dynamically using standard CSS gradients.
  - **Interactive Legend Panel**: Color-matches segments to contractor names, indicating the absolute completed ritase cycle count and percentage weight.
  - **Auto-Fallbacks**: Renders a clean default state when no crossings or cycles are logged, preventing visualization failures.
  - **Vector Comparison Chart**: Programmatically renders side-by-side comparative SVG bar charts comparing contractor compliance percentages and hourly capacity throughput vs expectation targets. Vector format guarantees visibility on print layouts.

### 3.5 PDF Report Generator & Print Layout
* **Implementation Status**: `[DONE]` (implemented in [plans/next-enhancements.md](../plans/next-enhancements.md) task 3.2)
* **Description**: Print-ready engine formatting the entire reports workspace for high-fidelity paper or PDF generation.
* **Key Capabilities**:
  - **Modular print.css Stylesheet**: Dedicated CSS module matching print media to strip sidebar layouts, header menus, search fields, and buttons.
  - **Automatic Layout Restructuring**: Re-flows reports side-by-side grid panel layout into clean stacked linear sections optimized for single or multi-page PDF files.
  - **Page Break Avoidance**: Configures CSS print rules to prevent cards or tables from breaking in half across pages (`page-break-inside: avoid;`).
  - **High-Contrast Print Palettes**: Overrides dark backgrounds with clean, high-contrast dark text on white backgrounds.
  - **Interactive Print Settings Modal**: Prompts operators with a modal dialog upon clicking "Print PDF" to input a custom report title and define a filter date range before triggering standard browser print routines.
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




