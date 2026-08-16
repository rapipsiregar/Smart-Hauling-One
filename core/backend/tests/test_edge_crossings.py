"""Edge crossing ingestion: TC-010-01, TC-010-02, TC-010-03."""

from __future__ import annotations

import json
import uuid

from app.core.config import SNAPSHOT_DIR
from app.services.dataset import build_dataset, invalidate_cache
from tests.conftest import EDGE_TEST_CODE

FAKE_JPEG = b"\xff\xd8\xff\xe0" + b"pytest-not-a-real-jpeg" + b"\xff\xd9"


def _payload(**overrides) -> str:
    body = {
        "camera_code": EDGE_TEST_CODE,
        "detected_at": "2026-08-02T14:31:02Z",
        "window_sec": 5.8,
        "hull_id": "DT-118",
        "confidence": 0.94,
        "read_count": 9,
        "votes": [
            {"text": "DT-118", "count": 6, "avg_ocr_conf": 0.91},
            {"text": "DT118", "count": 2, "avg_ocr_conf": 0.85},
        ],
    }
    body.update(overrides)
    return json.dumps(body)


def _submit(client, headers, *, key=None, payload=None, snapshot=FAKE_JPEG):
    key = key or str(uuid.uuid4())
    files = {"snapshot": ("crop.jpg", snapshot, "image/jpeg")} if snapshot else None
    response = client.post(
        "/api/edge/crossings",
        headers={**headers, "Idempotency-Key": key},
        data={"payload": payload or _payload()},
        files=files,
    )
    return response, key


def test_new_crossing_returns_201(client, edge_camera, auth_headers):
    r, _ = _submit(client, auth_headers)
    assert r.status_code == 201
    body = r.json()
    assert body["status"] == "success"
    assert isinstance(body["crossing_id"], int)


def test_duplicate_key_returns_200_and_same_id(client, edge_camera, auth_headers):
    first, key = _submit(client, auth_headers)
    assert first.status_code == 201

    second, _ = _submit(client, auth_headers, key=key)
    assert second.status_code == 200
    assert second.json()["duplicate"] is True
    assert second.json()["crossing_id"] == first.json()["crossing_id"]


def test_empty_window_accepted_without_snapshot(client, edge_camera, auth_headers):
    r, _ = _submit(
        client,
        auth_headers,
        payload=_payload(hull_id="UNKNOWN", confidence=0.0, read_count=0, votes=[]),
        snapshot=None,
    )
    assert r.status_code == 201


def test_missing_snapshot_rejected_when_required(client, edge_camera, auth_headers):
    r, _ = _submit(client, auth_headers, snapshot=None)
    assert r.status_code == 422


def test_malformed_payload_rejected(client, edge_camera, auth_headers):
    r, _ = _submit(client, auth_headers, payload='{"camera_code": "x"}')
    assert r.status_code == 422


def test_non_uuid4_idempotency_key_rejected(client, edge_camera, auth_headers):
    r, _ = _submit(client, auth_headers, key="not-a-uuid")
    assert r.status_code == 422


def test_camera_code_mismatch_rejected(client, edge_camera, auth_headers):
    r, _ = _submit(client, auth_headers, payload=_payload(camera_code="SOME-OTHER-GATE"))
    assert r.status_code == 422


def test_snapshot_lands_where_the_read_path_looks(client, edge_camera, auth_headers):
    r, key = _submit(client, auth_headers)
    assert r.status_code == 201
    stem = f"edge-{EDGE_TEST_CODE}-{key}"
    matches = list(SNAPSHOT_DIR.glob(f"{stem}__*.jpg"))
    assert matches, "snapshot not discoverable by dataset._snapshot_for"
    for path in matches:
        path.unlink(missing_ok=True)


def test_crossing_is_attributed_to_the_submitting_camera(client, edge_camera, auth_headers):
    r, key = _submit(client, auth_headers)
    assert r.status_code == 201
    invalidate_cache()

    video = f"edge-{EDGE_TEST_CODE}-{key}.jpg"
    match = [c for c in build_dataset()["crossings"] if c["video"] == video]
    assert len(match) == 1
    # Depends on the camera-attribution fix: without it this reads
    # "Unassigned Gate", because no playlist file exists for an edge crossing.
    assert match[0]["camera_code"] == EDGE_TEST_CODE
    assert match[0]["lane"] == "Pytest North"


def test_the_devices_own_direction_reading_is_stored_and_returned(
    client, edge_camera, auth_headers
):
    """The crossing's direction comes from the device's virtual center line, not
    from a fixed direction on the camera -- the camera has none anymore."""
    r, key = _submit(client, auth_headers, payload=_payload(direction="outbound"))
    assert r.status_code == 201
    invalidate_cache()

    video = f"edge-{EDGE_TEST_CODE}-{key}.jpg"
    match = [c for c in build_dataset()["crossings"] if c["video"] == video]
    assert len(match) == 1
    assert match[0]["direction"] == "outbound"


def test_a_window_that_never_crossed_the_line_stores_no_direction(
    client, edge_camera, auth_headers
):
    """Omitted (or null) direction is a real answer -- the truck was seen but
    never crossed the line -- not something to guess from the camera."""
    r, key = _submit(client, auth_headers, payload=_payload())
    assert r.status_code == 201
    invalidate_cache()

    video = f"edge-{EDGE_TEST_CODE}-{key}.jpg"
    match = [c for c in build_dataset()["crossings"] if c["video"] == video]
    assert len(match) == 1
    assert match[0]["direction"] is None


def test_a_stale_camera_direction_never_leaks_into_an_edge_crossing(
    client, edge_camera, auth_headers
):
    """Regression: cameras.direction is a legacy column (batch-pipeline only,
    app/services/dataset.py) surviving only because ADD COLUMN never drops one.
    A camera provisioned before every gate detected both ways can still carry
    an old 'inbound'/'outbound' value in that column -- and if an edge crossing
    with no direction of its own ever fell back to it, every truck a gate saw
    would silently resolve to that one fixed direction again, exactly the
    per-gate behaviour this whole feature replaced."""
    from app.repositories import camera_repo

    camera_repo.update_row(EDGE_TEST_CODE, {"direction": "inbound"})

    r, key = _submit(client, auth_headers, payload=_payload())
    assert r.status_code == 201
    invalidate_cache()

    video = f"edge-{EDGE_TEST_CODE}-{key}.jpg"
    match = [c for c in build_dataset()["crossings"] if c["video"] == video]
    assert len(match) == 1
    assert match[0]["direction"] is None


# --- Timestamp compatibility with the batch pipeline --------------------------
# The device sends ISO 8601 UTC with a `Z` (API_CONTRACT §0); the batch pipeline
# writes `video_results.crossed_at` naive (crossing_time.ISO). Both land in the
# SAME column, and ritase pairing sorts and subtracts across all of them --
# which Python refuses to do between an aware and a naive datetime. Storing the
# `Z` form verbatim took /api/ritase and /api/shift-report down with a 500 the
# first time one edge crossing sat beside batch rows, i.e. on the first real
# delivery from a gate.

def test_detected_at_is_stored_in_the_batch_pipelines_format(
    client, edge_camera, auth_headers
):
    from app.core.database import connect

    r, key = _submit(client, auth_headers)
    assert r.status_code == 201

    conn = connect()
    try:
        stored = conn.execute(
            "SELECT crossed_at FROM video_results WHERE video = ?",
            (f"edge-{EDGE_TEST_CODE}-{key}.jpg",),
        ).fetchone()[0]
    finally:
        conn.close()

    # Same instant, no offset suffix -- comparable with every batch row.
    assert stored == "2026-08-02T14:31:02"


def test_reports_survive_edge_and_batch_crossings_together(
    client, edge_camera, auth_headers
):
    assert _submit(client, auth_headers)[0].status_code == 201
    invalidate_cache()

    assert client.get("/api/ritase").status_code == 200
    assert client.get("/api/shift-report").status_code == 200


def test_a_legacy_z_suffixed_row_does_not_break_pairing(
    client, edge_camera, auth_headers
):
    """Rows written before the normalisation still have to sort."""
    from app.core.database import connect

    r, key = _submit(client, auth_headers)
    assert r.status_code == 201

    conn = connect()
    try:
        conn.execute(
            "UPDATE video_results SET crossed_at = ? WHERE video = ?",
            ("2026-08-02T14:31:02Z", f"edge-{EDGE_TEST_CODE}-{key}.jpg"),
        )
        conn.commit()
    finally:
        conn.close()
    invalidate_cache()

    assert client.get("/api/ritase").status_code == 200
    assert client.get("/api/shift-report").status_code == 200
