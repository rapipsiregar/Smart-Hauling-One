# Test Execution Sheet — Source of Truth #9

**Document Version:** v1.1  
**Project:** Smart Gate — Integrated Smart Hauling System (ISHS)  
**Status:** UC-001–UC-007 Completed (Passed); UC-008–UC-010 Backend Executed (Passed) with
documented UI/hardware gaps  
**Last Updated:** 2026-08-02  
**Execution Method:** UC-001–UC-007: Automated Playwright Browser E2E Suite
(`tests/test_e2e_playwright.py`). UC-008–UC-010: automated pytest suites against the implemented
API (`tests/test_edge_*.py`, `tests/test_device_status_sweep.py`, `tests/test_live_sessions.py`).
Rows needing a browser page, a deployed media relay, or real Jetson hardware remain `[—]` with the
reason stated — those are genuinely not executed, not silently passed.  

---

## Instructions

1. Execute each test case in order.
2. Mark **Pass** (✓) if actual result matches expected, **Fail** (✗) if not, **N/A** if not applicable.
3. For failed tests, record the actual result and defect ID.
4. Re-test failed cases after fix and update status.

---

## UC-001: User Login

| TC ID | Test Case | Tester | Date | Status | Actual Result | Defect ID |
|-------|-----------|--------|------|--------|---------------|-----------|
| TC-001-01 | Successful login | Playwright E2E | 2026-07-25 | `[✓]` | Navigation shell loaded, session active | — |
| TC-001-02 | Invalid password | Playwright E2E | 2026-07-25 | `[✓]` | Error message shown as expected | — |
| TC-001-03 | Unknown username | Playwright E2E | 2026-07-25 | `[✓]` | Generic authentication error displayed | — |
| TC-001-04 | Empty fields | Playwright E2E | 2026-07-25 | `[✓]` | Validation error highlighted | — |
| TC-001-05 | Session redirect | Playwright E2E | 2026-07-25 | `[✓]` | Redirected to dashboard shell | — |
| TC-001-06 | Logout | Playwright E2E | 2026-07-25 | `[✓]` | Session destroyed cleanly | — |

## UC-002: View Live Crossing Feed

| TC ID | Test Case | Tester | Date | Status | Actual Result | Defect ID |
|-------|-----------|--------|------|--------|---------------|-----------|
| TC-002-01 | Feed loads on dashboard | Playwright E2E | 2026-07-25 | `[✓]` | Crossing cards & KPI stats populated | — |
| TC-002-02 | New crossing via WS | Playwright E2E | 2026-07-25 | `[✓]` | Live crossing cards streamed | — |
| TC-002-03 | Confidence badge colors | Playwright E2E | 2026-07-25 | `[✓]` | Badges rendered (Green/Amber/Red) | — |
| TC-002-04 | Quick-filter tags | Playwright E2E | 2026-07-25 | `[✓]` | Filter tags updated view correctly | — |
| TC-002-05 | Search highlights | Playwright E2E | 2026-07-25 | `[✓]` | Hull ID search highlights matches | — |
| TC-002-06 | WS disconnection | Playwright E2E | 2026-07-25 | `[✓]` | Status indicator turns warning | — |
| TC-002-07 | WS reconnection | Playwright E2E | 2026-07-25 | `[✓]` | Reconnected automatically | — |
| TC-002-08 | Empty state | Playwright E2E | 2026-07-25 | `[✓]` | Empty state message rendered | — |

## UC-003: Audit & Verify Crossing

| TC ID | Test Case | Tester | Date | Status | Actual Result | Defect ID |
|-------|-----------|--------|------|--------|---------------|-----------|
| TC-003-01 | View crossing detail | Playwright E2E | 2026-07-25 | `[✓]` | Crop image & context pane loaded | — |
| TC-003-02 | Verify crossing | Playwright E2E | 2026-07-25 | `[✓]` | Status updated to verified | — |
| TC-003-03 | Correct hull ID | Playwright E2E | 2026-07-25 | `[✓]` | Hull ID correction recorded | — |
| TC-003-04 | Autocomplete filters fleet | Playwright E2E | 2026-07-25 | `[✓]` | Fleet dropdown filtered | — |
| TC-003-05 | Missing evidence | Playwright E2E | 2026-07-25 | `[✓]` | Placeholder shown when image missing | — |
| TC-003-06 | OCR reprocess | Playwright E2E | 2026-07-25 | `[✓]` | Crop reprocessed via API | — |
| TC-003-07 | Back navigation | Playwright E2E | 2026-07-25 | `[✓]` | Navigated back to feed | — |
| TC-003-08 | Verify from feed card | Playwright E2E | 2026-07-25 | `[✓]` | In-line card verification updated | — |

## UC-004: Generate Shift Report

| TC ID | Test Case | Tester | Date | Status | Actual Result | Defect ID |
|-------|-----------|--------|------|--------|---------------|-----------|
| TC-004-01 | Load shift summary | Playwright E2E | 2026-07-25 | `[✓]` | Shift analytics & KPI cards active | — |
| TC-004-02 | Date picker | Playwright E2E | 2026-07-25 | `[✓]` | Analytics reloaded per selected date | — |
| TC-004-03 | Export PDF | Playwright E2E | 2026-07-25 | `[✓]` | PDF export preview triggered | — |
| TC-004-04 | Export CSV | Playwright E2E | 2026-07-25 | `[✓]` | CSV download generated | — |
| TC-004-05 | Compliance gauge thresholds | Playwright E2E | 2026-07-25 | `[✓]` | Gauges colored per threshold | — |
| TC-004-06 | Send compliance warning | Playwright E2E | 2026-07-25 | `[✓]` | Dispatch warning modal open | — |

## UC-005: Manage Fleet Registry

| TC ID | Test Case | Tester | Date | Status | Actual Result | Defect ID |
|-------|-----------|--------|------|--------|---------------|-----------|
| TC-005-01 | View fleet table | Playwright E2E | 2026-07-25 | `[✓]` | Sortable fleet table displayed | — |
| TC-005-02 | Search fleet | Playwright E2E | 2026-07-25 | `[✓]` | Real-time filtering working | — |
| TC-005-03 | Add single truck | Playwright E2E | 2026-07-25 | `[✓]` | Add truck form submitted | — |
| TC-005-04 | Duplicate hull ID rejection | Playwright E2E | 2026-07-25 | `[✓]` | Duplicate rejected by API | — |
| TC-005-05 | Toggle status | Playwright E2E | 2026-07-25 | `[✓]` | Status toggled visually | — |
| TC-005-06 | Edit truck | Playwright E2E | 2026-07-25 | `[✓]` | Truck details updated | — |
| TC-005-07 | CSV import valid | Playwright E2E | 2026-07-25 | `[✓]` | Bulk CSV import accepted | — |
| TC-005-08 | CSV import with errors | Playwright E2E | 2026-07-25 | `[✓]` | Errors reported per row | — |

## UC-006: Monitor Telemetry Status

| TC ID | Test Case | Tester | Date | Status | Actual Result | Defect ID |
|-------|-----------|--------|------|--------|---------------|-----------|
| TC-006-01 | View telemetry page | Playwright E2E | 2026-07-25 | `[✓]` | Telemetry & CCTV history loaded | — |
| TC-006-02 | Status colors | Playwright E2E | 2026-07-25 | `[✓]` | Skid status badges accurate | — |
| TC-006-03 | Trend charts | Playwright E2E | 2026-07-25 | `[✓]` | Battery & solar trend charts active | — |
| TC-006-04 | Time range selector | Playwright E2E | 2026-07-25 | `[✓]` | Time range options reloaded data | — |
| TC-006-05 | Simulation override | Playwright E2E | 2026-07-25 | `[✓]` | Simulation slider applied | — |
| TC-006-06 | Reset simulation | Playwright E2E | 2026-07-25 | `[✓]` | Simulation reset to real feed | — |

## UC-007: Configure System

| TC ID | Test Case | Tester | Date | Status | Actual Result | Defect ID |
|-------|-----------|--------|------|--------|---------------|-----------|
| TC-007-01 | View admin panel | Playwright E2E | 2026-07-25 | `[✓]` | System settings panel loaded | — |
| TC-007-02 | Update thresholds | Playwright E2E | 2026-07-25 | `[✓]` | Threshold updated & saved | — |
| TC-007-03 | Add user | Playwright E2E | 2026-07-25 | `[✓]` | User created in list | — |
| TC-007-04 | Duplicate username | Playwright E2E | 2026-07-25 | `[✓]` | Validation error displayed | — |
| TC-007-05 | Database backup | Playwright E2E | 2026-07-25 | `[✓]` | Backup triggered | — |
| TC-007-06 | Database restore | Playwright E2E | 2026-07-25 | `[✓]` | Restore flow validated | — |
| TC-007-07 | Prune crossings | Playwright E2E | 2026-07-25 | `[✓]` | Prune retention policy saved | — |
| TC-007-08 | Supervisor access denied | Playwright E2E | 2026-07-25 | `[✓]` | Role restriction enforced | — |

---

## UC-008: Configure Edge Device Settings — Backend Executed

**Method:** `tests/test_edge_config_api.py`, `tests/test_edge_config_roundtrip.py`. The API is
implemented; the settings **page** (PAGE-008) is frontend-branch work and does not exist, so
TC-008-01 stays `[—]`.

| TC ID | Test Case | Tester | Date | Status | Actual Result | Defect ID |
|-------|-----------|--------|------|--------|---------------|-----------|
| TC-008-01 | Load device settings page | — | — | `[—]` | Backing `GET /api/cameras` covered; page is frontend-branch work | — |
| TC-008-02 | Save valid settings | pytest (automated) | 2026-08-02 | `[✓]` | `config_version` 1→2; `applied_config_version` unchanged → pending | — |
| TC-008-03 | Setting applied after heartbeat | pytest (automated) | 2026-08-02 | `[✓]` | After device confirms, applied == current; `last_config_applied_at` set | — |
| TC-008-04 | Out-of-range value rejected | pytest (automated) | 2026-08-02 | `[✓]` | 400 field-specific message; `config_version` unchanged (10 boundary cases) | — |
| TC-008-05 | Save settings for an offline device | pytest (automated) | 2026-08-02 | `[✓]` | Save succeeded; state reads pending, not failed | — |
| TC-008-06 | Empty partial-update body rejected | pytest (automated) | 2026-08-02 | `[✓]` | 400; no write performed | — |

## UC-009: View Live Raw CCTV Feed — Session Orchestration Executed

**Method:** `tests/test_live_sessions.py`. Session control is implemented and tested; **video
playback is not**, because it needs a deployed MediaMTX + coturn with real TURN credentials and a
public IP (`infra/` scaffolds the containers only). Rows asserting actual video stay `[—]`.

| TC ID | Test Case | Tester | Date | Status | Actual Result | Defect ID |
|-------|-----------|--------|------|--------|---------------|-----------|
| TC-009-01 | Start live view, device online | pytest (automated) | 2026-08-02 | `[◐]` | `session_id`/`whep_url` returned and edge long-poll woken; **video not verified** — needs a deployed relay | — |
| TC-009-02 | Start live view, device offline | pytest (automated) | 2026-08-02 | `[✓]` | 200 with session info for an offline device, as specified | — |
| TC-009-03 | Duplicate start for same gate | pytest (automated) | 2026-08-02 | `[✓]` | Identical `session_id`/`whep_url` returned; no conflict | — |
| TC-009-04 | Explicit stop | pytest (automated) | 2026-08-02 | `[✓]` | Session ended; edge long-poll received `action: "stop"` | — |
| TC-009-05 | Implicit stop (tab closed) | pytest (automated) | 2026-08-02 | `[✓]` | Stale sweep ended the session past the keep-alive timeout | — |
| TC-009-06 | No detection overlay ever present | — | — | `[—]` | Property of the edge's WHIP push; needs real hardware + relay | — |

## UC-010: Edge Device Reports Crossing & Heartbeat — Executed

**Method:** `tests/test_edge_crossings.py`, `tests/test_edge_heartbeat.py`,
`tests/test_edge_auth.py`, `tests/test_device_status_sweep.py`, plus a manual end-to-end run of the
real `edge/agent` outbox against a live induk (documented in `docs/feature-list.md` §6.8).

| TC ID | Test Case | Tester | Date | Status | Actual Result | Defect ID |
|-------|-----------|--------|------|--------|---------------|-----------|
| TC-010-01 | Successful crossing submission | pytest (automated) | 2026-08-02 | `[✓]` | 201 + `crossing_id`; visible in the feed with `source='edge'`, attributed to its gate | — |
| TC-010-02 | Duplicate submission (same Idempotency-Key) | pytest (automated) | 2026-08-02 | `[✓]` | 200 `duplicate: true`, same id; no second row (verified by distinct-key audit) | — |
| TC-010-03 | Empty-window submission | pytest (automated) | 2026-08-02 | `[✓]` | 201 with no snapshot; recorded as UNIDENTIFIED, not rejected | — |
| TC-010-04 | Invalid API key | pytest (automated) | 2026-08-02 | `[✓]` | 401 `{"error": "Invalid device credentials"}` for missing/malformed/unknown/revoked | — |
| TC-010-05 | Heartbeat updates device status | pytest (automated) | 2026-08-02 | `[✓]` | `status → online`, `last_heartbeat_at`/`agent_version`/queue depth recorded | — |
| TC-010-06 | Config-changed flag after a settings save | pytest (automated) | 2026-08-02 | `[✓]` | `config_changed: true` while stale; new values served by `GET /edge/config` | — |
| TC-010-07 | Offline sweep after missed heartbeats | pytest (automated) | 2026-08-02 | `[✓]` | Flipped to offline past 90s; boundary/never-heartbeated cases untouched | — |
| TC-010-08 | Outbox retry after simulated network failure | manual E2E | 2026-08-02 | `[✓]` | 3 crossings survived a full induk outage, all delivered in order on recovery, zero duplicates | — |

---

## Summary

| UC ID | Use Case | Total TC | Pass | Fail | N/A | Not Executed | Pass % (of executed) |
|-------|----------|----------|------|------|-----|--------------|--------|
| UC-001 | User Login | 6 | 6 | 0 | 0 | 0 | 100% |
| UC-002 | View Live Crossing Feed | 8 | 8 | 0 | 0 | 0 | 100% |
| UC-003 | Audit & Verify Crossing | 8 | 8 | 0 | 0 | 0 | 100% |
| UC-004 | Generate Shift Report | 6 | 6 | 0 | 0 | 0 | 100% |
| UC-005 | Manage Fleet Registry | 8 | 8 | 0 | 0 | 0 | 100% |
| UC-006 | Monitor Telemetry Status | 6 | 6 | 0 | 0 | 0 | 100% |
| UC-007 | Configure System | 8 | 8 | 0 | 0 | 0 | 100% |
| UC-008 | Configure Edge Device Settings | 6 | 5 | 0 | 0 | 1 | 100% of executed |
| UC-009 | View Live Raw CCTV Feed | 6 | 4 (+1 partial) | 0 | 0 | 1 | 100% of executed |
| UC-010 | Edge Device Reports Crossing & Heartbeat | 8 | 8 | 0 | 0 | 0 | 100% |
| **Total** | | **70** | **67** | **0** | **0** | **2 (+1 partial)** | **100% of executed** |

> **Correction:** this table previously stated a total of **78**, but the per-UC counts sum to
> **70** (6+8+8+6+8+6+8 = 50 for UC-001–007, plus 6+6+8 = 20 for UC-008–010). The 78 was an
> arithmetic error carried from `docs/test_plan.md` §2.1, which has the same mistake. Corrected
> here; correct it there too if that document is revised.

**Status legend:** `[✓]` passed · `[◐]` partially executed (the row states what was and wasn't) ·
`[—]` not executed, with the reason stated · `[✗]` failed.

**The 3 rows not fully executed, and why** — none are "we didn't get to it":
- **TC-008-01** `[—]` — the settings page (PAGE-008) is `frontend`-branch work; its backing
  `GET /api/cameras` call is covered by TC-008's other rows.
- **TC-009-01** `[◐]` — session start and the edge long-poll wakeup are verified; actual video
  playback is not, as that needs a deployed relay.
- **TC-009-06** `[—]` — "no detection overlay" is a property of what the edge pushes over WHIP;
  it needs real hardware plus a deployed MediaMTX + coturn with real TURN credentials and a public
  IP. `infra/` scaffolds the containers; the deployment is a separate step.

---

## Defect Log

| Defect ID | TC ID | Severity | Description | Status | Fix Date | Verified By |
|-----------|-------|----------|-------------|--------|----------|-------------|
| — | — | — | No defects encountered | Closed | 2026-07-25 | Playwright E2E |

