"""Direction from a truck's path across the frame (agent/pipeline.py).

The regressions these lock down were both found on the ten reference clips:
every crossing came back as the exact opposite of what happened (the axis was
hardcoded), and one came back as None despite the truck plainly traversing the
frame (the lane never touched the frame's centre line).
"""

from __future__ import annotations

from agent.pipeline import LTR, RTL, travel_direction

WIDTH = 1920.0


def _path(*xs: float) -> list[float]:
    return list(xs)


def test_rightward_travel_is_inbound_on_an_ltr_gate() -> None:
    assert travel_direction(_path(200, 900, 1700), WIDTH, LTR) == "inbound"


def test_leftward_travel_is_outbound_on_an_ltr_gate() -> None:
    assert travel_direction(_path(1700, 900, 200), WIDTH, LTR) == "outbound"


def test_the_axis_flips_both_answers() -> None:
    """A right-to-left gate reports the mirror image, and nothing else changes."""
    assert travel_direction(_path(200, 1700), WIDTH, RTL) == "outbound"
    assert travel_direction(_path(1700, 200), WIDTH, RTL) == "inbound"


def test_a_lane_entirely_left_of_centre_still_resolves() -> None:
    """The bug that produced direction=None on a real crossing.

    Every sample sits in the left half, so the old centre-line test saw one side
    for the whole window and refused to answer. The truck still travelled most
    of a frame width, which is the fact that matters.
    """
    assert travel_direction(_path(60, 300, 700, 900), WIDTH, LTR) == "inbound"


def test_a_lane_entirely_right_of_centre_still_resolves() -> None:
    assert travel_direction(_path(1850, 1500, 1100, 1000), WIDTH, LTR) == "outbound"


def test_a_stationary_truck_gets_no_direction() -> None:
    """Jitter must never be promoted to a crossing direction."""
    assert travel_direction(_path(900, 906, 898, 903), WIDTH, LTR) is None


def test_too_few_samples_get_no_direction() -> None:
    assert travel_direction(_path(900), WIDTH, LTR) is None
    assert travel_direction([], WIDTH, LTR) is None


def test_an_unknown_frame_width_gets_no_direction() -> None:
    assert travel_direction(_path(200, 1700), 0.0, LTR) is None
