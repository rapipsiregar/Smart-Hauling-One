"""Camera registry business logic: validation, folder attribution, CRUD.

Each mining gate installs one or more cameras. A camera is a real operator
record in the ``cameras`` table; every processed video is attributed to a camera
by the playlist subfolder its file lives in. Until an operator registers a
camera for a folder, its videos honestly read as "Unassigned".
"""

from __future__ import annotations

import time
from pathlib import Path

from app.core.config import (
    ALLOWED_VIDEO_EXTS,
    CAMERA_FIELDS,
    PLAYLIST_DIR,
    VALID_CAMERA_DIRECTION,
    VALID_CAMERA_STATUS,
)
from app.repositories import camera_repo
from app.repositories.camera_repo import ensure_schema  # re-exported for callers/tests


# --- Folder-based attribution ------------------------------------------------

def _folder_key(path: Path) -> str:
    """Relative playlist folder for a file. '' means the playlist root."""
    try:
        rel = path.resolve().parent.relative_to(PLAYLIST_DIR.resolve())
    except ValueError:
        return ""
    return "" if str(rel) == "." else rel.as_posix()


def playlist_folder_map() -> dict[str, str]:
    """Map each playlist video basename -> its folder key (recursive)."""
    out: dict[str, str] = {}
    if not PLAYLIST_DIR.is_dir():
        return out
    for f in PLAYLIST_DIR.rglob("*"):
        if f.suffix.lower() in ALLOWED_VIDEO_EXTS and f.is_file():
            out.setdefault(f.name, _folder_key(f))
    return out


def _norm_folder(folder: str | None) -> str:
    """Normalise a folder value ('', '.', '/' all mean the playlist root)."""
    if not folder:
        return ""
    f = folder.strip().strip("/")
    return "" if f == "." else f


def camera_by_folder() -> dict[str, dict]:
    """Map folder key -> camera row (dict) for fast attribution."""
    return {_norm_folder(c["folder"]): c for c in list_cameras()}


def resolve_camera_for_video(
    video_name: str,
    by_folder: dict[str, dict] | None = None,
    folder_map: dict[str, str] | None = None,
) -> dict | None:
    """Return the camera a given video belongs to, or None if unassigned."""
    by_folder = camera_by_folder() if by_folder is None else by_folder
    folder_map = playlist_folder_map() if folder_map is None else folder_map
    folder = _norm_folder(folder_map.get(video_name, None))
    return by_folder.get(folder)


def sync_attribution() -> int:
    """Persist ``camera_id`` on video_results from current playlist folders.

    Returns the number of rows tagged to a camera.

    Only rows whose video is actually **present in the playlist tree** are
    touched. A row whose video has no file on disk is left exactly as it is --
    critically, that includes every edge-ingested crossing, which is attributed
    at insert time from the submitting device and has no playlist file to be
    re-derived from. Rewriting those to NULL here would silently strip the gate
    from every live crossing the moment an operator hit
    ``POST /api/cameras-sync-attribution``.

    Clearing still happens where it should: a video that *is* on disk but sits in
    a folder no camera claims resolves to NULL, which is the correct "unassigned"
    outcome after a camera is deleted or its folder reassigned.
    """
    ensure_schema()
    by_folder = camera_by_folder()
    folder_map = playlist_folder_map()
    pairs: list[tuple[int, int | None]] = []
    tagged = 0
    for row in camera_repo.iter_video_results():
        if row["video"] not in folder_map:
            continue  # not playlist-derived; its attribution is not ours to rewrite
        cam = resolve_camera_for_video(row["video"], by_folder, folder_map)
        cam_id = cam["id"] if cam else None
        pairs.append((row["id"], cam_id))
        if cam_id is not None:
            tagged += 1
    camera_repo.bulk_set_camera_ids(pairs)
    return tagged


# --- CRUD --------------------------------------------------------------------

def list_cameras() -> list[dict]:
    return camera_repo.list_rows()


def get_camera(camera_code: str) -> dict | None:
    return camera_repo.get_row(camera_code)


def _clean(payload: dict) -> dict:
    """Keep only known fields; validate enums; normalise folder and identifiers."""
    data = {k: payload.get(k) for k in CAMERA_FIELDS if k in payload}
    if "direction" in data and data["direction"] not in VALID_CAMERA_DIRECTION:
        data["direction"] = "both"
    if "status" in data and data["status"] not in VALID_CAMERA_STATUS:
        data["status"] = "offline"
    if "folder" in data:
        data["folder"] = _norm_folder(data.get("folder"))
    if "camera_code" in data and isinstance(data["camera_code"], str):
        data["camera_code"] = data["camera_code"].strip()
    if "name" in data and isinstance(data["name"], str):
        data["name"] = data["name"].strip()
    return data


def create_camera(payload: dict) -> dict | None:
    ensure_schema()
    data = _clean(payload)
    if not data.get("camera_code") or not data.get("name"):
        return None
    if not camera_repo.insert_row(data):
        return None  # duplicate camera_code or folder
    return get_camera(data["camera_code"])


def update_camera(camera_code: str, payload: dict) -> dict | None:
    if get_camera(camera_code) is None:
        return None
    data = _clean(payload)
    data.pop("camera_code", None)  # code is the stable key; not renamed here
    if not data:
        return get_camera(camera_code)
    data["updated_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
    if not camera_repo.update_row(camera_code, data):
        return None  # folder collision with another camera
    return get_camera(camera_code)


def delete_camera(camera_code: str) -> bool:
    if get_camera(camera_code) is None:
        return False
    camera_repo.delete_row(camera_code)
    return True
