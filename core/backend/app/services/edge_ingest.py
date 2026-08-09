"""Crossing ingestion from edge devices (``docs/edge-system/SRS.md`` §3.4, §5.2).

Edge crossings land in the same ``video_results`` table as the batch pipeline -- a
new producer into one store, not a parallel data model (SRS §9). They are
distinguished by ``source = 'edge'``.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from app.core.config import SNAPSHOT_DIR
from app.repositories import run_write_repo
from app.schemas.edge import CrossingPayload
from app.services import hull_matcher
from app.services.crossing_time import ISO
from app.services.dataset import invalidate_cache
from app.utils.paths import relative_to_root


def synthetic_video_name(camera_code: str, idempotency_key: str) -> str:
    """The ``video`` identifier for an edge crossing.

    Edge crossings have no file in ``data/01-playlist`` -- this is a stable
    synthetic id, unique because ``idempotency_key`` is a UUID v4. The ``.jpg``
    suffix is for readability only; nothing parses it as a real file.
    """
    return f"edge-{camera_code}-{idempotency_key}.jpg"


def save_snapshot(video_name: str, raw: bytes) -> str | None:
    """Persist a crossing snapshot where the existing read path already looks.

    ``dataset.py::_snapshot_for`` globs ``{stem}__*.jpg`` inside ``SNAPSHOT_DIR``,
    so naming the file ``{stem}__edge.jpg`` makes it discoverable with zero
    changes to that function.
    """
    if not raw:
        return None
    SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)
    dest = SNAPSHOT_DIR / f"{Path(video_name).stem}__edge.jpg"
    dest.write_bytes(raw)
    return relative_to_root(dest)


def snapshot_required(payload: CrossingPayload) -> bool:
    """Every crossing carries a snapshot except the empty-window case (SRS §3.4).

    A window that produced zero reads has no crop to send; the crossing is still
    submitted so operators see that a truck passed unidentified.
    """
    return not (payload.hull_id == "UNKNOWN" and payload.read_count == 0)


def normalize_crossed_at(detected_at: str) -> str:
    """Put an edge timestamp into the form ``video_results.crossed_at`` holds.

    The device sends ISO 8601 UTC with an explicit ``Z`` (API_CONTRACT §0), but
    that column's convention throughout the batch pipeline is the naive
    ``crossing_time.ISO``. Storing the two side by side is what broke ritase
    pairing: it sorts and subtracts these values, and Python will not compare an
    aware datetime with a naive one.

    The instant is preserved -- converted to UTC, then the offset dropped -- so
    nothing is invented about the site's local zone. An unparseable value is
    returned untouched rather than guessed at; ``ritase._parse`` treats it as no
    timestamp, which is the honest answer.
    """
    try:
        parsed = datetime.fromisoformat(detected_at.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return detected_at
    if parsed.tzinfo is not None:
        parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
    return parsed.strftime(ISO)


# A reading has to clear this share of the consensus vote before an unregistered
# truck is recorded by its number.
#
# The cost of being wrong is asymmetric. Too low and OCR noise invents trucks
# that were never on site, each one counting its own ritase; too high and a real
# unit missing from the master stays invisible. 0.70 sits above the vote share of
# every misread observed on the reference footage (the worst genuine mistake
# scored 0.29) and below every correct reading of a truck the master did not
# know. It is deliberately stricter than what a *registered* truck needs, because
# a registered match is corroborated by the master and this is not.
UNREGISTERED_MIN_CONFIDENCE = 0.70


def unregistered_hull(payload: CrossingPayload) -> str | None:
    """The number to file a confidently-read but unregistered truck under.

    None when the reading does not earn it -- the crossing then stores UNKNOWN
    exactly as before.

    Trucks do turn up that the master has never heard of: a contractor's visitor,
    a unit commissioned since the last spreadsheet import, a hull renumbered in
    the field. Recording those as UNKNOWN loses the one fact the gate was sure
    about, and makes a real truck indistinguishable from a window that read
    nothing. So the digits are kept and the crossing is filed under them.

    ``raw_code`` has already been through ``extract_code``, which returns a value
    only for an unambiguous 4-digit run -- so this is never a partial or
    multi-candidate reading. The confidence gate is the second filter.
    """
    code = (payload.raw_code or "").strip()
    if not code.isdigit() or len(code) != 4:
        return None
    if payload.confidence < UNREGISTERED_MIN_CONFIDENCE:
        return None
    if payload.read_count <= 0:
        return None
    return code


def record_crossing(
    *,
    payload: CrossingPayload,
    camera_id: int,
    idempotency_key: str,
    snapshot: bytes | None,
    direction: str | None = None,
) -> tuple[int, bool]:
    """Persist one crossing idempotently. Returns ``(crossing_id, created)``.

    Fast path: an already-seen idempotency key returns the original row without
    touching disk. The UNIQUE index inside ``insert_edge_crossing`` is what
    actually guarantees no duplicate under a concurrent retry race (SRS §5.2).
    """
    existing = run_write_repo.find_by_idempotency_key(idempotency_key)
    if existing is not None:
        return existing, False

    video = synthetic_video_name(payload.camera_code, idempotency_key)
    snapshot_path = save_snapshot(video, snapshot) if snapshot else None

    # Resolve the device's reading against the master registry. The edge reports
    # what it read; deciding which registered unit that *is* stays central,
    # because the master lives here and the 4 devices must not each hold a stale
    # copy of it. An unresolvable read is stored as UNKNOWN rather than as a
    # guess -- see app/services/hull_matcher.py for why correction is refused
    # when two real trucks are equally close.
    #
    # At an OUT gate the candidate set narrows to the trucks currently in the
    # pit before falling back to the master: a truck can only leave if it came
    # in. That knowledge exists only here -- a device sees its own gate, not who
    # entered through the other three -- which is why this is not done on the
    # edge alongside the rest of the matching.
    #
    # Match on the raw digits when the device could not name the unit itself.
    # ``hull_id`` is "UNKNOWN" then, and matching on that string can only ever
    # fail -- which quietly disabled the narrowing above in exactly the case it
    # was built for: a reading that is ambiguous against all 276 master codes is
    # often unambiguous against the handful of trucks actually inside.
    reading = payload.hull_id
    if reading == "UNKNOWN" and payload.raw_code:
        reading = payload.raw_code

    if (direction or "").lower() == "outbound":
        match = hull_matcher.match_outbound(reading)
        resolved_hull = match.hull_id if (match.is_registered and match.hull_id) else "UNKNOWN"
    else:
        resolved_hull = hull_matcher.resolve_display_hull(reading)

    # Still nobody the master knows, but the gate was sure of the digits.
    if resolved_hull == "UNKNOWN":
        resolved_hull = unregistered_hull(payload) or "UNKNOWN"

    crossing_id, created = run_write_repo.insert_edge_crossing(
        camera_id=camera_id,
        video=video,
        hull_id=resolved_hull,
        confidence=payload.confidence,
        read_count=payload.read_count,
        snapshot_path=snapshot_path,
        idempotency_key=idempotency_key,
        window_sec=payload.window_sec,
        votes_json=json.dumps([v.model_dump() for v in payload.votes]),
        detected_at_iso=normalize_crossed_at(payload.detected_at),
    )
    if created:
        # build_dataset() is memoised; without this the new crossing would not
        # appear on the next GET /api/crossings poll.
        invalidate_cache()
    return crossing_id, created
