# Information Architecture (IA) — Source of Truth #2

**Document Version:** v1.0  
**Project:** Smart Gate — Integrated Smart Hauling System (ISHS)  
**Status:** Validated / Active  
**Last Updated:** 2026-08-02  
**Author:** System Analyst AI  
**Source:** Derived from `docs/PRD.md` (SoT-1). Modules M008–M009 additionally derived from
`docs/edge-system/PRD.md` Goals 2, 3, 6, 7 (settings, device health, live raw CCTV view).

---

## 1. Document Overview

### 1.1 Purpose

This document defines the Information Architecture (IA) for the Smart Gate ISHS web dashboard. It is derived directly from the PRD (SoT-1) and serves as the single source of truth for:

- Page structure and navigation hierarchy
- URL routing conventions
- Screen-to-screen transitions
- Content hierarchy per module

### 1.2 Related Sources of Truth

| Artifact | Reference | Description |
|----------|-----------|-------------|
| SoT-1 | `docs/PRD.md` | Product requirements, epics, UX workflow |
| SoT-3 | `docs/design_system.md` | Visual language, components, tokens |
| SoT-4 | `docs/data_model.md` | Database schema, entities |

---

## 2. Product Modules

| Module ID | Module Name | Description |
|-----------|-------------|-------------|
| M001 | Authentication | Login/logout gate for supervisor dashboard access |
| M002 | Live Terminal Feed | Real-time list of vehicle crossings with hull IDs, confidence, timestamps |
| M003 | Visual Audit | Split-pane inspection of crop + context images for a crossing |
| M004 | Shift Reporting | Generate and view shift-end summaries, export verified reports |
| M005 | Fleet Registry | Manage registered OHT master database |
| M006 | Telemetry Status | Monitor remote skid tower health (battery, solar, latency) |
| M007 | Admin Settings | System configuration, user management, alert thresholds |
| M008 | Edge Device Settings | Per-gate tuning of `yolo_fps`/`ocr_fps`/`detect_window_sec` and other edge tunables, pushed to the device (`docs/edge-system/`) |
| M009 | Live CCTV Viewer | On-demand real-time raw camera feed for one gate at a time — never a detection overlay (`docs/edge-system/SRS.md` §8) |

---

## 3. Site Map

```
Smart Gate ISHS (Root)
├── M001: Authentication
│   └── PAGE-001: Login
│
├── M002: Live Terminal Feed (Default Landing Page)
│   └── PAGE-002: Dashboard — Real-time crossing stream
│
├── M003: Visual Audit
│   └── PAGE-003: Crossing Detail — Split-pane proof viewer
│
├── M004: Shift Reporting
│   ├── PAGE-004: Shift Summary — Daily productivity metrics
│   └── PAGE-004-SUB-01: Export Report — Print/PDF generator
│
├── M005: Fleet Registry
│   ├── PAGE-005: Fleet Master — Registered OHT table
│   └── PAGE-005-SUB-01: Add Truck Form — Modal overlay
│
├── M006: Telemetry Status
│   └── PAGE-006: Skid Telemetry — Tower health dashboard
│
├── M007: Admin Settings
│   └── PAGE-007: Admin Panel — Thresholds, users, audit logs
│
├── M008: Edge Device Settings
│   └── PAGE-008: Device Settings — Per-gate fps/window tuning, one panel per device
│
└── M009: Live CCTV Viewer
    └── PAGE-009: Live Gate View — On-demand raw feed for one selected gate
```

## 4. Page Inventory

| Page ID | Page Name | Module | URL Path | Access Role |
|---------|-----------|--------|----------|-------------|
| PAGE-001 | Login | M001 | `/login` | Guest |
| PAGE-002 | Dashboard / Live Feed | M002 | `/dashboard` | Supervisor |
| PAGE-003 | Crossing Detail | M003 | `/crossing/[id]` | Supervisor |
| PAGE-004 | Shift Summary | M004 | `/reports` | Supervisor |
| PAGE-004-SUB-01 | Export Report | M004 | (modal on `/reports`) | Supervisor |
| PAGE-005 | Fleet Master | M005 | `/fleet` | Supervisor |
| PAGE-005-SUB-01 | Add Truck Form | M005 | (modal on `/fleet`) | Supervisor |
| PAGE-006 | Skid Telemetry | M006 | `/telemetry` | Supervisor |
| PAGE-007 | Admin Panel | M007 | `/admin` | Administrator |
| PAGE-008 | Device Settings | M008 | `/settings/devices` | Administrator |
| PAGE-009 | Live Gate View | M009 | `/live/[camera_code]` | Supervisor |

---

## 5. Page Definitions

### PAGE-001: Login

- **Purpose:** Authenticate supervisor/administrator identity.
- **Entry Points:** First URL access without session; explicit `/login` navigation.
- **Exit Points:** Successful login → redirect to `/dashboard`.
- **Navigation:** Full-screen centered card, no sidebar. Brand logo + tagline.
- **Related User Flows:** UC-001: User Login.

### PAGE-002: Dashboard / Live Feed

- **Purpose:** Primary real-time operational view — live crossing list, KPI cards, map view.
- **Entry Points:** Post-login redirect; sidebar "Dashboard" click.
- **Exit Points:** Sidebar navigation to other pages.
- **Content Areas:**
  - **Header:** WebSocket connection indicator, theme toggle, user menu, alerts badge.
  - **KPI Row:** Total crossings today, active fleet count, low-confidence warning count, completion rate.
  - **Live Feed Panel:** Scrollable card list of crossings (Hull ID, confidence %, timestamp, gate location, direction).
  - **Inline Action:** Quick-verify badge, context menu on right-click.
  - **Filter Toolbar:** Quick-filter tags (Low Conf, Unregistered), class checkboxes, search query.
  - **Mini Map:** SVG pit map with zone activity heat overlay.
- **Related User Flows:** UC-002: View Live Crossing Feed.

### PAGE-003: Crossing Detail

- **Purpose:** Deep inspection of a single crossing event with visual proof.
- **Entry Points:** Click on a crossing card in Dashboard live feed.
- **Content Areas:**
  - **Split Pane:** Left = cropped hull ID image; Right = wide-angle context photo.
  - **Metadata Panel:** UTC timestamp, gate location, direction, OCR confidence, TMV frame count.
  - **Correction Tools:** Correct Hull ID button, manual reprocess trigger.
  - **Audit Trail:** History of any corrections or re-verifications.
- **Navigation:** Back to Dashboard via breadcrumb or sidebar.
- **Related User Flows:** UC-003: Audit & Verify Crossing.

### PAGE-004: Shift Summary

- **Purpose:** View shift-end productivity reports, compare against targets.
- **Entry Points:** Sidebar "Reports" click.
- **Content Areas:**
  - **Date Picker / Shift Selector:** Choose shift period to view.
  - **KPI Cards:** Total verified crossings, contractor breakdown, compliance %, target comparison.
  - **Compliance Gauge Bars:** Visual progress bars per contractor.
  - **Donut Chart:** Subcontractor ritase allocation.
  - **Export Button:** Triggers PDF/CSV export modal.
  - **Discrepancies Feed:** Low-confidence, unregistered, or unusual cycle alerts.
- **Related User Flows:** UC-004: Generate Shift Report.

### PAGE-005: Fleet Master

- **Purpose:** View, register, edit, and deactivate OHT vehicles in the master registry.
- **Entry Points:** Sidebar "Fleet" click.
- **Content Areas:**
  - **Search + Add Button:** Top toolbar.
  - **Interactive Table:** Hull ID, contractor, model, year, status (active/inactive toggle), last crossing timestamp.
  - **Modal — Add/Edit Truck:** Form with hull_id, contractor, model fields + CSV bulk import option.
  - **Inline Status Toggle:** Switch active/inactive directly in table row.
- **Related User Flows:** UC-005: Manage Fleet Registry.

### PAGE-006: Skid Telemetry

- **Purpose:** Monitor health and status of remote mobile skidding towers.
- **Entry Points:** Sidebar "Telemetry" click.
- **Content Areas:**
  - **Tower Cards:** One card per deployed tower (Alpha, Beta, Gamma, Delta).
  - **Metrics:** Battery % (with sparkline trend), solar panel wattage, network latency, uptime.
  - **Status Indicator:** Color-coded (Green = normal, Yellow = warning, Red = offline).
  - **Trend Modal:** Click a tower card to open 6H/24H/7D historical trend charts.
  - **Simulation Toolbar:** Trigger simulated anomalies for testing.
- **Related User Flows:** UC-006: Monitor Telemetry Status.

### PAGE-007: Admin Panel

- **Purpose:** System configuration, user management, audit log inspection.
- **Entry Points:** Gear icon in sidebar or header.
- **Content Areas:**
  - **Alert Thresholds:** Configure battery low %, solar low W, latency high ms bounds.
  - **User Management:** Add/edit/disable supervisor accounts.
  - **Audit Logs:** Chronological log of all corrections, threshold changes, and system events.
  - **Database Management:** Backup download, restore upload, prune old crossings.
  - **Health Check:** System status summary (DB connectivity, disk usage, telemetry health).
- **Related User Flows:** UC-007: Configure System.

### PAGE-008: Device Settings

- **Purpose:** Tune per-gate edge inference settings (`yolo_fps`, `ocr_fps`, `detect_window_sec`,
  `ocr_min_conf`, `dedup_iou`) without physical access to the Jetson, and see whether each of the
  4 devices has confirmed applying its current settings.
- **Entry Points:** Sidebar "Device Settings" click; gear icon on a gate's card elsewhere in the
  dashboard.
- **Content Areas:**
  - **Device List:** One row/card per gate (4 total — one camera per gate, per
    `docs/edge-system/PRD.md` Goal 1), showing `device_status` (online/offline/maintenance),
    `local_queue_depth`, and whether `applied_config_version == config_version` ("saved" vs.
    "pending").
  - **Settings Form (per device):** Numeric inputs for `yolo_fps` (18–25 typical), `ocr_fps` (~4
    typical), `detect_window_sec` (5–7 typical), `ocr_min_conf`, `dedup_iou` — validated client-side
    against the ranges in `docs/edge-system/API_CONTRACT.md` §2.2 before submit.
  - **Save Confirmation State:** Explicit "pending" indicator (not just a generic toast) while
    `applied_config_version` still lags `config_version` — this is a real device-offline
    condition, not a UI glitch, and must read as such.
- **Related User Flows:** UC-008: Configure Edge Device Settings.
- **Related System Logic:** `docs/system_logics/sys_uc_008.md`.

### PAGE-009: Live Gate View

- **Purpose:** View exactly one gate's raw camera feed in real time, on demand — never a
  detection overlay (`docs/edge-system/PRD.md` Non-Goal, Goal 7).
- **Entry Points:** "View Live" action on a gate's card (Dashboard, Device Settings, or Fleet
  view); direct navigation to `/live/[camera_code]`.
- **Content Areas:**
  - **Video Player:** WHEP-compatible player, one gate at a time (`docs/edge-system/SRS.md` §8).
  - **Connection State:** Explicit "connecting…" vs. "device offline" states — starting a session
    against an offline device still returns a session ID (`docs/edge-system/API_CONTRACT.md`
    §2.4), so the UI must distinguish "no video yet" from "never going to get video."
  - **No overlay controls of any kind** — no bounding-box toggle, no hull-ID readout on this page;
    that data belongs to the crossing feed (PAGE-002/PAGE-003), not here.
- **Exit Points:** Closing/navigating away triggers `/live/stop`; an unclean exit (closed tab) is
  covered by the server-side keep-alive timeout, not a requirement on this page.
- **Related User Flows:** UC-009: View Live Raw CCTV Feed.
- **Related System Logic:** `docs/system_logics/sys_uc_009.md`.

---

## 6. Navigation Conventions

| Navigation Element | Type | Behavior |
|-------------------|------|----------|
| Main Menu | Sidebar (left) | Persistent on desktop (260px), collapsible to icon-mode (80px). Contains: Dashboard, Reports, Fleet, Telemetry, Admin. |
| User Menu | Top-right dropdown | Avatar + name, Settings link, Logout button. |
| WS Indicator | Top-right, header | Glowing dot (green/yellow/red) showing WebSocket connection state. |
| Theme Toggle | Top-right, header | Switch between Slate-Blue and Emerald-Green theme. |
| Mobile Nav | Hamburger (top-left) | Slide-out drawer on screens < 768px. |

---

## 7. Routing Conventions

| Route | Type | Auth | Notes |
|-------|------|------|-------|
| `/` | Public | — | Redirector: session → `/dashboard`, no session → `/login` |
| `/login` | Public | Guest | Redirect to `/dashboard` if already authenticated |
| `/dashboard` | Protected | Supervisor | Default landing page |
| `/crossing/[id]` | Protected | Supervisor | Dynamic route by crossing ID |
| `/reports` | Protected | Supervisor | Shift summary |
| `/fleet` | Protected | Supervisor | Fleet master registry |
| `/telemetry` | Protected | Supervisor | Skid tower health |
| `/admin` | Protected | Administrator | System configuration |
| `/settings/devices` | Protected | Administrator | Per-gate edge inference settings (M008) |
| `/live/[camera_code]` | Protected | Supervisor | On-demand live raw feed, one gate at a time (M009) |
| `*` | Public | — | 404 page with link to `/dashboard` |

---

## 8. Traceability Matrix (PRD → IA)

| PRD Section / Epic | Page ID | Route |
|--------------------|---------|-------|
| Epic 1: Edge-Compute Object Detection & OCR | PAGE-002 | `/dashboard` |
| Epic 4: Analytics, Dashboard, & Verification — Live Terminal Feed | PAGE-002 | `/dashboard` |
| Epic 4: Visual Audit Section | PAGE-003 | `/crossing/[id]` |
| Epic 4: Shift Reporting Module | PAGE-004 | `/reports` |
| Phase 1: Fleet Master Database Setup | PAGE-005 | `/fleet` |
| Phase 1: Autonomous Mobile Skidding Towers | PAGE-006 | `/telemetry` |
| Phase 1: Operational dashboards | PAGE-002, PAGE-004 | `/dashboard`, `/reports` |
| Network Redundancy Architecture | PAGE-006 | `/telemetry` |
| Risk: Monsoon Power Outages — Low-Power Mode | PAGE-006, PAGE-007 | `/telemetry`, `/admin` |
| Risk: Master Data Integration | PAGE-005 | `/fleet` |
| `docs/edge-system/PRD.md` Goal 2 (per-device settings page) | PAGE-008 | `/settings/devices` |
| `docs/edge-system/PRD.md` Goal 3 (device health visibility) | PAGE-008 | `/settings/devices` |
| `docs/edge-system/PRD.md` Goals 6–7 (on-demand live raw feed, no overlay) | PAGE-009 | `/live/[camera_code]` |
