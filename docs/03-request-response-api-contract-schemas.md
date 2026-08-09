# 3. Request and Response API Contract Schemas

This document contains all Pydantic request and response models across both **Core Backend (Induk)** and **Edge Backend (Gate Device)**.

---

## 1. Edge-Facing Request & Response Schemas (`core/backend/app/schemas/edge.py`)

### 1.1 `HeartbeatRequest`
Payload sent by the Edge Agent to Core every heartbeat interval (`POST /api/edge/heartbeat`).

```json
{
  "agent_version": "1.2.0",
  "applied_config_version": 3,
  "local_queue_depth": 0,
  "status": "online"
}
```

* **Validation Rules:**
  * `applied_config_version`: Integer $\ge 0$
  * `local_queue_depth`: Integer $\ge 0$
  * `status`: Must be strictly `"online"` or `"maintenance"` (`"offline"` is rejected with 422).

---

### 1.2 `VoteEntry`
Represents one OCR consensus cluster inside the crossing submission payload.

```json
{
  "text": "2152",
  "count": 12,
  "avg_ocr_conf": 0.945
}
```

* **Validation Rules:**
  * `count`: Integer $\ge 0$
  * `avg_ocr_conf`: Float between `0.0` and `1.0`

---

### 1.3 `CrossingPayload`
Payload sent inside the `payload` form field of `POST /api/edge/crossings`.

```json
{
  "camera_code": "CAM-IN-01",
  "detected_at": "2026-08-06T14:32:10Z",
  "window_sec": 6.0,
  "hull_id": "HD 2152",
  "confidence": 0.945,
  "read_count": 12,
  "votes": [
    {
      "text": "2152",
      "count": 12,
      "avg_ocr_conf": 0.945
    }
  ]
}
```

* **Validation Rules:**
  * `camera_code`: Non-empty string matching authenticated device code.
  * `detected_at`: Valid ISO 8601 UTC timestamp format.
  * `window_sec`: Float $\ge 0.0$.
  * `confidence`: Float between `0.0` and `1.0`.
  * `read_count`: Integer $\ge 0$. Must be `0` if `votes` is empty.

---

### 1.4 `LiveSessionRef`
Request body for live stream session keepalive (`/api/live/heartbeat`) and stop (`/api/live/stop`).

```json
{
  "session_id": "sess_8f93a10b4c2e"
}
```

---

## 2. Dynamic Configuration Schemas (`core/backend/app/schemas/edge_config.py`)

### 2.1 `EdgeConfigUpdate`
Payload for updating dynamic edge detection parameters (`PUT /api/cameras/{code}/edge-config`).

```json
{
  "yolo_fps": 20,
  "ocr_fps": 4,
  "detect_window_sec": 6,
  "ocr_min_conf": 0.30,
  "dedup_iou": 0.92
}
```

* **Validation Ranges:**
  * `yolo_fps`: `1` to `60` FPS
  * `ocr_fps`: `1` to `30` FPS
  * `detect_window_sec`: `2` to `30` seconds
  * `ocr_min_conf`: `0.05` to `0.95`
  * `dedup_iou`: `0.50` to `0.99`

---

## 3. Fleet Administration Schemas (`core/backend/app/schemas/fleet.py`)

### 3.1 `TruckCreate`
Payload for registering a new hauling truck (`POST /api/fleet`).

```json
{
  "hull_id": "HD 2152",
  "status": "active"
}
```

### 3.2 `TruckUpdate`
Payload for updating an existing hauling truck (`PUT /api/fleet/{hull_id}`).

```json
{
  "hull_id": "HD 2152",
  "status": "maintenance"
}
```

---

## 4. Camera Registry Schemas (`core/backend/app/schemas/camera.py`)

### 4.1 `CameraCreate`
Payload for registering a new gate camera (`POST /api/cameras`).

```json
{
  "camera_code": "CAM-OUT-02",
  "name": "Gerbang Keluar 02",
  "gate_location": "Pit North",
  "direction": "outbound",
  "rtsp_url": "rtsp://admin:pass@192.168.1.102:554/stream1",
  "ip_host": "192.168.1.102",
  "fps": 25,
  "resolution": "1920x1080"
}
```

### 4.2 `CameraUpdate`
Partial update payload for camera settings (`PUT /api/cameras/{camera_code}`).

```json
{
  "name": "Gerbang Keluar Utama 02",
  "status": "online",
  "direction": "outbound"
}
```

---

## 5. Crossing Mutation Schema (`core/backend/app/schemas/crossing.py`)

### 5.1 `CrossingUpdate`
Payload for manual operator override of a crossing event record (`PUT /api/crossings/{crossing_id}`).

```json
{
  "hull_id": "HD 2152",
  "confidence": 1.0
}
```

---

## 6. Common Status Response Schema (`core/backend/app/schemas/common.py`)

### 6.1 `StatusResponse`
Standardized success response for mutation endpoints.

```json
{
  "status": "success",
  "message": "Operation completed successfully"
}
```
