"""HTTP client for the induk API (``docs/edge-system/API_CONTRACT.md`` §1).

The only thing in the agent that knows the induk exists. Never logs the
Authorization header (SRS §6 Security NFR).
"""

from __future__ import annotations

import requests

from agent.config import Settings

DEFAULT_TIMEOUT_SEC = 15


class IndukClient:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._session = requests.Session()
        self._session.headers.update({"Authorization": f"Bearer {settings.api_key}"})

    def _url(self, path: str) -> str:
        return f"{self._settings.induk_url}/api{path}"

    def get_config(self) -> dict:
        r = self._session.get(self._url("/edge/config"), timeout=DEFAULT_TIMEOUT_SEC)
        r.raise_for_status()
        return r.json()

    def heartbeat(
        self,
        *,
        agent_version: str,
        applied_config_version: int,
        local_queue_depth: int,
        status: str = "online",
    ) -> dict:
        r = self._session.post(
            self._url("/edge/heartbeat"),
            json={
                "agent_version": agent_version,
                "applied_config_version": applied_config_version,
                "local_queue_depth": local_queue_depth,
                "status": status,
            },
            timeout=DEFAULT_TIMEOUT_SEC,
        )
        r.raise_for_status()
        return r.json()

    def submit_crossing(
        self, *, idempotency_key: str, payload_json: str, snapshot_path: str | None
    ):
        """Submit one crossing. Returns the raw response.

        The outbox decides what a non-2xx means (SRS §4.2: everything retries,
        nothing is dropped), so this deliberately does not raise for status.
        """
        files = None
        handle = None
        try:
            if snapshot_path:
                handle = open(snapshot_path, "rb")
                files = {"snapshot": ("crop.jpg", handle, "image/jpeg")}
            return self._session.post(
                self._url("/edge/crossings"),
                headers={"Idempotency-Key": idempotency_key},
                data={"payload": payload_json},
                files=files,
                timeout=DEFAULT_TIMEOUT_SEC,
            )
        finally:
            if handle is not None:
                handle.close()

    def get_master(self, known_version: int = 0) -> dict:
        """Fetch the truck master, but only when the core's version has moved.

        Returns ``{"changed": False, "master_version": N}`` when this device is
        already current, so a routine poll over cellular costs one small request
        rather than the whole roster.
        """
        r = self._session.get(
            self._url("/edge/master"),
            params={"known_version": known_version},
            timeout=DEFAULT_TIMEOUT_SEC,
        )
        r.raise_for_status()
        return r.json()

    def poll_live_session(self, wait_seconds: int) -> dict:
        """Long-poll for a live-view action. Timeout allows for the server hold."""
        r = self._session.get(
            self._url("/edge/live-session"),
            params={"wait": wait_seconds},
            timeout=wait_seconds + DEFAULT_TIMEOUT_SEC,
        )
        r.raise_for_status()
        return r.json()
