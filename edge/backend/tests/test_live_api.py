"""The endpoints the gate console reads: live state, crop images, and the MJPEG feed."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

import pytest

# Set before app import, exactly as tests/test_gate_api.py does: the edge suite
# has no conftest on purpose, so each file states the environment it needs.
os.environ.setdefault("SMART_GATE_RUN_AGENT", "false")
os.environ.setdefault("SMART_GATE_CAMERA_CODE", "PYTEST-GATE")
os.environ.setdefault(
    "SMART_GATE_EDGE_DB", str(Path(tempfile.mkdtemp()) / "edge-test.db")
)

from fastapi.testclient import TestClient  # noqa: E402

from agent.live_state import LIVE  # noqa: E402
from app import store  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture
def client():
    store.ensure_schema()
    return TestClient(app)


@pytest.fixture(autouse=True)
def clean_live():
    """LIVE is a module-level singleton -- one gate per process. Tests that share
    it must not inherit each other's tracks."""
    LIVE.reset()
    yield
    LIVE.reset()


def test_live_state_is_serveable_before_anything_has_run(client) -> None:
    """A gate console opened on a cold device must render, not 500."""
    response = client.get("/api/live/state")
    assert response.status_code == 200

    body = response.json()
    assert body["tracks"] == []
    assert body["boxes"] == []
    assert body["active_track"] is None
    assert body["counters"] == {
        "frames": 0, "detections": 0, "ocr_attempts": 0, "ocr_reads": 0,
    }


def test_live_state_shows_boxes_with_no_readings_yet(client) -> None:
    """The behaviour the reviewer asked for, at the API boundary."""
    LIVE.open_track(1)
    LIVE.publish_frame(b"jpeg", [{"x0": 1, "y0": 2, "x1": 3, "y1": 4, "conf": 0.9}])
    LIVE.note_ocr_queued(1)

    body = client.get("/api/live/state").json()
    assert len(body["boxes"]) == 1
    assert body["tracks"][0]["pending_ocr"] == 1
    assert body["tracks"][0]["crops"] == []


def test_crop_is_served_as_jpeg(client) -> None:
    LIVE.open_track(7)
    LIVE.add_crop(7, crop_index=3, jpeg=b"\xff\xd8jpeg-bytes", text="2152",
                  raw="2152", ocr_conf=0.9, det_conf=0.8, frame=12)

    response = client.get("/api/live/crops/7/3")
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/jpeg"
    assert response.content == b"\xff\xd8jpeg-bytes"


def test_missing_crop_is_404_not_a_placeholder(client) -> None:
    """A placeholder would imply the camera saw something it did not."""
    assert client.get("/api/live/crops/999/1").status_code == 404


def test_reset_clears_the_view_without_touching_crossings(client) -> None:
    """Clearing what is on screen must never delete the record of trucks that
    actually passed -- that is a separate, confirmed action."""
    LIVE.open_track(1)
    LIVE.add_crop(1, crop_index=1, jpeg=b"j", text="2152", raw="2152",
                  ocr_conf=0.9, det_conf=0.8, frame=1)
    before = len(client.get("/api/crossings").json())

    assert client.post("/api/live/reset").status_code == 200
    assert client.get("/api/live/state").json()["tracks"] == []
    assert len(client.get("/api/crossings").json()) == before


def test_status_reports_which_engine_is_running(client) -> None:
    """Two gates reading the same truck differently starts with this question."""
    body = client.get("/api/status").json()
    assert body["ocr_backend"] in (
        "ppocrv6-tiny", "ppocrv6-small", "ppocrv6-medium", "paddleocr-vl",
    )
