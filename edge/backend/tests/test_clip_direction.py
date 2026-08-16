"""Which clips a gate is offered.

A gate no longer has a fixed direction to filter clips against -- every clip
is offered regardless of what its name claims, because the virtual center line
(agent/pipeline.py) now decides inbound vs. outbound per truck from the video
itself, not from which gate is playing it.
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


# Deliberately NOT one of the gate filenames above: these tests exist to keep
# the two folders distinguishable, so the fixtures must not overlap by accident.
SAMPLE = "6Ne6NCbtv-A.mp4"


@pytest.fixture
def clip_dir(monkeypatch: pytest.MonkeyPatch) -> Path:
    directory = Path(tempfile.mkdtemp())
    for name in (MARKED_IN, MARKED_OUT, UNMARKED, "notes.txt"):
        (directory / name).write_bytes(b"x")
    monkeypatch.setattr(clip_sources, "CLIP_DIR", directory)
    monkeypatch.setattr(clip_sources, "SAMPLE_DIR", None)
    store.ensure_schema()
    monkeypatch.setenv("SMART_GATE_CAMERA_CODE", "CAM-GATE-A")
    return directory


@pytest.fixture
def sample_dir(clip_dir, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Reference footage in a folder of its own, never merged into the gate's."""
    directory = Path(tempfile.mkdtemp())
    for name in (SAMPLE, "MFZIp_ENJbY.mp4"):
        (directory / name).write_bytes(b"x")
    monkeypatch.setattr(clip_sources, "SAMPLE_DIR", directory)
    return directory


def _names(clips) -> set[str]:
    return {c["name"] for c in clips}


def test_clip_direction_reads_the_name() -> None:
    assert clip_sources.clip_direction(MARKED_IN) == "inbound"
    assert clip_sources.clip_direction(MARKED_OUT) == "outbound"
    assert clip_sources.clip_direction(UNMARKED) is None


def test_every_clip_is_offered_regardless_of_its_labelled_direction(clip_dir) -> None:
    """No gate is pinned to a direction anymore, so nothing gets hidden."""
    for direction in (None, "inbound", "outbound"):
        clips = clip_sources.list_clips(direction=direction)
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
    resolved = {p.name for p in clip_sources.resolve(None)}
    assert {MARKED_IN, MARKED_OUT, UNMARKED} <= resolved


def test_an_explicitly_named_clip_is_still_honoured(clip_dir) -> None:
    assert [p.name for p in clip_sources.resolve([MARKED_OUT])] == [MARKED_OUT]


def test_core_contact_is_recorded_and_readable() -> None:
    """What /api/status falls back to when the agent is not running -- otherwise
    it reports 'Terputus' about a centre the device just spoke to."""
    store.ensure_schema()
    store.set_meta(clip_sources.LAST_CONTACT_META, "")
    clip_sources.remember_core_contact()

    stamp = clip_sources.core_last_contact()
    assert stamp and stamp.startswith("20")


# --- the reference set -------------------------------------------------------

def test_sample_clips_are_offered_alongside_the_gate_s_own(sample_dir) -> None:
    names = _names(clip_sources.list_clips(direction="inbound"))
    assert SAMPLE in names
    assert MARKED_IN in names


def test_sample_clips_are_never_direction_filtered(sample_dir) -> None:
    """They are other people's trucks. Giving them a direction would invent a
    fact about footage that never claimed one."""
    for direction in ("inbound", "outbound"):
        clips = clip_sources.list_clips(direction=direction)
        assert SAMPLE in _names(clips)
        assert next(c["direction"] for c in clips if c["name"] == SAMPLE) is None


def test_each_clip_says_which_folder_it_came_from(sample_dir) -> None:
    by_name = {c["name"]: c["source"] for c in clip_sources.list_clips()}
    assert by_name[MARKED_IN] == clip_sources.GATE_SOURCE
    assert by_name[SAMPLE] == clip_sources.SAMPLE_SOURCE


def test_run_everything_does_not_sweep_in_the_reference_set(sample_dir) -> None:
    """A bare "run all" must stay this gate's own footage. Filing other people's
    trucks as crossings here needs to be asked for by name."""
    resolved = {p.name for p in clip_sources.resolve(None)}
    assert SAMPLE not in resolved
    assert MARKED_IN in resolved


def test_a_sample_named_explicitly_is_honoured(sample_dir) -> None:
    assert [p.name for p in clip_sources.resolve([SAMPLE])] == [SAMPLE]


def test_a_gate_clip_wins_a_name_collision(clip_dir, monkeypatch) -> None:
    """This device's own footage is the real record; reference material must
    never shadow it."""
    other = Path(tempfile.mkdtemp())
    (other / MARKED_IN).write_bytes(b"sample-copy")
    monkeypatch.setattr(clip_sources, "SAMPLE_DIR", other)

    assert clip_sources.clip_path(MARKED_IN).parent == clip_dir
    sources = [c["source"] for c in clip_sources.list_clips() if c["name"] == MARKED_IN]
    assert sources == [clip_sources.GATE_SOURCE]


def test_clip_path_refuses_to_escape_either_folder(sample_dir) -> None:
    assert clip_sources.clip_path("../../etc/passwd") is None
    assert clip_sources.clip_path("notes.txt") is not None  # inside, just not video


def test_no_sample_folder_configured_is_not_an_error(clip_dir) -> None:
    """A device in the field carries no reference footage."""
    assert clip_sources.SAMPLE_DIR is None
    assert SAMPLE not in _names(clip_sources.list_clips())
