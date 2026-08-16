"""The device card's two new jobs: set the gate's axis, and issue its key.

``inbound_axis`` is the setting that decides whether a gate records arrivals as
arrivals. It is per device because two gates rarely face the same way, and it
lives on the core rather than in the Jetson's .env because an operator who spots
a gate running backwards has to be able to fix it from the dashboard.

Provisioning is here because the plaintext key exists for exactly one response
and never again -- a property worth a test that would fail loudly if someone
later "helpfully" made it readable.
"""

from __future__ import annotations

import pytest

from app.services import edge_devices
from tests.conftest import EDGE_TEST_CODE

CONFIG_URL = f"/api/cameras/{EDGE_TEST_CODE}/edge-config"
PROVISION_URL = f"/api/cameras/{EDGE_TEST_CODE}/provision"


# --- the axis -----------------------------------------------------------------

def test_a_new_gate_defaults_to_left_to_right(client, edge_camera):
    assert client.get(CONFIG_URL).json()["inbound_axis"] == "ltr"


@pytest.mark.parametrize("axis", ["ltr", "rtl"])
def test_the_axis_can_be_set_to_either_direction(client, edge_camera, axis):
    body = client.put(CONFIG_URL, json={"inbound_axis": axis}).json()
    assert body["inbound_axis"] == axis
    assert client.get(CONFIG_URL).json()["inbound_axis"] == axis


def test_changing_the_axis_bumps_config_version(client, edge_camera):
    """It is a device setting, so the device must be told to re-fetch it.

    Without the bump the heartbeat would report the device already in sync and
    it would keep running the old axis -- silently, which is the failure mode
    this whole setting exists to end.
    """
    body = client.put(CONFIG_URL, json={"inbound_axis": "rtl"}).json()
    assert body["config_version"] == 2
    assert body["applied_config_version"] == 0     # UI shows "pending"


def test_an_unknown_axis_is_rejected_and_changes_nothing(client, edge_camera):
    r = client.put(CONFIG_URL, json={"inbound_axis": "sideways"})
    assert r.status_code == 400
    assert r.json() == {"error": "inbound_axis must be one of ltr, rtl"}

    after = client.get(CONFIG_URL).json()
    assert after["inbound_axis"] == "ltr"
    assert after["config_version"] == 1            # a rejected write never bumps


def test_the_device_is_told_its_axis(client, edge_camera, auth_headers):
    """The setting is worthless unless it reaches the gate that acts on it."""
    client.put(CONFIG_URL, json={"inbound_axis": "rtl"})
    device_config = client.get("/api/edge/config", headers=auth_headers).json()
    assert device_config["inbound_axis"] == "rtl"


# --- connectivity -------------------------------------------------------------

def test_the_card_reports_both_ends_of_the_link(client, edge_camera):
    body = client.get(CONFIG_URL).json()
    assert "core_url" in body            # what the device must dial
    assert "rtsp_url" in body            # what the device pulls video from
    assert "ip_host" in body
    # The fixture provisions a key, so the card reports one is set -- and still
    # does not carry it. `api_key_set` is the whole truth the UI is allowed.
    assert body["api_key_set"] is True
    assert "api_key" not in body
    assert "api_key_hash" not in body


def test_provisioning_returns_a_key_once_and_never_again(client, edge_camera):
    r = client.post(PROVISION_URL)
    assert r.status_code == 200
    issued = r.json()["api_key"]
    assert issued

    # The config endpoint confirms a key exists but cannot hand it back: only
    # the hash was stored, so there is nothing to leak.
    config = client.get(CONFIG_URL).json()
    assert config["api_key_set"] is True
    assert issued not in str(config)


def test_the_issued_key_actually_authenticates_the_device(client, edge_camera):
    """A key that does not open the door would be a very quiet failure."""
    issued = client.post(PROVISION_URL).json()["api_key"]
    r = client.get("/api/edge/config", headers={"Authorization": f"Bearer {issued}"})
    assert r.status_code == 200
    assert r.json()["camera_code"] == EDGE_TEST_CODE


def test_rotating_retires_the_previous_key_immediately(client, edge_camera):
    old = client.post(PROVISION_URL).json()["api_key"]
    new = client.post(PROVISION_URL).json()["api_key"]
    assert old != new

    stale = client.get("/api/edge/config", headers={"Authorization": f"Bearer {old}"})
    assert stale.status_code == 401
    fresh = client.get("/api/edge/config", headers={"Authorization": f"Bearer {new}"})
    assert fresh.status_code == 200


def test_only_the_hash_is_ever_persisted(client, edge_camera):
    """Guards the SRS §7.3 promise at the storage layer, not just the API."""
    from app.repositories import edge_repo

    issued = client.post(PROVISION_URL).json()["api_key"]
    row = edge_repo.get_by_api_key_hash(edge_devices.hash_api_key(issued))
    assert row is not None
    assert row["api_key_hash"] != issued


def test_provisioning_an_unknown_camera_404s(client):
    r = client.post("/api/cameras/PYTEST-NO-SUCH-GATE/provision")
    assert r.status_code == 404
    assert r.json() == {"error": "Camera not found"}
