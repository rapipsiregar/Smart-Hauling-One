# Test Cases — Source of Truth #8

**Document Version:** v1.0  
**Project:** Smart Gate — Integrated Smart Hauling System (ISHS)  
**Status:** Draft  
**Last Updated:** 2026-08-02  
**Source:** Derived from `docs/system_logics/` (SoT-6). UC-008–UC-010 additionally derived from
`docs/edge-system/` — **planned coverage, not yet implemented or executed** (see
`docs/test_execution_sheet.md`).

---

## UC-001: User Login

| TC ID | Test Case | Precondition | Steps | Expected Result | Severity |
|-------|-----------|-------------|-------|-----------------|----------|
| TC-001-01 | Successful login | User registered | 1. Go to `/login`. 2. Enter valid username/password. 3. Click "Sign In". | Redirect to `/dashboard`. WS indicator green. Session cookie set. | Critical |
| TC-001-02 | Invalid password | User registered | 1. Go to `/login`. 2. Enter valid username + wrong password. 3. Click "Sign In". | Error message "Invalid username or password" shown. No redirect. | Major |
| TC-001-03 | Unknown username | — | 1. Go to `/login`. 2. Enter unregistered username. 3. Click "Sign In". | Same error message as TC-001-02 (no user enumeration). | Major |
| TC-001-04 | Empty fields | — | 1. Go to `/login`. 2. Click "Sign In" with empty fields. | Validation error under each empty field. | Minor |
| TC-001-05 | Session redirect | Authenticated | 1. While logged in, navigate to `/login`. | Redirect to `/dashboard`. | Minor |
| TC-001-06 | Logout | Authenticated | 1. Click user menu. 2. Click "Logout". | Session destroyed. Redirect to `/login`. | Critical |

---

## UC-002: View Live Crossing Feed

| TC ID | Test Case | Precondition | Steps | Expected Result | Severity |
|-------|-----------|-------------|-------|-----------------|----------|
| TC-002-01 | Feed loads on dashboard | Authenticated, crossings exist | 1. Navigate to `/dashboard`. | Crossing cards populate feed. KPI stats display correct counts. | Critical |
| TC-002-02 | New crossing via WS | Authenticated, WS connected | 1. POST a new crossing via API (simulate edge). | Card slides in at top of feed. KPI counters update. | Critical |
| TC-002-03 | Confidence badge colors | Crossings with varied confidence | 1. Load feed with crossings at 96%, 88%, 72%. | ≥95% green badge. 85–94% amber badge. <85% red badge. | Major |
| TC-002-04 | Quick-filter tags | Mixed crossings | 1. Click "Low Conf" filter tag. | Only crossings < 85% shown. Counter reflects filtered count. | Major |
| TC-002-05 | Search highlights | Crossings exist | 1. Type "DT" in search box. | Matching cards shown, non-matching hidden. "DT" highlighted yellow in hull IDs. | Major |
| TC-002-06 | WS disconnection | Authenticated | 1. Stop backend server. | WS indicator turns yellow → red. Banner "Live updates paused" appears. | Major |
| TC-002-07 | WS reconnection | WS disconnected | 1. Restart backend server. | Indicator turns green. Banner dismissed. Missed crossings load. | Major |
| TC-002-08 | Empty state | No crossings in DB | 1. Navigate to `/dashboard` with empty DB. | Empty state illustration + "No crossings detected" message. | Minor |

---

## UC-003: Audit & Verify Crossing

| TC ID | Test Case | Precondition | Steps | Expected Result | Severity |
|-------|-----------|-------------|-------|-----------------|----------|
| TC-003-01 | View crossing detail | Crossing exists with evidence | 1. Click a crossing card in feed. | Split pane shows crop (left) + context (right). Metadata panel accurate. | Critical |
| TC-003-02 | Verify crossing | Unverified crossing | 1. Open crossing detail. 2. Click "Verify". | Status → `verified`. Confidence → 100%. Badge turns green. WS broadcast sent. | Critical |
| TC-003-03 | Correct hull ID | Crossing with low confidence | 1. Click "Correct Hull ID". 2. Select truck from autocomplete. 3. Enter reason. 4. Save. | Crossing updated. Correction record created. AuditLog entry written. WS broadcast. | Critical |
| TC-003-04 | Autocomplete filters fleet | Registered trucks exist | 1. Click "Correct Hull ID". 2. Type "DT" in input. | Dropdown shows matching trucks only. | Major |
| TC-003-05 | Missing evidence | Crossing without images | 1. Open crossing detail with missing files. | Placeholder image with "[Image not available]" in red border. | Major |
| TC-003-06 | OCR reprocess | Crossing detail loaded | 1. Click "Reprocess OCR". 2. Drag bounding box on context image. 3. Submit. | New OCR result returned. Confidence updated. Crossing record updated. | Major |
| TC-003-07 | Back navigation | Crossing detail loaded | 1. Click browser back / breadcrumb. | Returns to dashboard feed, preserving filter state. | Minor |
| TC-003-08 | Verify from feed card | Unverified crossing in feed | 1. Click verify badge (checkmark) on feed card directly. | Card updates in-place. Status → `verified`. No page navigation. | Major |

---

## UC-004: Generate Shift Report

| TC ID | Test Case | Precondition | Steps | Expected Result | Severity |
|-------|-----------|-------------|-------|-----------------|----------|
| TC-004-01 | Load shift summary | Crossings exist | 1. Navigate to `/reports`. | KPI cards, shift breakdown, compliance gauges, donut chart render correctly. | Critical |
| TC-004-02 | Date picker | Crossings exist across dates | 1. Select a different date. | Report data reloads for selected date. All charts update. | Major |
| TC-004-03 | Export PDF | Report loaded | 1. Click "Export PDF". 2. Configure settings. 3. Generate. | Print preview modal opens with formatted report. Browser print dialog appears. | Major |
| TC-004-04 | Export CSV | Report loaded | 1. Click "Export CSV". | CSV file downloads with correct column data. | Major |
| TC-004-05 | Compliance gauge thresholds | Contractors with varying compliance | 1. View compliance gauges. | ≥85% → green. 50–84% → amber. <50% → red. | Minor |
| TC-004-06 | Send compliance warning | Contractor below target | 1. Click "Send Warning". 2. Enter recipient. 3. Send. | DispatchLog created. Toast notification: "Warning dispatched". | Major |

---

## UC-005: Manage Fleet Registry

| TC ID | Test Case | Precondition | Steps | Expected Result | Severity |
|-------|-----------|-------------|-------|-----------------|----------|
| TC-005-01 | View fleet table | Trucks registered | 1. Navigate to `/fleet`. | Sortable table with all trucks. Columns: Hull ID, Contractor, Model, Year, Status, Last Crossing. | Critical |
| TC-005-02 | Search fleet | Trucks exist | 1. Type contractor name in search. | Table filters in real-time. Matching rows only. | Major |
| TC-005-03 | Add single truck | — | 1. Click "Add Truck". 2. Fill form. 3. Save. | Truck created. Table refreshes. Toast confirmation. | Critical |
| TC-005-04 | Duplicate hull ID rejection | Existing truck DT-118 | 1. Add truck with hull_id "DT-118". | Error: "Hull ID already exists". No duplicate created. | Major |
| TC-005-05 | Toggle status | Truck exists | 1. Click status toggle switch on a row. | Status changes in DB. Row updates visually. No page reload. | Major |
| TC-005-06 | Edit truck | Truck exists | 1. Click edit icon. 2. Change model. 3. Save. | Truck updated. Table reflects change. | Major |
| TC-005-07 | CSV import valid | Valid CSV file | 1. Click "Import CSV". 2. Select valid file. 3. Upload. | All rows imported. Success count shown. | Major |
| TC-005-08 | CSV import with errors | CSV with invalid rows | 1. Upload CSV with missing fields. | Import rejected. Row-by-row error report displayed. | Major |

---

## UC-006: Monitor Telemetry Status

| TC ID | Test Case | Precondition | Steps | Expected Result | Severity |
|-------|-----------|-------------|-------|-----------------|----------|
| TC-006-01 | View telemetry page | Towers active | 1. Navigate to `/telemetry`. | Tower cards for each deployed skid. Shows battery %, solar W, latency ms, status. | Critical |
| TC-006-02 | Status colors | Mix of tower statuses | 1. View all tower cards. | Green for normal, amber for warning, red for offline towers. | Major |
| TC-006-03 | Trend charts | Telemetry history exists | 1. Click a tower card. | Modal opens with 6-hour battery + solar trend chart. | Major |
| TC-006-04 | Time range selector | Trend modal open | 1. Click "24H" / "7D" buttons. | Chart reloads with selected time range data. | Major |
| TC-006-05 | Simulation override | Telemetry page loaded | 1. Open simulation toolbar. 2. Set battery to 15% for Alpha. 3. Apply. | Alpha card shows 15% battery. Status turns amber. | Major |
| TC-006-06 | Reset simulation | Override active | 1. Click "Reset All" in toolbar. | All towers return to natural telemetry data. | Minor |

---

## UC-007: Configure System

| TC ID | Test Case | Precondition | Steps | Expected Result | Severity |
|-------|-----------|-------------|-------|-----------------|----------|
| TC-007-01 | View admin panel | Admin user | 1. Navigate to `/admin`. | All sections load: Alert Thresholds, Users, Audit Logs, Database. | Critical |
| TC-007-02 | Update thresholds | Admin user | 1. Change battery_low to 20%. 2. Save. | Threshold persisted. AuditLog entry created. | Major |
| TC-007-03 | Add user | Admin user | 1. Open Users tab. 2. Add user with valid data. | User created. Appears in user list. | Critical |
| TC-007-04 | Duplicate username | Existing username | 1. Add user with existing username. | Validation error: "Username already exists". | Major |
| TC-007-05 | Database backup | — | 1. Click "Backup Database". | JSON file downloaded with all tables. | Critical |
| TC-007-06 | Database restore | Backup file exists | 1. Click "Restore". 2. Select backup JSON. 3. Confirm. | Data restored. Success count shown. | Critical |
| TC-007-07 | Prune crossings | Old crossings exist | 1. Set retention to 60 days. 2. Confirm prune. | Crossings + evidence files deleted. Stats aggregated. | Major |
| TC-007-08 | Supervisor access denied | Supervisor role | 1. Login as supervisor. 2. Navigate to `/admin`. | 403 Forbidden or redirect to `/dashboard`. | Major |

---

## UC-008: Configure Edge Device Settings

*Planned — `docs/edge-system/`, not yet implemented.*

| TC ID | Test Case | Precondition | Steps | Expected Result | Severity |
|-------|-----------|-------------|-------|-----------------|----------|
| TC-008-01 | Load device settings page | Admin, ≥1 device registered | 1. Navigate to `/settings/devices`. | All registered devices listed with current `yolo_fps`/`ocr_fps`/`detect_window_sec` and health. | Critical |
| TC-008-02 | Save valid settings | Admin, device online | 1. Change `yolo_fps` to 22. 2. Save. | `config_version` increments. UI shows "Settings: pending". | Critical |
| TC-008-03 | Setting applied after heartbeat | Change saved (TC-008-02), device online | 1. Wait ≥30s. 2. Reload panel. | `applied_config_version == config_version`. UI shows "Settings: saved". | Critical |
| TC-008-04 | Out-of-range value rejected | Admin | 1. Enter `yolo_fps = 40`. 2. Save. | `400` with field-specific message; no `config_version` change. | Major |
| TC-008-05 | Save settings for an offline device | Device `status = offline` | 1. Change settings. 2. Save. | Save succeeds (`config_version` increments); UI shows "pending", not an error. | Major |
| TC-008-06 | Empty partial-update body rejected | Admin | 1. Submit save with no fields changed. | `400` — at least one field required. | Minor |

---

## UC-009: View Live Raw CCTV Feed

*Planned — `docs/edge-system/`, not yet implemented.*

| TC ID | Test Case | Precondition | Steps | Expected Result | Severity |
|-------|-----------|-------------|-------|-----------------|----------|
| TC-009-01 | Start live view, device online | Device online, edge long-poll active | 1. Click "View Live" for GATE-A. | `session_id`/`whep_url` returned. Video renders within a few seconds. | Critical |
| TC-009-02 | Start live view, device offline | Device `status = offline` | 1. Click "View Live". | `200` with session info returned, but no video arrives; UI shows "Device offline" within a bounded wait, not an infinite spinner. | Critical |
| TC-009-03 | Duplicate start for same gate | Session already active for GATE-A | 1. Click "View Live" for GATE-A again (e.g. a second tab). | Same `session_id`/`whep_url` returned — not a conflict/error. | Major |
| TC-009-04 | Explicit stop | Live session active | 1. Close the live view. | `/live/stop` called; edge stops the WHIP push within one long-poll cycle. | Major |
| TC-009-05 | Implicit stop (tab closed) | Live session active | 1. Close the browser tab without navigating away first. | No heartbeat arrives; session ends server-side within ~20s. | Major |
| TC-009-06 | No detection overlay ever present | Live session active | 1. Inspect the video stream/frames. | No bounding boxes, hull-ID text, or any annotation — raw camera output only. | Critical |

---

## UC-010: Edge Device Reports Crossing & Heartbeat

*Planned — `docs/edge-system/`, not yet implemented. Actor: Edge Agent (automated); tests exercise the API directly rather than a UI.*

| TC ID | Test Case | Precondition | Steps | Expected Result | Severity |
|-------|-----------|-------------|-------|-----------------|----------|
| TC-010-01 | Successful crossing submission | Valid device API key | 1. `POST /api/edge/crossings` with a valid payload + snapshot + fresh `Idempotency-Key`. | `201` with `crossing_id`. Crossing visible in dashboard feed with `source = "edge"`. | Critical |
| TC-010-02 | Duplicate submission (same Idempotency-Key) | TC-010-01 already succeeded | 1. Re-submit the identical request with the same `Idempotency-Key`. | `200` with `duplicate: true`, same `crossing_id`. No second row created. | Critical |
| TC-010-03 | Empty-window submission | — | 1. Submit with `hull_id = "UNKNOWN"`, `read_count = 0`, no `snapshot` field. | Accepted (`201`) — crossing recorded as unidentified, not rejected for missing snapshot. | Major |
| TC-010-04 | Invalid API key | Revoked/wrong key | 1. `POST /api/edge/heartbeat` with a bad key. | `401 {"error": "Invalid device credentials"}`. | Critical |
| TC-010-05 | Heartbeat updates device status | Device previously offline | 1. Send a valid heartbeat. | `Camera.status → "online"`, `last_heartbeat_at` updated. | Critical |
| TC-010-06 | Config-changed flag after a settings save | Settings changed via UC-008 | 1. Send heartbeat with a stale `applied_config_version`. | Response `config_changed: true`. Subsequent `GET /api/edge/config` returns the new values. | Major |
| TC-010-07 | Offline sweep after missed heartbeats | Device was online, no heartbeat sent for 90s | 1. Wait past the offline threshold. 2. Check device status. | `Camera.status → "offline"` automatically, without any explicit "offline" report. | Critical |
| TC-010-08 | Outbox retry after simulated network failure | Mock edge agent, injectable network failure | 1. Fail the first 2 submission attempts. 2. Allow the 3rd to succeed. | Crossing eventually recorded exactly once; no duplicate from the earlier failed attempts (still same `Idempotency-Key`). | Major |
