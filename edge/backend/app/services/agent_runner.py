"""Owns the detection/sync threads and exposes their state to the local API.

The agent modules under ``agent/`` are the same ones that already ran as a
standalone process; this wraps them so the FastAPI app can start them, stop them,
and answer "is the camera up, is the core reachable, how deep is the queue"
without the router reaching into thread internals.

Every accessor here is safe to call from a request handler: it reads a plain
attribute or asks a thread for a counter, and never blocks on inference.
"""

from __future__ import annotations

import os
import queue
import threading
from datetime import datetime, timezone

from app import store
from app.services import local_matcher


class AgentRunner:
    """Starts, stops, and reports on the on-device pipeline."""

    def __init__(self) -> None:
        self._threads: list = []
        self._stop = threading.Event()
        self._last_error: str | None = None
        self._core_ok = False
        self._settings = self._load_settings()

    # -- lifecycle ------------------------------------------------------------

    def start(self) -> None:
        try:
            self._start_threads()
        except Exception as err:  # the UI must still come up to show the failure
            self._last_error = f"agent failed to start: {err}"
            print(f"edge: {self._last_error}")

    def _start_threads(self) -> None:
        from agent.capture import CaptureThread, FrameRing
        from agent.config import Settings, TunableStore, Tunables
        from agent.heartbeat import HeartbeatThread
        from agent.induk_client import IndukClient
        from agent.inference import InferenceLoop
        from agent.outbox import Outbox, OutboxSender

        settings = Settings.from_env()
        self._settings_obj = settings
        self._ring = FrameRing()
        self._tunables = TunableStore(Tunables(**self._settings))
        self._finalizer_q: queue.Queue = queue.Queue()
        self._client = IndukClient(settings)
        self._outbox = Outbox(settings)

        self._capture = CaptureThread(settings.rtsp_url, self._ring)
        self._inference = InferenceLoop(
            self._ring, self._tunables, self._finalizer_q, settings,
            # Models load inside the thread, so a failure there cannot surface as
            # a start() exception. Without this the gate reports a healthy agent
            # and silently never detects anything.
            on_error=self._record_error,
        )
        self._threads = [
            self._capture,
            self._inference,
            LocalFinalizer(self._finalizer_q, self._outbox, settings.camera_code),
            # store.mark_synced is what turns the gate UI's per-crossing delivery
            # icon green; without it every crossing reads as still queued forever.
            OutboxSender(self._outbox, self._client, on_delivered=store.mark_synced),
            HeartbeatThread(self._client, self._tunables, self._outbox),
            MasterSync(self._client, self),
        ]
        for t in self._threads:
            t.start()
        print(f"edge: agent started for {settings.camera_code}")

    def stop(self) -> None:
        self._stop.set()
        for t in self._threads:
            try:
                t.stop()
            except Exception:
                pass

    # -- state for the API ----------------------------------------------------

    def is_alive(self) -> bool:
        return any(t.is_alive() for t in self._threads) if self._threads else False

    def detecting(self) -> bool:
        """Is the thread that actually reads hull numbers still running?

        ``is_alive`` is true while ANY thread survives, so it stays true when only
        the inference thread has died -- the one case where the gate has stopped
        doing its job. This is the answer the status endpoint needs.
        """
        inference = getattr(self, "_inference", None)
        return bool(inference and inference.is_alive())

    def _record_error(self, message: str) -> None:
        self._last_error = message

    def camera_connected(self) -> bool:
        ring = getattr(self, "_ring", None)
        return bool(ring and ring.latest()[1] is not None)

    def core_reachable(self) -> bool:
        return self._core_ok

    def set_core_reachable(self, ok: bool) -> None:
        self._core_ok = ok

    def outbox_depth(self) -> int:
        outbox = getattr(self, "_outbox", None)
        try:
            return outbox.depth() if outbox else 0
        except Exception:
            return 0

    def last_error(self) -> str | None:
        return self._last_error

    def client(self):
        return getattr(self, "_client", None)

    # -- settings -------------------------------------------------------------

    @staticmethod
    def _load_settings() -> dict:
        defaults = {
            "yolo_fps": 20, "ocr_fps": 4, "detect_window_sec": 6,
            "ocr_min_conf": 0.30, "dedup_iou": 0.92,
        }
        out = {}
        for key, default in defaults.items():
            raw = store.get_meta(f"setting_{key}")
            if raw is None:
                out[key] = default
            else:
                out[key] = float(raw) if isinstance(default, float) else int(float(raw))
        return out

    def settings(self) -> dict:
        tunables = getattr(self, "_tunables", None)
        if tunables is None:
            return dict(self._settings)
        current = tunables.get()
        return {
            "yolo_fps": current.yolo_fps,
            "ocr_fps": current.ocr_fps,
            "detect_window_sec": current.detect_window_sec,
            "ocr_min_conf": current.ocr_min_conf,
            "dedup_iou": current.dedup_iou,
        }

    def apply_settings(self, fields: dict) -> None:
        """Swap new tunables in atomically -- never mutate the live object."""
        self._settings.update(fields)
        tunables = getattr(self, "_tunables", None)
        if tunables is None:
            return
        from agent.config import Tunables

        current = tunables.get()
        tunables.swap(Tunables(
            yolo_fps=self._settings["yolo_fps"],
            ocr_fps=self._settings["ocr_fps"],
            detect_window_sec=self._settings["detect_window_sec"],
            ocr_min_conf=self._settings["ocr_min_conf"],
            dedup_iou=self._settings["dedup_iou"],
            config_version=current.config_version,
        ))


class LocalFinalizer(threading.Thread):
    """Consumes closed Detection Windows: vote, match locally, store, queue.

    The local match is what lets this gate name a truck with the core offline;
    the resolved hull id is then what gets sent upstream, so the core is not
    asked to redo work the gate already did.
    """

    def __init__(self, finalizer_queue: queue.Queue, outbox, camera_code: str) -> None:
        super().__init__(name="local-finalizer", daemon=True)
        self.queue = finalizer_queue
        self.outbox = outbox
        self.camera_code = camera_code
        self._stop = threading.Event()

    def stop(self) -> None:
        self._stop.set()

    def run(self) -> None:
        from agent.consensus import finalize_window

        while not self._stop.is_set():
            try:
                start_ts, end_ts, reads, direction = self.queue.get(timeout=1.0)
            except queue.Empty:
                continue

            result = finalize_window(start_ts, end_ts, reads)
            match = local_matcher.match_reading(result["hull_id"])
            hull_id = match.hull_id if (match.is_registered and match.hull_id) else "UNKNOWN"
            detected_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

            import json

            payload = {
                "camera_code": self.camera_code,
                "detected_at": detected_at,
                "window_sec": round(result["window_sec"], 2),
                "hull_id": hull_id,
                # What the gate read, independent of whether it recognised it.
                # Without this an unregistered truck reaches the centre as an
                # anonymous UNKNOWN and can never be counted -- the digits were
                # known here and thrown away on the way out.
                "raw_code": match.raw_code,
                "confidence": result["confidence"],
                "read_count": result["read_count"],
                "votes": result["votes"],
                # Which way the truck crossed the virtual center line
                # (agent/pipeline.py DetectionWindow.direction). None when it
                # never crossed inside this window.
                "direction": direction,
            }
            key = self.outbox.enqueue(
                camera_code=self.camera_code,
                payload=payload,
                snapshot=result["snapshot"],
            )
            # The outbox's copy is deleted the moment the core acknowledges the
            # crossing, so the gate keeps its own for the inspection view.
            snapshot_path = store.save_snapshot(key, result["snapshot"])
            store.record_crossing(
                idempotency_key=key,
                hull_id=hull_id,
                raw_code=match.raw_code,
                match_outcome=match.outcome,
                confidence=result["confidence"],
                read_count=result["read_count"],
                window_sec=result["window_sec"],
                votes_json=json.dumps(result["votes"]),
                snapshot_path=snapshot_path,
                detected_at=detected_at,
            )
            print(f"edge: {hull_id} ({match.outcome}) recorded as {key}")


class MasterSync(threading.Thread):
    """Keeps the local master replica current with the core.

    Version-gated, exactly like the config poll: the core reports a
    ``master_version`` and the full roster is only pulled when it moves. 276 units
    is small, but pulling it every minute over cellular for nothing is not.
    """

    INTERVAL_SEC = 300

    def __init__(self, client, runner: AgentRunner) -> None:
        super().__init__(name="master-sync", daemon=True)
        self.client = client
        self.runner = runner
        self._stop = threading.Event()

    def stop(self) -> None:
        self._stop.set()

    def sync_once(self) -> bool:
        """Pull the master if the core's version is newer. True if replaced."""
        payload = self.client.get_master(known_version=store.master_version())
        self.runner.set_core_reachable(True)
        if not payload.get("changed"):
            return False
        stored = store.replace_master(payload["trucks"], payload["master_version"])
        print(f"edge: master replica updated -> {stored} units "
              f"(v{payload['master_version']})")
        return True

    def run(self) -> None:
        # Pull once at startup: a gate that has never synced cannot identify
        # anything, so this is the difference between working and not.
        while not self._stop.is_set():
            try:
                self.sync_once()
            except Exception as err:
                self.runner.set_core_reachable(False)
                print(f"edge: master sync failed ({err}); using local replica")
            if self._stop.wait(timeout=self.INTERVAL_SEC):
                return
