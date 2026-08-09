# Section 01 — Schema Foundations

**Goal:** every DB column, config constant, and repository helper the rest of the build needs.
**Depends on:** [00](./00-environment-setup.md). **Blocks:** 02, 03, 04, 05.

Includes a **fix for a real pre-existing bug** (1.4) — read it, don't skip it.

---

## 1.1 [DONE] Add config constants

**File:** `app/core/config.py` — append after the existing `VALID_CAMERA_STATUS` line.

```python
# --- Edge device tunables (docs/edge-system/PRD.md §9) ------------------------

# Operator-tunable per device via PUT /api/cameras/{code}/edge-config.
EDGE_TUNABLE_FIELDS = (
    "yolo_fps", "ocr_fps", "detect_window_sec", "ocr_min_conf", "dedup_iou",
)

# (min, max) inclusive. Authoritative server-side validation — the settings form
# mirrors these client-side but the server rejects out-of-range values regardless.
EDGE_TUNABLE_RANGES = {
    "yolo_fps": (1, 30),            # business owner's preferred operating range: 18-25
    "ocr_fps": (1, 15),             # preferred: ~4
    "detect_window_sec": (1, 30),   # preferred: 5-7
    "ocr_min_conf": (0.0, 1.0),
    "dedup_iou": (0.0, 1.0),
}

EDGE_TUNABLE_DEFAULTS = {
    "yolo_fps": 20,
    "ocr_fps": 4,
    "detect_window_sec": 6,
    "ocr_min_conf": 0.30,
    "dedup_iou": 0.92,
}

HEARTBEAT_INTERVAL_SEC = 30              # docs/edge-system/SRS.md §3.5
OFFLINE_THRESHOLD_SEC = 90               # 3x heartbeat interval, SRS §5.1
LIVE_SESSION_MAX_WAIT_SEC = 30           # long-poll clamp, API_CONTRACT §1.4
LIVE_SESSION_DEFAULT_WAIT_SEC = 25       # long-poll default, API_CONTRACT §1.4
LIVE_SESSION_STALE_SEC = 20              # 2 missed viewer keep-alives, SRS §8.3
```

Do **not** add the edge columns to `CAMERA_FIELDS`. That tuple drives the identity-edit form in
`app/services/cameras.py::_clean()`; keeping edge tunables out of it guarantees a
`PUT /api/cameras/{code}` can never clobber `config_version` or `api_key_hash`.

---

## 1.2 [DONE] Add edge columns to the `cameras` table

**File:** `app/repositories/camera_repo.py`

`ensure_schema()` is the single owner of this table's DDL. Extend it — do not create a second
module that also runs `ALTER TABLE cameras`, or two migrations can race.

Add this constant at module level, below the imports:

```python
# Additive edge-device columns (docs/edge-system/SRS.md §9). Defaults match
# docs/edge-system/PRD.md §9. SQLite's ALTER TABLE ADD COLUMN accepts DEFAULT
# but not UNIQUE/REFERENCES — none of these need either.
EDGE_CAMERA_COLUMNS = {
    "api_key_hash": "TEXT",                       # NULL until provisioned; never returned by any read endpoint
    "agent_version": "TEXT",                      # NULL until first heartbeat
    "yolo_fps": "INTEGER NOT NULL DEFAULT 20",
    "ocr_fps": "INTEGER NOT NULL DEFAULT 4",
    "detect_window_sec": "INTEGER NOT NULL DEFAULT 6",
    "ocr_min_conf": "REAL NOT NULL DEFAULT 0.30",
    "dedup_iou": "REAL NOT NULL DEFAULT 0.92",
    "config_version": "INTEGER NOT NULL DEFAULT 1",
    "applied_config_version": "INTEGER NOT NULL DEFAULT 0",  # see note below
    "last_heartbeat_at": "TEXT",                  # ISO 8601 UTC with 'Z'; NULL until first heartbeat
    "last_config_applied_at": "TEXT",             # ISO 8601 UTC with 'Z'
    "local_queue_depth": "INTEGER NOT NULL DEFAULT 0",
}
```

> **`applied_config_version` is a deliberate addition to SRS §9's proposed column list.**
> The API returns it (`API_CONTRACT.md` §2.1) but SRS §9 doesn't list it as stored, implying it
> should be derived. It can't be, reliably: once an operator saves again, `config_version` moves to
> 4 while the device is still on 3, and a `last_config_applied_at` timestamp alone cannot tell you
> *which* version that timestamp refers to. Deriving it would force the API to report a wrong value
> (or a lossy `0`) in exactly the "pending" state the field exists to describe. SRS §9 calls its
> list "proposed additive columns," so storing the value the device already reports on every
> heartbeat is within scope and makes the contract exact. `0` means "never confirmed anything."

Then, inside `ensure_schema()`, insert the migration loop **between** the `CREATE TABLE` statement
and the existing `video_results.camera_id` block:

```python
        cam_cols = {r[1] for r in conn.execute("PRAGMA table_info(cameras)")}
        for column, ddl in EDGE_CAMERA_COLUMNS.items():
            if column not in cam_cols:
                conn.execute(f"ALTER TABLE cameras ADD COLUMN {column} {ddl}")
```

Also update the function's docstring to mention the edge columns.

**Verify:**
```bash
uv run python -c "
from app.repositories.camera_repo import ensure_schema
from app.core.database import connect
ensure_schema()
c = connect()
print([r[1] for r in c.execute('PRAGMA table_info(cameras)')])
"
```
All 12 new names must appear.

---

## 1.3 [DONE] Add edge columns to `video_results`

**File:** `app/repositories/run_write_repo.py`

This table backs "crossings" (see README decision #1). Add at module level, below `SCHEMA`:

```python
# Additive edge-ingestion columns (docs/edge-system/SRS.md §9).
VIDEO_RESULT_EDGE_COLUMNS = {
    "idempotency_key": "TEXT",                 # NULL for batch rows; UNIQUE index below
    "source": "TEXT NOT NULL DEFAULT 'batch'",  # 'batch' | 'edge'
    "votes_json": "TEXT",                       # JSON array of the consensus vote breakdown
    "window_sec": "REAL",                       # actual Detection Window duration; NULL for batch
}
```

Extend `ensure_schema()` — currently it runs `executescript(SCHEMA)` then delegates to the two
other repos. Insert the migration before the `conn.commit()`:

```python
def ensure_schema() -> None:
    """Create the inference tables and every added column (idempotent)."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = connect()
    try:
        conn.executescript(SCHEMA)
        existing = {r[1] for r in conn.execute("PRAGMA table_info(video_results)")}
        for column, ddl in VIDEO_RESULT_EDGE_COLUMNS.items():
            if column not in existing:
                conn.execute(f"ALTER TABLE video_results ADD COLUMN {column} {ddl}")
        # The real, concurrency-safe duplicate guard for edge submissions
        # (docs/data_model.md BR-010). SQLite treats NULLs as distinct in a
        # UNIQUE index, so every existing batch row (idempotency_key IS NULL)
        # coexists fine -- only non-NULL keys must be unique.
        conn.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_vr_idempotency "
            "ON video_results(idempotency_key)"
        )
        conn.commit()
    finally:
        conn.close()
    ensure_camera_schema()  # cameras table + video_results.camera_id
    ensure_time_schema()  # video_results.source_started_at / crossed_at
```

### Add the edge insert function

Append to the same file. Do **not** reuse `upsert_video_result` — it deletes-then-reinserts by
video name, which is wrong for idempotent inserts.

```python
def insert_edge_crossing(
    *,
    camera_id: int,
    video: str,
    hull_id: str,
    confidence: float,
    read_count: int,
    snapshot_path: str | None,
    idempotency_key: str,
    window_sec: float,
    votes_json: str,
    detected_at_iso: str,
) -> tuple[int, bool]:
    """Insert one edge-submitted crossing.

    Returns ``(video_result_id, created)``. ``created`` is False when the
    idempotency key was already present -- the caller turns that into a
    ``200 {"duplicate": true}`` instead of a ``201`` (SRS §5.2).

    ``run_id`` stays NULL: an edge submission is a single live crossing, not a
    batch run over a directory of clips.
    """
    ensure_schema()
    conn = connect()
    try:
        cur = conn.execute(
            "INSERT INTO video_results (run_id, video, voted_hull_id, vote_confidence, "
            "total_detections, frames_with_detections, snapshot_path, camera_id, "
            "source_started_at, crossed_at, idempotency_key, source, votes_json, window_sec) "
            "VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'edge', ?, ?)",
            (
                video,
                hull_id,
                float(confidence),
                int(read_count),
                # No frame concept in a live window; read_count is the closest
                # existing analog and keeps the dashboard's "frames" column honest.
                int(read_count),
                snapshot_path,
                int(camera_id),
                detected_at_iso,
                detected_at_iso,
                idempotency_key,
                votes_json,
                float(window_sec),
            ),
        )
        conn.commit()
        return int(cur.lastrowid), True
    except sqlite3.IntegrityError:
        # Two retries raced between the caller's SELECT and this INSERT. The
        # UNIQUE index -- not the application check -- is the actual guard.
        conn.rollback()
        row = conn.execute(
            "SELECT id FROM video_results WHERE idempotency_key = ?", (idempotency_key,)
        ).fetchone()
        if row is None:  # pragma: no cover - a non-idempotency integrity error
            raise
        return int(row[0]), False
    finally:
        conn.close()


def find_by_idempotency_key(idempotency_key: str) -> int | None:
    """Return an existing crossing's id for this key, or None (SRS §5.2 fast path)."""
    ensure_schema()
    conn = connect()
    try:
        row = conn.execute(
            "SELECT id FROM video_results WHERE idempotency_key = ?", (idempotency_key,)
        ).fetchone()
        return int(row[0]) if row else None
    finally:
        conn.close()
```

**Check the file length** after this addition (`wc -l app/repositories/run_write_repo.py`). It
starts at 217; these two functions add roughly 70 lines, landing near 290 — under the 400 limit,
so no split needed.

---

## 1.4 [DONE] Fix camera attribution to use the stored FK — **real bug**

### What's wrong today

`video_results.camera_id` exists as a real column and `sync_attribution()` populates it. But:

1. `app/repositories/video_results_repo.py::load_video_results()` selects 6 columns and **omits
   `camera_id`** entirely — the stored FK never reaches the read path.
2. `app/services/dataset.py::_build_crossing()` therefore always re-derives the camera by treating
   `r["video"]` as a filename and looking it up in the *playlist folder* map.

Batch rows survive this because their video really is a file under `PLAYLIST_DIR`. **Edge rows will
not** — their `video` is a synthetic identifier with no file on disk, so every edge crossing would
resolve to `"Unassigned Gate"` regardless of which gate actually submitted it.

### Part A — select the column

**File:** `app/repositories/video_results_repo.py`, in `load_video_results()`.

Change the SQL and the dict construction:

```python
            cursor.execute(
                """
                SELECT video, voted_hull_id, vote_confidence, total_detections,
                       frames_with_detections, snapshot_path, camera_id
                FROM video_results
                ORDER BY id ASC
                """
            )
```
```python
                return [
                    {
                        "video": row[0],
                        "voted_hull_id": row[1],
                        "vote_confidence": row[2],
                        "total_detections": row[3],
                        "frames_with_detections": row[4],
                        "snapshot_path": row[5],
                        "camera_id": row[6],
                    }
                    for row in rows
                ]
```

### Part B — prefer the FK, fall back to folder guessing

**File:** `app/services/dataset.py`

Replace `_camera_attribution()` (returns a 3-tuple now):

```python
def _camera_attribution() -> tuple[dict, dict, dict]:
    """(``camera_by_folder``, ``playlist_folder_map``, ``camera_by_id``).

    Empty maps on failure. ``camera_by_id`` lets a row that already carries a
    real ``camera_id`` skip folder guessing entirely -- required for edge-sourced
    crossings, which have no playlist file to guess from.
    """
    try:
        from app.services.cameras import camera_by_folder, playlist_folder_map
        by_folder = camera_by_folder()
        by_id = {c["id"]: c for c in by_folder.values() if c.get("id") is not None}
        return by_folder, playlist_folder_map(), by_id
    except Exception as err:  # pragma: no cover - defensive
        print(f"dataset: camera attribution unavailable: {err}")
        return {}, {}, {}
```

In `_build_crossing()`, add `by_id` to the signature and resolve with the FK first:

```python
def _build_crossing(
    idx: int, r: dict, by_folder: dict, folder_map: dict, by_id: dict, times: dict
) -> dict:
    vid = r.get("video", "")
    stem = Path(vid).stem
    hull = r.get("voted_hull_id", "UNKNOWN")
    conf = round(float(r.get("vote_confidence", 0.0) or 0.0) * 100, 1)
    reads = int(r.get("total_detections", 0) or 0)
    known = hull not in UNIDENTIFIED_HULLS

    # A stored camera_id is authoritative (edge rows, and batch rows that have
    # been through sync_attribution). Folder guessing is the fallback for rows
    # that predate attribution.
    stored_camera_id = r.get("camera_id")
    cam = by_id.get(stored_camera_id) if stored_camera_id is not None else None
    if cam is None:
        cam = _resolve_camera(vid, by_folder, folder_map)
```
The rest of the function body is unchanged.

In `build_dataset()`, update both call sites:

```python
    by_folder, folder_map, by_id = _camera_attribution()
```
```python
        crossing = _build_crossing(idx, r, by_folder, folder_map, by_id, times)
```

> **Do not add any key to `_build_crossing`'s returned dict.**
> `tests/test_response_contract.py::test_dataset_shape_is_frozen` asserts the exact key set with
> `==`. Adding `source` or `idempotency_key` here breaks 3 tests. See README §A.

### Part C — regression test

**New file:** `tests/test_camera_attribution_by_id.py`

```python
"""The stored video_results.camera_id must win over playlist-folder guessing.

Edge-submitted crossings have no file under PLAYLIST_DIR, so folder guessing
cannot attribute them -- only the stored FK can.
"""

from __future__ import annotations

import pytest

from app.core.database import connect
from app.services import cameras as cam
from app.services.dataset import build_dataset, invalidate_cache

TEST_CODE = "PYTEST-ATTR-CAM"
TEST_VIDEO = "edge-PYTEST-ATTR-no-such-file.jpg"


def _purge():
    cam.ensure_schema()
    conn = connect()
    try:
        conn.execute("DELETE FROM video_results WHERE video = ?", (TEST_VIDEO,))
        conn.execute("DELETE FROM cameras WHERE camera_code = ?", (TEST_CODE,))
        conn.commit()
    finally:
        conn.close()
    invalidate_cache()


@pytest.fixture(autouse=True)
def _cleanup():
    _purge()
    yield
    _purge()


def test_stored_camera_id_beats_folder_guessing():
    created = cam.create_camera({
        "camera_code": TEST_CODE,
        "name": "Attribution Test Gate",
        "gate_location": "Pytest Gate Location",
        "folder": "pytest-attr-folder",
    })
    assert created is not None

    conn = connect()
    try:
        conn.execute(
            "INSERT INTO video_results (video, voted_hull_id, vote_confidence, "
            "total_detections, frames_with_detections, camera_id, source) "
            "VALUES (?, 'DT-999', 0.9, 3, 3, ?, 'edge')",
            (TEST_VIDEO, created["id"]),
        )
        conn.commit()
    finally:
        conn.close()
    invalidate_cache()

    match = [c for c in build_dataset()["crossings"] if c["video"] == TEST_VIDEO]
    assert len(match) == 1, "the edge row did not reach build_dataset()"
    crossing = match[0]

    # The whole point: no file exists at PLAYLIST_DIR for this video, so only
    # the stored FK could have produced a real gate here.
    assert crossing["camera_id"] == created["id"]
    assert crossing["camera_code"] == TEST_CODE
    assert crossing["lane"] == "Pytest Gate Location"
    assert crossing["lane"] != "Unassigned Gate"
```

---

## 1.5 [DONE] Create `app/repositories/edge_repo.py`

**New file.** Read/write helpers scoped to the edge columns. DDL stays in `camera_repo`.

```python
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
    """Provision (or revoke, with None) a device credential."""
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

    ``status`` is whatever the device self-reported -- only 'online' or
    'maintenance'. A device never reports 'offline'; that state is inferred
    centrally by the sweep (docs/edge-system/SRS.md §5.1).

    ``applied_config_version`` is stored verbatim as reported: it is the device's
    own claim about which config it is running, and the dashboard's saved-vs-
    pending indicator is exactly ``applied_config_version == config_version``.
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
    """Stamp the 'settings saved' timestamp, but only if the device is current.

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

    ``fields`` must already be validated and restricted to EDGE_TUNABLE_FIELDS.
    Returns the updated row, or None if ``camera_code`` does not exist.
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
    """Flip devices silent since ``threshold_iso`` to 'offline'. Returns rows changed.

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
```

---

## 1.6 [DONE] Add the shared UTC timestamp helper

Every timestamp written by this build must be ISO 8601 UTC with an explicit `Z`
(`docs/edge-system/API_CONTRACT.md` §0). SQLite compares TEXT timestamps
lexicographically, so a single inconsistent format silently breaks the offline sweep's
`last_heartbeat_at < ?` comparison.

**File:** `app/utils/paths.py` is for paths; put this in a new **`app/utils/timeutil.py`**:

```python
"""UTC timestamp formatting shared by every edge-system module.

One format, everywhere: ISO 8601 with an explicit 'Z'. SQLite compares TEXT
timestamps lexicographically, so a single module using a different format would
silently break the offline sweep's range comparison.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

ISO_Z = "%Y-%m-%dT%H:%M:%SZ"


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).strftime(ISO_Z)


def utc_iso_seconds_ago(seconds: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(seconds=seconds)).strftime(ISO_Z)
```

---

## Acceptance for Section 01

- [ ] `PRAGMA table_info(cameras)` shows all 12 edge columns with correct defaults.
- [ ] `PRAGMA table_info(video_results)` shows `idempotency_key`, `source`, `votes_json`,
      `window_sec`; `PRAGMA index_list(video_results)` shows `idx_vr_idempotency` as unique.
- [ ] `uv run pytest tests/test_camera_attribution_by_id.py -q` passes.
- [ ] `uv run pytest tests/ -q` shows no **new** failures vs. the Section 00 baseline — especially
      `tests/test_response_contract.py`, which is the tripwire for the frozen-shape rule.
