# Next Implementation — Edge Device Console (UC-008 / UC-009)

**Status:** Phase 1 complete (2026-08-02) · Phase 2 blocked on backend deployment
**Scope:** This repository only (the Next.js frontend, `frontend` branch).
**Derived from:** the companion backend repo's Source-of-Truth artifacts on its `backend`
branch — `docs/edge-system/PRD.md`, `docs/edge-system/SRS.md`,
`docs/edge-system/API_CONTRACT.md`, `docs/system_logics/sys_uc_008.md`,
`sys_uc_009.md`, `sys_uc_010.md`, `docs/information_architecture.md` (PAGE-008,
PAGE-009) and `docs/design_system.md` (§7.9–§7.11).

---

## 1. What the backend spec actually says

The backend branch has specced — but **not implemented** — a live edge-device system:
four NVIDIA Jetson Orin Nano Super mini-PCs ("anak"), one per gate, each with exactly
one CCTV camera, running YOLO + OCR + fuzzy-consensus locally and reporting finished
crossings to the central server ("induk"). Three facts shape everything below.

**The camera row *is* the device row.** There is no separate device entity. The spec
(SRS §9) adds columns to the existing `cameras` table: `yolo_fps`, `ocr_fps`,
`detect_window_sec`, `ocr_min_conf`, `dedup_iou`, `config_version`,
`applied_config_version`, `last_heartbeat_at`, `agent_version`, `local_queue_depth`,
`api_key_hash`. So this frontend's existing camera registry and the new device console
are two views of one resource — they must not drift into two separate mental models.

**Settings are eventually consistent, and the UI has to say so.** Saving settings
increments `config_version` server-side immediately, but the device only picks the
change up on its next 30s heartbeat and then reports back `applied_config_version`.
`applied_config_version == config_version` means *saved*; a mismatch means *pending*,
and pending is a real operational condition (device offline / unreachable), not a
spinner to hide. This is the single most important interaction rule in UC-008.

**Live video and detection results are separate paths, permanently.** PRD Goal 7 and
the Non-Goals are explicit: the dashboard may show a gate's **raw** camera feed over
WebRTC, and must **never** show a live detection overlay. Inference reaches the
dashboard only as finished, already-voted crossing events. No bounding-box toggle, no
hull-ID readout on the live player — ever.

### Endpoints this frontend will consume

| Endpoint | Purpose | Contract |
|---|---|---|
| `GET /api/cameras` (extended) | All-gates health table in one call | §2.3 |
| `GET /api/cameras/{code}/edge-config` | One device's tunables + health | §2.1 |
| `PUT /api/cameras/{code}/edge-config` | Save tunables (partial, ≥1 field) | §2.2 |
| `POST /api/cameras/{code}/live/start` | Open a live session → `session_id`, `whep_url` | §2.4 |
| `POST /api/cameras/{code}/live/heartbeat` | Keep-alive, every ~10s | §2.4 |
| `POST /api/cameras/{code}/live/stop` | Close the session | §2.4 |

`/api/edge/*` (config, heartbeat, crossings, live-session long-poll) belongs to the
edge agents and is **never** called from this frontend (API_CONTRACT §3.3).

### Canonical ranges (PRD §9 — server is authoritative, form mirrors it)

| Field | Default | API range | Typical operating range |
|---|---|---|---|
| `yolo_fps` | 20 | 1–30 | 18–25 |
| `ocr_fps` | 4 | 1–15 | ~4 |
| `detect_window_sec` | 6 | 1–30 | 5–7 |
| `ocr_min_conf` | 0.30 | 0.0–1.0 | — |
| `dedup_iou` | 0.92 | 0.0–1.0 | — |

---

## 2. The constraint that shapes the build

**None of these endpoints exist on the backend yet.** Every one of them 404s today.
Building against them is still correct — the contract is frozen and the frontend is
explicitly meant to be built in parallel (API_CONTRACT §3, "so both can be built in
parallel without guessing") — but it means graceful degradation is a *feature
requirement*, not polish.

The two 404s are distinguishable, and the UI must distinguish them:

| Cause | Status | Body | UI |
|---|---|---|---|
| Route not mounted (backend not upgraded yet) | 404 | `{"detail": "Not Found"}` (FastAPI default) | "Backend belum menyediakan endpoint ini" — explain, don't alarm |
| Unknown `camera_code` | 404 | `{"error": "Camera not found"}` (contract §0) | Genuine not-found error |

Detection rule: a 404 carrying an `error` key is a real contract response; a 404
without one means the route isn't mounted. This is why the API client parses error
bodies instead of throwing on status alone.

---

## 3. Phase 1 — Device console + live view ✅ shipped

Delivered files:

| File | Role |
|---|---|
| `src/lib/edge-types.ts` | Edge domain types, re-exported from `types.ts` |
| `src/lib/edge-config.ts` | PRD §9 tunable table as data + sync/health helpers |
| `src/lib/whep.ts` | Dependency-free WHEP client |
| `src/lib/use-live-session.ts` | Session lifecycle (start → keep-alive → stop) |
| `src/lib/api-client.ts` | `ApiError`, `isEndpointMissing`, 5 new endpoints |
| `src/components/devices/` | Health badge, stepper, config form, device card |
| `src/components/live/live-player.tsx` | Player with connecting/live/unreachable states |
| `src/app/settings/devices/page.tsx` | PAGE-008 |
| `src/app/live/[camera_code]/page.tsx` | PAGE-009 |


### 3.1 API layer

- `src/lib/api-client.ts` — add `getEdgeConfig`, `updateEdgeConfig`, `startLiveSession`,
  `liveSessionHeartbeat`, `stopLiveSession`. Introduce an `ApiError` carrying
  `status` + parsed body so callers can branch on *why* a call failed rather than on a
  string. Existing call sites keep working unchanged (`ApiError extends Error`).
- `src/lib/types.ts` — `EdgeConfig`, `EdgeConfigPatch`, `LiveSession`, and additive
  optional edge/health fields on `Camera` (§2.3 extends the existing row rather than
  replacing it, so they are optional until the backend ships them).
- `src/lib/edge-config.ts` — the §9 tunable table as data: field metadata (label, range,
  step, typical range, helper text), `configSyncState()` (`saved` | `pending`), and
  `deviceHealthTone()` implementing design_system §7.9 (including the rule that
  `local_queue_depth > 0` on an *online* device renders as a warning, distinct from
  healthy `queue: 0`).

### 3.2 PAGE-008 — Device Settings (`/settings/devices`)

Route per IA §7. One card per gate, built from a single `GET /api/cameras`, with each
card lazily loading its own `edge-config` for the authoritative values.

- **Health badge** (design_system §7.9): status dot + last-seen + queue depth, plus the
  secondary `Settings: saved` / `Settings: pending` badge driven by version equality.
- **Settings form** (§7.10): numeric steppers, not free text. Hard limits from the API
  range; the business owner's operating range shown as helper text only. Save disabled
  until something actually changes (mirrors the API's "≥1 field" rule). Validation
  errors render inline under the offending field, sourced from the server's `400`
  message — client-side range checks guard the stepper, they do not replace the server.
- **Pending state** is explicit prose, not a toast: it names the device and says the
  change is waiting on the next heartbeat.
- Auto-refresh every 30s (one heartbeat interval) so `pending` resolves to `saved`
  without a manual reload.

### 3.3 PAGE-009 — Live Gate View (`/live/[camera_code]`)

Route per IA §7. Raw feed only.

- **Session lifecycle** (SRS §8.3): `POST /live/start` on mount → keep-alive every 10s
  → `POST /live/stop` on unmount *and* on `pagehide`. The server's 20s stale timeout is
  the real backstop; the frontend is not required to guarantee stop fires.
- **WHEP playback** via a plain `RTCPeerConnection` — POST the SDP offer to `whep_url`
  as `application/sdp`, apply the SDP answer. No external player library: it is ~60
  lines and keeps the bundle and the dependency surface flat.
- **Three explicit states** (§7.11): `connecting` (spinner), `live` (video + pulsing
  LIVE tag), and `device offline` — an explicit message with a Wifi-off icon, never an
  infinite spinner, because a session against an offline device returns `200` and then
  simply never produces video (API_CONTRACT §2.4).
- **No overlay controls of any kind.** Enforced by a comment at the component head so a
  future contributor doesn't "helpfully" add one.

### 3.4 Wiring

- Sidebar: "Perangkat Edge" (`/settings/devices`) under *Pengaturan*. The live view is
  reached from a gate card, not from the sidebar — it is per-gate, not a destination.
- `HEADINGS` entries for both new routes.
- Existing `/settings` links across to the device console.

### 3.5 Out of scope for Phase 1

Anything requiring backend work that isn't merely "mount the specced route": device
provisioning / API-key issuance (manual, SRS §7.3), footage retrieval (PRD §8 open
question 1, no endpoint defined), and the media relay / TURN deployment itself (SRS
§8.1 — infrastructure, not frontend).

---

## 4. Phase 2 — after the backend mounts the endpoints

1. Replace the polling refresh on PAGE-008 with SSE if the backend adds a device-event
   stream (it already streams test runs, so the pattern exists).
2. Surface `source: "batch" | "edge"` (SRS §9) in the ledger and crossing detail, so an
   auditor can see which crossings came from a live gate versus the playlist pipeline.
3. Show `local_queue_depth` as a fleet-wide backlog indicator in the header, next to the
   existing backend-status dot.
4. Add the gate-scoped dashboard surface (API_CONTRACT §3.1) — the per-gate view that
   the 4-device split implies but this console does not yet provide.

---

## 5. Verification

- `bun run build` and `bun run lint` clean.
- Every new file under the 256-LOC threshold (AGENTS.md §3).
- Manual: with the backend running but *not* upgraded, `/settings/devices` must render
  the gate list and an honest "endpoint not available yet" notice per card — not an
  error page, and not a fabricated set of values.
