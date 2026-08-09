"""Offline sweep (TC-010-07).

Calls sweep_once() directly -- never sleeps. A test that waits 90s for a
background thread is a test nobody runs.
"""

from __future__ import annotations

from app.core.database import connect
from app.services import cameras as cam
from app.services import device_status
from app.utils.timeutil import utc_iso_seconds_ago
from tests.conftest import EDGE_TEST_CODE


def _set_heartbeat(camera_code: str, iso: str | None, status: str = "online") -> None:
    """Force a device's last-seen time directly, bypassing the API."""
    conn = connect()
    try:
        conn.execute(
            "UPDATE cameras SET last_heartbeat_at = ?, status = ? WHERE camera_code = ?",
            (iso, status, camera_code),
        )
        conn.commit()
    finally:
        conn.close()


def test_silent_device_flips_offline(client, edge_camera):
    _set_heartbeat(EDGE_TEST_CODE, utc_iso_seconds_ago(91), "online")
    assert device_status.sweep_once() >= 1
    assert cam.get_camera(EDGE_TEST_CODE)["status"] == "offline"


def test_recent_device_is_untouched(client, edge_camera):
    _set_heartbeat(EDGE_TEST_CODE, utc_iso_seconds_ago(10), "online")
    device_status.sweep_once()
    assert cam.get_camera(EDGE_TEST_CODE)["status"] == "online"


def test_device_at_threshold_boundary_is_untouched(client, edge_camera):
    # 89s < the 90s threshold -- must survive.
    _set_heartbeat(EDGE_TEST_CODE, utc_iso_seconds_ago(89), "online")
    device_status.sweep_once()
    assert cam.get_camera(EDGE_TEST_CODE)["status"] == "online"


def test_never_heartbeated_device_is_untouched(client, edge_camera):
    # last_heartbeat_at IS NULL -- provisioned but never deployed. Nothing to
    # infer from silence that was never preceded by contact (SRS §5.1).
    _set_heartbeat(EDGE_TEST_CODE, None, "maintenance")
    device_status.sweep_once()
    assert cam.get_camera(EDGE_TEST_CODE)["status"] == "maintenance"


def test_stale_maintenance_is_overridden(client, edge_camera):
    # "No news" must never render as "known, attended maintenance" (SRS §5.1).
    _set_heartbeat(EDGE_TEST_CODE, utc_iso_seconds_ago(120), "maintenance")
    device_status.sweep_once()
    assert cam.get_camera(EDGE_TEST_CODE)["status"] == "offline"


def test_heartbeat_brings_a_swept_device_back(client, edge_camera, auth_headers):
    _set_heartbeat(EDGE_TEST_CODE, utc_iso_seconds_ago(120), "online")
    device_status.sweep_once()
    assert cam.get_camera(EDGE_TEST_CODE)["status"] == "offline"

    client.post("/api/edge/heartbeat", headers=auth_headers, json={
        "agent_version": "1.0.0", "applied_config_version": 1,
        "local_queue_depth": 0, "status": "online",
    })
    assert cam.get_camera(EDGE_TEST_CODE)["status"] == "online"


def test_sweep_is_idempotent(client, edge_camera):
    _set_heartbeat(EDGE_TEST_CODE, utc_iso_seconds_ago(120), "online")
    assert device_status.sweep_once() >= 1
    # Already offline -> the WHERE status != 'offline' guard means no rework.
    device_status.sweep_once()
    assert cam.get_camera(EDGE_TEST_CODE)["status"] == "offline"
