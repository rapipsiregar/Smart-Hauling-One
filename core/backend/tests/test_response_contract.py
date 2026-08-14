"""Golden-shape contract tests: lock the EXACT response keys the frontend reads.

The other suites assert subsets ("these keys are present"); these assert the
full key set so an accidental drop or rename of any field the Next.js client
consumes fails loudly. If a payload legitimately changes, update the frozen set
here and the matching TypeScript type in the frontend together.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


# --- Reference endpoints (camelCase frontend contract) -----------------------

CROSSING_KEYS = {
    "id", "hullId", "confidence", "video", "lane", "direction", "cameraId",
    "cameraCode", "cameraName", "rtspUrl", "reads", "frames", "known",
    # Added when confidently-read but unregistered trucks started being recorded
    # by number instead of collapsed to UNKNOWN: "known" alone can no longer say
    # whether a crossing belongs to a master unit. Purely additive.
    "registered",
    "isReconciled", "reconciledBy", "ocrReads", "imageProofUrl",
    "contextImageUrl", "crossedAt", "processedAt",
    # New metadata fields
    "modelType", "unitType", "contractor",
}
CCTV_KEYS = {
    "id", "video", "towerId", "location", "camera", "cameraId", "cameraCode",
    "cameraName", "rtspUrl", "timestamp", "ocrText", "confidence", "croppedText",
    "framesProcessed", "frameResults", "ocrReadCount", "detectionConfidence",
    "isConsistent", "aiModel",
    # Added when the crossing detail page was retired: the inspection panel in
    # Riwayat Pembacaan now shows the evidence inline, so the detection has to
    # carry it. Purely additive -- no existing field changed.
    "imageProofUrl", "contextImageUrl",
}
FLEET_UNIT_KEYS = {
    "id", "hullId", "status", "passages", "reads", "bestConf", "snapshot",
    "camerasSeen", "lastActive",
    # New metadata fields
    "modelType", "unitType", "contractor",
}
KPI_KEYS = {
    "totalPassages", "identified", "unknown", "uniqueTrucks", "totalReads",
    "avgConfidence", "perGate", "period", "periodLabel",
}
SHIFT_KEYS = {
    "date", "model", "totalPassages", "totalRitase", "totalCrossings",
    "unpairedCount", "pairingBasis", "hasCrossingTimes", "identified",
    "unknown", "reconciled", "uniqueTrucks", "totalReads", "avgConfidence",
    "perGate", "perTruck", "unpaired",
    # Added so the exports can flag haulage by units the master does not list --
    # the PDF and spreadsheet are exactly where that flag has to appear.
    "unregisteredRitase", "unregisteredHulls",
}
RECEIPT_KEYS = {"syncedAt", "count", "source", "status"}


def test_crossings_shape_is_frozen(require_crossings):
    item = client.get("/api/crossings").json()[0]
    assert set(item) == CROSSING_KEYS


def test_cctv_detections_shape_is_frozen(require_crossings):
    item = client.get("/api/cctv-detections").json()[0]
    assert set(item) == CCTV_KEYS


def test_fleet_registry_shape_is_frozen():
    item = client.get("/api/fleet-registry").json()[0]
    assert set(item) == FLEET_UNIT_KEYS


def test_performance_kpis_shape_is_frozen(require_crossings):
    data = client.get("/api/performance-kpis").json()
    assert set(data) == KPI_KEYS
    assert set(data["perGate"][0]) == {"gate", "passages", "identified"}


def test_shift_report_shape_is_frozen(require_crossings):
    data = client.get("/api/shift-report").json()
    assert set(data) == SHIFT_KEYS
    assert set(data["perTruck"][0]) == {
        "hullId", "registered", "ritase", "inCount", "outCount", "unpaired",
        "reads", "bestConf", "avgCycleSeconds",
    }


def test_sync_ritase_receipt_shape_is_frozen():
    receipt = client.post("/api/sync-ritase", json={"crossings": [], "source": "pytest"}).json()
    assert set(receipt) == RECEIPT_KEYS


# --- Dashboard endpoints (snake_case legacy contract) ------------------------

DATASET_CROSSING_KEYS = {
    "id", "hull_id", "video", "confidence", "reads", "frames", "lane",
    "direction", "camera_id", "camera_code", "camera_name", "rtsp_url",
    "snapshot", "annotated_video", "known", "crossed_at",
    # See CROSSING_KEYS: "known" says a number was read, "registered" says that
    # number is a master unit. They differ for a confidently-read truck the
    # spreadsheet does not list.
    "registered",
    # New metadata fields
    "model_type", "unit_type", "contractor",
}
DATASET_FLEET_KEYS = {
    "hull_id", "passages", "reads", "best_conf", "snapshot", "status", "cameras_seen",
    # New metadata fields
    "model_type", "unit_type", "contractor",
}
DATASET_KPI_KEYS = {
    "total_videos", "identified", "unique_trucks", "total_reads",
    "avg_confidence", "unknown",
}
MAP_KEYS = {
    "inside", "outside", "total_inside", "total_outside", "total_trucks",
    "active_lanes",
}


def test_dataset_shape_is_frozen(require_crossings):
    data = client.get("/api/dataset").json()
    assert set(data) == {"crossings", "fleet", "kpis"}
    assert set(data["crossings"][0]) == DATASET_CROSSING_KEYS
    assert set(data["fleet"][0]) == DATASET_FLEET_KEYS
    assert set(data["kpis"]) == DATASET_KPI_KEYS


def test_fleet_endpoint_shape_is_frozen():
    data = client.get("/api/fleet").json()
    assert set(data) == {"fleet", "kpis"}
    assert set(data["fleet"][0]) == DATASET_FLEET_KEYS


def test_map_shape_is_frozen():
    assert set(client.get("/api/map").json()) == MAP_KEYS


def test_crossing_detail_shape_is_frozen(require_crossings):
    data = client.get("/api/crossings/1").json()
    assert set(data) == DATASET_CROSSING_KEYS
