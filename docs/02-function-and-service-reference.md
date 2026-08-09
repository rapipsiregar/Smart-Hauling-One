# 2. Complete Function, Service & Repository Reference

This document catalogs every function across routers, services, repositories, and edge agent background threads in both **Core Backend (Induk)** and **Edge Backend (Gate Device)**.

---

## 1. Edge Backend Reference

### 1.1 Edge Routers (`edge/backend/app/routers/gate.py`)

| Function / Endpoint | Method | Path | Request Schema / Parameters | Response Schema | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `status_endpoint()` | `GET` | `/status` | None | `dict` | Returns gate operational metrics (`camera_code`, `device_status`, `queue_depth`, `master_version`). |
| `get_crossings()` | `GET` | `/crossings` | `limit: int = 50` | `list[dict]` | Returns recent local crossings recorded at gate. |
| `get_crossing_snapshot()` | `GET` | `/crossings/{crossing_id}/snapshot` | `crossing_id: int` | `FileResponse` | Serves JPEG crop of stored local crossing. |
| `update_settings()` | `GET`, `POST` | `/settings` | `SettingsUpdate` (Pydantic) | `dict` | Reads or updates local gate overrides (RTSP, FPS, window size). |
| `match_probe()` | `POST` | `/match-probe` | `MatchProbe` (`raw_code: str`) | `dict` | Debug endpoint testing fuzzy matching against local master replica. |
| `idle_view()` | `GET` | `/idle-view` | None | `Response` (`image/jpeg`) | Serves latest JPEG frame captured by gate camera pipeline. |
| `live_stream()` | `GET` | `/live-stream` | None | `StreamingResponse` | Stream MJPEG live feed for gate operator console. |
| `get_test_runs()` | `GET` | `/test-runs` | None | `list[dict]` | Returns list of local synthetic test runs. |
| `run_test_run()` | `POST` | `/test-runs` | `TestRunRequest` | `dict` | Triggers synthetic test video run through local pipeline. |

---

### 1.2 Edge Store & Services

#### `edge/backend/app/store.py` (Local SQLite Access)
* `ensure_schema()` -> `None`: Initializes local `trucks`, `crossings`, and `meta` tables.
* `get_meta(key, default)` -> `str | None`: Reads local configuration metadata.
* `set_meta(key, value)` -> `None`: Sets local metadata key-value pair.
* `replace_master(trucks, master_version)` -> `int`: Atomically replaces local master replica from Core sync.
* `all_hull_codes()` -> `list[str]`: Fetches list of all registered 4-digit codes.
* `get_by_hull_code(hull_code)` -> `dict | None`: Looks up vehicle details by digits code.
* `record_crossing(**fields)` -> `int`: Stores locally detected crossing event into `crossings`.
* `save_snapshot(idempotency_key, jpeg)` -> `str | None`: Writes vehicle JPEG crop to local disk.
* `prune_snapshots(keep)` -> `int`: Enforces disk cap (default 500 images max).
* `snapshot_path_for(crossing_id)` -> `Path | None`: Retrieves snapshot file path for given crossing ID.
* `mark_synced(idempotency_key)` -> `None`: Sets `synced = 1` for acknowledged crossing.
* `recent_crossings(limit)` -> `list[dict]`: Queries recent crossings for UI console.
* `crossing_counts()` -> `dict`: Computes total, unsynced, and identified crossing counts.
* `clear_crossings()` -> `dict`: Clears local crossing history & images.

#### `edge/backend/app/services/local_matcher.py`
* `match_code(raw_text)` -> `tuple[str, str, float]`: Runs 4-digit fuzzy matching against local `trucks` table.

#### `edge/backend/app/services/idle_view.py`
* `update_latest_frame(jpeg_bytes)` -> `None`: Pushes latest camera JPEG frame into thread buffer.
* `get_latest_frame()` -> `bytes | None`: Fetches recent camera frame.

---

### 1.3 Edge Agent Components (`edge/backend/agent/`)

#### `edge/backend/agent/outbox.py` (Queue Management)
* `Outbox.enqueue(camera_code, payload, snapshot)` -> `str`: Enqueues new crossing event into SQLite outbox, generating UUID `idempotency_key`.
* `Outbox.depth()` -> `int`: Returns pending unsent queue count.
* `Outbox.next_due()` -> `Row | None`: Returns next queue item ready for retry.
* `Outbox.delete(row_id, snapshot_path)` -> `None`: Deletes acknowledged queue item and image.
* `Outbox.record_failure(row, error)` -> `None`: Increments attempt counter and sets exponential backoff delay.
* `Outbox.enforce_ceiling()` -> `int`: Evicts oldest queue items if total disk usage exceeds 500MB cap.
* `OutboxSender.run()` -> `None`: Dedicated thread draining outbox items in order via `IndukClient`.

#### `edge/backend/agent/induk_client.py` (Core HTTP Client)
* `IndukClient.get_config()` -> `dict`: Calls `GET /api/edge/config`.
* `IndukClient.heartbeat(...)` -> `dict`: Calls `POST /api/edge/heartbeat`.
* `IndukClient.submit_crossing(...)` -> `Response`: Calls `POST /api/edge/crossings` with multipart payload & snapshot.
* `IndukClient.get_master(known_version)` -> `dict`: Calls `GET /api/edge/master?known_version=N`.
* `IndukClient.poll_live_session(wait_seconds)` -> `dict`: Calls `GET /api/edge/live-session?wait=N`.

#### `edge/backend/agent/consensus.py` (Consensus Voting Engine)
* `aggregate_votes(candidates)` -> `tuple[str, float, int, list[dict]]`: Groups raw OCR detection outputs by string similarity, calculates weighted confidence, and returns winner text & cluster stats.

---

## 2. Core Backend Reference

### 2.1 Core Routers (`core/backend/app/routers/`)

#### 2.1.1 Edge Device Endpoints (`routers/edge.py`)
* `get_edge_config(device)` -> `dict`: Handles `GET /api/edge/config`.
* `post_heartbeat(body: HeartbeatRequest, device)` -> `dict`: Handles `POST /api/edge/heartbeat`.
* `post_crossing(payload: str, snapshot, idempotency_key, device)` -> `JSONResponse`: Handles `POST /api/edge/crossings`.
* `get_master(known_version: int, device)` -> `dict`: Handles `GET /api/edge/master`.
* `get_live_session(wait: int, device)` -> `dict`: Handles `GET /api/edge/live-session`.

#### 2.1.2 Dashboard Endpoints (`routers/dashboard.py`)
* `dataset()` -> `dict`: `GET /api/dataset`
* `kpis()` -> `dict`: `GET /api/kpis`
* `gate_map()` -> `dict`: `GET /api/map` (Computes unique inside/outside vehicle locations)
* `fleet()` -> `dict`: `GET /api/fleet`
* `reports()` -> `dict`: `GET /api/reports`
* `get_crossing(crossing_id: int)` -> `dict`: `GET /api/crossings/{crossing_id}`
* `update_crossing(crossing_id, payload: CrossingUpdate)` -> `StatusResponse`: `PUT /api/crossings/{crossing_id}`
* `crossings_reset_preview()` -> `dict`: `GET /api/crossings-reset-preview`
* `reset_all_crossings()` -> `dict`: `POST /api/crossings-reset`
* `add_truck(payload: TruckCreate)` -> `StatusResponse`: `POST /api/fleet`
* `update_truck(hull_id, payload: TruckUpdate)` -> `StatusResponse`: `PUT /api/fleet/{hull_id}`
* `delete_truck(hull_id)` -> `StatusResponse`: `DELETE /api/fleet/{hull_id}`

#### 2.1.3 Camera Administration Endpoints (`routers/cameras.py`)
* `list_cameras()` -> `list[dict]`: `GET /api/cameras`
* `create_camera(payload: CameraCreate)` -> `dict`: `POST /api/cameras`
* `get_camera(camera_code: str)` -> `dict`: `GET /api/cameras/{camera_code}`
* `update_camera(camera_code: str, payload: CameraUpdate)` -> `dict`: `PUT /api/cameras/{camera_code}`
* `delete_camera(camera_code: str)` -> `dict`: `DELETE /api/cameras/{camera_code}`
* `update_edge_config(camera_code: str, payload: EdgeConfigUpdate)` -> `dict`: `PUT /api/cameras/{camera_code}/edge-config`
* `provision_api_key(camera_code: str)` -> `dict`: `POST /api/cameras/{camera_code}/provision-key`

#### 2.1.4 Live Stream Session Control (`routers/live.py`)
* `start_live_session(camera_code: str)` -> `dict`: `POST /api/live/start/{camera_code}`
* `live_heartbeat(body: LiveSessionRef)` -> `dict`: `POST /api/live/heartbeat`
* `stop_live_session(body: LiveSessionRef)` -> `dict`: `POST /api/live/stop`

---

### 2.2 Core Repositories (`core/backend/app/repositories/`)

#### `truck_master_repo.py`
* `ensure_schema()` -> `None`: Creates `trucks` table.
* `upsert_many(rows: list[dict])` -> `dict`: Batch upserts truck master entries.
* `list_all()` -> `list[dict]`: Fetches all registered units.
* `get_by_hull_code(hull_code: str)` -> `dict | None`: Looks up vehicle by 4 digits.
* `get_by_hull_id(hull_id: str)` -> `dict | None`: Looks up vehicle by full hull ID.
* `master_version()` -> `int`: Computes total count hash/version integer.

#### `camera_repo.py`
* `ensure_schema(conn)` -> `None`: Migrates `cameras` table and edge telemetry columns.
* `list_rows()` -> `list[dict]`: Lists all camera records.
* `get_row(camera_code: str)` -> `dict | None`: Fetches single camera record.
* `insert_row(data: dict)` -> `bool`: Inserts new camera record.
* `update_row(camera_code: str, data: dict)` -> `bool`: Updates existing camera columns.
* `delete_row(camera_code: str)` -> `None`: Deletes camera record.

#### `edge_repo.py`
* `get_device_by_api_key(api_key: str)` -> `dict | None`: Validates API key hash and returns device record.
* `apply_heartbeat(...)` -> `None`: Updates `last_heartbeat_at`, queue depth, agent version.
* `mark_config_applied(...)` -> `None`: Sets `last_config_applied_at` timestamp.
* `update_edge_config(camera_code, updates)` -> `dict`: Atomically updates config version & tunables.
* `store_api_key_hash(camera_code, key_hash)` -> `None`: Saves generated API key hash.

#### `run_write_repo.py`
* `ensure_schema()` -> `None`: Creates `runs`, `video_results`, and `detections` tables.
* `insert_edge_crossing(...)` -> `tuple[int, bool]`: Writes ingested Edge crossing to `video_results`.
* `find_by_idempotency_key(key: str)` -> `int | None`: Checks for existing key duplicate.
* `upsert_video_result(...)` -> `dict`: Writes batch video processing result.

#### `crossing_time_repo.py`
* `ensure_schema(conn)` -> `None`: Adds `source_started_at` & `crossed_at` columns.
* `load_crossing_times()` -> `dict[str, dict]`: Queries crossing time records.
* `set_crossing_time(video, crossed_at, source_started_at)` -> `None`: Writes crossing timestamp.

---

### 2.3 Core Services (`core/backend/app/services/`)

#### `edge_ingest.py`
* `record_crossing(payload, camera_id, idempotency_key, snapshot, direction)` -> `tuple[int, bool]`: Ingests Edge crossing, performs server-side hull re-matching/validation, saves snapshot file, and inserts `video_results` row.
* `snapshot_required(payload)` -> `bool`: Returns True if snapshot upload is strictly required.

#### `hull_matcher.py` / `hull_matching.py`
* `match_hull(raw_code, direction, pit_trucks)` -> `HullMatch`: Evaluates raw 4-digit code using fuzzy matching rules. Performs PIT occupancy check for outbound gates to eliminate ambiguity.

#### `live_sessions.py`
* `start_session(camera_code)` -> `str`: Creates new live viewing session token.
* `keepalive(session_id)` -> `bool`: Refreshes live session timeout.
* `stop_session(session_id)` -> `None`: Terminates live viewing session.
* `wait_for_action(camera_code, timeout_sec)` -> `dict`: Long-polls pending stream commands for Edge device.
