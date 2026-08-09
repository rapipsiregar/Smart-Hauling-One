"""Read/write helpers for the edge-device columns on the ``cameras`` table.

DDL for these columns lives in ``camera_repo.ensure_schema`` (the single owner of
that table's schema); this module only reads and writes their values.

Pure persistence -- no validation. Callers pass already-validated values.
"""

from __future__ import annotations

from app.core.database import connect
from app.repositories.camera_repo import ensure_schema


def get_by_api_key_hash(api_key_hash: str) -> dict | None:
    """Resolve a device credential to its camera row. NULL hashes never match."""
    ensure_schema()
    conn = connect(rows=True)
    try:
        row = conn.execute(
            "SELECT * FROM cameras WHERE api_key_hash = ?", (api_key_hash,)
        ).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def set_api_key_hash(camera_code: str, api_key_hash: str | None) -> None:
    """Provision (or revoke, with ``None``) a device credential."""
    ensure_schema()
    conn = connect()
    try:
        conn.execute(
            "UPDATE cameras SET api_key_hash = ? WHERE camera_code = ?",
            (api_key_hash, camera_code),
        )
        conn.commit()
    finally:
        conn.close()


def apply_heartbeat(
    camera_code: str,
    *,
    status: str,
    local_queue_depth: int,
    agent_version: str,
    applied_config_version: int,
    now_iso: str,
) -> None:
    """Record a heartbeat.

    ``status`` is whatever the device self-reported -- only ``online`` or
    ``maintenance``. A device never reports ``offline``; that state is inferred
    centrally by the sweep (``docs/edge-system/SRS.md`` §5.1).

    ``applied_config_version`` is stored verbatim as reported: it is the device's
    own claim about which config it is running, and the dashboard's
    saved-vs-pending indicator is exactly
    ``applied_config_version == config_version``.
    """
    ensure_schema()
    conn = connect()
    try:
        conn.execute(
            "UPDATE cameras SET status = ?, local_queue_depth = ?, agent_version = ?, "
            "applied_config_version = ?, last_heartbeat_at = ? WHERE camera_code = ?",
            (
                status,
                int(local_queue_depth),
                agent_version,
                int(applied_config_version),
                now_iso,
                camera_code,
            ),
        )
        conn.commit()
    finally:
        conn.close()


def mark_config_applied(camera_code: str, applied_version: int, now_iso: str) -> None:
    """Stamp the "settings saved" timestamp, but only if the device is current.

    The ``config_version = ?`` guard makes this a safe no-op when the device
    reports a version that is already stale (SRS §5.3) -- the timestamp then keeps
    pointing at the last version the device genuinely converged on.
    """
    ensure_schema()
    conn = connect()
    try:
        conn.execute(
            "UPDATE cameras SET last_config_applied_at = ? "
            "WHERE camera_code = ? AND config_version = ?",
            (now_iso, camera_code, int(applied_version)),
        )
        conn.commit()
    finally:
        conn.close()


def update_edge_config(camera_code: str, fields: dict) -> dict | None:
    """Write tunables and bump ``config_version`` by exactly 1 (BR-012).

    ``fields`` must already be validated and restricted to ``EDGE_TUNABLE_FIELDS``.
    Returns the updated row, or ``None`` if ``camera_code`` does not exist.
    """
    ensure_schema()
    if not fields:
        return None
    assignments = ", ".join(f"{col} = ?" for col in fields)
    conn = connect(rows=True)
    try:
        cur = conn.execute(
            f"UPDATE cameras SET {assignments}, config_version = config_version + 1, "
            "updated_at = datetime('now') WHERE camera_code = ?",
            [*fields.values(), camera_code],
        )
        if cur.rowcount == 0:
            return None
        conn.commit()
        row = conn.execute(
            "SELECT * FROM cameras WHERE camera_code = ?", (camera_code,)
        ).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def sweep_offline(threshold_iso: str) -> int:
    """Flip devices silent since ``threshold_iso`` to ``offline``. Returns rows changed.

    Never touches a device that has not heartbeated at all -- there is nothing to
    infer from silence that was never preceded by contact (SRS §5.1).
    """
    ensure_schema()
    conn = connect()
    try:
        cur = conn.execute(
            "UPDATE cameras SET status = 'offline' "
            "WHERE status != 'offline' AND last_heartbeat_at IS NOT NULL "
            "AND last_heartbeat_at < ?",
            (threshold_iso,),
        )
        conn.commit()
        return cur.rowcount
    finally:
        conn.close()
