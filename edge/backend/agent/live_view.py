"""Live-view long-poll + WHIP push (``docs/edge-system/SRS.md`` §8.2).

THE ONE INVIOLABLE RULE: this pushes RAW frames. No bounding boxes, no hull-ID
text, no annotation of any kind, ever (PRD Goal 7 / Non-Goal). Detection results
reach the dashboard only as consensus-voted crossing events. If you find yourself
importing anything from ``agent.pipeline`` here, stop -- that is the bug.

Frames come from the SAME ring buffer the inference loop reads: never a second
RTSP connection to the camera, which could exceed its concurrent-client limit.
"""

from __future__ import annotations

import asyncio
import threading

from agent.config import LIVE_POLL_WAIT_SEC
from agent.induk_client import IndukClient


class LiveViewThread(threading.Thread):
    """Holds the long-poll open and starts/stops the WHIP push on command."""

    def __init__(self, client: IndukClient, ring) -> None:
        super().__init__(name="live-view", daemon=True)
        self.client = client
        self.ring = ring
        self._stop = threading.Event()
        self._active_session: str | None = None
        self._pusher: "WhipPusher | None" = None

    def stop(self) -> None:
        self._stop.set()
        self._stop_push()

    def _start_push(self, session_id: str, whip_url: str, whip_token: str) -> None:
        if self._active_session == session_id:
            return
        self._stop_push()
        print(f"live_view: starting WHIP push for session {session_id}")
        self._pusher = WhipPusher(self.ring, whip_url, whip_token)
        self._pusher.start()
        self._active_session = session_id

    def _stop_push(self) -> None:
        if self._pusher is not None:
            self._pusher.stop()
            self._pusher = None
        self._active_session = None

    def run(self) -> None:
        while not self._stop.is_set():
            try:
                action = self.client.poll_live_session(LIVE_POLL_WAIT_SEC)
            except Exception as err:
                print(f"live_view: poll failed ({err}); retrying")
                self._stop.wait(timeout=5.0)
                continue

            kind = action.get("action")
            if kind == "start":
                self._start_push(
                    action["session_id"], action["whip_url"], action["whip_token"]
                )
            elif kind == "stop":
                # A stop for a session we are not pushing is a no-op, never an
                # error (API_CONTRACT §1.4).
                if self._active_session == action.get("session_id"):
                    print(f"live_view: stopping session {action['session_id']}")
                    self._stop_push()


class WhipPusher:
    """Pushes raw ring-buffer frames to the relay over WebRTC (aiortc).

    Runs its own asyncio loop on a dedicated thread: aiortc is async, the rest of
    the agent is threaded, and this is the seam between them.
    """

    def __init__(self, ring, whip_url: str, whip_token: str) -> None:
        self.ring = ring
        self.whip_url = whip_url
        self.whip_token = whip_token
        self._thread: threading.Thread | None = None
        self._loop: asyncio.AbstractEventLoop | None = None
        self._stop = threading.Event()

    def start(self) -> None:
        self._thread = threading.Thread(target=self._run, name="whip-push", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._loop is not None:
            self._loop.call_soon_threadsafe(self._loop.stop)

    def _run(self) -> None:
        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)
        try:
            self._loop.run_until_complete(self._push())
        except Exception as err:
            print(f"whip: push ended ({err})")
        finally:
            self._loop.close()

    async def _push(self) -> None:
        """Negotiate WHIP and stream until stopped.

        DELIBERATELY UNIMPLEMENTED. Writing WebRTC negotiation blind, with no
        relay to test against, produces code that looks right and works never.
        Stand up the relay first (``docker compose --profile live-view up -d``,
        see plans/next-implementation/07-media-relay-infra.md), then implement
        this against it and delete the raise.

        Steps:
          1. Build an aiortc RTCPeerConnection.
          2. Add a VideoStreamTrack whose recv() pulls ring.latest() and wraps it
             in an av.VideoFrame -- RAW, no drawing.
          3. Create an offer, POST the SDP to whip_url with
             Authorization: Bearer {whip_token}, Content-Type: application/sdp.
          4. setRemoteDescription with the SDP answer.
          5. Keep the connection open until self._stop is set.
        """
        raise NotImplementedError(
            "WHIP push requires a running media relay; see the steps in this "
            "docstring and plans/next-implementation/07-media-relay-infra.md."
        )
