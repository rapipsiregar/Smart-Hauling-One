"""JSON persistence for the registered-truck registry and the results export.

Both the dashboard dataset and the fleet/crossing mutations touched these two
files with copy-pasted loaders; that logic now lives here once.
"""

from __future__ import annotations

import json

from app.core.config import REGISTERED_TRUCKS_JSON, RESULTS_JSON


# --- Registered trucks -------------------------------------------------------

def read_registered_trucks() -> dict[str, dict]:
    """Registry as a dict, or ``{}`` when the file is missing/unreadable."""
    parsed = read_registered_trucks_or_none()
    return parsed if parsed is not None else {}


def read_registered_trucks_or_none() -> dict[str, dict] | None:
    """Parsed registry, or ``None`` when the file is missing or invalid.

    Callers that need to distinguish "no registry yet" from "empty registry"
    (e.g. to seed one) use this; others use :func:`read_registered_trucks`.
    """
    if REGISTERED_TRUCKS_JSON.exists():
        try:
            return json.loads(REGISTERED_TRUCKS_JSON.read_text(encoding="utf-8"))
        except Exception:
            return None
    return None


def write_registered_trucks(registry: dict[str, dict]) -> None:
    try:
        REGISTERED_TRUCKS_JSON.write_text(
            json.dumps(registry, indent=2, ensure_ascii=False), encoding="utf-8"
        )
    except Exception as err:
        print(f"Error saving registered trucks: {err}")


# --- Results export (mutable) ------------------------------------------------

def read_results() -> list[dict]:
    """The ``results`` array from the pipeline's JSON export (``[]`` on miss)."""
    if RESULTS_JSON.exists():
        try:
            return json.loads(RESULTS_JSON.read_text(encoding="utf-8")).get("results", [])
        except Exception:
            return []
    return []


def write_results(results: list[dict]) -> None:
    """Replace the ``results`` array, preserving any other top-level keys."""
    if not RESULTS_JSON.exists():
        return
    try:
        data = json.loads(RESULTS_JSON.read_text(encoding="utf-8"))
        data["results"] = results
        RESULTS_JSON.write_text(
            json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8"
        )
    except Exception as err:
        print(f"Error saving results: {err}")
