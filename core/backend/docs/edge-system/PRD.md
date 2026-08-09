# PRD — Smart Gate Edge Devices (Live Camera Pipeline)

**Status:** Implemented (backend + edge agent) · dashboard pages pending on the `frontend` branch
**Scope:** The edge/central split for live CCTV-based hull-ID detection, described in this
document and its companions [`SRS.md`](./SRS.md) and [`API_CONTRACT.md`](./API_CONTRACT.md).

> This document supersedes nothing else in `docs/`. The existing `docs/PRD.md` and
> `docs/feature-list.md` describe a different, unimplemented hardware vision (solar towers,
> UHF radio telemetry, Next.js frontend, etc.) that does not match this codebase and is
> intentionally **not** referenced here. Treat this folder as the authoritative spec for the
> edge work currently being built.

---

## 0. Glossary

Every term below is used with exactly this meaning everywhere in this folder — SRS.md and
API_CONTRACT.md do not redefine them.

| Term | Meaning |
| :--- | :--- |
| **Induk** | The central backend — this repo (`backend/`), unchanged in role: dashboard, DB, reports. |
| **Anak / Edge / Edge agent** | The new software running on one Jetson Orin Nano Super at one gate. One anak per gate, 4 total. |
| **Gate** | A physical checkpoint with exactly one camera. Identified by `camera_code` (e.g. `GATE-A`). |
| **Device** | Synonym for the Jetson running the edge agent at a gate. 1 device = 1 gate = 1 camera = 1 row in the `Camera` table (SRS §5). |
| **Crossing** | One truck passing a gate, identified by the edge over one Detection Window and reported to the induk as one event. |
| **Detection Window** | The bounded period (5–7s target) during which the edge accumulates YOLO+OCR reads for a single crossing, ended by the state machine in SRS §3.2. |
| **Read** | One (normalized hull-ID text, weight) pair produced by OCR on one detected+cropped frame during a window. Multiple reads feed one consensus vote. |
| **Consensus / Vote** | The fuzzy-clustering algorithm (SRS §3.3, reusing `labs/custom_model/ocr_utils.fuzzy_vote_distribution`) that turns a window's reads into one final hull ID + confidence. |
| **Hull ID** | The truck identifier printed on the vehicle (e.g. `DT-118`) that the system exists to read. |
| **Outbox / local queue** | A durable, on-device store of crossing events not yet acknowledged by the induk (SRS §4). |
| **Idempotency key** | A UUID the edge generates once per crossing and reuses on every retry of that crossing's submission, so the induk can safely de-duplicate. |
| **Config version** | An integer on the `Camera` row, incremented every time an operator saves new device settings; the device reports back which version it has actually applied. |
| **Heartbeat** | A periodic (30s) message from edge to induk reporting health; absence of heartbeats is how the induk infers a device is offline. |
| **Live session** | A short-lived, on-demand WebRTC connection carrying one gate's *raw* camera feed to one dashboard viewer (SRS §8). Entirely separate from crossings/consensus. |
| **WHIP** | WebRTC-HTTP Ingestion Protocol — how the edge pushes its live feed *into* the central media relay. |
| **WHEP** | WebRTC-HTTP Egress Protocol — how a browser pulls a live feed *out of* the central media relay. |
| **TURN** | A relay server (coturn) that lets WebRTC traffic traverse NAT/firewalls it can't punch through directly — required because the 4 edges are behind cellular NAT. |
| **RTSP** | The protocol assumed for camera → edge video (via the existing `Camera.rtsp_url` field); see PRD §8 open question #2. |

## 1. Background & Problem

Today, `backend/` (the induk) only processes **pre-recorded video clips** dropped into
`data/01-playlist/<camera-folder>/` — there is no live camera ingestion, and no per-device
settings. Each gate has exactly one CCTV camera. The company has purchased 4× **NVIDIA Jetson
Orin Nano Super** mini PCs, one per gate, to run detection live instead of processing footage
after the fact.

Direct instruction from the business owner (translated/paraphrased):

> Per location there is only 1 camera, so the dashboard should show camera 1 only. The Jetson
> hardware bought is the "Nano" compute tier — frame processing rates must be adjustable from a
> settings page. Preferred defaults: YOLO 18–25 fps; OCR 4 fps; detect over a 5–7 second window;
> and take a consensus across all detections/OCR reads in that window to find the most accurate
> hull ID. Continue development of the edge part (4 edge devices, each with 1 CCTV).

A follow-up clarification, restated precisely: **the main server (induk) dashboard can view a
gate's raw CCTV feed, but never a live detection overlay** — the only place inference results
ever reach the dashboard is as discrete, already-consensus-voted crossing events. Live video and
detection results are two independent data paths (PRD §6 Goal 6/7, SRS §8).

## 2. Goals

1. Each of the 4 gates runs detection **live**, locally, on its Jetson — not by uploading video
   for the central server to process.
2. Per-device inference rate (YOLO fps, OCR fps, detection window) is tunable from a **central
   settings page**, without touching the device physically.
3. The central dashboard keeps working as today (fleet registry, reports, audit trail) and gains
   visibility into each edge device's health (online/offline, last seen, pending-sync backlog).
4. The system tolerates unreliable WiFi/cellular between gate and central server without losing
   crossing events.
5. Every reported crossing remains auditable: a hull-ID reading is always backed by a snapshot
   image and a full vote breakdown, and — for disputes — the source footage is retrievable from
   the edge device's local storage.
6. An operator can open **any one gate's raw camera feed live**, on demand, from the central
   dashboard — real-time video (WebRTC), not a refreshing snapshot.
7. There is no live detection/annotation overlay anywhere in the central dashboard. Inference
   results only ever reach the dashboard as discrete, already-consensus-voted crossing events
   (Goal 5); the live view (Goal 6) is always the unmodified raw camera feed.

## 3. Non-Goals (explicitly out of scope for this iteration)

- Rugged/solar hardware, UHF radio telemetry, multi-camera-per-gate — not applicable; there is
  one camera per gate and the devices are mini PCs, not embedded towers.
- Payload/volumetric estimation, tire/chassis inspection, ERP/FMS deep integration — future work,
  not part of this spec.
- Automatic device provisioning/zero-touch enrollment — devices are provisioned manually by an
  admin for a 4-device fleet; not worth automating yet (see SRS §7.3 for the manual procedure).
- Pushing raw video or full evidence clips to the central server on every crossing by default —
  the only continuous video path is the on-demand live view (Goal 6), which is architecturally
  separate from crossing evidence (a snapshot only, per crossing).
- **Live detection overlay on the central dashboard** (Goal 7). If a live annotated view is ever
  wanted, it is a local/on-device concern (e.g. an HDMI-attached monitor at the gate), never
  something the induk serves to a browser.
  - **Built, and it stayed on the device.** The gate console now shows the annotated feed
    (`GET /api/live/stream`, MJPEG) rendered by the gate's *own* FastAPI over the LAN —
    `edge/backend/agent/annotate.py` and `agent/live_state.py`. The induk serves nothing
    annotated, and the on-demand live view it does serve (Goal 6, `agent/live_view.py`) is still
    the unmodified raw feed. Neither the annotated frames nor the OCR sample crops cross the
    site's satellite link. This is the "local/on-device" case this bullet allowed for, with a
    browser on the LAN standing in for the HDMI monitor.
- Multi-tenant/role-based access control design — this spec assumes a single trusted operator
  role for the dashboard, matching the existing app's current lack of auth on `/api/*`. If
  dashboard auth is added later, it wraps around this spec, it doesn't change it.

## 4. Users & Use Cases

| User | Need |
| :--- | :--- |
| **Site operations / production manager** | See live, accurate hull-ID crossings per gate on the existing dashboard, without caring which gate's camera hardware is doing the work. |
| **Backend/ops engineer (you)** | Tune each device's fps/window without SSH-ing into a Jetson in the field; see at a glance which of the 4 devices is offline or falling behind. |
| **Frontend engineer** | Needs a stable API contract to build the settings page, device-health UI, and live-view player in parallel with edge firmware work. |
| **Auditor (dispute resolution)** | Needs to trace a reported hull-ID back to a snapshot always, and to raw footage on request, when a reading is contested. |

## 5. Requirements Summary (see SRS.md for full detail)

1. **Edge inference**: YOLOv8 detection + OCR + fuzzy-cluster consensus voting (reusing
   `labs/custom_model/ocr_utils.py` exactly, SRS §3.3), running locally on each Jetson against its
   one RTSP camera stream, with fps/window as configurable parameters, gated by an explicit
   per-crossing state machine (SRS §3.2) — not a fixed, always-on sampling cadence.
2. **Settings**: central-authoritative, per-device config (`yolo_fps`, `ocr_fps`,
   `detect_window_sec`, plus existing pipeline tunables `ocr_min_conf`/`dedup_iou`), pushed to
   edge via poll — edge falls back to its last-known-good config if central is unreachable.
3. **Sync**: edge sends only a lightweight result (JSON) + one best snapshot image per crossing —
   no routine video upload. A local outbox queue on the edge buffers events through network
   outages and retries with backoff (SRS §4).
4. **Auth**: each device authenticates to the central API with a per-device API key.
5. **Health**: each device sends a periodic heartbeat; the central dashboard shows per-gate
   online/offline/maintenance status (existing `Camera.status` enum) and queue backlog.
6. **Local evidence**: each edge keeps a rolling local buffer of raw/annotated footage,
   independent of what's synced centrally, for on-site retrieval during disputes (SRS §7).
7. **Live view**: on operator request, one gate's raw camera feed streams to the central
   dashboard in real time over WebRTC (edge → central media relay → browser), independent of the
   crossing-result path (SRS §8).

## 6. Success Criteria

| Metric | Target |
| :--- | :--- |
| Crossing events lost due to network outage | 0 — buffered locally and delivered once connectivity returns |
| Time to change a device's fps settings | No physical access to the Jetson required; change from the dashboard, applied within one heartbeat interval (≤30s) |
| Dashboard visibility into device health | Operator can tell, without SSH, whether a given gate's edge device is online and how many events are queued locally |
| Consensus accuracy | Matches the existing batch pipeline's accuracy on the same footage bit-for-bit for the voting math itself (same functions, SRS §3.3), now triggered by a live window instead of a whole clip |
| Live view start latency | Opening a gate's live view results in visible video within a few seconds, on demand — no continuous streaming while unwatched |
| Duplicate crossings from retried submissions | 0 — enforced by the idempotency-key uniqueness constraint (SRS §5.2) |

## 7. Key Decisions

Settled during scoping — recorded here so they aren't re-litigated as "open" in the SRS/API docs:

1. **Central hosting: cloud-hosted / public IP.** Required for the live-view feature's TURN
   relay — cellular NAT on the 4 edges otherwise defeats direct peer connections.
2. **Live view fidelity: real-time WebRTC**, not a refreshing snapshot. Accepted the added
   infrastructure (media relay + TURN, SRS §8) explicitly in exchange for smooth video.
3. **Live view is on-demand, one gate at a time per viewer** — no continuous 24/7 streaming from
   any edge, and no artificial system-wide cap preventing different operators from viewing
   different gates simultaneously (SRS §8.4).
4. **Live raw feed is architecturally separate from detection.** The edge never burns detection
   overlays into the WHIP push; the induk never derives crossing data from the live feed.
5. **Numeric tunables and their defaults are centralized** in §9 below — every other document
   references that table rather than restating numbers, to prevent drift.

## 8. Open Questions

Everything with a clear, safe default has been resolved with an explicit value in §9 (marked
`(proposed default)`) so implementation is never blocked on these — but they should still be
confirmed with the business/hardware owner before the corresponding behavior ships as final:

1. **Local video retention window** — §9 proposes 7 days / free-space-based eviction as a
   starting default (SRS §7.1); confirm against actual storage capacity on the purchased Jetsons
   and real dispute-resolution turnaround time.
2. **Camera stream protocol** — RTSP is assumed (the existing `Camera.rtsp_url` field implies it)
   and all pipeline detail in SRS §3 is written against RTSP; needs confirming against what's
   actually configured on the 4 physical cameras before the edge agent is pointed at them.
3. **Offline-queue ceiling** — §9 proposes a size-based cap (SRS §4.4); confirm the Jetson's
   actual local storage size (NVMe/eMMC capacity) once known, since the cap should leave headroom
   for the local video buffer (item 1) on the same disk.

4. **OCR throughput — NOW THE CRITICAL PATH, with first real numbers.** SRS §11 flagged that
   PaddleOCR-VL might not sustain `ocr_fps` = 4 on an Orin Nano Super. First measurement against
   the real model, via the shared `run_ocr_on_crop` helper, on **x86 CPU** (no CUDA):

   | Stage | Measured | Target (§9) | Verdict |
   | :--- | :--- | :--- | :--- |
   | YOLO detect, 1080p | 41 ms/frame — **24 fps** | `yolo_fps` 20 | comfortable, even on CPU |
   | PaddleOCR-VL per crop | 12–15 s — **0.08 fps** | `ocr_fps` 4 | **~50x short** |

   Accuracy is not the problem — `830E`, `DT-118`, `5061` all read exactly right at 0.90
   confidence. Throughput is. Caveat: this is CPU-only; the Orin Nano Super has a GPU. But the
   model is a 0.9B-parameter vision-language transformer, and closing a 50x gap on that hardware is
   a large ask. Worked example at a plausible 10x GPU speedup: ~1.2 s/read x ~10 reads per 6 s
   Detection Window = ~12 s of OCR per crossing, still 2x slower than real time.

   **Action:** benchmark on the actual Jetson before committing, and identify the lighter OCR
   fallback SRS §11 asks for. Nothing in the build blocks on this — `ocr_fps` is already a
   per-device setting and the OCR call sits behind one interface — but the fallback decision does.

   **RESOLVED (2026-08-08). The lighter fallback exists, and it is now the default.**
   Re-measured against 15 clips of real mining footage
   (`docs/sample-references/sample-video/`), same YOLO boxes and same `pad_crop` for both
   engines so only the recogniser differs:

   | Engine | Weights | Per crop | Correct (13 legible clips) |
   | :--- | :--- | :--- | :--- |
   | PP-OCRv6 tiny rec | **4.5 MB** | **15 ms, CPU** | 12/13 |
   | PaddleOCR-VL 1.6 | 1.8 GB | 514 ms, RTX 2060 | 13/13 |

   Two corrections to the numbers above. The 12–15 s figure was **CPU-only**; on a GPU
   PaddleOCR-VL is 0.5 s/crop, ~25x better than recorded, though still short of `ocr_fps` 4.
   And the gap the tiny recogniser closes is not 50x but ~35x — *on worse hardware*, at 1/400th
   the download. `ppocrv6-tiny` is therefore the default (`agent/ocr_backends.py`), with
   `paddleocr-vl` selectable per device via `SMART_GATE_OCR_BACKEND`.

   The one clip the tiny model loses is a low-contrast, motion-blurred plate (true `5806`; it
   voted `J808`). It loses it **loudly** — a 0.29 vote share against its usual 1.00 — so the
   consensus confidence already flags it rather than reporting a confident wrong answer.
   PaddleOCR-VL reads that plate correctly but at 0.49 share, so it is a hard frame either way.

   Also note the tiny model's characteristic errors are letter-for-digit substitutions
   (`56D0`, `5EO0`, `S0D`), which is exactly what `hull_matching._DIGIT_CONFUSIONS` was built
   for — and single-character misreads already cluster together in the Levenshtein-1 consensus
   vote before matching ever runs. `E→6` is *not* in that table and would help here; it was
   deliberately not added, because changing a file that must stay byte-identical across core and
   edge on the evidence of 15 clips of non-fleet footage is not warranted.

   **Still open:** none of this was measured on an actual Orin Nano Super. The tiny recogniser's
   15 ms is CPU-measured on x86 and has that much headroom to give; PaddleOCR-VL's 0.5 s does not.

---

## 9. Canonical Defaults & Tunables

Single source of truth. SRS.md and API_CONTRACT.md reference these by name; if a value needs to
change, change it here first.

| Name | Default | Range / Notes | Configurable per-device? |
| :--- | :--- | :--- | :--- |
| `yolo_fps` | 20 | 18–25 per business owner; API allows 1–30 | Yes (dashboard settings) |
| `ocr_fps` | 4 | ~4 per business owner; API allows 1–15 | Yes |
| `detect_window_sec` | 6 | 5–7 per business owner; API allows 1–30. Max duration of one Detection Window (SRS §3.2). | Yes |
| `ocr_min_conf` | 0.30 | 0.0–1.0. Existing pipeline gate, reused as-is (SRS §3.3). | Yes |
| `dedup_iou` | 0.92 | 0.0–1.0. Existing pipeline gate, reused as-is (SRS §3.3). | Yes |
| `ocr_min_area` | 400 (px²) | Existing pipeline gate (`labs/custom_model/video_processor.py`), reused as-is. | No — not exposed as a device setting; a code constant, changeable only by redeploying the agent. |
| `detect_trigger_conf` *(new)* | = `ocr_min_conf` (0.30) | Minimum YOLO box confidence to open a new Detection Window (SRS §3.2). Proposed default: same value as `ocr_min_conf` so "worth OCR-ing" and "worth opening a window for" agree by default. | No — code constant for now; promote to a device setting later if real-world tuning needs it. |
| `no_detection_grace_sec` *(new, proposed default)* | 1.5s | How long a window tolerates zero qualifying detections before closing early (truck has left frame) — SRS §3.2. | No |
| `post_window_cooldown_sec` *(new, proposed default)* | 1.0s | Minimum gap after a window closes before a new one can open — prevents one physical truck's trailing edge re-triggering a second window (SRS §3.2). | No |
| Heartbeat interval | 30s | SRS §3.5 / API_CONTRACT §1.2 | No — code constant |
| Offline threshold | 3 missed heartbeats (~90s) | SRS §3.5 | No |
| Live-session long-poll `wait` | 25s | API_CONTRACT §1.4 | No |
| Live-session viewer keep-alive interval | 10s | API_CONTRACT §2.4 | No |
| Live-session stale timeout | 20s (2 missed keep-alives) | API_CONTRACT §2.4 / SRS §8.3 | No |
| Outbox retry backoff | 2s initial, ×2 per attempt, capped at 60s, ±20% jitter | SRS §4.3 | No |
| Outbox size ceiling *(proposed default)* | 500 MB on-disk (SQLite file + pending snapshot blobs) | Oldest-first eviction beyond this (SRS §4.4). Confirm against real Jetson storage (PRD §8.3). | No |
| Local video retention *(proposed default)* | 7 days rolling, oldest-first eviction; also evicts early if free disk < 10% | SRS §7.1. Confirm against real Jetson storage (PRD §8.1). | No |

---

See [`SRS.md`](./SRS.md) for the functional/non-functional requirements, algorithms, and
architecture, and [`API_CONTRACT.md`](./API_CONTRACT.md) for the concrete endpoints and payloads.
