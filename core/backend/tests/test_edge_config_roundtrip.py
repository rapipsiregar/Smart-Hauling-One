"""Settings save -> device confirms -> UI shows saved (TC-008-02, TC-008-03)."""

from __future__ import annotations

from tests.conftest import EDGE_TEST_CODE


def _config(client):
    return client.get(f"/api/cameras/{EDGE_TEST_CODE}/edge-config").json()


def _beat(client, auth_headers, applied):
    return client.post("/api/edge/heartbeat", headers=auth_headers, json={
        "agent_version": "1.0.0",
        "applied_config_version": applied,
        "local_queue_depth": 0,
        "status": "online",
    }).json()


def test_pending_until_device_confirms(client, edge_camera, auth_headers):
    # 1. Operator saves -> version 2, device still on 1 -> "pending".
    client.put(f"/api/cameras/{EDGE_TEST_CODE}/edge-config", json={"yolo_fps": 22})
    before = _config(client)
    assert before["config_version"] == 2
    assert before["applied_config_version"] != before["config_version"]

    # 2. Device heartbeats while still stale -> told to re-fetch.
    stale = _beat(client, auth_headers, applied=1)
    assert stale["config_changed"] is True
    assert stale["config_version"] == 2

    # 3. Device fetches the new config and gets the saved values.
    fetched = client.get("/api/edge/config", headers=auth_headers).json()
    assert fetched["yolo_fps"] == 22
    assert fetched["config_version"] == 2

    # 4. Device confirms on its next heartbeat -> "saved".
    confirmed = _beat(client, auth_headers, applied=2)
    assert confirmed["config_changed"] is False

    after = _config(client)
    assert after["applied_config_version"] == after["config_version"] == 2
    assert after["last_config_applied_at"] is not None
    assert after["device_status"] == "online"
