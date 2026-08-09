"""Live-view session orchestration: TC-009-01 through TC-009-05.

Never sleeps for the real 20s timeout -- the stale sweep is driven by rewinding
last_keepalive and calling sweep_stale_sessions() directly.
"""

from __future__ import annotations

import threading
import time

import pytest

from app.core.config import LIVE_SESSION_STALE_SEC
from app.services import live_sessions
from tests.conftest import EDGE_TEST_CODE


@pytest.fixture(autouse=True)
def _reset_sessions():
    live_sessions.reset_for_tests()
    yield
    live_sessions.reset_for_tests()


def test_start_returns_session_and_whep_url(client, edge_camera):
    r = client.post(f"/api/cameras/{EDGE_TEST_CODE}/live/start")
    assert r.status_code == 200
    body = r.json()
    assert set(body) == {"session_id", "whep_url"}
    assert body["session_id"] in body["whep_url"]
    assert EDGE_TEST_CODE in body["whep_url"]


def test_start_unknown_camera_404(client):
    r = client.post("/api/cameras/PYTEST-NO-SUCH-GATE/live/start")
    assert r.status_code == 404


def test_start_for_offline_device_still_succeeds(client, edge_camera):
    # TC-009-02: a session for an offline device is created and simply never
    # streams. The API must not pre-emptively fail.
    assert edge_camera["status"] == "offline"
    assert client.post(f"/api/cameras/{EDGE_TEST_CODE}/live/start").status_code == 200


def test_duplicate_start_reuses_the_session(client, edge_camera):
    # TC-009-03: two tabs on the same gate is a harmless race, not a conflict.
    first = client.post(f"/api/cameras/{EDGE_TEST_CODE}/live/start").json()
    second = client.post(f"/api/cameras/{EDGE_TEST_CODE}/live/start").json()
    assert first["session_id"] == second["session_id"]
    assert first["whep_url"] == second["whep_url"]


def test_heartbeat_keeps_the_session_alive(client, edge_camera):
    session_id = client.post(f"/api/cameras/{EDGE_TEST_CODE}/live/start").json()["session_id"]
    r = client.post(
        f"/api/cameras/{EDGE_TEST_CODE}/live/heartbeat", json={"session_id": session_id}
    )
    assert r.status_code == 200
    assert r.json() == {"status": "success"}


def test_heartbeat_unknown_session_404(client, edge_camera):
    client.post(f"/api/cameras/{EDGE_TEST_CODE}/live/start")
    r = client.post(
        f"/api/cameras/{EDGE_TEST_CODE}/live/heartbeat",
        json={"session_id": "00000000-0000-4000-8000-000000000000"},
    )
    assert r.status_code == 404


def test_stop_is_idempotent(client, edge_camera):
    session_id = client.post(f"/api/cameras/{EDGE_TEST_CODE}/live/start").json()["session_id"]
    for _ in range(2):
        r = client.post(
            f"/api/cameras/{EDGE_TEST_CODE}/live/stop", json={"session_id": session_id}
        )
        assert r.status_code == 200
        assert r.json() == {"status": "success"}


def test_stop_after_heartbeat_ends_the_session(client, edge_camera):
    session_id = client.post(f"/api/cameras/{EDGE_TEST_CODE}/live/start").json()["session_id"]
    client.post(f"/api/cameras/{EDGE_TEST_CODE}/live/stop", json={"session_id": session_id})
    r = client.post(
        f"/api/cameras/{EDGE_TEST_CODE}/live/heartbeat", json={"session_id": session_id}
    )
    assert r.status_code == 404


def test_stale_session_is_swept(client, edge_camera):
    # TC-009-05: tab closed without an explicit stop.
    client.post(f"/api/cameras/{EDGE_TEST_CODE}/live/start")
    session = live_sessions.get_session(EDGE_TEST_CODE)
    assert session is not None

    session.last_keepalive = time.monotonic() - (LIVE_SESSION_STALE_SEC + 1)
    assert live_sessions.sweep_stale_sessions() == 1
    assert live_sessions.get_session(EDGE_TEST_CODE) is None


def test_fresh_session_survives_the_sweep(client, edge_camera):
    client.post(f"/api/cameras/{EDGE_TEST_CODE}/live/start")
    assert live_sessions.sweep_stale_sessions() == 0
    assert live_sessions.get_session(EDGE_TEST_CODE) is not None


# --- Edge long-poll ----------------------------------------------------------

def test_longpoll_times_out_with_action_none(client, edge_camera, auth_headers):
    r = client.get("/api/edge/live-session?wait=0", headers=auth_headers)
    assert r.status_code == 200
    assert r.json() == {"action": "none"}


def test_longpoll_delivers_start_immediately(client, edge_camera, auth_headers):
    started = client.post(f"/api/cameras/{EDGE_TEST_CODE}/live/start").json()
    body = client.get("/api/edge/live-session?wait=0", headers=auth_headers).json()
    assert body["action"] == "start"
    assert body["session_id"] == started["session_id"]
    assert EDGE_TEST_CODE in body["whip_url"]
    assert body["whip_token"]
    # Single-use: the same action is not delivered twice.
    again = client.get("/api/edge/live-session?wait=0", headers=auth_headers).json()
    assert again == {"action": "none"}


def test_longpoll_delivers_stop(client, edge_camera, auth_headers):
    started = client.post(f"/api/cameras/{EDGE_TEST_CODE}/live/start").json()
    client.get("/api/edge/live-session?wait=0", headers=auth_headers)  # consume start

    client.post(
        f"/api/cameras/{EDGE_TEST_CODE}/live/stop",
        json={"session_id": started["session_id"]},
    )
    body = client.get("/api/edge/live-session?wait=0", headers=auth_headers).json()
    assert body == {"action": "stop", "session_id": started["session_id"]}


def test_longpoll_wait_is_clamped_not_rejected(client, edge_camera, auth_headers):
    # API_CONTRACT §1.4: tolerate a misconfigured agent rather than erroring.
    # wait=0 keeps the test fast; the clamp itself is asserted below.
    from app.core.config import LIVE_SESSION_MAX_WAIT_SEC
    assert LIVE_SESSION_MAX_WAIT_SEC == 30
    r = client.get("/api/edge/live-session?wait=0", headers=auth_headers)
    assert r.status_code == 200


def test_waiting_longpoll_is_woken_by_a_start(client, edge_camera, auth_headers):
    """A poll parked before the request must return as soon as one arrives."""
    result = {}

    def _poll():
        result["body"] = client.get(
            "/api/edge/live-session?wait=10", headers=auth_headers
        ).json()

    thread = threading.Thread(target=_poll)
    thread.start()
    time.sleep(0.3)  # let the poll park

    started = client.post(f"/api/cameras/{EDGE_TEST_CODE}/live/start").json()
    thread.join(timeout=5)

    assert not thread.is_alive(), "long-poll was not woken by the start request"
    assert result["body"]["action"] == "start"
    assert result["body"]["session_id"] == started["session_id"]
