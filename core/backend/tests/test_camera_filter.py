"""TDD: filter the reference read endpoints by camera (camera_code / camera_id).

The filter is additive and backward-compatible: no query param returns the full
list (locked by test_response_contract). These tests cover the filter helper
directly (hermetic) and the endpoint wiring (arrangement-independent).
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.dataset import filter_by_camera

client = TestClient(app)


# --- Unit: the shared filter helper ------------------------------------------

def test_filter_by_camera_code():
    items = [{"cameraCode": "A", "cameraId": 1}, {"cameraCode": "B", "cameraId": 2}]
    assert filter_by_camera(items, camera_code="A") == [items[0]]


def test_filter_by_camera_id():
    items = [{"cameraCode": "A", "cameraId": 1}, {"cameraCode": "B", "cameraId": 2}]
    assert filter_by_camera(items, camera_id=2) == [items[1]]


def test_filter_no_args_returns_all():
    items = [{"cameraCode": "A", "cameraId": 1}, {"cameraCode": "B", "cameraId": 2}]
    assert filter_by_camera(items) == items


# --- Endpoint wiring ---------------------------------------------------------

def test_crossings_unknown_camera_returns_empty():
    assert client.get("/api/crossings?camera_code=__NO_SUCH_CAM__").json() == []


def test_cctv_unknown_camera_returns_empty():
    assert client.get("/api/cctv-detections?camera_code=__NO_SUCH_CAM__").json() == []


def test_fleet_unknown_camera_returns_empty():
    assert client.get("/api/fleet-registry?camera_code=__NO_SUCH_CAM__").json() == []


@pytest.mark.parametrize("path", ["/api/crossings", "/api/cctv-detections"])
def test_filter_returns_subset_for_attributed_camera(path):
    """When cameras are attributed (e.g. after `python -m app.seed`), filtering
    by a real camera_code yields only that camera's items."""
    everything = client.get(path).json()
    codes = {x["cameraCode"] for x in everything if x.get("cameraCode")}
    if not codes:
        pytest.skip("no cameras attributed; run `uv run python -m app.seed`")
    code = sorted(codes)[0]
    filtered = client.get(f"{path}?camera_code={code}").json()
    assert filtered, "expected at least one item for an attributed camera"
    assert all(x["cameraCode"] == code for x in filtered)
    assert len(filtered) <= len(everything)
