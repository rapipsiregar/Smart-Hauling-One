# User Flow Specification: UC-008 Configure Edge Device Settings

**Version:** v1.0
**Status:** Draft — planned, not yet implemented
**Primary Actor:** Administrator
**Page:** PAGE-008 (Device Settings)
**Related Requirements:** `docs/edge-system/PRD.md` Goal 2, `docs/edge-system/SRS.md` §5.3
**Related System Logic:** `docs/system_logics/sys_uc_008.md`

---

## 1. Overview

Administrator tunes a gate's edge inference rate (YOLO fps, OCR fps, detection window, and the
existing pipeline tunables) from the central dashboard, without physical access to the Jetson at
that gate, and can see whether the device has actually confirmed applying the change.

---

## 2. Trigger

- User clicks "Device Settings" in the sidebar, or a gear icon on a gate's card elsewhere in the
  dashboard.

---

## 3. Preconditions

| ID | Condition |
| :--- | :--- |
| PRE-001 | User authenticated with `admin` role |
| PRE-002 | At least one camera/device is registered (`docs/edge-system/SRS.md` §7.3) |

---

## 4. Main Flow

| Step | Actor Action | System Response |
| :--- | :--- | :--- |
| 1 | User navigates to `/settings/devices` | System loads all registered devices with current settings + health (`GET /api/cameras`, extended) |
| 2 | User opens GATE-A's settings panel | System shows current `yolo_fps`/`ocr_fps`/`detect_window_sec`/`ocr_min_conf`/`dedup_iou`, plus `device_status`, `last_heartbeat_at`, `local_queue_depth` |
| 3 | User changes `yolo_fps` from 20 to 22 and clicks Save | System validates range (1–30), sends `PUT /api/cameras/GATE-A/edge-config`, `config_version` increments |
| 4 | | System shows "Settings: pending" — `applied_config_version` has not yet caught up |
| 5 | User waits (or returns later) and reloads the panel | System shows "Settings: saved" once GATE-A's next heartbeat confirms `applied_config_version == config_version` (within ~30s if the device is online) |

---

## 5. Alternative Flows

### AF-001: Out-of-range value

| Step | Actor Action | System Response |
| :--- | :--- | :--- |
| 1 | User enters `yolo_fps = 40` | Client-side validation blocks submit; if bypassed, server returns `400 {"error": "yolo_fps must be between 1 and 30"}` |

### AF-002: Device offline when settings are saved

| Step | Actor Action | System Response |
| :--- | :--- | :--- |
| 1 | User saves new settings for a device whose `device_status` is `offline` | Save still succeeds (`config_version` increments server-side regardless of device connectivity) |
| 2 | | "Settings: pending" persists indefinitely until the device reconnects and heartbeats — UI must not imply an error, since this is expected behavior, not a failure |

---

## 6. Postconditions

| ID | Condition |
| :--- | :--- |
| POST-001 | `Camera.config_version` incremented by exactly 1 per successful save |
| POST-002 | The device applies the new values within one heartbeat interval (≤30s) once online, without restarting |
| POST-003 | No detection/consensus behavior changes until the device confirms `applied_config_version` — the dashboard never claims a setting is live before that |

---

## 7. Business Rules

| ID | Rule |
| :--- | :--- |
| BR-001 | Only device-configurable fields are editable here — identity fields (name, folder, `rtsp_url`) stay on the existing camera-edit form, not this one |
| BR-002 | Range validation is enforced server-side regardless of client-side checks |
| BR-003 | A device that has never heartbeated shows no "saved/pending" state at all (no baseline to compare against) — shown distinctly from a device that is `offline` but has heartbeated before |

---

## 8. Acceptance Criteria

| AC ID | Description |
| :--- | :--- |
| AC-001 | All 4 devices are visible from one page, each with its own settings panel |
| AC-002 | Saving settings for an offline device does not error, and clearly communicates "pending," not "failed" |
| AC-003 | "Settings: saved" only shows once `applied_config_version == config_version` — never optimistically before that |
| AC-004 | Out-of-range input is rejected with a specific, field-level message, not a generic error |
