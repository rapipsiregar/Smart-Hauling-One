"""Which clips a gate is offered, given which way it faces.

The filter exists so an outbound clip is never replayed on an inbound gate --
that would file the crossing as an arrival. It must not also hide footage that
simply never claimed a direction, which is what made a folder of reference clips
show up as "Semua klip (0)" the moment a gate learned it was inbound.
"""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

import pytest

os.environ.setdefault("SMART_GATE_RUN_AGENT", "false")
os.environ.setdefault(
    "SMART_GATE_EDGE_DB", str(Path(tempfile.mkdtemp()) / "edge-test.db")
)

from app import store  # noqa: E402
from app.services import clip_sources  # noqa: E402

MARKED_IN = "2152 - In - 20231027_081402.mp4"
MARKED_OUT = "2152 - Out - 20231027_082247.mp4"
UNMARKED = "kVVasZ0b0JU.mp4"


@pytest.fixture
def clip_dir(monkeypatch: pytest.MonkeyPatch) -> Path:
    directory = Path(tempfile.mkdtemp())
    for name in (MARKED_IN, MARKED_OUT, UNMARKED, "notes.txt"):
        (directory / name).write_bytes(b"x")
    monkeypatch.setattr(clip_sources, "CLIP_DIR", directory)
    store.ensure_schema()
    monkeypatch.delenv("SMART_GATE_DIRECTION", raising=False)
    monkeypatch.setenv("SMART_GATE_CAMERA_CODE", "CAM-GATE-A")
    return directory


def _names(clips) -> set[str]:
    return {c["name"] for c in clips}


def test_clip_direction_reads_the_name() -> None:
    assert clip_sources.clip_direction(MARKED_IN) == "inbound"
    assert clip_sources.clip_direction(MARKED_OUT) == "outbound"
    assert clip_sources.clip_direction(UNMARKED) is None


def test_an_inbound_gate_hides_only_the_explicitly_outbound(clip_dir) -> None:
    clips = clip_sources.list_clips(direction="inbound")

    assert MARKED_IN in _names(clips)
    assert MARKED_OUT not in _names(clips)
    # The regression: unlabelled footage is a claim about nothing, so it stays.
    assert UNMARKED in _names(clips)


def test_an_outbound_gate_hides_only_the_explicitly_inbound(clip_dir) -> None:
    clips = clip_sources.list_clips(direction="outbound")

    assert MARKED_OUT in _names(clips)
    assert MARKED_IN not in _names(clips)
    assert UNMARKED in _names(clips)


def test_a_gate_with_no_known_direction_is_offered_everything(clip_dir) -> None:
    clips = clip_sources.list_clips()
    assert _names(clips) == {MARKED_IN, MARKED_OUT, UNMARKED}


def test_non_video_files_are_never_offered(clip_dir) -> None:
    assert "notes.txt" not in _names(clip_sources.list_clips())


def test_each_clip_reports_its_own_direction(clip_dir) -> None:
    """So the console can distinguish direction-matched from merely unlabelled."""
    by_name = {c["name"]: c["direction"] for c in clip_sources.list_clips()}
    assert by_name[MARKED_IN] == "inbound"
    assert by_name[MARKED_OUT] == "outbound"
    assert by_name[UNMARKED] is None


def test_resolve_defaults_to_what_this_gate_would_be_offered(clip_dir) -> None:
    clip_sources.remember_direction("inbound")
    resolved = {p.name for p in clip_sources.resolve(None)}

    assert MARKED_OUT not in resolved
    assert {MARKED_IN, UNMARKED} <= resolved


def test_an_explicitly_named_clip_is_still_honoured(clip_dir) -> None:
    """The technician asked for it by name; offering fewer choices is the filter's
    job, overruling a direct request is not."""
    clip_sources.remember_direction("inbound")
    assert [p.name for p in clip_sources.resolve([MARKED_OUT])] == [MARKED_OUT]


def test_core_contact_is_recorded_and_readable() -> None:
    """What /api/status falls back to when the agent is not running -- otherwise
    it reports 'Terputus' about a centre the device just spoke to."""
    store.ensure_schema()
    store.set_meta(clip_sources.LAST_CONTACT_META, "")
    clip_sources.remember_core_contact()

    stamp = clip_sources.core_last_contact()
    assert stamp and stamp.startswith("20")
