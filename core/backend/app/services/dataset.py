"""Build the canonical dashboard dataset from real processing results.

``build_dataset`` joins video results, the registered-truck registry, and
per-gate camera attribution into the crossings/fleet/KPIs structure every other
read view derives from. The result is memoised until :func:`invalidate_cache`.
"""

from __future__ import annotations

from pathlib import Path

from app.core.config import ANNOTATED_DIR, SNAPSHOT_DIR, UNIDENTIFIED_HULLS
from app.repositories import truck_registry_repo, video_results_repo
from app.utils.paths import relative_to_root

_CACHE: dict | None = None


def invalidate_cache() -> None:
    global _CACHE
    _CACHE = None


def filter_by_camera(
    items: list[dict],
    camera_code: str | None = None,
    camera_id: int | None = None,
) -> list[dict]:
    """Filter reference-shaped dicts by camera. No filter args -> unchanged list."""
    if camera_code is not None:
        items = [x for x in items if x.get("cameraCode") == camera_code]
    if camera_id is not None:
        items = [x for x in items if x.get("cameraId") == camera_id]
    return items


def _snapshot_for(stem: str) -> str | None:
    if not SNAPSHOT_DIR.is_dir():
        return None
    for f in SNAPSHOT_DIR.glob(f"{stem}__*.jpg"):
        return relative_to_root(f)
    return None


def _load_registry(results: list[dict]) -> dict[str, dict]:
    """The fleet registry, master table first.

    Resolution order:

    1. The ``trucks`` master table, imported from the operator's own spreadsheet
       (``app/services/master_import.py``). Authoritative when populated.
    2. ``data/registered_trucks.json`` -- the pre-master registry, kept working
       for deployments that have not imported a spreadsheet yet.
    3. Hull ids observed in the results, seeded and saved.

    The master's ``Layak``/``Tidak Layak`` roadworthiness maps onto the
    ``active``/``inactive`` status the fleet views already render, so adopting the
    master changes the data source without changing the response contract.
    """
    master = _master_registry()
    if master:
        return master

    existing = truck_registry_repo.read_registered_trucks_or_none()
    if existing is not None:
        return existing

    registry: dict[str, dict] = {}
    for r in results:
        hull = r.get("voted_hull_id", "UNKNOWN")
        if hull not in UNIDENTIFIED_HULLS:
            registry[hull] = {"hull_id": hull, "status": "active"}
    truck_registry_repo.write_registered_trucks(registry)
    return registry


def _master_registry() -> dict[str, dict]:
    """``{hull_id: {...}}`` from the master table, or ``{}`` when it is empty."""
    try:
        from app.repositories import truck_master_repo
        return {
            t["hull_id"]: {
                "hull_id": t["hull_id"],
                "status": "inactive" if t.get("status") == "Tidak Layak" else "active",
            }
            for t in truck_master_repo.list_all()
        }
    except Exception as err:  # pragma: no cover - defensive
        print(f"dataset: master registry unavailable: {err}")
        return {}


def _camera_attribution() -> tuple[dict, dict, dict]:
    """(``camera_by_folder``, ``playlist_folder_map``, ``camera_by_id``).

    Empty maps on failure. ``camera_by_id`` lets a row that already carries a real
    ``camera_id`` skip folder guessing entirely -- required for edge-sourced
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


def _crossing_times() -> dict:
    """``{video: crossed_at|None}``, or empty when the time source is absent."""
    try:
        from app.services.crossing_time import crossing_times_by_video
        return crossing_times_by_video()
    except Exception as err:  # pragma: no cover - defensive
        print(f"dataset: crossing times unavailable: {err}")
        return {}


def _resolve_camera(video_name: str, by_folder: dict, folder_map: dict) -> dict | None:
    if not by_folder:
        return None
    try:
        from app.services.cameras import resolve_camera_for_video
        return resolve_camera_for_video(video_name, by_folder, folder_map)
    except Exception:  # pragma: no cover - defensive
        return None


def _annotated_video(video: str) -> str | None:
    annotated = ANNOTATED_DIR / f"annotated_{video}"
    if not annotated.exists():
        return None
    try:
        from app.utils.media import ensure_browser_compatible
        ensure_browser_compatible(annotated)
    except Exception:
        pass
    return relative_to_root(annotated)


def _build_crossing(
    idx: int, r: dict, by_folder: dict, folder_map: dict, by_id: dict, times: dict,
    registered: dict | None = None,
) -> dict:
    vid = r.get("video", "")
    stem = Path(vid).stem
    hull = r.get("voted_hull_id", "UNKNOWN")
    conf = round(float(r.get("vote_confidence", 0.0) or 0.0) * 100, 1)
    reads = int(r.get("total_detections", 0) or 0)
    known = hull not in UNIDENTIFIED_HULLS
    # "We read this truck" and "this truck is in the master" are two different
    # claims, and the system now records crossings where the first is true and
    # the second is not: a contractor's visitor, a unit commissioned since the
    # last spreadsheet import (app/services/edge_ingest.py::unregistered_hull).
    # Those still count and still pair into ritase -- the truck really crossed --
    # but presenting them as fleet units would quietly enlarge the fleet, so the
    # distinction travels with every crossing rather than being inferred later.
    is_registered = bool(known and registered is not None and hull in registered)

    # A stored camera_id is authoritative (edge rows, and batch rows that have
    # been through sync_attribution). Folder guessing is the fallback for rows
    # that predate attribution.
    stored_camera_id = r.get("camera_id")
    cam = by_id.get(stored_camera_id) if stored_camera_id is not None else None
    if cam is None:
        cam = _resolve_camera(vid, by_folder, folder_map)
    lane = (
        cam.get("gate_location") or cam.get("name") or "Unassigned Gate"
        if cam is not None else "Unassigned Gate"
    )
    own_direction = r.get("direction")
    if own_direction in ("inbound", "outbound"):
        direction = own_direction
    elif r.get("source") == "edge":
        # An edge crossing always reports its own reading (device's virtual
        # center line, edge/backend/agent/pipeline.py) -- there is no gate-level
        # direction left to fall back to, and there must not be: a camera row's
        # `direction` column is a historical leftover from before every gate
        # detected both ways, and honouring it here would silently resurrect
        # the "gate is fixed inbound/outbound" behaviour for every edge
        # crossing whose truck genuinely never crossed the line. None is the
        # correct, final answer for those -- not something to paper over.
        direction = None
    else:
        # Batch rows predate the per-crossing column entirely and were really
        # filmed at a camera pinned to one direction at the time, so the
        # camera's own value is the honest answer for them.
        cam_dir = cam.get("direction") if cam is not None else None
        direction = cam_dir if cam_dir in ("inbound", "outbound") else None

    return {
        "id": idx + 1,
        "hull_id": hull if known else "UNIDENTIFIED",
        "video": vid,
        "confidence": conf,
        "reads": reads,
        "frames": int(r.get("frames_with_detections", 0) or 0),
        "lane": lane,
        "direction": direction,
        # Real wall-clock crossing time, or None when no source supplies one.
        "crossed_at": times.get(vid),
        "camera_id": cam.get("id") if cam else None,
        "camera_code": cam.get("camera_code") if cam else None,
        "camera_name": cam.get("name") if cam else None,
        "rtsp_url": cam.get("rtsp_url") if cam else None,
        "snapshot": _snapshot_for(stem) if known else None,
        "annotated_video": _annotated_video(vid),
        "known": known,
        "registered": is_registered,
    }


def _accumulate_fleet(fleet: dict, crossing: dict, registered: dict, reads: int) -> None:
    hull = crossing["hull_id"]
    status = registered.get(hull, {}).get("status", "active")
    registered.setdefault(hull, {"hull_id": hull, "status": "active"})
    f = fleet.setdefault(
        hull,
        {"hull_id": hull, "passages": 0, "reads": 0, "best_conf": 0.0,
         "snapshot": crossing["snapshot"], "status": status, "cameras_seen": []},
    )
    f["passages"] += 1
    f["reads"] += reads
    f["best_conf"] = max(f["best_conf"], crossing["confidence"])
    label = crossing["camera_name"] or crossing["lane"]
    if label and label not in f["cameras_seen"]:
        f["cameras_seen"].append(label)


def build_dataset() -> dict:
    global _CACHE
    if _CACHE is not None:
        return _CACHE

    results = video_results_repo.load_video_results()
    registered = _load_registry(results)
    by_folder, folder_map, by_id = _camera_attribution()
    times = _crossing_times()

    crossings: list[dict] = []
    fleet: dict[str, dict] = {}

    for idx, r in enumerate(results):
        crossing = _build_crossing(idx, r, by_folder, folder_map, by_id, times, registered)
        crossings.append(crossing)
        # Only master units build the fleet view. An unregistered truck is a real
        # crossing and is counted as one, but it is not a unit of this fleet and
        # adding it here would silently grow the roster the operator maintains.
        if crossing["registered"]:
            _accumulate_fleet(fleet, crossing, registered, crossing["reads"])

    for hull, info in registered.items():
        fleet.setdefault(hull, {
            "hull_id": hull, "passages": 0, "reads": 0, "best_conf": 0.0,
            "snapshot": None, "status": info.get("status", "active"), "cameras_seen": [],
        })

    fleet_list = sorted(
        fleet.values(), key=lambda x: (x["passages"], x["hull_id"]), reverse=True
    )
    known_crossings = [c for c in crossings if c["known"]]
    avg_conf = (
        round(sum(c["confidence"] for c in known_crossings) / len(known_crossings), 1)
        if known_crossings else 0.0
    )

    kpis = {
        "total_videos": len(crossings),
        "identified": len(known_crossings),
        "unique_trucks": len(fleet_list),
        "total_reads": sum(c["reads"] for c in crossings),
        "avg_confidence": avg_conf,
        "unknown": len(crossings) - len(known_crossings),
    }

    _CACHE = {"crossings": crossings, "fleet": fleet_list, "kpis": kpis}
    return _CACHE
