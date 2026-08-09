"""The reset button clears the gate devices too, and admits when it cannot.

Each gate keeps its own database, so a reset that only emptied the centre would
leave the devices holding readings the centre no longer has -- and the next test
would start from two stores that disagree. These tests pin both halves of that:
the fan-out happens, and a gate that could not be reached is reported as a
failure rather than folded into the success.
"""

from __future__ import annotations

import json
import socket
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest

from app.services import reset_crossings


def _free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


class _GateHandler(BaseHTTPRequestHandler):
    """Stands in for a gate device's own /api/crossings-reset."""

    def do_POST(self):  # noqa: N802 -- BaseHTTPRequestHandler's naming
        body = json.dumps({"status": "success", "removed": {"crossings": 3, "snapshots": 2}})
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(body.encode())

    def log_message(self, *args):  # keep the test output readable
        pass


@pytest.fixture
def gate_server():
    server = HTTPServer(("127.0.0.1", _free_port()), _GateHandler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{server.server_port}"
    server.shutdown()


def test_reaches_each_configured_gate(gate_server, monkeypatch):
    monkeypatch.setattr(reset_crossings, "GATE_URLS", [gate_server])

    results = reset_crossings._reset_gates()

    assert len(results) == 1
    assert results[0]["ok"] is True
    assert results[0]["removed"] == {"crossings": 3, "snapshots": 2}


def test_unreachable_gate_is_reported_not_swallowed(monkeypatch):
    dead = f"http://127.0.0.1:{_free_port()}"
    monkeypatch.setattr(reset_crossings, "GATE_URLS", [dead])

    results = reset_crossings._reset_gates()

    # The operator has to learn this device still holds its readings. Reporting
    # it as a success would send them away believing the system is empty.
    assert results[0]["ok"] is False
    assert results[0]["error"]


def test_one_dead_gate_does_not_stop_the_others(gate_server, monkeypatch):
    dead = f"http://127.0.0.1:{_free_port()}"
    monkeypatch.setattr(reset_crossings, "GATE_URLS", [dead, gate_server])

    results = reset_crossings._reset_gates()

    assert [entry["ok"] for entry in results] == [False, True]


def test_no_gates_configured_is_not_an_error(monkeypatch):
    """Production has not wired this yet; the centre must still reset itself."""
    monkeypatch.setattr(reset_crossings, "GATE_URLS", [])

    assert reset_crossings._reset_gates() == []
