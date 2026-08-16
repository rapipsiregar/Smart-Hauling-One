"""_resolve() unpacks whatever DetectionWindow._close_window puts on the queue.

Regression coverage for a real crash: DetectionWindow started putting a 4-tuple
``(start, end, reads, direction)`` once the virtual-center-line algorithm
landed, and this consumer still unpacked 3 -- so every OCR Inspection HUD run
threw ``ValueError: too many values to unpack`` on its very first closed
window, which read to an operator as "the whole detector stopped working".
"""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

os.environ.setdefault("SMART_GATE_RUN_AGENT", "false")
os.environ.setdefault(
    "SMART_GATE_EDGE_DB", str(Path(tempfile.mkdtemp()) / "edge-test.db")
)

from app.services.test_runs import _resolve  # noqa: E402


def test_resolve_unpacks_the_four_tuple_a_closed_window_actually_puts() -> None:
    window = (100.0, 106.0, [], "inbound")
    resolved = _resolve(window)
    assert resolved["direction"] == "inbound"
    assert resolved["hull_id"] == "UNKNOWN"  # no reads in this synthetic window


def test_resolve_carries_a_missing_direction_through_as_none() -> None:
    window = (100.0, 106.0, [], None)
    resolved = _resolve(window)
    assert resolved["direction"] is None
