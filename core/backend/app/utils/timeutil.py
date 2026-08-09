"""UTC timestamp formatting shared by every edge-system module.

One format, everywhere: ISO 8601 with an explicit ``Z``
(``docs/edge-system/API_CONTRACT.md`` §0). SQLite compares TEXT timestamps
lexicographically, so a single module writing a different format would silently
break the offline sweep's ``last_heartbeat_at < ?`` range comparison.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

ISO_Z = "%Y-%m-%dT%H:%M:%SZ"


def utc_now_iso() -> str:
    """Current UTC time as an ISO 8601 string with an explicit ``Z``."""
    return datetime.now(timezone.utc).strftime(ISO_Z)


def utc_iso_seconds_ago(seconds: int) -> str:
    """UTC timestamp ``seconds`` in the past, same format as :func:`utc_now_iso`."""
    return (datetime.now(timezone.utc) - timedelta(seconds=seconds)).strftime(ISO_Z)
