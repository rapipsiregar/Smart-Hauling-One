"""Heartbeat and config endpoints: TC-010-05, TC-010-06."""

from __future__ import annotations

from app.services import cameras as cam
from tests.conftest import EDGE_TEST_CODE


def _beat(client, headers, *, applied=1, status="online", queue=0, version="1.0.0"):
    return client.post(
        "/api/edge/heartbeat",
        headers=headers,
        json={
            "agent_version": version,
            "applied_config_version": applied,
            "local_queue_depth": queue,
            "status": status,
        },
    )


def test_config_returns_the_contract_shape(client, edge_camera, auth_headers):
    body = client.get("/api/edge/config", headers=auth_headers).json()
    assert set(body) == {
        # `direction` is registry data the device cannot know on its own, and it
        # decides whether a crossing counts as an arrival or a departure. Sending
        # it here keeps one owner for it; the alternative was a second copy in
        # each device's environment, free to drift out of step with the centre.
        "camera_code", "direction", "yolo_fps", "ocr_fps", "detect_window_sec",
        "ocr_min_conf", "dedup_iou", "config_version",
    }
    assert body["direction"] in ("inbound", "outbound", "both", None)
    assert body["yolo_fps"] == 20      # PRD §9 defaults
    assert body["ocr_fps"] == 4
    assert body["detect_window_sec"] == 6
    assert body["ocr_min_conf"] == 0.30
    assert body["dedup_iou"] == 0.92


def test_heartbeat_brings_device_online(client, edge_camera, auth_headers):
    assert edge_camera["status"] == "offline"
    r = _beat(client, auth_headers)
    assert r.status_code == 200
    assert r.json()["status"] == "success"

    refreshed = cam.get_camera(EDGE_TEST_CODE)
    assert refreshed["status"] == "online"
    assert refreshed["last_heartbeat_at"] is not None
    assert refreshed["agent_version"] == "1.0.0"


def test_heartbeat_records_queue_depth(client, edge_camera, auth_headers):
    _beat(client, auth_headers, queue=17)
    assert cam.get_camera(EDGE_TEST_CODE)["local_queue_depth"] == 17


def test_maintenance_status_accepted(client, edge_camera, auth_headers):
    _beat(client, auth_headers, status="maintenance")
    assert cam.get_camera(EDGE_TEST_CODE)["status"] == "maintenance"


def test_device_may_not_self_report_offline(client, edge_camera, auth_headers):
    # SRS §5.1: offline is inferred centrally, never claimed by the device.
    assert _beat(client, auth_headers, status="offline").status_code == 422


def test_config_changed_false_when_versions_match(client, edge_camera, auth_headers):
    body = _beat(client, auth_headers, applied=1).json()
    assert body["config_version"] == 1
    assert body["config_changed"] is False

    refreshed = cam.get_camera(EDGE_TEST_CODE)
    assert refreshed["applied_config_version"] == 1
    assert refreshed["last_config_applied_at"] is not None


def test_config_changed_true_when_device_is_stale(client, edge_camera, auth_headers):
    body = _beat(client, auth_headers, applied=0).json()
    assert body["config_changed"] is True
    # Reported verbatim even while stale -- this drives the "pending" indicator.
    refreshed = cam.get_camera(EDGE_TEST_CODE)
    assert refreshed["applied_config_version"] == 0
    assert refreshed["last_config_applied_at"] is None
