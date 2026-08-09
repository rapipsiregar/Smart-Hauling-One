"""Edge agent entrypoint: wires up and starts every thread from SRS §3.1."""

from __future__ import annotations

import queue
import signal
import threading
from datetime import datetime, timezone

from agent.capture import CaptureThread, FrameRing
from agent.config import Settings, TunableStore
from agent.consensus import finalize_window
from agent.heartbeat import HeartbeatThread
from agent.induk_client import IndukClient
from agent.inference import InferenceLoop
from agent.live_view import LiveViewThread
from agent.outbox import Outbox, OutboxSender
from agent.video_retention import RetentionSweep, VideoWriterThread


class WindowFinalizer(threading.Thread):
    """Consumes closed windows, votes, and enqueues the result (SRS §3.1).

    Decoupled from the inference loop by a queue so DB writes and JPEG encoding
    never block frame capture.
    """

    def __init__(
        self, finalizer_queue: queue.Queue, outbox: Outbox, camera_code: str
    ) -> None:
        super().__init__(name="finalizer", daemon=True)
        self.queue = finalizer_queue
        self.outbox = outbox
        self.camera_code = camera_code
        self._stop = threading.Event()

    def stop(self) -> None:
        self._stop.set()

    def run(self) -> None:
        while not self._stop.is_set():
            try:
                start_ts, end_ts, reads = self.queue.get(timeout=1.0)
            except queue.Empty:
                continue
            result = finalize_window(start_ts, end_ts, reads)
            payload = {
                "camera_code": self.camera_code,
                "detected_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "window_sec": round(result["window_sec"], 2),
                "hull_id": result["hull_id"],
                "confidence": result["confidence"],
                "read_count": result["read_count"],
                "votes": result["votes"],
            }
            key = self.outbox.enqueue(
                camera_code=self.camera_code,
                payload=payload,
                snapshot=result["snapshot"],
            )
            print(
                f"finalizer: {result['hull_id']} "
                f"({result['confidence']:.2f}, {result['read_count']} reads) queued as {key}"
            )


def main() -> None:
    settings = Settings.from_env()
    print(f"Integrated Smart Hauling System edge agent starting for {settings.camera_code}")

    ring = FrameRing()
    tunables = TunableStore()
    finalizer_queue: queue.Queue = queue.Queue()
    client = IndukClient(settings)
    outbox = Outbox(settings)

    threads = [
        CaptureThread(settings.rtsp_url, ring),
        InferenceLoop(ring, tunables, finalizer_queue, settings),
        WindowFinalizer(finalizer_queue, outbox, settings.camera_code),
        OutboxSender(outbox, client),
        HeartbeatThread(client, tunables, outbox),
        LiveViewThread(client, ring),
        VideoWriterThread(ring, settings.video_dir),
        RetentionSweep(settings.video_dir),
    ]
    for thread in threads:
        thread.start()

    shutdown = threading.Event()
    signal.signal(signal.SIGINT, lambda *_: shutdown.set())
    signal.signal(signal.SIGTERM, lambda *_: shutdown.set())
    shutdown.wait()

    print("edge agent: shutting down")
    for thread in threads:
        thread.stop()


if __name__ == "__main__":
    main()
