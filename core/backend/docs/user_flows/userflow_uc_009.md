# User Flow Specification: UC-009 View Live Raw CCTV Feed

**Version:** v1.0
**Status:** Draft — planned, not yet implemented
**Primary Actor:** Supervisor
**Page:** PAGE-009 (Live Gate View)
**Related Requirements:** `docs/edge-system/PRD.md` Goals 6–7, `docs/edge-system/SRS.md` §8
**Related System Logic:** `docs/system_logics/sys_uc_009.md`

---

## 1. Overview

Supervisor opens a real-time, raw (unannotated) camera feed for exactly one gate at a time, on
demand, to visually confirm what's happening at that checkpoint right now. This is strictly
separate from the crossing feed (PAGE-002) — no detection results, bounding boxes, or hull-ID
overlays ever appear on this page.

---

## 2. Trigger

- User clicks "View Live" on a gate's card (Dashboard, Device Settings, or Fleet view), or
  navigates directly to `/live/[camera_code]`.

---

## 3. Preconditions

| ID | Condition |
| :--- | :--- |
| PRE-001 | User authenticated as Supervisor (or higher) |
| PRE-002 | The target camera/device is registered (does not need to be currently online — see AF-001) |

---

## 4. Main Flow

| Step | Actor Action | System Response |
| :--- | :--- | :--- |
| 1 | User clicks "View Live" for GATE-A | System calls `POST /api/cameras/GATE-A/live/start`, receives `session_id` + `whep_url` |
| 2 | | Player shows "Connecting…" while the edge's long-poll picks up the start signal |
| 3 | | Within a few seconds, live raw video renders via the WHEP connection |
| 4 | | Frontend sends a keep-alive (`POST .../live/heartbeat`) every ~10s while the page stays open |
| 5 | User closes the view / navigates away | Frontend sends `POST .../live/stop`; the edge stops pushing within one long-poll cycle |

---

## 5. Alternative Flows

### AF-001: Device is offline

| Step | Actor Action | System Response |
| :--- | :--- | :--- |
| 1 | User clicks "View Live" for an offline gate | `POST .../live/start` still returns `200` with a `session_id`/`whep_url` — the session is "requested" but nothing streams |
| 2 | | After a few seconds with no video, the UI must switch to an explicit "Device offline — no live feed available" state, not spin indefinitely |

### AF-002: Two operators view different gates simultaneously

| Step | Actor Action | System Response |
| :--- | :--- | :--- |
| 1 | Operator A views GATE-A while Operator B views GATE-C | Both sessions run independently — no system-wide single-stream restriction (`docs/edge-system/SRS.md` §8.4) |

### AF-003: Tab closed without an explicit stop

| Step | Actor Action | System Response |
| :--- | :--- | :--- |
| 1 | User closes the browser tab directly | No keep-alive arrives; after ~20s (2 missed) the induk ends the session server-side and signals the edge to stop — no user action required |

---

## 6. Postconditions

| ID | Condition |
| :--- | :--- |
| POST-001 | No edge ever streams continuously/unwatched — every active WHIP push corresponds to a live, heartbeating session |
| POST-002 | Nothing seen on this page is written to the crossing/audit trail — this view produces no persisted data of its own |

---

## 7. Business Rules

| ID | Rule |
| :--- | :--- |
| BR-001 | This page never renders a detection overlay of any kind — no bounding boxes, no hull-ID text, no "toggle overlay" control |
| BR-002 | One gate at a time per viewer — this page shows a single feed, not a multi-gate grid |
| BR-003 | Live view does not pause or affect detection on the edge — the two are architecturally independent |

---

## 8. Acceptance Criteria

| AC ID | Description |
| :--- | :--- |
| AC-001 | Video starts within a few seconds of clicking "View Live" when the device is online |
| AC-002 | An offline device produces a clear "offline" state within a bounded wait, never an indefinite spinner |
| AC-003 | Closing the tab without clicking a "stop" button still ends the session within ~20s |
| AC-004 | No detection/hull-ID data appears anywhere on this page |
