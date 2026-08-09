"""Device API-key authentication for the /api/edge/* endpoints.

Covers TC-010-04 (invalid API key -> 401 with the contract's exact body).
"""

from __future__ import annotations

from app.repositories import edge_repo
from app.services import edge_devices
from tests.conftest import EDGE_TEST_CODE, EDGE_TEST_KEY


def test_hash_is_stable_and_not_the_plaintext():
    assert edge_devices.hash_api_key("abc") == edge_devices.hash_api_key("abc")
    assert edge_devices.hash_api_key("abc") != "abc"
    assert len(edge_devices.hash_api_key("abc")) == 64  # sha256 hex


def test_generated_keys_are_unique():
    assert edge_devices.generate_api_key() != edge_devices.generate_api_key()


def test_valid_key_authenticates(client, edge_camera, auth_headers):
    r = client.get("/api/edge/config", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["camera_code"] == EDGE_TEST_CODE


def test_missing_header_rejected(client, edge_camera):
    r = client.get("/api/edge/config")
    assert r.status_code == 401
    assert r.json() == {"error": "Invalid device credentials"}


def test_wrong_scheme_rejected(client, edge_camera):
    r = client.get("/api/edge/config", headers={"Authorization": EDGE_TEST_KEY})
    assert r.status_code == 401
    assert r.json() == {"error": "Invalid device credentials"}


def test_unknown_key_rejected(client, edge_camera):
    r = client.get("/api/edge/config", headers={"Authorization": "Bearer not-a-real-key"})
    assert r.status_code == 401
    assert r.json() == {"error": "Invalid device credentials"}


def test_revoked_key_rejected(client, edge_camera, auth_headers):
    # Revocation == clearing the hash (SRS §7.3 step 5).
    edge_repo.set_api_key_hash(EDGE_TEST_CODE, None)
    r = client.get("/api/edge/config", headers=auth_headers)
    assert r.status_code == 401


def test_rotation_invalidates_the_old_key(client, edge_camera, auth_headers):
    new_key = edge_devices.provision(EDGE_TEST_CODE)
    assert new_key != EDGE_TEST_KEY

    assert client.get("/api/edge/config", headers=auth_headers).status_code == 401
    r = client.get("/api/edge/config", headers={"Authorization": f"Bearer {new_key}"})
    assert r.status_code == 200
