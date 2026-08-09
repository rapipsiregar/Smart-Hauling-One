# SRS — Smart Gate Edge Devices (Live Camera Pipeline)

**Status:** Implemented (backend + edge agent) · dashboard pages pending on the `frontend` branch · companion to [`PRD.md`](./PRD.md) (read its
§0 Glossary and §9 Canonical Defaults first — everything below assumes them) and
[`API_CONTRACT.md`](./API_CONTRACT.md).

## 1. System Overview

This repo (`backend/`) splits into two roles:

- **Induk (central)** — this repo, unchanged in role: dashboard, fleet registry, reports, audit
  trail, DB. Gains: an ingestion API for edge results, a per-device settings API, and a WebRTC
  media relay for live viewing.
- **Anak (edge)** — new, one instance per gate (4 total), deployed on a Jetson Orin Nano Super.
  Captures its one CCTV's RTSP stream, runs detection+OCR+consensus locally, and syncs results to
  the induk.

```
┌──────────────────────────────┐        WiFi/cellular          ┌───────────────────────────────────┐
│   GATE A/B/C/D — Jetson       │   (unreliable, retry+queue)   │        Induk (central backend)     │
│   Orin Nano Super             │ ──────────────────────────────▶ FastAPI app, existing dashboard,   │
│                                │                                DB, reports, audit trail            │
│  RTSP camera ─▶ Capture ring   │                                                                     │
│  buffer ─▶ Detection Window    │  ◀──────────────────────────  Per-device settings (§3.5, §5.3)     │
│  state machine (§3.2) ─▶       │        (config poll)                                                │
│  consensus (§3.3) ─▶ local     │                                New: /edge/* routers, settings page  │
│  SQLite outbox (§4)            │                                backend, device health, live-view    │
│                                │                                orchestration (§5, §8)               │
│  Live-view WHIP push (§8) ─────┼──────────────────────────────▶ WebRTC media relay (MediaMTX) +      │
│  Local rolling video (§7.1)    │        (on-demand only)         TURN (coturn), public IP required   │
└────────────────────────────────┘                               └────────────────┬────────────────────┘
                                                                                    │ WHEP
                                                                                    ▼
                                                                         Browser dashboard (frontend)
```

Key architectural decision, unchanged from earlier drafts: **inference stays on the edge**. The
induk never receives raw video routinely — only a JSON result + one snapshot per crossing —
because the link back to it is WiFi/cellular and may be unreliable. The live-view path (§8) is the
one exception, and it is on-demand and architecturally separate from crossings.

## 2. Actors

| Actor | Description |
| :--- | :--- |
| **Edge agent** | Software process (multi-threaded, §3.1) running on each Jetson. Owns capture, inference, consensus, local queue, local video retention, and reporting to the induk. |
| **Induk backend** | This FastAPI app. Owns the source-of-truth DB, dashboard, reports, device orchestration (§5), and the settings edge agents must converge to. |
| **Media relay** | A separate process (MediaMTX + coturn, §8.1) alongside the induk backend. Handles WebRTC media; the FastAPI backend only orchestrates sessions, never touches video frames. |
| **Operator** | Uses the central dashboard's settings page to tune a device's fps/window; views device health, crossing feed, and live raw video. |
| **Auditor** | Investigates a disputed crossing; needs the snapshot + vote breakdown (always, from the induk) and, if needed, raw footage (from the edge's local buffer, §7). |

---

## 3. Edge Agent — Detailed Processing Pipeline

### 3.1 Components & Threads

The edge agent is one process with several concurrent workers. All shared mutable state (current
config, ring buffer) must be accessed through the accessors described below — never read/written
directly from more than one thread without them.

| Component | Responsibility |
| :--- | :--- |
| **Capture Thread** | Opens the camera's RTSP stream (`cv2.VideoCapture` or a GStreamer pipeline). Continuously reads frames into a **shallow ring buffer** (depth 2–3) holding only the most recent frame(s) — deliberately shallow so processing always works close to live rather than draining a backlog; dropping frames when inference falls behind is acceptable, there is no "process every frame" requirement. Reconnects with backoff (same formula as §4.3) on stream failure. |
| **Inference Loop** | Pulls the latest frame from the ring buffer and runs §3.2's state machine on it (YOLO detection, OCR gating, window open/close). Single logical loop — YOLO and OCR are sequential per frame, matching the existing batch pipeline's structure. |
| **Window Finalizer** | Receives a completed window's reads via an in-process queue from the Inference Loop (decoupled so DB/JPEG-encode work never blocks frame capture). Runs consensus (§3.3), picks the best snapshot (§3.4), writes one row into the local outbox (§4.1). |
| **Outbox Sender Thread** | Drains the local SQLite outbox to `POST /edge/crossings`, one row at a time, with retry/backoff (§4.2–§4.3). |
| **Heartbeat Thread** | Every 30s (PRD §9), `POST /edge/heartbeat`; on `config_changed: true`, triggers the Config Watcher (§3.5). |
| **Config Watcher** | Calls `GET /edge/config`, atomically swaps the shared config object (e.g. replace-by-reference of an immutable dataclass — never mutate fields in place, so the Inference Loop never reads a half-updated config mid-frame). |
| **Live-Session Long-Poll Thread** | Holds `GET /edge/live-session` open (§8.2). On `action: "start"`, begins a WHIP push sourced from the **same** ring buffer the Inference Loop reads (raw frames, no overlay) — an independent consumer, never competing with or blocking detection. |
| **Local Video Writer** | Independent consumer of the ring buffer; writes rotating raw-video segments to disk for the retention buffer (§7.1). |

### 3.2 Detection Window State Machine

This is the part earlier drafts of this spec left undefined — restated as an explicit,
unambiguous algorithm.

**States:** `IDLE`, `ACTIVE`.

**Per-device runtime state** (all reset at the marked points):
```
state               = "IDLE"
window_start_ts      = None
last_qualifying_ts    = None
cooldown_until         = 0.0
reads                   = []     # list of {text, weight, det_conf, ocr_conf, ts, crop_jpeg}
last_ocr_box             = None  # IoU dedup reference — reset every window (see note below)
last_yolo_ts               = 0.0
last_ocr_ts                  = 0.0
```

**Per-frame algorithm** (`on_frame(frame, now)`, called by the Inference Loop for every frame it
pulls from the ring buffer):

```python
def on_frame(frame, now):
    global state, window_start_ts, last_qualifying_ts, cooldown_until
    global reads, last_ocr_box, last_yolo_ts, last_ocr_ts

    # 1) yolo_fps throttle — drop this frame for inference if we're ahead of schedule.
    if now - last_yolo_ts < 1.0 / config.yolo_fps:
        return
    last_yolo_ts = now

    # 2) Run YOLO. `conf=` is the model's own threshold, so `boxes` already excludes
    #    anything below detect_trigger_conf — no separate filter step needed.
    boxes = yolo_model.predict(frame, conf=DETECT_TRIGGER_CONF)

    # 3) IDLE -> ACTIVE trigger.
    if state == "IDLE":
        if boxes and now >= cooldown_until:
            state = "ACTIVE"
            window_start_ts = now
            last_qualifying_ts = now
            reads = []
            last_ocr_box = None          # dedup reference always starts clean per window
        else:
            return   # nothing else to do this frame

    # From here, state == "ACTIVE" (either just entered above, or already was).
    if boxes:
        last_qualifying_ts = now
        # Every qualifying box is processed independently — matches the existing batch
        # pipeline's `for box in results.boxes` loop (labs/custom_model/video_processor.py),
        # not just the single best box.
        for box in boxes:
            area = box.width * box.height
            do_ocr = (
                box.det_conf >= config.ocr_min_conf
                and area >= OCR_MIN_AREA                                  # constant, 400 px^2
                and not (last_ocr_box is not None
                         and iou(box.bbox, last_ocr_box) >= config.dedup_iou)
                and (now - last_ocr_ts) >= 1.0 / config.ocr_fps           # NEW vs. batch: live throttle
            )
            if do_ocr:
                last_ocr_ts = now
                crop = pad_crop(frame, *box.bbox)                         # reused, ocr_utils.py
                text, ocr_conf = run_ocr_on_crop(crop, ocr_pipeline)      # reused, ocr_utils.py
                last_ocr_box = box.bbox
                if text:
                    norm = normalize_hull_id(text)                       # reused, ocr_utils.py
                    if norm != "UNKNOWN":
                        weight = box.det_conf * (ocr_conf or 0.5)        # reused formula, exact
                        reads.append({
                            "text": norm, "weight": weight,
                            "det_conf": box.det_conf, "ocr_conf": ocr_conf,
                            "ts": now, "crop_jpeg": encode_jpeg(crop),
                        })

    # 4) Window-close conditions — checked every processed frame while ACTIVE.
    duration = now - window_start_ts
    gap = now - last_qualifying_ts
    if duration >= config.detect_window_sec or gap >= NO_DETECTION_GRACE_SEC:
        finalizer_queue.put((window_start_ts, now, reads))   # hand off, §3.3/§3.4 — never block here
        state = "IDLE"
        cooldown_until = now + POST_WINDOW_COOLDOWN_SEC
```

**Constants used above** (from PRD §9 — code constants, not device settings, unless noted):
`DETECT_TRIGGER_CONF` = 0.30 (proposed default = `ocr_min_conf`'s default; if an operator sets
`ocr_min_conf` *below* 0.30 via the settings page, the `box.det_conf >= config.ocr_min_conf` check
in step 3 becomes a no-op since `boxes` from step 2 already excludes anything below
`DETECT_TRIGGER_CONF` — this is expected, not a bug: it just means the trigger threshold is the
effective floor), `OCR_MIN_AREA` = 400 px², `NO_DETECTION_GRACE_SEC` = 1.5s,
`POST_WINDOW_COOLDOWN_SEC` = 1.0s.

**Why the cooldown exists**: without it, a truck whose trailing edge causes one qualifying frame
right as the window closes (duration cap reached) could immediately retrigger a second, spurious
window for the same physical truck. The cooldown suppresses new triggers for 1s after any window
closes.

### 3.3 Consensus Algorithm — exact reuse, not a reimplementation

At `finalize_window(window_start_ts, window_end_ts, reads)` (Window Finalizer thread):

1. If `reads` is empty: `hull_id = "UNKNOWN"`, `confidence = 0.0`, `votes = []`, `read_count = 0`.
   **The crossing event is still submitted** (not silently dropped) — this matches the existing
   app's `UNIDENTIFIED_HULLS = {"UNKNOWN", "ERROR", ""}` sentinel handling
   (`app/core/config.py`), so operators still see that a truck crossed even when it couldn't be
   identified. Skip to step 4 with an empty snapshot handling per §3.4.
2. Otherwise, call the **existing, unmodified** function:
   ```python
   from custom_model.ocr_utils import fuzzy_vote_distribution   # labs/custom_model/ocr_utils.py

   hull_id, confidence, distribution = fuzzy_vote_distribution(
       [(r["text"], r["weight"]) for r in reads]
   )
   ```
   `distribution` is `[{"id": str, "weight": float, "reads": int, "share": float, "winner": bool}, ...]`
   sorted by weight descending (see the function's real implementation — already ported into this
   repo, do not rewrite its clustering logic on the edge).
3. `fuzzy_vote_distribution` does not return each cluster's average OCR confidence, but the API
   contract's `votes[].avg_ocr_conf` field needs one. Compute it by re-associating each read to
   the cluster distance rule the function already applied (Levenshtein distance ≤ 1, the
   function's default `max_dist`):
   ```python
   from custom_model.ocr_utils import _levenshtein   # same module — reuse, don't reimplement

   def avg_ocr_conf_per_cluster(reads, distribution):
       groups = {d["id"]: [] for d in distribution}
       for r in reads:
           closest = min(distribution, key=lambda d: _levenshtein(r["text"], d["id"]))
           groups[closest["id"]].append(r["ocr_conf"])
       return {cid: (sum(v) / len(v) if v else 0.0) for cid, v in groups.items()}
   ```
   This is a thin wrapper written in the edge agent's own code — **do not modify
   `labs/custom_model/ocr_utils.py`** to add this; that module stays exactly as the batch pipeline
   uses it, so both pipelines keep agreeing on the core voting math (PRD Success Criteria).
4. Map `distribution` + the per-cluster `avg_ocr_conf` into the `votes` array for
   `POST /edge/crossings` (API_CONTRACT §1.3): `votes[i] = {"text": distribution[i]["id"],
   "count": distribution[i]["reads"], "avg_ocr_conf": avg_ocr_conf_per_cluster[...][distribution[i]["id"]]}`.

### 3.4 Best Snapshot Selection

Among the `reads` whose normalized text is within the winning cluster (same association rule as
§3.3 step 3, filtered to `closest["id"] == hull_id`): pick the read with the **highest `weight`**
(`det_conf * (ocr_conf or 0.5)`, same value already computed in §3.2); tie-break by **latest
`ts`** (a later frame is more likely to be squarely framed/less motion-blurred as the truck
aligns with the camera). That read's `crop_jpeg` bytes become the `snapshot` multipart field in
`POST /edge/crossings`.

If `reads` was empty (§3.3 step 1, `hull_id = "UNKNOWN"`), there is no snapshot to pick — submit
the crossing with a 1×1 placeholder JPEG or (preferred, if the API allows it — confirm against
API_CONTRACT §1.3 before finalizing) omit the `snapshot` field entirely for that submission.

### 3.5 Heartbeat & Config Polling Loop

Every 30s (Heartbeat Thread):
1. `POST /edge/heartbeat` with `agent_version`, `applied_config_version` (the config version this
   agent has actually applied, from the last successful Config Watcher run), `local_queue_depth`
   (`SELECT COUNT(*) FROM outbox`), `status` ("online", or "maintenance" if locally set — the
   mechanism for a technician to set that locally is out of scope for this spec).
2. If the response's `config_changed` is `true`:
   - Call `GET /edge/config`.
   - Atomically replace the shared config object (§3.1) with the new values.
   - Remember the new `config_version` as `applied_config_version` for the **next** heartbeat —
     there is deliberately up to one heartbeat interval (≤30s) of lag between applying a config
     and reporting it applied; this matches the PRD's "applied within one heartbeat interval"
     success criterion, not sub-second reconciliation.
   - If the `GET /edge/config` call itself fails (network drop between the heartbeat ack and the
     fetch), do nothing further this cycle — keep running with the last-known-good config;
     `config_changed` will still read `true` on the next heartbeat since the reported
     `applied_config_version` still lags, so this is self-healing without extra state.

---

## 4. Local Outbox & Reliability

### 4.1 Schema (SQLite, on-device, e.g. `outbox.db`)

```sql
CREATE TABLE outbox (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    idempotency_key  TEXT NOT NULL UNIQUE,   -- generated once (UUID v4) at finalize time, reused on every retry
    camera_code      TEXT NOT NULL,
    payload_json     TEXT NOT NULL,          -- exact JSON body for the `payload` field, API_CONTRACT §1.3
    snapshot_path    TEXT,                   -- local file path to the JPEG; NULL if §3.4's empty-snapshot case
    created_at       TEXT NOT NULL,          -- ISO 8601 UTC, when the crossing was detected (window close time)
    attempt_count    INTEGER NOT NULL DEFAULT 0,
    next_attempt_at  TEXT NOT NULL,          -- ISO 8601 UTC; row is not sent before this time
    last_error       TEXT                    -- nullable, most recent failure reason (diagnostics only)
);
CREATE INDEX idx_outbox_next_attempt ON outbox(next_attempt_at);
```

The snapshot is a file on disk, not a DB blob, so the DB stays small and fast to scan; the file is
deleted together with its row on success or eviction (§4.4).

### 4.2 Submission Flow (Outbox Sender Thread)

```python
while True:
    row = db.execute(
        "SELECT * FROM outbox WHERE next_attempt_at <= ? ORDER BY id ASC LIMIT 1", [now()]
    ).fetchone()
    if row is None:
        sleep(1.0)
        continue
    try:
        resp = post(
            "/edge/crossings",
            headers={"Authorization": f"Bearer {api_key}", "Idempotency-Key": row.idempotency_key},
            data={"payload": row.payload_json},
            files={"snapshot": open(row.snapshot_path, "rb")} if row.snapshot_path else {},
        )
        if resp.status_code in (200, 201):
            db.execute("DELETE FROM outbox WHERE id = ?", [row.id])
            if row.snapshot_path:
                os.remove(row.snapshot_path)
        else:
            record_failure(row, f"HTTP {resp.status_code}")
    except NetworkError as e:
        record_failure(row, str(e))
```

Rows are sent in `id ASC` order (insertion order = detection order) and **strictly one at a
time** — the next row is never attempted until the current one either succeeds or its retry is
deferred. This guarantees in-order delivery and is a deliberate simplicity choice: a 4-device
fleet's crossing rate never approaches needing parallel submission.

**Every non-2xx response retries with backoff, including 401 and 422** — a 401 might mean a
just-rotated key hasn't propagated everywhere yet, and a crossing event is worse to silently drop
than to leave stuck retrying (visible via `local_queue_depth`, SRS §5). The **only** path by which
a crossing is ever discarded is the explicit ceiling eviction in §4.4.

### 4.3 Retry / Backoff

```python
def record_failure(row, error):
    attempt = row.attempt_count + 1
    delay = min(60, 2 * (2 ** (attempt - 1)))          # 2, 4, 8, 16, 32, 60, 60, 60, ...
    jitter = delay * random.uniform(-0.2, 0.2)
    db.execute(
        "UPDATE outbox SET attempt_count=?, next_attempt_at=?, last_error=? WHERE id=?",
        [attempt, now() + delay + jitter, error, row.id],
    )
```

Same backoff formula is reused for RTSP reconnects (§3.1 Capture Thread) so there is only one
retry policy to implement, not two.

### 4.4 Size Ceiling & Eviction

Proposed default ceiling: **500 MB** on-disk (`outbox.db` file size + all referenced snapshot
files combined) — see PRD §9/§8.3 for why this needs confirming against real Jetson storage.

```python
def enforce_ceiling():
    total = db_file_size() + sum(os.path.getsize(p) for p in all_snapshot_paths())
    while total > OUTBOX_CEILING_BYTES:
        oldest = db.execute("SELECT * FROM outbox ORDER BY id ASC LIMIT 1").fetchone()
        if oldest is None:
            break
        freed = row_size(oldest)
        db.execute("DELETE FROM outbox WHERE id = ?", [oldest.id])
        if oldest.snapshot_path:
            os.remove(oldest.snapshot_path)
        log.warning("outbox ceiling exceeded, dropped crossing", idempotency_key=oldest.idempotency_key)
        total -= freed
```

Run after every successful insert into the outbox. This is the **only** path by which a crossing
is permanently lost, and it only triggers after an outage long enough to fill the ceiling — log it
loudly; a device that has evicted anything should be treated as a `maintenance`-worthy condition,
not a silent statistic.

---

## 5. Central Orchestration

### 5.1 Device Status State Machine

Reuses the existing `Camera.status` enum unmodified: `online` | `offline` | `maintenance`
(`VALID_CAMERA_STATUS` in `app/core/config.py`).

- **Any → `online`**: a heartbeat is received with `status: "online"` in its body; update
  `last_heartbeat_at = now()`.
- **Any → `maintenance`**: a heartbeat is received with `status: "maintenance"` (device
  self-reports; how a technician sets this locally is out of scope here).
- **`online`/`maintenance` → `offline`**: a background sweep, not a heartbeat — see below. A
  device that has gone silent flips to `offline` even if its last self-report was
  `maintenance`, since "no news" should never be displayed as "known, attended maintenance."
- **`offline` → `online`**: the next successful heartbeat.
- A device that has **never** heartbeated (`last_heartbeat_at IS NULL`, e.g. freshly provisioned
  but not yet deployed) is left at whatever its manually-set initial status is (default
  `offline`, per the existing `camera_repo` default) — nothing to sweep until it's heard from once.

**Background sweep** (runs every 30s on the induk, same cadence as the heartbeat interval so
staleness is detected within one extra cycle at most):
```sql
UPDATE cameras
SET status = 'offline'
WHERE status != 'offline'
  AND last_heartbeat_at IS NOT NULL
  AND last_heartbeat_at < datetime('now', '-90 seconds');   -- 3x heartbeat interval, PRD §9
```

### 5.2 Idempotency & Crossing Ingestion

```python
existing = db.execute(
    "SELECT id FROM crossings WHERE idempotency_key = ?", [idempotency_key]
).fetchone()
if existing:
    return 200, {"status": "success", "crossing_id": existing.id, "duplicate": True}

try:
    new_id = insert_crossing(idempotency_key=idempotency_key, ...)   # idempotency_key UNIQUE, §9
    return 201, {"status": "success", "crossing_id": new_id}
except UniqueConstraintViolation:
    # Two retries raced each other between the SELECT and the INSERT above — the UNIQUE
    # constraint (not the SELECT) is the actual concurrency-safe guard.
    existing = db.execute(
        "SELECT id FROM crossings WHERE idempotency_key = ?", [idempotency_key]
    ).fetchone()
    return 200, {"status": "success", "crossing_id": existing.id, "duplicate": True}
```

The `SELECT`-then-`INSERT` is a fast-path optimization; the `UNIQUE` constraint on
`idempotency_key` (§9 Data Model) is what actually prevents a duplicate row under concurrent
retries, not the application-level check.

### 5.3 Config Version Reconciliation — Sequence

```
Operator (frontend)          Induk (central)                     Edge agent
      |  PUT edge-config           |                                   |
      |--------------------------->| config_version: 3 -> 4            |
      |   200 {config_version:4}   |  (persisted on Camera row)        |
      |<----------------------------|                                  |
      |                             |         (up to 30s later)         |
      |                             |<---- POST /edge/heartbeat --------|  applied_config_version: 3
      |                             |---- 200 {config_changed:true} --->|
      |                             |                                   |
      |                             |<----- GET /edge/config -----------|
      |                             |---- 200 {config_version:4, ...} ->|  agent applies new values (§3.5)
      |                             |                                   |  atomic swap, no restart
      |                             |         (next heartbeat, +30s)     |
      |                             |<---- POST /edge/heartbeat --------|  applied_config_version: 4
      |                             |---- 200 {config_changed:false} -->|
      |  GET edge-config             |                                   |
      |---------------------------->| applied_config_version == 4       |
      |  200 {config_version:4,      |  == config_version -> UI shows    |
      |       applied_config_ver:4}  |  "settings saved" (not pending)   |
      |<-----------------------------|                                  |
```

---

## 6. Non-Functional Requirements

| Category | Requirement |
| :--- | :--- |
| **Reliability** | No crossing event is lost due to a transient network outage; the local outbox is durable across an edge process restart (SQLite file survives a restart by construction). |
| **Degraded-network operation** | The edge agent must keep detecting and queuing locally indefinitely, bounded only by the outbox ceiling (§4.4), with zero connectivity to the induk. |
| **Latency (connected)** | A crossing result reaches the induk within one retry cycle (starting at 2s, §4.3) of being computed when the network is healthy. |
| **Config propagation** | A settings change takes effect within one heartbeat interval (≤30s) once the device is back online (§5.3). |
| **Resource fit** | Detection+OCR at the target fps must run within the Orin Nano Super's memory/compute budget without starving the outbox/heartbeat threads — requires a TensorRT-exported YOLO model, not raw PyTorch inference, for headroom. |
| **Security** | API keys are per-device (never shared), transmitted only over TLS, never logged (§4.2's `Authorization` header must be redacted in any request logging). Live-view sessions (§8) use separate short-lived, single-use credentials, never the long-lived device API key. |
| **Auditability** | Every stored crossing has a snapshot (or an explicit empty case, §3.4) and the full vote breakdown (§3.3), not just the final answer. |
| **Public reachability** | The induk must be reachable at a public IP with a TURN relay configured (PRD §7 Key Decision 1) — required for the live-view feature to traverse cellular NAT on the 4 edges. |
| **Thread safety** | Config values are swapped by reference (immutable object replacement), never mutated in place, so the Inference Loop never observes a half-updated config mid-frame (§3.1, §3.5). |

---

## 7. Local Video Retention & Device Provisioning

### 7.1 Local Video Retention

Proposed default (PRD §9, confirm against real Jetson storage — PRD §8.1):
- The Local Video Writer (§3.1) writes rotating **5-minute segment files** of the raw camera feed
  to local disk (independent of detection — this runs regardless of whether any Detection Window
  is active).
- A background sweep, every 10 minutes, deletes the oldest segment(s) whenever **either**: (a) the
  oldest segment's age exceeds **7 days**, or (b) free disk space drops below **10%** — whichever
  triggers first, oldest-first, until neither condition holds.
- This storage and its lifecycle are **entirely separate** from the outbox (§4) — different
  directory, different ceiling, never competes with crossing-event delivery for space or I/O
  priority.

### 7.2 Footage Retrieval (still open — PRD §8's open question #1)

No endpoint is defined yet. Two candidate mechanisms, neither chosen: (a) a remote pull endpoint
(`GET /edge/footage?from=...&to=...`, symmetrical to the live-view control pattern in §8.2) that an
auditor triggers from the dashboard; or (b) physical retrieval only (a technician visits the site
with a USB drive). Do not build either until the PRD's open question is resolved with the
business/hardware owner — building the wrong one costs real time on a 4-device fleet.

### 7.3 Manual Device Provisioning Procedure

Fills in the "provisioning is manual, not automated" Non-Goal (PRD §3) with an actual procedure:

1. Admin creates/edits the gate's `Camera` row via the existing `POST`/`PUT /cameras` endpoints
   (`camera_code`, `name`, `gate_location`, `rtsp_url`, etc.).
2. Admin generates a random API key (e.g. `secrets.token_urlsafe(32)`) and stores **only its
   hash** in `Camera.api_key_hash` (§9) — the plaintext key is never stored centrally, matching
   the Security NFR (§6). The plaintext is handed to whoever is physically provisioning the
   Jetson.
3. The plaintext key is written to the edge agent's local config (e.g. a `.env` file placed during
   initial SSH setup) before first boot — exact mechanism is an edge-agent implementation detail,
   out of scope here.
4. On first successful heartbeat, `last_heartbeat_at` populates and `status` flips to `online`
   (§5.1) — this is how the admin confirms provisioning worked, by checking the dashboard rather
   than SSH-ing back into the device.
5. **Revocation**: admin clears/replaces `api_key_hash` on the `Camera` row. The device's next
   request gets `401`; its outbox grows (bounded by §4.4) until re-provisioned with a new key —
   no separate "revoked" device state is needed beyond the existing 401-retry handling (§4.3).

---

## 8. Live Raw CCTV Viewing — Architecture

Finalized design for the live-view feature (PRD Goals 6/7). This is a separate data path from
crossing results (§3–§5): nothing here touches detection, OCR, or consensus voting, and nothing in
§3–§5 depends on this section.

### 8.1 Components

- **Central media relay** — a WebRTC-capable server (recommended: MediaMTX) running alongside the
  induk backend, with a TURN relay (recommended: coturn) reachable at the induk's public IP (PRD
  §7 Key Decision 1). Handles the actual media (WHIP ingest from edges, WHEP playback to
  browsers); the FastAPI backend only orchestrates *which* session is allowed to be active — it
  never touches video frames itself.
- **Edge WHIP client** — part of the edge agent (Live-Session Long-Poll Thread, §3.1). When
  instructed to go live, pushes raw frames from the **same** ring buffer the Inference Loop reads
  (never a second RTSP connection to the camera, and never with any overlay drawn) to the central
  relay via WHIP.
- **Browser playback** — the frontend's video element connects to the central relay via WHEP.
  Player choice is a frontend concern; any WHEP-compatible player works against this backend.

### 8.2 Why edge-initiated control (not central-initiated)

The edges are behind cellular NAT and cannot be reached inbound — every edge-facing endpoint in
this spec is edge-initiated (heartbeat, config poll, crossing submission), and live-view control
follows the same rule: the induk cannot "push" a start command to an edge on demand. Instead:

- The edge holds a **long-poll** connection open against a dedicated control endpoint
  (`GET /edge/live-session`, ~25s timeout — API_CONTRACT §1.4). Under normal conditions this just
  times out and the edge immediately reopens it.
- The moment an operator requests that gate's live view, the induk resolves the edge's outstanding
  long-poll immediately with the WHIP ingest URL + a short-lived credential, so the stream starts
  within about one round-trip, not up to a full heartbeat interval later.

### 8.3 Session Lifecycle

1. **Start**: operator opens a gate's live view → frontend calls
   `POST /cameras/{camera_code}/live/start` → induk marks a session `requested` for that
   `camera_code` and issues a WHIP credential → the edge's outstanding long-poll (§8.2) returns
   with that credential and begins pushing.
2. **Keep-alive**: while the view is open, the frontend calls
   `POST /cameras/{camera_code}/live/heartbeat` roughly every 10s (PRD §9).
3. **Stop (explicit)**: operator closes the view → frontend calls
   `POST /cameras/{camera_code}/live/stop` → induk ends the session → the edge's next long-poll
   response tells it to stop the WHIP push.
4. **Stop (implicit)**: if the induk hasn't received a keep-alive in ~20s (2 missed, PRD §9), it
   ends the session the same way as an explicit stop — covers a closed tab/lost frontend connection
   without requiring the edge to stream indefinitely.

**Session states** (ephemeral, induk-side, keyed by `camera_code` — see §9 for why this is not
persisted): `requested` → `active` (once the edge's WHIP push is confirmed connected by the media
relay) → `ended`. Only one session may be `requested`/`active` per `camera_code` at a time; a
second `/live/start` for the same `camera_code` while one is already active returns the existing
session's `session_id`/`whep_url` rather than creating a conflicting second one.

### 8.4 Scope and Limits

- One gate at a time **per viewer** — there is no artificial system-wide restriction to a single
  global stream; with only 4 devices, supporting up to 4 concurrent sessions (different operators
  watching different gates) costs nothing extra and needs no special-casing.
- Detection (§3.2) is unaffected by a live session — same capture ring buffer, an extra WHIP
  output, not a competing camera connection or a pause in inference.
- No detection overlay is ever part of this stream (PRD Non-Goal) — if an annotated live view is
  wanted later, it's an on-device/local concern, out of scope for the induk.

---

## 9. Data Model Impact (induk)

The existing `Camera` entity (`app/repositories/camera_repo.py`, `CAMERA_FIELDS` in
`app/core/config.py`) already models one row per gate camera, which fits the "1 camera per site"
rule directly — no new entity for "device," it extends `Camera`. Proposed additive columns (not
yet implemented — this is the planning artifact):

| Column | Type | Nullable | Default | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `api_key_hash` | TEXT | yes (until provisioned) | NULL | Hashed device credential (§7.3); never returned by any read endpoint. |
| `agent_version` | TEXT | yes | NULL | Reported at heartbeat (§3.5); helps diagnose fleet-wide issues. |
| `yolo_fps` | INTEGER | no | 20 | PRD §9. |
| `ocr_fps` | INTEGER | no | 4 | PRD §9. |
| `detect_window_sec` | INTEGER | no | 6 | PRD §9. |
| `ocr_min_conf` | REAL | no | 0.30 | PRD §9. |
| `dedup_iou` | REAL | no | 0.92 | PRD §9. |
| `config_version` | INTEGER | no | 1 | Incremented on every settings write (§5.3); edge reports back which version it applied. |
| `last_heartbeat_at` | TEXT (ISO 8601 UTC) | yes | NULL | Drives §5.1's offline sweep. |
| `last_config_applied_at` | TEXT (ISO 8601 UTC) | yes | NULL | What the dashboard shows next to "settings saved." |
| `local_queue_depth` | INTEGER | no | 0 | Last-reported outbox size from the device (§4), for the health widget. |

`crossings` (or whatever backs `app/repositories/run_write_repo.py` /
`video_results_repo.py` today) gains:

| Column | Type | Nullable | Default | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `idempotency_key` | TEXT | no | — | **`UNIQUE`** — the real concurrency-safe de-duplication mechanism (§5.2), not an application-level check. |
| `source` | TEXT | no | `"batch"` | `"batch"` for the existing playlist pipeline, `"edge"` for crossings arriving via `POST /edge/crossings` — lets reports distinguish provenance without inferring it from other fields. |

The edge path is a new **producer** into the same crossing store (existing dashboard/report
queries are unaffected), not a parallel data model.

**Live-view sessions (§8) are ephemeral, not part of this persisted schema** — a session exists
only in memory/a short-lived cache on the induk for its duration (`requested` → `active` →
`ended`), keyed by `camera_code`. There is nothing to migrate or back up here; it is
request-scoped state, not device configuration.

---

## 10. Reuse vs. New Build & Module Layout

| Component | Source |
| :--- | :--- |
| YOLOv8 hull-ID detector | Existing `ai-model/pak-shomad-v2.pt`, exported to TensorRT for the edge. |
| OCR | Existing PaddleOCR-VL pipeline (`labs/custom_model/ocr_utils.py`) — confirm it sustains 4fps on Orin Nano Super under real thermal/power conditions; fall back to a lighter PaddleOCR variant if not (§11 Risks — not yet benchmarked on this hardware). |
| Consensus voting | Existing `fuzzy_vote_distribution`/`normalize_hull_id`/`pad_crop`/`run_ocr_on_crop`/`_levenshtein` (`labs/custom_model/ocr_utils.py`) — reused unmodified, called exactly as described in §3.3, so live and batch pipelines agree on the core voting math. |
| Camera registry / settings storage | Existing `Camera` entity, extended per §9. |
| Dashboard / reports / audit trail | Existing, unchanged; new data just flows into it via the `source` column (§9). |
| Detection Window state machine, local outbox, local video retention, heartbeat/config client, live-view WHIP client | **New** — the edge-agent build itself, in a new `edge/` subfolder (layout below). |
| Edge-facing ingestion/config/heartbeat/live-session API on the induk | **New** — see `API_CONTRACT.md` §1. |
| Dashboard-facing edge-config/live endpoints on the induk | **New** — see `API_CONTRACT.md` §2. |
| WebRTC media relay (WHIP ingest / WHEP playback) + TURN | **New** infrastructure — MediaMTX + coturn recommended, run alongside (not inside) the FastAPI process. |

**Proposed `edge/` subfolder layout:**
```
backend/
  edge/
    pyproject.toml          # separate from the root pyproject.toml — different platform target (ARM64/JetPack)
    agent/
      __init__.py
      main.py                # entrypoint: wires up and starts every thread in §3.1
      capture.py              # Capture Thread — RTSP -> ring buffer, reconnect/backoff (§4.3 formula)
      pipeline.py               # Detection Window state machine (§3.2) + Window Finalizer (§3.3/§3.4)
      outbox.py                  # SQLite schema (§4.1) + Outbox Sender Thread (§4.2/§4.3/§4.4)
      heartbeat.py                 # Heartbeat + Config Watcher (§3.5)
      live_view.py                   # Live-Session Long-Poll Thread + WHIP push (§8.2)
      video_retention.py               # Local Video Writer + retention sweep (§7.1)
      config.py                          # Shared config dataclass + atomic swap helper (§3.1, §6 thread safety)
    Dockerfile.jetson                    # ARM64/JetPack-based image, separate from the root Dockerfile
```
`pipeline.py` imports `labs/custom_model/ocr_utils.py` functions directly (same repo — add
`labs/` to `sys.path` the same way `app/core/config.py` already does) rather than forking or
copying them, so both pipelines can never silently drift apart.

**Proposed central-side new modules:**
```
backend/app/
  routers/
    edge.py          # NEW: /edge/config, /edge/heartbeat, /edge/crossings, /edge/live-session
    live.py           # NEW: /cameras/{code}/live/start|heartbeat|stop
  services/
    edge_devices.py    # NEW: device auth (api_key_hash check), config read/write, heartbeat handling
    device_status.py    # NEW: §5.1's background offline sweep
    live_sessions.py     # NEW: ephemeral session state (§8), WHIP/WHEP URL issuance
  repositories/
    edge_repo.py          # NEW: Camera table extension read/write helpers (§9)
```

---

## 11. Risks

| Risk | Mitigation |
| :--- | :--- |
| PaddleOCR-VL (transformer OCR) may not sustain 4fps on Orin Nano Super under real thermal/power conditions | Benchmark early against §3.2's actual throttled loop, not a synthetic benchmark; have a lighter OCR fallback identified before committing to the transformer model on-device. |
| Unreliable WiFi/cellular causes outbox growth faster than it drains | Bounded by the ceiling (§4.4) and surfaced via `local_queue_depth` on the dashboard (API_CONTRACT §2.1/§2.3) rather than failing silently. |
| Settings desync between what the dashboard shows as "saved" and what's actually running on a device | §5.3's applied-config-version reporting exists specifically to make this visible instead of assumed. |
| Duplicate crossings from retried submissions | §5.2's `idempotency_key` `UNIQUE` constraint — an actual DB-level guarantee, not just an application check. |
| Cellular NAT still defeats WebRTC even with TURN (symmetric NAT edge cases, carrier-side blocking) | Not fully eliminable in theory; test against the actual SIM/carrier the devices use early, don't assume standard TURN behavior holds on every cellular network. |
| Opening a second connection to the camera for live view exceeds its concurrent-RTSP-client limit | Avoided by design (§8.1): the live push reuses the same capture ring buffer already open for detection, never a second RTSP connection to the physical camera. |
| Detection Window state machine misfires on a stationary/idling truck (e.g. queued at a gate) — `detect_window_sec` cap would close the window mid-truck, and the cooldown (§3.2) could suppress the immediate re-trigger for its continued presence, undercounting or mis-timing the crossing | Accepted for v1: `detect_window_sec` (5–7s) is short enough that a queued truck simply produces multiple sequential crossing events rather than one — acceptable since ritase pairing (existing `app/services/ritase.py`) already reconciles IN/OUT pairs downstream. Flag for revisit if false-multiple-crossings from queued trucks shows up in real data. |
| `avg_ocr_conf` re-association in §3.3 step 3 (distance-based, not the exact membership `fuzzy_vote_distribution` used internally) can occasionally group a read into a different cluster than the original clustering did, if two clusters are equidistant | Low-impact (only affects the diagnostic `avg_ocr_conf` field, never the winning `hull_id` itself, which comes directly from the reused function); acceptable approximation rather than modifying the shared `ocr_utils.py` clustering function to expose real membership. |
