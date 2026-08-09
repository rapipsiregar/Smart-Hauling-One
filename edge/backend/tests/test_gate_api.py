"""The local gate API, with the agent threads disabled.

Runs with SMART_GATE_RUN_AGENT=false: no camera, no model, no GPU. That the API
still serves is the point -- a technician must be able to see why a gate is
unhealthy even when the pipeline itself will not start.
"""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

import pytest

os.environ.setdefault("SMART_GATE_RUN_AGENT", "false")
os.environ.setdefault("SMART_GATE_CAMERA_CODE", "PYTEST-GATE")
os.environ.setdefault(
    "SMART_GATE_EDGE_DB", str(Path(tempfile.mkdtemp()) / "edge-test.db")
)

from fastapi.testclient import TestClient  # noqa: E402

from app import store  # noqa: E402
from app.main import app  # noqa: E402

MASTER = [
    {"hull_id": "HD 2152", "hull_code": "2152", "contractor": "PT. CK - BIB",
     "unit_type": "OHT", "brand": "CATERPILLAR", "model_type": "773D",
     "year": 2018, "status": "Layak"},
    {"hull_id": "HD 2253", "hull_code": "2253", "contractor": "PT. CK - BIB",
     "unit_type": "OHT", "brand": "CATERPILLAR", "model_type": "777",
     "year": 2019, "status": "Layak"},
    {"hull_id": "WT 6018", "hull_code": "6018", "contractor": "PT. CK - BIB",
     "unit_type": "WATER TRUCK", "brand": "CATERPILLAR", "model_type": "773D-WT",
     "year": 2015, "status": "Tidak Layak"},
]


@pytest.fixture
def client():
    store.ensure_schema()
    store.replace_master(MASTER, master_version=42)
    return TestClient(app)


def test_health_reports_the_gate_identity(client):
    body = client.get("/").json()
    assert body["status"] == "online"
    assert body["camera_code"] == "PYTEST-GATE"


def test_status_serves_without_the_agent(client):
    """The whole point: diagnosis works even when the pipeline is down."""
    body = client.get("/api/status").json()
    assert body["camera_code"] == "PYTEST-GATE"
    assert body["agent_running"] is False
    assert body["camera_connected"] is False
    assert body["master"] == {"units": 3, "version": 42}
    assert set(body["settings"]) == {
        "yolo_fps", "ocr_fps", "detect_window_sec", "ocr_min_conf", "dedup_iou"
    }


def test_status_reports_which_way_the_gate_faces(client, monkeypatch):
    """The console shows this instead of a detector tile, so it has to be there.

    Direction decides whether a crossing is an arrival or a departure. A camera
    code carries no hint of it, so the value comes from the core.
    """
    from app.services import clip_sources

    monkeypatch.setattr(clip_sources, "get_gate_direction", lambda: "outbound")
    assert client.get("/api/status").json()["direction"] == "outbound"


def test_unknown_direction_is_null_not_guessed(client, monkeypatch):
    """Guessing would mislabel every crossing this gate records."""
    from app.services import clip_sources

    monkeypatch.setattr(clip_sources, "get_gate_direction", lambda: None)
    assert client.get("/api/status").json()["direction"] is None


def test_master_replica_is_readable(client):
    body = client.get("/api/master").json()
    assert body["units"] == 3
    assert body["version"] == 42
    assert "2152" in body["codes_sample"]


def test_settings_roundtrip(client):
    assert client.get("/api/settings").json()["yolo_fps"] == 20
    r = client.put("/api/settings", json={"yolo_fps": 24, "ocr_fps": 5})
    assert r.status_code == 200
    assert r.json()["yolo_fps"] == 24
    # Persisted locally, so it survives a restart with no core involved.
    assert client.get("/api/settings").json()["ocr_fps"] == 5
    client.put("/api/settings", json={"yolo_fps": 20, "ocr_fps": 4})


@pytest.mark.parametrize("field,bad", [
    ("yolo_fps", 31), ("yolo_fps", 0),
    ("ocr_fps", 16), ("detect_window_sec", 0),
    ("ocr_min_conf", 1.5), ("dedup_iou", -0.2),
])
def test_settings_range_enforced_locally(client, field, bad):
    """The device validates for itself -- it must not rely on the core being up."""
    r = client.put("/api/settings", json={field: bad})
    assert r.status_code == 400
    assert "must be between" in r.json()["error"]


def test_settings_empty_body_rejected(client):
    assert client.put("/api/settings", json={}).status_code == 400


def test_match_probe_resolves_against_the_local_replica(client):
    """Field diagnosis: would this gate recognise that number, and if not, why."""
    exact = client.post("/api/match-probe", json={"text": "HD 2152"}).json()
    assert exact["outcome"] == "exact"
    assert exact["hull_id"] == "HD 2152"

    # Optical confusion repaired on-device.
    repaired = client.post("/api/match-probe", json={"text": "HD 215Z"}).json()
    assert repaired["outcome"] == "exact"
    assert repaired["hull_id"] == "HD 2152"

    # 2153 sits one edit from both 2152 and 2253 -- refused, not guessed.
    ambiguous = client.post("/api/match-probe", json={"text": "2153"}).json()
    assert ambiguous["outcome"] == "ambiguous"
    assert ambiguous["hull_id"] is None
    assert set(ambiguous["ambiguous_candidates"]) == {"2152", "2253"}

    unknown = client.post("/api/match-probe", json={"text": "9999"}).json()
    assert unknown["outcome"] == "unregistered"


def test_crossings_endpoint_reads_local_storage(client):
    store.record_crossing(
        idempotency_key="pytest-key-1", hull_id="HD 2152", raw_code="2152",
        match_outcome="exact", confidence=0.94, read_count=4, window_sec=5.8,
        votes_json="[]", snapshot_path=None, detected_at="2026-08-02T06:00:00Z",
    )
    rows = client.get("/api/crossings").json()
    assert any(r["idempotency_key"] == "pytest-key-1" for r in rows)

    counts = client.get("/api/status").json()["crossings"]
    assert counts["total"] >= 1 and counts["identified"] >= 1
