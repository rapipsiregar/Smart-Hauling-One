"""Shared fixtures for the edge-system test suites.

Existing test modules predate this file and define their own local fixtures; they
are unaffected. New edge tests use the fixtures here.

Convention (inherited from ``tests/test_camera_api.py``): tests run against the
REAL database and clean up after themselves by prefixing every row they create
with ``PYTEST-``. Never point these at a temp DB -- several suites rely on the
real one's seeded content.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.core.config import SNAPSHOT_DIR
from app.core.database import connect
from app.main import app
from app.services import cameras as cam
from app.services.dataset import invalidate_cache

EDGE_TEST_CODE = "PYTEST-EDGE-GATE"
EDGE_TEST_KEY = "pytest-plaintext-device-key-do-not-use-in-production"


def _purge_edge_rows() -> None:
    """Delete every row and file this suite could have created, in FK-safe order."""
    cam.ensure_schema()
    conn = connect()
    try:
        conn.execute(
            "DELETE FROM detections WHERE video_result_id IN "
            "(SELECT id FROM video_results WHERE video LIKE 'edge-PYTEST-%')"
        )
        conn.execute("DELETE FROM video_results WHERE video LIKE 'edge-PYTEST-%'")
        conn.execute("DELETE FROM cameras WHERE camera_code LIKE 'PYTEST-%'")
        conn.commit()
    finally:
        conn.close()
    # Submitting a crossing also writes a snapshot beside the real ones. Rolling
    # back only the rows left those behind, one per run, in the user's data dir.
    for stale in SNAPSHOT_DIR.glob(f"edge-{EDGE_TEST_CODE}-*__*.jpg"):
        stale.unlink(missing_ok=True)
    invalidate_cache()


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def edge_camera():
    """A registered camera provisioned with a known plaintext API key.

    Yields the camera row dict. Cleaned up automatically.
    """
    from app.repositories import edge_repo
    from app.services import edge_devices

    _purge_edge_rows()
    created = cam.create_camera({
        "camera_code": EDGE_TEST_CODE,
        "name": "Pytest Edge Gate",
        "gate_location": "Pytest North",
        "direction": "inbound",
        "status": "offline",
        "folder": "pytest-edge-gate",
    })
    assert created is not None, "fixture setup failed: camera_code already taken?"
    edge_repo.set_api_key_hash(EDGE_TEST_CODE, edge_devices.hash_api_key(EDGE_TEST_KEY))
    yield cam.get_camera(EDGE_TEST_CODE)
    _purge_edge_rows()


@pytest.fixture
def auth_headers() -> dict:
    return {"Authorization": f"Bearer {EDGE_TEST_KEY}"}


@pytest.fixture
def require_crossings():
    """Skip a test that needs processed crossings when the dataset is empty.

    The reference/contract suites verify that served data is *derived from real
    processing output*. With no crossings in the database there is nothing to
    derive, so those assertions cannot be evaluated -- an explicit skip is honest
    where a rewritten assertion would just be testing nothing.

    The dataset is empty whenever no footage has been processed: ``data/`` is
    gitignored, and the truck master (``app/services/master_import.py``) supplies
    the fleet roster but no crossings. Process a clip, or run
    ``python -m app.demo_data``, and these run again unchanged.
    """
    from app.services.dataset import build_dataset, invalidate_cache

    invalidate_cache()
    if not build_dataset()["crossings"]:
        pytest.skip(
            "no crossings in the dataset -- process footage or run "
            "`python -m app.demo_data` to exercise this test"
        )
