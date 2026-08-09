"""The stored video_results.camera_id must win over playlist-folder guessing.

Edge-submitted crossings have no file under PLAYLIST_DIR, so folder guessing
cannot attribute them -- only the stored FK can. Before this fix,
video_results_repo.load_video_results() never selected camera_id at all, so every
edge crossing would have read as "Unassigned Gate".
"""

from __future__ import annotations

import pytest

from app.core.database import connect
from app.services import cameras as cam
from app.services.dataset import build_dataset, invalidate_cache

TEST_CODE = "PYTEST-ATTR-CAM"
TEST_VIDEO = "edge-PYTEST-ATTR-no-such-file.jpg"


def _purge():
    cam.ensure_schema()
    conn = connect()
    try:
        conn.execute("DELETE FROM video_results WHERE video = ?", (TEST_VIDEO,))
        conn.execute("DELETE FROM cameras WHERE camera_code = ?", (TEST_CODE,))
        conn.commit()
    finally:
        conn.close()
    invalidate_cache()


@pytest.fixture(autouse=True)
def _cleanup():
    _purge()
    yield
    _purge()


def test_stored_camera_id_beats_folder_guessing():
    created = cam.create_camera({
        "camera_code": TEST_CODE,
        "name": "Attribution Test Gate",
        "gate_location": "Pytest Gate Location",
        "folder": "pytest-attr-folder",
    })
    assert created is not None

    conn = connect()
    try:
        conn.execute(
            "INSERT INTO video_results (video, voted_hull_id, vote_confidence, "
            "total_detections, frames_with_detections, camera_id, source) "
            "VALUES (?, 'DT-999', 0.9, 3, 3, ?, 'edge')",
            (TEST_VIDEO, created["id"]),
        )
        conn.commit()
    finally:
        conn.close()
    invalidate_cache()

    match = [c for c in build_dataset()["crossings"] if c["video"] == TEST_VIDEO]
    assert len(match) == 1, "the edge row did not reach build_dataset()"
    crossing = match[0]

    # The whole point: no file exists under PLAYLIST_DIR for this video, so only
    # the stored FK could have produced a real gate here.
    assert crossing["camera_id"] == created["id"]
    assert crossing["camera_code"] == TEST_CODE
    assert crossing["lane"] == "Pytest Gate Location"
    assert crossing["lane"] != "Unassigned Gate"


def test_sync_attribution_does_not_clobber_edge_rows():
    """POST /api/cameras-sync-attribution must not strip edge crossings' gate.

    Edge crossings are attributed at insert time from the submitting device and
    have no playlist file. A sync that rewrote every row would set them to NULL,
    silently unassigning every live crossing.
    """
    created = cam.create_camera({
        "camera_code": TEST_CODE,
        "name": "Attribution Test Gate",
        "gate_location": "Pytest Gate Location",
        "folder": "pytest-attr-folder",
    })
    assert created is not None

    conn = connect()
    try:
        conn.execute(
            "INSERT INTO video_results (video, voted_hull_id, vote_confidence, "
            "total_detections, frames_with_detections, camera_id, source) "
            "VALUES (?, 'DT-999', 0.9, 3, 3, ?, 'edge')",
            (TEST_VIDEO, created["id"]),
        )
        conn.commit()
    finally:
        conn.close()

    cam.sync_attribution()

    conn = connect()
    try:
        after = conn.execute(
            "SELECT camera_id FROM video_results WHERE video = ?", (TEST_VIDEO,)
        ).fetchone()[0]
    finally:
        conn.close()
    assert after == created["id"], "sync_attribution wiped an edge crossing's camera_id"
