# 4. End-to-End Edge to Core Data Flow Architecture

This document details the complete step-by-step end-to-end data flow for every key operation in the Smart Gate Hauling System: Detection & Ingestion, Heartbeat & Configuration Tuning, Master Replica Sync, and Live View CCTV Control.

---

## 1. Flow 1: Detection Window to Core Ingestion Flow

This flow triggers whenever a hauling truck passes a gate camera.

```
[ Gate Camera Stream ]
       │ (RTSP / Video Capture)
       ▼
[ Edge Agent: Capture Thread ] ──── (Frames) ────► [ Dynamic Sampler (YOLO FPS) ]
                                                            │
                                                            ▼
                                                   [ YOLO Detector ] ── (Truck / Plate BBox)
                                                            │
                                                            ▼
                                                   [ Dynamic Sampler (OCR FPS) ]
                                                            │
                                                            ▼
                                                   [ PaddleOCR Engine ] ── (Raw Text Candidates)
                                                            │
                                                            ▼
                                                   [ Detection Window Accumulator ]
                                                            │ (Window Closes after N sec)
                                                            ▼
                                                   [ Consensus Voting Engine ]
                                                            │ (Consensus Cluster & Top Candidate)
                                                            ▼
                                                   [ Local Hull Matcher ]
                                                            │ (Matches vs local `trucks` replica)
                                                            ▼
                                            ┌───────────────┴───────────────┐
                                            ▼                               ▼
                                 [ Local Store (edge.db) ]      [ Outbox Queue (outbox.db) ]
                                 (Record local crossing)        (Enqueue persistent queue)
                                                                            │
                                                                            ▼
                                                                  [ Outbox Sender Thread ]
                                                                            │
                                                                            ▼ (HTTP POST multipart/form-data)
                                                                  [ Core API: /api/edge/crossings ]
                                                                            │
                                                                            ▼
                                                                  [ Core Bearer Authentication ]
                                                                            │
                                                                            ▼
                                                                  [ Core Ingestion Service ]
                                                                            │ (Hull Re-match & Outbound Pit Logic)
                                                                            ▼
                                                                  [ Core Database (smart_hauling.db) ]
                                                                  (Write to `video_results`)
                                                                            │
                                                                            ▼
                                                                  [ HTTP 201 Created Response ]
                                                                            │
                                                                            ▼
                                                                  [ Edge Mark Synced (synced=1) ]
```

---

### Detailed Step-by-Step Data Flow & Function Calls

#### Step 1: Capture & Frame Preprocessing (`edge/backend/agent/capture.py`)
* Camera video stream is read frame-by-frame via OpenCV `cv2.VideoCapture` or RTSP pipeline.
* Frame is passed to `IdleView` service (`edge/backend/app/services/idle_view.py:update_latest_frame`) to drive local gate console MJPEG live stream.

#### Step 2: YOLO Object Detection (`edge/backend/agent/inference.py`)
* Frame is sampled at `yolo_fps` rate (default: 20 FPS).
* `YOLOInference.detect(frame)` finds license plate / vehicle hull region bounding boxes.

#### Step 3: OCR Recognition & Consensus Accumulation (`edge/backend/agent/pipeline.py`)
* Detected bounding box crop is sampled at `ocr_fps` rate (default: 4 FPS).
* `PaddleOCR.recognize(crop)` extracts raw digits text strings.
* Detections accumulate inside `DetectionWindow` buffer for `detect_window_sec` duration (default: 6 seconds).

#### Step 4: Consensus Voting (`edge/backend/agent/consensus.py`)
* At window close, `aggregate_votes(candidates)` clusters candidates by fuzzy string similarity.
* Winner raw code, candidate count, average OCR confidence score, and cluster JSON are produced.

#### Step 5: Local Hull Matching & Store (`edge/backend/app/services/local_matcher.py`)
* Local gate matches raw code against local SQLite database `edge.db` (`store.py:get_by_hull_code`).
* Local event recorded via `store.py:record_crossing()` with `synced = 0`.
* JPEG crop saved to `./data/crossing-snapshots/{uuid}.jpg` via `store.py:save_snapshot()`.

#### Step 6: Outbox Persistence & Retries (`edge/backend/agent/outbox.py`)
* Agent enqueues crossing to `outbox.db` via `Outbox.enqueue()`. A persistent UUID v4 `idempotency_key` is generated.
* Dedicated background thread `OutboxSender` fetches next due row (`Outbox.next_due()`).

#### Step 7: Core Ingestion HTTP POST (`edge/backend/agent/induk_client.py`)
* Client performs HTTP `POST /api/edge/crossings` with headers:
  * `Authorization: Bearer <API_KEY>`
  * `Idempotency-Key: <UUID_V4>`
* Form Data Payload:
  * `payload`: `CrossingPayload` JSON string.
  * `snapshot`: Multipart image JPEG binary stream (`crop.jpg`).

#### Step 8: Core Authentication & Validation (`core/backend/app/routers/edge.py`)
* `authenticate_device` validates Bearer token against SHA-256 hashes in `cameras.api_key_hash`.
* UUID v4 format and camera code match are verified.

#### Step 9: Core Matching & Ingestion Service (`core/backend/app/services/edge_ingest.py`)
* `edge_ingest.record_crossing()` checks for duplicate `idempotency_key` via `run_write_repo.find_by_idempotency_key()`.
* Performs server-side validation & matching via `hull_matcher.match_hull()`.
  * If gate direction is `"outbound"`, queries current pit occupancy (`pit_occupancy.get_pit_trucks()`) to resolve candidate ambiguity.
* Saves crop snapshot file permanently to Core media storage directory.
* Inserts row into `video_results` via `run_write_repo.insert_edge_crossing()`.

#### Step 10: Server Response & Local Confirmation
* Core returns `201 Created` with `{"status": "success", "crossing_id": 1042}` (or `200` with `{"duplicate": true}`).
* `OutboxSender` receives 201 response, calls `Outbox.delete()`, and triggers callback `store.mark_synced(idempotency_key)`. Local `crossings` record is updated to `synced = 1`.

---

## 2. Flow 2: Device Heartbeat & Dynamic Config Propagation

This flow keeps device telemetry updated and propagates setting changes made on the central dashboard down to edge devices.

```
[ Dashboard Operator ] ──── (Edit FPS / Window) ──► [ PUT /api/cameras/{code}/edge-config ]
                                                                  │
                                                                  ▼
                                                      [ Core: camera_repo ]
                                                      (Bumps config_version = N + 1)
                                                                  ▲
                                                                  │ (Compares version)
[ Edge Heartbeat Thread ] ─── (POST /api/edge/heartbeat) ──────────┘
           │
           ▼
[ Response: {"config_changed": true, "config_version": N + 1} ]
           │
           ▼
[ Edge Client: GET /api/edge/config ] ──► [ Returns authoritative settings ]
           │
           ▼
[ Edge Pipeline applies new parameters dynamically ]
```

### Detailed Sequence
1. **Config Modification:** Dashboard user updates dynamic parameters (e.g. YOLO FPS from 20 to 15) via `PUT /api/cameras/{code}/edge-config`. `edge_repo.update_edge_config()` increments `config_version` integer.
2. **Heartbeat Execution:** Edge agent heartbeat thread sends `POST /api/edge/heartbeat` every 15 seconds containing `applied_config_version` and `local_queue_depth`.
3. **Version Check:** Core `post_heartbeat()` compares device's `applied_config_version` with database `config_version`.
4. **Heartbeat Response:** Returns `{"status": "success", "config_version": 4, "config_changed": true}`.
5. **Config Fetch:** If `config_changed == true`, edge agent immediately issues `GET /api/edge/config`.
6. **Apply & Update:** Edge agent updates its runtime sampling loop parameters dynamically and reports `applied_config_version = 4` on the next heartbeat. Core then updates `last_config_applied_at`.

---

## 3. Flow 3: Master Truck Registry Synchronization Flow

Ensures edge devices maintain an updated local replica of the 276+ hauling truck master list.

```
[ Core Operator ] ──── (Upload Excel / CSV) ──► [ POST /api/master/import ]
                                                          │
                                                          ▼
                                              [ Core: truck_master_repo ]
                                              (Upserts trucks & increments version)
                                                          ▲
                                                          │ (Version-gated check)
[ Edge Master Sync Thread ] ── (GET /api/edge/master?known_version=N) ──┘
           │
           ├───────────────────────────────┐
           ▼                               ▼
 [ changed == false ]             [ changed == true ]
 (No-op, zero bandwidth)          (Receives JSON array of trucks)
                                           │
                                           ▼
                                  [ store.replace_master() ]
                                  (Atomically replaces local trucks table)
```

### Detailed Sequence
1. **Master Update at Core:** Operator imports new spreadsheet. `truck_master_repo.upsert_many()` updates `trucks` table and updates `master_version`.
2. **Periodic Edge Poll:** Edge device periodically polls `GET /api/edge/master?known_version=N` (where `N` is local `master_version`).
3. **Lightweight Guard:** If versions match, Core returns `{"changed": false, "master_version": N}` with no data payload, saving cellular bandwidth.
4. **Full Replica Swap:** If version moved, Core returns full list of trucks. Edge calls `store.replace_master()`, clearing local `trucks` table and re-populating it atomically inside an SQLite transaction.

---

## 4. Flow 4: Live View CCTV Control Stream Flow

Allows central dashboard operators to open an on-demand live video feed from any gate Jetson.

```
[ Dashboard UI ] ─── (Click "Live Stream") ──► [ POST /api/live/start/{camera_code} ]
                                                              │
                                                              ▼
                                                   [ Core: live_sessions ]
                                                   (Creates session_id & action request)
                                                              ▲
                                                              │ (Long-Poll Hold)
[ Edge Agent: Live Poll Thread ] ── (GET /api/edge/live-session?wait=30) ──┘
           │
           ▼
[ Returns Action: {"action": "start_stream", "stream_url": "..."} ]
           │
           ▼
[ Edge Agent starts local WebRTC/RTSP relay stream to Core ]
           │
           ▼
[ Dashboard UI receives live WebRTC / MJPEG feed ]
```
