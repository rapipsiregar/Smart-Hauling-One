"""LocalFinalizer -- the live-agent path embedded in the FastAPI app.

Regression coverage for a real crash: this thread's queue.get() still unpacked
a 3-tuple after DetectionWindow started closing windows with a 4th element
(direction), so the very first truck a running gate detected killed this
thread silently -- no traceback on screen, just a gate that stopped recording
crossings after its first one.
"""

from __future__ import annotations

import os
import queue
import tempfile
import time
from pathlib import Path

os.environ.setdefault("SMART_GATE_RUN_AGENT", "false")
os.environ.setdefault(
    "SMART_GATE_EDGE_DB", str(Path(tempfile.mkdtemp()) / "edge-test.db")
)

from agent.config import Settings  # noqa: E402
from agent.outbox import Outbox  # noqa: E402
from app import store  # noqa: E402
from app.services.agent_runner import LocalFinalizer  # noqa: E402


def _settings(tmp: Path) -> Settings:
    return Settings(
        induk_url="http://127.0.0.1:0", api_key="test-key", camera_code="TEST-GATE",
        rtsp_url="none", outbox_db=tmp / "outbox.db", snapshot_dir=tmp / "snaps",
        video_dir=tmp / "video", model_path=tmp / "model.pt",
    )


def test_a_closed_window_does_not_kill_the_finalizer_thread(tmp_path) -> None:
    store.ensure_schema()
    outbox = Outbox(_settings(tmp_path))
    q: queue.Queue = queue.Queue()
    finalizer = LocalFinalizer(q, outbox, "TEST-GATE")
    finalizer.start()
    try:
        # Exactly the shape DetectionWindow._close_window puts on the queue.
        q.put((100.0, 106.0, [], "inbound"))
        deadline = time.time() + 3.0
        while q.qsize() and time.time() < deadline:
            time.sleep(0.02)
        time.sleep(0.1)  # let the thread finish processing what it just took
        assert finalizer.is_alive(), (
            "LocalFinalizer died processing a closed window -- almost certainly "
            "an unpack shape mismatch with DetectionWindow._close_window"
        )
    finally:
        # Not .join(): LocalFinalizer.__init__ names its Event `self._stop`,
        # which shadows threading.Thread's own private `_stop` method and makes
        # join() raise "'Event' object is not callable". Pre-existing, and
        # harmless in production (these are daemon threads, never joined) --
        # out of scope for this test.
        finalizer.stop()
