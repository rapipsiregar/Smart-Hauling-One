"""Heartbeat + config watcher (``docs/edge-system/SRS.md`` §3.5).

Config convergence is deliberately lazy: there is up to one heartbeat interval
(<=30s) of lag between applying a config and reporting it applied. That matches
the PRD's "applied within one heartbeat interval" criterion -- this is not
sub-second reconciliation, and does not need to be.
"""

from __future__ import annotations

import threading

from agent.config import AGENT_VERSION, HEARTBEAT_INTERVAL_SEC, Tunables, TunableStore
from agent.induk_client import IndukClient
from agent.outbox import Outbox


class HeartbeatThread(threading.Thread):
    def __init__(self, client: IndukClient, tunables: TunableStore, outbox: Outbox) -> None:
        super().__init__(name="heartbeat", daemon=True)
        self.client = client
        self.tunables = tunables
        self.outbox = outbox
        self._stop = threading.Event()

    def stop(self) -> None:
        self._stop.set()

    def fetch_and_apply_config(self) -> None:
        """Pull the authoritative config and swap it in atomically.

        On failure, keep running with the last-known-good config. The next
        heartbeat still reports a stale ``applied_config_version``, so the induk
        will say ``config_changed`` again -- self-healing with no extra state
        (SRS §3.5).
        """
        payload = self.client.get_config()
        self.tunables.swap(Tunables.from_api(payload))
        print(f"heartbeat: applied config version {payload['config_version']}")

    def beat_once(self) -> None:
        current = self.tunables.get()
        response = self.client.heartbeat(
            agent_version=AGENT_VERSION,
            applied_config_version=current.config_version,
            local_queue_depth=self.outbox.depth(),
            status="online",
        )
        if response.get("config_changed"):
            self.fetch_and_apply_config()

    def run(self) -> None:
        # Fetch once at startup so the agent never runs on defaults it was never
        # told to use.
        try:
            self.fetch_and_apply_config()
        except Exception as err:
            print(f"heartbeat: initial config fetch failed ({err}); using defaults")

        while not self._stop.wait(timeout=HEARTBEAT_INTERVAL_SEC):
            try:
                self.beat_once()
            except Exception as err:
                print(f"heartbeat: failed ({err}); will retry next interval")
