"""The inspection surface the gate UI reads: snapshots, clips, test runs, idle view.

These are what moved off the core. The gate is what detects, so the gate is what
has to be able to show a detection happening and explain one after the fact.
Everything here runs with the agent disabled -- no camera, no model, no GPU --
because that is the state a technician debugs a device in.
"""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

import pytest

_TMP = Path(tempfile.mkdtemp())
os.environ.setdefault("SMART_GATE_RUN_AGENT", "false")
os.environ.setdefault("SMART_GATE_CAMERA_CODE", "PYTEST-GATE")
os.environ.setdefault("SMART_GATE_EDGE_DB", str(_TMP / "edge-test.db"))
os.environ["SMART_GATE_CROSSING_SNAPSHOTS"] = str(_TMP / "snaps")
os.environ["SMART_GATE_IDLE_STILL"] = str(_TMP / "idle.jpg")
os.environ["SMART_GATE_CLIP_DIR"] = str(_TMP / "clips")

from fastapi.testclient import TestClient  # noqa: E402

from app import store  # noqa: E402
from app.main import app  # noqa: E402
from app.services import clip_sources, idle_view  # noqa: E402

JPEG = b"\xff\xd8\xff\xe0" + b"pytest-not-a-real-jpeg" + b"\xff\xd9"


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def crossing() -> int:
    """One stored crossing with a snapshot, as the finalizer would write it.

    The key is unique to this module on purpose: the suites share one database,
    record_crossing is INSERT OR IGNORE on the idempotency key, and reusing
    another module's key silently keeps ITS row -- which has no snapshot.
    """
    store.ensure_schema()
    key = "pytest-inspection-snapshot"
    path = store.save_snapshot(key, JPEG)
    store.record_crossing(
        idempotency_key=key, hull_id="HD 2152", raw_code="2152",
        match_outcome="exact", confidence=0.97, read_count=24, window_sec=6.0,
        votes_json='[{"text": "2152", "count": 24, "avg_ocr_conf": 0.9}]',
        snapshot_path=path, detected_at="2026-08-03T01:00:00Z",
    )
    return [c for c in store.recent_crossings(50)
            if c["idempotency_key"] == key][0]["id"]


# --- snapshots ----------------------------------------------------------------
# The outbox deletes its copy of the crop the moment the core acknowledges
# delivery. Without the gate keeping its own, every crossing older than its
# delivery had no image -- which is exactly when a technician goes looking.

def test_snapshot_is_served_for_a_stored_crossing(client, crossing):
    r = client.get(f"/api/crossings/{crossing}/snapshot")
    assert r.status_code == 200
    assert r.headers["content-type"] == "image/jpeg"
    assert r.content == JPEG


def test_snapshot_survives_the_outbox_deleting_its_own_copy(client, crossing):
    """The gate's history and the delivery queue are separate stores.

    The outbox removes its snapshot as soon as the core acknowledges a crossing.
    If the history had merely pointed at that file, every delivered crossing
    would lose its image -- which is most of them, most of the time.
    """
    outbox_copy = _TMP / "outbox" / "delivered.jpg"
    outbox_copy.parent.mkdir(parents=True, exist_ok=True)
    outbox_copy.write_bytes(JPEG)
    outbox_copy.unlink()          # delivery acknowledged, queue cleans up
    assert client.get(f"/api/crossings/{crossing}/snapshot").status_code == 200


def test_missing_snapshot_is_404_not_a_placeholder(client):
    """An empty window never had a crop; saying so beats implying a blank frame."""
    assert client.get("/api/crossings/999999/snapshot").status_code == 404


def test_pruning_keeps_the_newest(tmp_path, monkeypatch):
    monkeypatch.setenv("SMART_GATE_CROSSING_SNAPSHOTS", str(tmp_path))
    for i in range(6):
        store.save_snapshot(f"k{i}", JPEG)
    assert store.prune_snapshots(keep=2) == 4
    assert len(list(tmp_path.glob("*.jpg"))) == 2


# --- clip sources -------------------------------------------------------------

def test_clip_listing_is_empty_without_a_folder(client, monkeypatch):
    monkeypatch.setattr(clip_sources, "CLIP_DIR", Path("/nonexistent-clip-dir"))
    assert client.get("/api/video-sources").json() == []


def test_only_video_files_are_offered(monkeypatch, tmp_path):
    monkeypatch.setattr(clip_sources, "CLIP_DIR", tmp_path)
    (tmp_path / "a.mp4").write_bytes(b"x")
    (tmp_path / "notes.txt").write_text("ignore me")
    assert [c["name"] for c in clip_sources.list_clips()] == ["a.mp4"]


def test_clip_names_cannot_escape_the_folder(monkeypatch, tmp_path):
    """A clip name is used as a path; traversal must not read outside CLIP_DIR."""
    monkeypatch.setattr(clip_sources, "CLIP_DIR", tmp_path)
    (tmp_path / "real.mp4").write_bytes(b"x")
    assert clip_sources.resolve(["../../etc/passwd"]) == []
    assert [p.name for p in clip_sources.resolve(["real.mp4"])] == ["real.mp4"]


# --- test runs ----------------------------------------------------------------

def test_starting_a_run_without_clips_is_rejected(client, monkeypatch):
    monkeypatch.setattr(clip_sources, "CLIP_DIR", Path("/nonexistent-clip-dir"))
    r = client.post("/api/test-runs", json={})
    assert r.status_code == 400
    assert "error" in r.json()


def test_active_run_is_null_before_anything_has_run(client):
    assert client.get("/api/test-runs/active").json() in (None, {})


def test_unknown_run_is_404(client):
    assert client.get("/api/test-runs/does-not-exist").status_code == 404
    assert client.post("/api/test-runs/does-not-exist/cancel").status_code == 404
    assert client.get("/api/test-runs/does-not-exist/stream").status_code == 404


# --- idle view ----------------------------------------------------------------
# A gate screen that goes blank between trucks tells a technician nothing.

def test_idle_frame_serves_the_cached_still(client, monkeypatch):
    # Pinned to a temp path explicitly. Relying on the module-level default here
    # once overwrote the device's real resting frame with a 28-byte fake.
    monkeypatch.setenv("SMART_GATE_IDLE_STILL", str(_TMP / "idle.jpg"))
    idle_view.store_still(JPEG)
    r = client.get("/api/idle-frame")
    assert r.status_code == 200
    assert r.headers["content-type"] == "image/jpeg"
    assert r.content == JPEG
    # A live frame must never be cached; the still is cheap to resend.
    assert r.headers["cache-control"] == "no-store"


def test_idle_frame_404s_with_no_camera_and_no_still(client, monkeypatch):
    monkeypatch.setenv("SMART_GATE_IDLE_STILL", "/nonexistent-still.jpg")
    assert client.get("/api/idle-frame").status_code == 404


def test_live_ring_frame_is_preferred_over_the_still():
    """One capture, many consumers -- never a second RTSP connection (SRS §3.1)."""
    class FakeRing:
        def latest(self):
            return (7, "frame-object")

    class FakeAgent:
        _ring = FakeRing()

    captured = {}
    monkey = idle_view._encode
    try:
        idle_view._encode = lambda frame: captured.setdefault("frame", frame) and b"live"
        assert idle_view.live_frame(FakeAgent()) == b"live"
        assert captured["frame"] == "frame-object"
    finally:
        idle_view._encode = monkey


def test_no_agent_means_no_live_frame():
    assert idle_view.live_frame(None) is None
