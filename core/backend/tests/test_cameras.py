"""TDD: camera registry + folder-based attribution.

Cameras are real operator-defined records in `data/smart_gate.db`. Crossings are
attributed to a camera by the playlist subfolder their video lives in. These
tests create cameras against the shipped DB and always clean up so the dataset is
left untouched.
"""

from __future__ import annotations

import sqlite3

import pytest

from app.services import cameras as cam
from app.core.config import DB_PATH
from app.services.dataset import invalidate_cache

TEST_CODE = "PYTEST-CAM-A"


def _purge_test_cameras() -> None:
    cam.ensure_schema()
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.execute("DELETE FROM cameras WHERE camera_code LIKE 'PYTEST-%'")
        conn.commit()
    finally:
        conn.close()
    cam.sync_attribution()  # clears camera_id back to real state
    invalidate_cache()


@pytest.fixture(autouse=True)
def _cleanup():
    _purge_test_cameras()
    yield
    _purge_test_cameras()


# --- Schema ------------------------------------------------------------------

def test_schema_adds_cameras_table_and_camera_id_column():
    cam.ensure_schema()
    conn = sqlite3.connect(DB_PATH)
    try:
        tables = {r[0] for r in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'")}
        assert "cameras" in tables
        cols = {r[1] for r in conn.execute("PRAGMA table_info(video_results)")}
        assert "camera_id" in cols
    finally:
        conn.close()


# --- CRUD --------------------------------------------------------------------

def test_create_and_get_camera():
    created = cam.create_camera({
        "camera_code": TEST_CODE,
        "name": "CK Gate A",
        "gate_location": "CK Gate A",
        "status": "online",
        "rtsp_url": "rtsp://10.0.0.5:554/stream1",
        "folder": "",
    })
    assert created is not None
    assert created["camera_code"] == TEST_CODE
    fetched = cam.get_camera(TEST_CODE)
    assert fetched["name"] == "CK Gate A"


def test_create_requires_code_and_name():
    assert cam.create_camera({"camera_code": "", "name": "x"}) is None
    assert cam.create_camera({"camera_code": "PYTEST-X", "name": ""}) is None


def test_duplicate_camera_code_rejected():
    assert cam.create_camera({"camera_code": TEST_CODE, "name": "one"}) is not None
    assert cam.create_camera({"camera_code": TEST_CODE, "name": "two"}) is None


def test_update_and_delete_camera():
    cam.create_camera({"camera_code": TEST_CODE, "name": "orig", "status": "offline"})
    updated = cam.update_camera(TEST_CODE, {"status": "maintenance", "name": "new"})
    assert updated["status"] == "maintenance"
    assert updated["name"] == "new"
    assert cam.delete_camera(TEST_CODE) is True
    assert cam.get_camera(TEST_CODE) is None


def test_invalid_enums_are_normalised():
    created = cam.create_camera({
        "camera_code": TEST_CODE, "name": "x",
        "direction": "sideways", "status": "exploded",
    })
    assert created["direction"] == "both"
    assert created["status"] == "offline"


# --- Folder-based attribution ------------------------------------------------

def test_camera_attributes_videos_in_its_folder():
    """A camera owns the videos whose playlist folder matches its own."""
    cam.create_camera({
        "camera_code": TEST_CODE, "name": "PyTest Gate",
        "gate_location": "PyTest Gate", "folder": "pytest-gate",
    })
    resolved = cam.resolve_camera_for_video(
        "clip.mp4", cam.camera_by_folder(), {"clip.mp4": "pytest-gate"}
    )
    assert resolved is not None
    assert resolved["camera_code"] == TEST_CODE


def test_video_in_unregistered_folder_is_unassigned():
    """A video whose folder has no camera resolves to None (honest 'Unassigned')."""
    resolved = cam.resolve_camera_for_video(
        "ghost.mp4", cam.camera_by_folder(), {"ghost.mp4": "no-camera-here"}
    )
    assert resolved is None


def test_crossings_camera_identity_is_consistent():
    """Every attributed crossing carries a real registered camera + gate label.

    Arrangement-independent: passes whether or not gate folders are seeded.
    """
    from app.services.reference import build_crossings
    invalidate_cache()
    known_codes = {c["camera_code"] for c in cam.list_cameras()}
    for c in build_crossings():
        if c["cameraCode"] is not None:
            assert c["cameraCode"] in known_codes
            assert c["lane"]  # non-empty gate label
