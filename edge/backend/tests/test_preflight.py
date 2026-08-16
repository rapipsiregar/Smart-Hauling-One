"""Commissioning checks: does the device say WHY it is not working?

/api/status answers "is it working". This answers "what is stopping it", and the
value is entirely in the distinctions -- a red light saying "core unreachable"
sends a technician to the network cabinet when the real fault was a mistyped
key. So the tests here are mostly about failures being told apart, not about the
happy path.
"""

from __future__ import annotations

import pytest

from app.services import preflight

ENV = {
    "SMART_GATE_INDUK_URL": "http://core.example:8000",
    "SMART_GATE_API_KEY": "kunci-uji",
    "SMART_GATE_CAMERA_CODE": "CAM-GATE-A",
    "SMART_GATE_RTSP_URL": "rtsp://10.0.0.9:554/stream1",
}


@pytest.fixture
def env(monkeypatch):
    for key, value in ENV.items():
        monkeypatch.setenv(key, value)
    return monkeypatch


# --- configuration -----------------------------------------------------------

def test_a_missing_variable_is_named(env):
    env.delenv("SMART_GATE_API_KEY")
    check = preflight._env_check()
    assert check["ok"] is False
    assert "SMART_GATE_API_KEY" in check["detail"]
    assert check["fix"]


def test_a_complete_env_passes(env):
    check = preflight._env_check()
    assert check["ok"] is True
    assert "CAM-GATE-A" in check["detail"]


def test_every_failure_carries_a_next_action(env):
    """A red light with no instruction just moves the confusion around."""
    env.delenv("SMART_GATE_CAMERA_CODE")
    report = preflight.run()
    for check in report["checks"]:
        if not check["ok"]:
            assert check["fix"], f"{check['name']} gagal tanpa arahan"


# --- the core link -----------------------------------------------------------

class _Response:
    def __init__(self, status_code: int, payload: dict | None = None):
        self.status_code = status_code
        self._payload = payload or {}

    def json(self):
        return self._payload


def test_a_rejected_key_is_reported_as_a_key_problem(env, monkeypatch):
    """The most common commissioning mistake: a truncated paste."""
    monkeypatch.setattr(
        preflight.requests, "get", lambda *a, **k: _Response(401)
    )
    check = preflight._auth_check("http://core.example:8000", "salah")
    assert check["ok"] is False
    assert "401" in check["detail"]
    assert "Terbitkan Ulang Kunci" in check["fix"]


def test_an_accepted_key_reports_who_the_core_thinks_this_is(env, monkeypatch):
    monkeypatch.setattr(
        preflight.requests, "get",
        lambda *a, **k: _Response(200, {"camera_code": "CAM-GATE-A", "inbound_axis": "rtl"}),
    )
    check = preflight._auth_check("http://core.example:8000", "kunci-uji")
    assert check["ok"] is True
    assert "CAM-GATE-A" in check["detail"]
    assert "rtl" in check["detail"]


def test_a_key_belonging_to_another_gate_is_caught(env, monkeypatch):
    """Copying .env between gates: the failure with no symptoms.

    The device authenticates fine and reports crossings — under the wrong
    checkpoint. Nothing downstream can detect it, which is why it has to be
    caught at commissioning.
    """
    monkeypatch.setattr(
        preflight.requests, "get",
        lambda *a, **k: _Response(200, {"camera_code": "CAM-GATE-A"}),
    )
    check = preflight._camera_match_check(
        "http://core.example:8000", "kunci-uji", "CAM-GATE-B"
    )
    assert check["ok"] is False
    assert "CAM-GATE-B" in check["detail"] and "CAM-GATE-A" in check["detail"]
    assert "pos yang salah" in check["fix"]


def test_matching_codes_pass(env, monkeypatch):
    monkeypatch.setattr(
        preflight.requests, "get",
        lambda *a, **k: _Response(200, {"camera_code": "CAM-GATE-A"}),
    )
    check = preflight._camera_match_check(
        "http://core.example:8000", "kunci-uji", "CAM-GATE-A"
    )
    assert check["ok"] is True


def test_an_unreadable_core_url_is_not_reported_as_a_network_fault(env):
    """Different cause, different remedy: this one is a typo, not cabling."""
    check = preflight._reachable_check("bukan-alamat")
    assert check["ok"] is False
    assert "SMART_GATE_INDUK_URL" in check["fix"]


# --- the camera --------------------------------------------------------------

def test_the_placeholder_rtsp_address_is_flagged_as_a_placeholder(env):
    check = preflight._camera_source_check("rtsp://localhost:554/live")
    assert check["ok"] is True
    assert "contoh" in check["detail"]


def test_an_unreadable_rtsp_url_is_reported(env):
    check = preflight._camera_source_check("bukan-alamat-rtsp")
    assert check["ok"] is False
    assert "SMART_GATE_RTSP_URL" in check["fix"]


# --- the whole report --------------------------------------------------------

def test_checks_stop_where_they_stop_making_sense(env):
    """A wrong URL makes the auth result meaningless, so it is not attempted.

    The list reads top to bottom as a repair sequence rather than a pile of
    alarms that all fire from one root cause.
    """
    env.delenv("SMART_GATE_INDUK_URL")
    report = preflight.run()
    names = [c["name"] for c in report["checks"]]
    assert names == ["Berkas pengaturan (.env)"]
    assert report["ready"] is False
