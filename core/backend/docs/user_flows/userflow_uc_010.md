# User Flow Specification: UC-010 Edge Device Reports Crossing & Heartbeat

**Version:** v1.0
**Status:** Draft — planned, not yet implemented
**Primary Actor:** Edge Agent (automated — no human interaction; documented here for
consistency with this folder's one-user-flow-per-system-logic pairing convention)
**Page:** None — this is a device-to-server flow with no dashboard page of its own; its effects
are visible on PAGE-002 (crossing feed), PAGE-008 (device health), and the `GET /api/cameras`
health summary.
**Related Requirements:** `docs/edge-system/SRS.md` §3–§5
**Related System Logic:** `docs/system_logics/sys_uc_010.md`

---

## 1. Overview

Once a Detection Window closes on the edge (SRS §3.2), the agent computes a consensus hull ID and
submits it to the induk, retrying through network outages via a local outbox. Independently, the
agent heartbeats every 30 seconds so the induk can track device health and push settings changes.
There is no human actor in this flow — it runs continuously, unattended, on all 4 devices.

---

## 2. Trigger

- A Detection Window closes on the edge agent (max duration reached, or no qualifying detection
  for the grace period — SRS §3.2). Independently: a 30-second timer, for heartbeat.

---

## 3. Preconditions

| ID | Condition |
| :--- | :--- |
| PRE-001 | The device has been provisioned with a valid API key (`docs/edge-system/SRS.md` §7.3) |
| PRE-002 | The edge agent process is running (capture, inference, outbox sender, heartbeat threads — SRS §3.1) |

---

## 4. Main Flow — Crossing Submission

| Step | Actor Action | System Response |
| :--- | :--- | :--- |
| 1 | Detection Window closes; agent runs consensus voting (SRS §3.3) and picks the best snapshot (SRS §3.4) | A new row is written to the local outbox with a fresh `Idempotency-Key` |
| 2 | Outbox Sender Thread picks up the row | `POST /api/edge/crossings` with the payload + snapshot |
| 3 | | Induk validates, inserts a new `Crossing` row (`source='edge'`), returns `201` + `crossing_id` |
| 4 | | Outbox row deleted locally; the crossing now appears in the existing crossing feed (PAGE-002) alongside batch-sourced ones |

## 5. Alternative Flows

### AF-001: Network outage during submission

| Step | Actor Action | System Response |
| :--- | :--- | :--- |
| 1 | `POST /api/edge/crossings` fails (network error or non-2xx) | Row stays in the outbox; `attempt_count` increments, `next_attempt_at` set via exponential backoff (2s → 60s cap, SRS §4.3) |
| 2 | Outage continues | Outbox grows; `local_queue_depth` reported on the next heartbeat (visible on PAGE-008) |
| 3 | Network recovers | Sender thread resumes, delivering queued rows in original order, oldest first |

### AF-002: Retry after a partial success (ack lost)

| Step | Actor Action | System Response |
| :--- | :--- | :--- |
| 1 | Agent retries a crossing whose `Idempotency-Key` the induk already processed | Induk returns `200 {"duplicate": true}` instead of creating a second row |

### AF-003: Heartbeat & config push

| Step | Actor Action | System Response |
| :--- | :--- | :--- |
| 1 | Every 30s, agent sends `POST /api/edge/heartbeat` | Induk updates `last_heartbeat_at`, `status='online'`, and returns `config_changed` |
| 2 | If `config_changed: true` | Agent calls `GET /api/edge/config`, atomically applies new values — no restart |
| 3 | Device goes silent (no heartbeat for 90s) | A background sweep on the induk flips `status` to `offline` — independent of any single heartbeat call |

### AF-004: Outbox ceiling reached

| Step | Actor Action | System Response |
| :--- | :--- | :--- |
| 1 | Outage persists long enough to exceed the outbox size ceiling (proposed 500 MB) | Oldest queued crossing(s) are evicted and logged loudly — this is the **only** path by which a crossing is permanently lost (SRS §4.4) |

---

## 6. Postconditions

| ID | Condition |
| :--- | :--- |
| POST-001 | No crossing is ever duplicated in the database, regardless of retry count |
| POST-002 | No crossing is silently lost except via the explicit, logged ceiling eviction (AF-004) |
| POST-003 | `Camera.status`, `last_heartbeat_at`, and `local_queue_depth` always reflect the most recent heartbeat, driving PAGE-008's health display |

---

## 7. Business Rules

| ID | Rule |
| :--- | :--- |
| BR-001 | `idempotency_key` uniqueness is enforced at the database level, not just in application code |
| BR-002 | Crossings are submitted strictly one at a time, in detection order — no parallel submission |
| BR-003 | A device never self-reports `offline` — that state is always inferred centrally from missed heartbeats |

---

## 8. Acceptance Criteria

| AC ID | Description |
| :--- | :--- |
| AC-001 | A crossing submitted while the network is healthy appears in the dashboard feed within one retry cycle |
| AC-002 | Killing network connectivity for an extended period does not lose crossings (up to the ceiling) — they all arrive once connectivity returns, in order |
| AC-003 | Retrying the same crossing twice never produces two rows in the database |
| AC-004 | A device that stops heartbeating shows `offline` on PAGE-008 within ~90s, without any explicit "device down" report from the device itself |
