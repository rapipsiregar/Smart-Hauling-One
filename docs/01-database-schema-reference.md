# 1. Database Schema Reference

This document provides a complete specification of all database schemas across both the **Core Backend (Induk)** and **Edge Backend (Gate Device)** in the Integrated Smart Hauling System.

---

## 1. Core Backend Database (`data/smart_hauling.db`)

The Core system acts as the central source of truth for the entire hauling fleet, camera registry, batch processing runs, and edge crossing ingestion.

### 1.1 `trucks` (Master Truck Registry)
Stores authoritative master records of all 276+ registered hauling trucks (OHT / Water Trucks).

* **Created by:** `app/repositories/truck_master_repo.py`
* **Indexes:** `idx_trucks_hull_code` (ON `hull_code`), `idx_trucks_contractor` (ON `contractor`)

| Column Name | SQLite Data Type | Constraints / Defaults | Description |
| :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | `PRIMARY KEY AUTOINCREMENT` | Internal database surrogate key |
| `hull_id` | `TEXT` | `UNIQUE NOT NULL` | Human-readable fleet identifier (e.g. `"HD 2152"`) |
| `hull_code` | `TEXT` | `UNIQUE NOT NULL` | Digits-only code for OCR matching (e.g. `"2152"`) |
| `contractor` | `TEXT` | `NULLABLE` | Mining contractor operating the unit |
| `unit_type` | `TEXT` | `NULLABLE` | Equipment classification (e.g. `"Dump Truck"`, `"Water Truck"`) |
| `brand` | `TEXT` | `NULLABLE` | Manufacturer brand (e.g. `"Caterpillar"`, `"Komatsu"`) |
| `model_type` | `TEXT` | `NULLABLE` | Vehicle model (e.g. `"777D"`, `"HD785"`) |
| `year` | `INTEGER` | `NULLABLE` | Manufacturing year |
| `status` | `TEXT` | `NULLABLE` | Operational status (`"active"`, `"maintenance"`, `"inactive"`) |
| `created_at` | `TEXT` | `DEFAULT (datetime('now'))` | ISO 8601 UTC creation timestamp |
| `updated_at` | `TEXT` | `DEFAULT (datetime('now'))` | ISO 8601 UTC last update timestamp |

---

### 1.2 `cameras` (Camera Registry & Edge Device Management)
Stores camera configurations, RTSP endpoints, location tags, security API keys, and edge device status telemetry.

* **Created by:** `app/repositories/camera_repo.py`
* **Indexes:** `camera_code` (UNIQUE), `folder` (UNIQUE)

| Column Name | SQLite Data Type | Constraints / Defaults | Description |
| :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | `PRIMARY KEY AUTOINCREMENT` | Primary key |
| `camera_code` | `TEXT` | `UNIQUE NOT NULL` | Canonical camera code (e.g. `"CAM-IN-01"`) |
| `name` | `TEXT` | `NOT NULL` | Display name (e.g. `"Gerbang Masuk Utam"`) |
| `gate_location` | `TEXT` | `NULLABLE` | Physical site/gate location tag |
| `direction` | `TEXT` | `DEFAULT 'both'` | Direction (`"inbound"`, `"outbound"`, `"both"`) |
| `status` | `TEXT` | `DEFAULT 'offline'` | Aggregate status (`"online"`, `"offline"`, `"maintenance"`) |
| `rtsp_url` | `TEXT` | `NULLABLE` | Video stream RTSP URL |
| `ip_host` | `TEXT` | `NULLABLE` | Host IP address of gate camera/device |
| `username` | `TEXT` | `NULLABLE` | RTSP stream authentication username |
| `resolution` | `TEXT` | `NULLABLE` | Streaming resolution (e.g. `"1920x1080"`) |
| `fps` | `INTEGER` | `NULLABLE` | Target camera video FPS |
| `folder` | `TEXT` | `UNIQUE NULLABLE` | Directory path for batch video clip ingest |
| `install_date` | `TEXT` | `NULLABLE` | Installation date string |
| `last_seen` | `TEXT` | `NULLABLE` | ISO timestamp of last activity |
| `notes` | `TEXT` | `NULLABLE` | Operator comments / notes |
| `created_at` | `TEXT` | `DEFAULT (datetime('now'))` | Timestamp created |
| `updated_at` | `TEXT` | `DEFAULT (datetime('now'))` | Timestamp updated |
| `api_key_hash` | `TEXT` | `NULLABLE` | SHA-256 hash of edge device Bearer API Key |
| `agent_version` | `TEXT` | `NULLABLE` | Version string reported by Edge agent heartbeat |
| `yolo_fps` | `INTEGER` | `NOT NULL DEFAULT 20` | Dynamic YOLO detection sampling FPS |
| `ocr_fps` | `INTEGER` | `NOT NULL DEFAULT 4` | Dynamic OCR sampling FPS |
| `detect_window_sec` | `INTEGER` | `NOT NULL DEFAULT 6` | Detection window accumulation duration (sec) |
| `ocr_min_conf` | `REAL` | `NOT NULL DEFAULT 0.30` | Minimum confidence threshold for OCR |
| `dedup_iou` | `REAL` | `NOT NULL DEFAULT 0.92` | Bounding-box deduplication IOU threshold |
| `config_version` | `INTEGER` | `NOT NULL DEFAULT 1` | Server-side authoritative config version |
| `applied_config_version`| `INTEGER` | `NOT NULL DEFAULT 0` | Config version reported applied by Edge device |
| `last_heartbeat_at` | `TEXT` | `NULLABLE` | ISO 8601 UTC timestamp of last heartbeat |
| `last_config_applied_at`| `TEXT` | `NULLABLE` | ISO 8601 UTC timestamp when config was verified |
| `local_queue_depth` | `INTEGER` | `NOT NULL DEFAULT 0` | Number of un-synced crossings pending on Edge device |

---

### 1.3 `runs` (Batch Ingestion Run History)
Tracks offline/batch inference processing runs performed by Core server tools.

* **Created by:** `app/repositories/run_write_repo.py`

| Column Name | SQLite Data Type | Constraints / Defaults | Description |
| :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | `PRIMARY KEY AUTOINCREMENT` | Run execution ID |
| `run_timestamp` | `TEXT` | `NULLABLE` | Start timestamp of run |
| `model` | `TEXT` | `NULLABLE` | AI model name/weights filename used |
| `input_directory` | `TEXT` | `NULLABLE` | Input folder scanned for video files |
| `videos_processed` | `INTEGER` | `NULLABLE` | Count of videos processed in run |
| `total_elapsed_seconds`| `REAL` | `NULLABLE` | Total processing wall-clock time in seconds |
| `ingested_at` | `TEXT` | `DEFAULT (datetime('now'))` | Timestamp row ingested |

---

### 1.4 `video_results` (Crossing Event & Detection Summary Ledger)
Stores both batch video processing results and live Edge crossing events.

* **Created by:** `app/repositories/run_write_repo.py`
* **Indexes:** 
  * `idx_vr_run` (ON `run_id`)
  * `idx_vr_hull` (ON `voted_hull_id`)
  * `idx_vr_idempotency` (`UNIQUE` ON `idempotency_key`)

| Column Name | SQLite Data Type | Constraints / Defaults | Description |
| :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | `PRIMARY KEY AUTOINCREMENT` | Primary key |
| `run_id` | `INTEGER` | `NULLABLE REFERENCES runs(id)` | FK to `runs.id` (NULL for Edge live ingestion) |
| `video` | `TEXT` | `NULLABLE` | Video filename or edge event identifier |
| `voted_hull_id` | `TEXT` | `NULLABLE` | Matched vehicle hull ID (e.g. `"HD 2152"`, or `"UNKNOWN"`) |
| `vote_confidence` | `REAL` | `NULLABLE` | Consensus voting confidence score (0.0 - 1.0) |
| `total_detections` | `INTEGER` | `NULLABLE` | Total raw OCR reading count |
| `frames_with_detections`| `INTEGER` | `NULLABLE` | Count of frames containing valid detections |
| `snapshot_path` | `TEXT` | `NULLABLE` | Relative path to vehicle crop snapshot |
| `camera_id` | `INTEGER` | `NULLABLE REFERENCES cameras(id)` | FK to `cameras.id` |
| `source_started_at` | `TEXT` | `NULLABLE` | ISO timestamp when camera view/window started |
| `crossed_at` | `TEXT` | `NULLABLE` | ISO timestamp when truck crossed gate |
| `idempotency_key` | `TEXT` | `UNIQUE NULLABLE` | Lowercase UUID v4 from Edge for deduplication |
| `source` | `TEXT` | `NOT NULL DEFAULT 'batch'` | Event origin (`"batch"` or `"edge"`) |
| `votes_json` | `TEXT` | `NULLABLE` | JSON string array of vote clusters breakdown |
| `window_sec` | `REAL` | `NULLABLE` | Edge detection window duration in seconds |

---

### 1.5 `detections` (Bounding Box & Bounding Frame Bounding Details)
Detailed per-frame OCR text detections associated with a batch processing result.

* **Created by:** `app/repositories/run_write_repo.py`
* **Indexes:** `idx_det_vr` (ON `video_result_id`)

| Column Name | SQLite Data Type | Constraints / Defaults | Description |
| :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | `PRIMARY KEY AUTOINCREMENT` | Primary key |
| `video_result_id` | `INTEGER` | `REFERENCES video_results(id) ON DELETE CASCADE` | FK to parent `video_results.id` |
| `frame_index` | `INTEGER` | `NULLABLE` | Frame index within video clip |
| `timestamp_seconds`| `REAL` | `NULLABLE` | Time offset from video start (seconds) |
| `bbox` | `TEXT` | `NULLABLE` | JSON array `[x1, y1, x2, y2]` bounding box coordinates |
| `detection_confidence`| `REAL` | `NULLABLE` | YOLO object detection confidence |
| `raw_text` | `TEXT` | `NULLABLE` | Raw un-corrected text output from OCR |
| `ocr_confidence` | `REAL` | `NULLABLE` | PaddleOCR text recognition confidence |

---

## 2. Edge Device Databases

Each Edge Jetson device maintains two isolated SQLite databases:
1. `edge.db` (`app/store.py`): Local gate historical ledger & offline truck master snapshot.
2. `outbox.db` (`agent/outbox.py`): Non-volatile outbound delivery queue.

---

### 2.1 Edge Store Database (`data/edge.db`)

#### 2.1.1 `trucks` (Local Master Replica)
Replicated local copy of Core's `trucks` table. Allows 100% offline local matching when Core connection is lost.

| Column Name | SQLite Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `hull_id` | `TEXT` | `PRIMARY KEY` | Vehicle full ID (e.g. `"HD 2152"`) |
| `hull_code` | `TEXT` | `UNIQUE NOT NULL` | Digits-only code (e.g. `"2152"`) |
| `contractor` | `TEXT` | `NULLABLE` | Contractor name |
| `unit_type` | `TEXT` | `NULLABLE` | Unit type |
| `brand` | `TEXT` | `NULLABLE` | Brand |
| `model_type` | `TEXT` | `NULLABLE` | Model |
| `year` | `INTEGER` | `NULLABLE` | Year |
| `status` | `TEXT` | `NULLABLE` | Operational status |

#### 2.1.2 `crossings` (Gate Local Crossing History)
Local log of all truck detection events registered at this specific gate.

| Column Name | SQLite Data Type | Constraints / Defaults | Description |
| :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | `PRIMARY KEY AUTOINCREMENT` | Local ID |
| `idempotency_key` | `TEXT` | `UNIQUE NOT NULL` | UUID v4 event key |
| `hull_id` | `TEXT` | `NULLABLE` | Matched vehicle ID |
| `raw_code` | `TEXT` | `NULLABLE` | Raw consensus candidate text |
| `match_outcome` | `TEXT` | `NULLABLE` | Match classification outcome string |
| `confidence` | `REAL` | `NULLABLE` | Final confidence score |
| `read_count` | `INTEGER` | `NULLABLE` | Number of OCR frames in window |
| `window_sec` | `REAL` | `NULLABLE` | Detection window duration |
| `votes_json` | `TEXT` | `NULLABLE` | JSON vote distribution payload |
| `snapshot_path` | `TEXT` | `NULLABLE` | Local disk crop image path |
| `detected_at` | `TEXT` | `NOT NULL` | ISO 8601 UTC detection timestamp |
| `synced` | `INTEGER` | `NOT NULL DEFAULT 0` | 1 if delivered to Core, 0 if pending |

#### 2.1.3 `meta` (Key-Value Metadata)
Stores local device metadata state (e.g., `master_version`).

| Column Name | SQLite Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `key` | `TEXT` | `PRIMARY KEY` | Metadata key |
| `value` | `TEXT` | `NULLABLE` | Value string |

---

### 2.2 Edge Outbox Database (`data/outbox.db`)

#### 2.2.1 `outbox` (Durable Delivery Queue)
Guarantees zero-loss delivery of crossing events from Edge to Core. Survives process crashes and device reboots.

* **Created by:** `agent/outbox.py`
* **Indexes:** `idx_outbox_next_attempt` (ON `next_attempt_at`)

| Column Name | SQLite Data Type | Constraints / Defaults | Description |
| :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | `PRIMARY KEY AUTOINCREMENT` | Queue item ID |
| `idempotency_key` | `TEXT` | `NOT NULL UNIQUE` | Persistent UUID v4 key used for HTTP retry retries |
| `camera_code` | `TEXT` | `NOT NULL` | Originating camera code |
| `payload_json` | `TEXT` | `NOT NULL` | Serialized `CrossingPayload` JSON |
| `snapshot_path` | `TEXT` | `NULLABLE` | Temporary JPEG crop image path |
| `created_at` | `TEXT` | `NOT NULL` | ISO 8601 UTC creation time |
| `attempt_count` | `INTEGER` | `NOT NULL DEFAULT 0` | Number of HTTP delivery attempts |
| `next_attempt_at` | `TEXT` | `NOT NULL` | ISO 8601 UTC time for next retry |
| `last_error` | `TEXT` | `NULLABLE` | Truncated error message from last failed HTTP call |
