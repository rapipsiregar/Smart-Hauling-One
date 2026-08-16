"""TDD: FastAPI endpoints for the camera registry."""

from __future__ import annotations

import sqlite3

import pytest
from fastapi.testclient import TestClient

from app.core.config import DB_PATH
from app.services.dataset import invalidate_cache
from app.main import app
from app.services import cameras as cam

client = TestClient(app)
TEST_CODE = "PYTEST-API-CAM"


def _purge():
    cam.ensure_schema()
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.execute("DELETE FROM cameras WHERE camera_code LIKE 'PYTEST-%'")
        conn.commit()
    finally:
        conn.close()
    cam.sync_attribution()
    invalidate_cache()


@pytest.fixture(autouse=True)
def _cleanup():
    _purge()
    yield
    _purge()


def test_camera_crud_roundtrip():
    # empty list initially (no PYTEST cameras)
    r = client.get("/api/cameras")
    assert r.status_code == 200
    assert isinstance(r.json(), list)

    # create
    r = client.post("/api/cameras", json={
        "camera_code": TEST_CODE, "name": "API Gate", "folder": "",
        "status": "online",
        "rtsp_url": "rtsp://host/stream",
    })
    assert r.status_code == 200
    assert r.json()["camera_code"] == TEST_CODE

    # get
    r = client.get(f"/api/cameras/{TEST_CODE}")
    assert r.status_code == 200
    assert r.json()["name"] == "API Gate"

    # update
    r = client.put(f"/api/cameras/{TEST_CODE}", json={"status": "maintenance"})
    assert r.status_code == 200
    assert r.json()["status"] == "maintenance"

    # delete
    r = client.delete(f"/api/cameras/{TEST_CODE}")
    assert r.status_code == 200
    r = client.get(f"/api/cameras/{TEST_CODE}")
    assert r.status_code == 404


def test_create_duplicate_returns_400():
    client.post("/api/cameras", json={"camera_code": TEST_CODE, "name": "one"})
    r = client.post("/api/cameras", json={"camera_code": TEST_CODE, "name": "two"})
    assert r.status_code == 400


def test_sync_attribution_endpoint(tmp_path):
    """A clip that really sits in a camera's folder gets tagged to that camera.

    This test creates its own playlist file rather than relying on ambient
    footage: ``data/01-playlist/`` is gitignored, so on a fresh checkout there is
    nothing to attribute and the assertion below could otherwise only be
    satisfied by mis-attributing a row whose video has no file at all.
    """
    from app.core.config import PLAYLIST_DIR

    folder = "pytest-attr-gate"
    clip_dir = PLAYLIST_DIR / folder
    clip_dir.mkdir(parents=True, exist_ok=True)
    clip = clip_dir / "PYTEST-attr-clip.mp4"
    clip.write_bytes(b"not a real video, only the path matters for attribution")

    conn = sqlite3.connect(DB_PATH)
    try:
        conn.execute(
            "INSERT INTO video_results (video, voted_hull_id, vote_confidence, "
            "total_detections, frames_with_detections) VALUES (?, 'DT-000', 0.5, 1, 1)",
            (clip.name,),
        )
        conn.commit()
    finally:
        conn.close()

    try:
        client.post("/api/cameras", json={
            "camera_code": TEST_CODE, "name": "API Gate", "folder": folder,
        })
        r = client.post("/api/cameras-sync-attribution")
        assert r.status_code == 200
        assert r.json()["tagged"] > 0

        conn = sqlite3.connect(DB_PATH)
        try:
            cam_id = conn.execute(
                "SELECT camera_id FROM video_results WHERE video = ?", (clip.name,)
            ).fetchone()[0]
        finally:
            conn.close()
        assert cam_id is not None, "a clip inside a registered camera's folder was not tagged"
    finally:
        conn = sqlite3.connect(DB_PATH)
        try:
            conn.execute("DELETE FROM video_results WHERE video = ?", (clip.name,))
            conn.commit()
        finally:
            conn.close()
        clip.unlink(missing_ok=True)
        if clip_dir.is_dir() and not any(clip_dir.iterdir()):
            clip_dir.rmdir()
