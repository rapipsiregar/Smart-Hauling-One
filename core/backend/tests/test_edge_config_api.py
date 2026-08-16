"""Dashboard-facing device settings: TC-008-01 through TC-008-06."""

from __future__ import annotations

import pytest

from app.core.config import EDGE_TUNABLE_RANGES
from tests.conftest import EDGE_TEST_CODE

EXPECTED_KEYS = {
    "camera_code", "yolo_fps", "ocr_fps", "detect_window_sec", "ocr_min_conf",
    "dedup_iou", "inbound_axis", "config_version", "device_status",
    "agent_version", "last_heartbeat_at", "last_config_applied_at",
    "applied_config_version", "local_queue_depth",
    # Connectivity, so the device card can show both ends of the link in one
    # place. `api_key_set` is a boolean on purpose -- only the key's hash is
    # stored, so there is no plaintext left to return (SRS §7.3).
    "rtsp_url", "ip_host", "core_url", "api_key_set",
}


def test_get_returns_contract_shape_with_defaults(client, edge_camera):
    r = client.get(f"/api/cameras/{EDGE_TEST_CODE}/edge-config")
    assert r.status_code == 200
    body = r.json()
    assert set(body) == EXPECTED_KEYS
    assert body["yolo_fps"] == 20
    assert body["ocr_fps"] == 4
    assert body["detect_window_sec"] == 6
    assert body["ocr_min_conf"] == 0.30
    assert body["dedup_iou"] == 0.92
    assert body["config_version"] == 1
    assert body["applied_config_version"] == 0     # never heartbeated
    assert body["device_status"] == "offline"


def test_get_unknown_camera_404(client):
    r = client.get("/api/cameras/PYTEST-NO-SUCH-GATE/edge-config")
    assert r.status_code == 404
    assert r.json() == {"error": "Camera not found"}


def test_put_saves_and_bumps_config_version(client, edge_camera):
    r = client.put(
        f"/api/cameras/{EDGE_TEST_CODE}/edge-config",
        json={"yolo_fps": 22, "ocr_fps": 5, "detect_window_sec": 5},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["yolo_fps"] == 22
    assert body["ocr_fps"] == 5
    assert body["detect_window_sec"] == 5
    assert body["config_version"] == 2             # exactly +1 (BR-012)
    assert body["applied_config_version"] == 0     # unchanged -> UI shows "pending"


def test_put_partial_update_leaves_other_fields_alone(client, edge_camera):
    client.put(f"/api/cameras/{EDGE_TEST_CODE}/edge-config", json={"yolo_fps": 25})
    body = client.get(f"/api/cameras/{EDGE_TEST_CODE}/edge-config").json()
    assert body["yolo_fps"] == 25
    assert body["ocr_fps"] == 4                    # untouched


def test_put_empty_body_400(client, edge_camera):
    r = client.put(f"/api/cameras/{EDGE_TEST_CODE}/edge-config", json={})
    assert r.status_code == 400
    assert "error" in r.json()
    unchanged = client.get(f"/api/cameras/{EDGE_TEST_CODE}/edge-config").json()
    assert unchanged["config_version"] == 1


def test_put_unknown_camera_404(client):
    r = client.put("/api/cameras/PYTEST-NO-SUCH-GATE/edge-config", json={"yolo_fps": 20})
    assert r.status_code == 404


@pytest.mark.parametrize("field,bad_value", [
    ("yolo_fps", 0), ("yolo_fps", 31),
    ("ocr_fps", 0), ("ocr_fps", 16),
    ("detect_window_sec", 0), ("detect_window_sec", 31),
    ("ocr_min_conf", -0.1), ("ocr_min_conf", 1.1),
    ("dedup_iou", -0.1), ("dedup_iou", 1.1),
])
def test_out_of_range_rejected_with_field_message(client, edge_camera, field, bad_value):
    r = client.put(f"/api/cameras/{EDGE_TEST_CODE}/edge-config", json={field: bad_value})
    assert r.status_code == 400
    low, high = EDGE_TUNABLE_RANGES[field]
    assert r.json() == {"error": f"{field} must be between {low} and {high}"}
    # A rejected write must not bump the version (TC-008-04).
    after = client.get(f"/api/cameras/{EDGE_TEST_CODE}/edge-config").json()
    assert after["config_version"] == 1


@pytest.mark.parametrize("field,ok_value", [
    ("yolo_fps", 1), ("yolo_fps", 30),
    ("ocr_fps", 1), ("ocr_fps", 15),
    ("detect_window_sec", 1), ("detect_window_sec", 30),
    ("ocr_min_conf", 0.0), ("ocr_min_conf", 1.0),
    ("dedup_iou", 0.0), ("dedup_iou", 1.0),
])
def test_range_boundaries_accepted(client, edge_camera, field, ok_value):
    r = client.put(f"/api/cameras/{EDGE_TEST_CODE}/edge-config", json={field: ok_value})
    assert r.status_code == 200


def test_save_for_offline_device_succeeds(client, edge_camera):
    # TC-008-05 / userflow_uc_008 AF-002: pending is not failure.
    assert edge_camera["status"] == "offline"
    r = client.put(f"/api/cameras/{EDGE_TEST_CODE}/edge-config", json={"yolo_fps": 24})
    assert r.status_code == 200
    body = r.json()
    assert body["config_version"] == 2
    assert body["applied_config_version"] != body["config_version"]


def test_list_cameras_carries_health_fields(client, edge_camera):
    rows = client.get("/api/cameras").json()
    row = next(c for c in rows if c["camera_code"] == EDGE_TEST_CODE)
    for key in ("device_status", "agent_version", "last_heartbeat_at",
                "local_queue_depth", "config_version", "applied_config_version"):
        assert key in row
    # Existing keys still present for current frontend callers.
    assert "status" in row and "name" in row
    # Secret never leaves the server (SRS §7.3).
    assert "api_key_hash" not in row
