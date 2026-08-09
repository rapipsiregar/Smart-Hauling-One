"""Local outbox durability and ordering (SRS §4).

No network: the sender thread is exercised in test_e2e_outbox_delivery.py against
a real induk. These tests cover the queue's own guarantees.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from agent.config import Settings
from agent.outbox import Outbox, OutboxSender


@pytest.fixture
def outbox(tmp_path: Path) -> Outbox:
    settings = Settings(
        induk_url="http://localhost:8000",
        api_key="test-key",
        camera_code="GATE-TEST",
        rtsp_url="unused",
        outbox_db=tmp_path / "outbox.db",
        snapshot_dir=tmp_path / "snapshots",
        video_dir=tmp_path / "video",
        model_path=tmp_path / "model.pt",
    )
    return Outbox(settings)


def _payload(hull="DT-118"):
    return {
        "camera_code": "GATE-TEST",
        "detected_at": "2026-08-02T14:31:02Z",
        "window_sec": 5.8,
        "hull_id": hull,
        "confidence": 0.94,
        "read_count": 3,
        "votes": [{"text": hull, "count": 3, "avg_ocr_conf": 0.9}],
    }


def test_enqueue_returns_a_uuid_key(outbox):
    key = outbox.enqueue(camera_code="GATE-TEST", payload=_payload(), snapshot=b"jpeg")
    assert len(key) == 36 and key.count("-") == 4
    assert outbox.depth() == 1


def test_snapshot_written_to_disk(outbox):
    key = outbox.enqueue(camera_code="GATE-TEST", payload=_payload(), snapshot=b"jpegbytes")
    row = outbox.next_due()
    assert row["snapshot_path"].endswith(f"{key}.jpg")
    assert Path(row["snapshot_path"]).read_bytes() == b"jpegbytes"


def test_empty_window_needs_no_snapshot(outbox):
    outbox.enqueue(camera_code="GATE-TEST", payload=_payload("UNKNOWN"), snapshot=None)
    assert outbox.next_due()["snapshot_path"] is None


def test_delivery_order_is_insertion_order(outbox):
    first = outbox.enqueue(camera_code="GATE-TEST", payload=_payload("AAA"), snapshot=None)
    outbox.enqueue(camera_code="GATE-TEST", payload=_payload("BBB"), snapshot=None)
    # Strictly one at a time, oldest first (SRS §4.2).
    assert outbox.next_due()["idempotency_key"] == first


def test_delete_removes_row_and_snapshot(outbox):
    outbox.enqueue(camera_code="GATE-TEST", payload=_payload(), snapshot=b"jpeg")
    row = outbox.next_due()
    path = Path(row["snapshot_path"])
    outbox.delete(int(row["id"]), row["snapshot_path"])
    assert outbox.depth() == 0
    assert not path.exists()


def test_failure_defers_the_row(outbox):
    outbox.enqueue(camera_code="GATE-TEST", payload=_payload(), snapshot=None)
    row = outbox.next_due()
    outbox.record_failure(row, "HTTP 500")

    # Backoff pushed next_attempt_at into the future, so it is no longer due...
    assert outbox.next_due() is None
    # ...but it is NOT lost. Nothing is ever dropped except by the ceiling.
    assert outbox.depth() == 1


def test_failure_records_attempt_and_error(outbox):
    outbox.enqueue(camera_code="GATE-TEST", payload=_payload(), snapshot=None)
    row = outbox.next_due()
    outbox.record_failure(row, "HTTP 401")

    with outbox._connect() as conn:
        stored = conn.execute("SELECT * FROM outbox").fetchone()
    # Even a 401 retries: a rotated key may not have propagated yet, and a
    # dropped crossing is worse than a stuck one (SRS §4.2).
    assert stored["attempt_count"] == 1
    assert "401" in stored["last_error"]


def test_queue_survives_a_restart(outbox, tmp_path):
    key = outbox.enqueue(camera_code="GATE-TEST", payload=_payload(), snapshot=None)
    reopened = Outbox(outbox.settings)
    assert reopened.depth() == 1
    assert reopened.next_due()["idempotency_key"] == key


# --- delivery notification ----------------------------------------------------
# The queue empties as it drains, so the moment a row is accepted is the only
# chance to record that it arrived. The gate UI's per-crossing "Kirim" column
# reads exactly that, and showed everything as still queued until this was wired.

class _FakeResponse:
    def __init__(self, status_code: int) -> None:
        self.status_code = status_code


class _FakeClient:
    def __init__(self, status_code: int = 201) -> None:
        self.status_code = status_code
        self.submitted: list[str] = []

    def submit_crossing(self, *, idempotency_key, payload_json, snapshot_path):
        self.submitted.append(idempotency_key)
        return _FakeResponse(self.status_code)


def _drain_once(outbox, client, on_delivered=None):
    """Run exactly one send, without starting the thread's forever loop."""
    sender = OutboxSender(outbox, client, on_delivered=on_delivered)
    row = outbox.next_due()
    response = client.submit_crossing(
        idempotency_key=row["idempotency_key"],
        payload_json=row["payload_json"],
        snapshot_path=row["snapshot_path"],
    )
    if response.status_code in (200, 201):
        sender._deliver(row)
    else:
        outbox.record_failure(row, f"HTTP {response.status_code}")
    return row


def test_delivery_notifies_with_the_idempotency_key(outbox):
    key = outbox.enqueue(camera_code="GATE-TEST", payload=_payload(), snapshot=None)
    delivered: list[str] = []

    _drain_once(outbox, _FakeClient(201), on_delivered=delivered.append)

    assert delivered == [key]
    assert outbox.depth() == 0


def test_rejected_row_is_not_reported_delivered(outbox):
    outbox.enqueue(camera_code="GATE-TEST", payload=_payload(), snapshot=None)
    delivered: list[str] = []

    _drain_once(outbox, _FakeClient(500), on_delivered=delivered.append)

    assert delivered == []
    assert outbox.depth() == 1


def test_a_failing_callback_does_not_resurrect_the_row(outbox):
    """The induk already has it -- retrying would submit a duplicate."""
    outbox.enqueue(camera_code="GATE-TEST", payload=_payload(), snapshot=None)

    def _explode(_key):
        raise RuntimeError("local store unavailable")

    _drain_once(outbox, _FakeClient(201), on_delivered=_explode)

    assert outbox.depth() == 0


def test_sender_works_without_a_callback(outbox):
    """agent/main.py runs standalone, with no local store to notify."""
    outbox.enqueue(camera_code="GATE-TEST", payload=_payload(), snapshot=None)

    _drain_once(outbox, _FakeClient(201))

    assert outbox.depth() == 0
