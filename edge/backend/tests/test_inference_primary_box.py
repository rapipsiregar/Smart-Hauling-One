"""Which box stands in for 'the truck' this frame, for direction tracking.

Multiple boxes in one frame are usually the same truck at different confidences,
not two trucks sharing a lane -- the biggest box is the whole vehicle.
"""

from __future__ import annotations

from agent.inference import _primary_box


def _box(x0, y0, x1, y1, conf=0.9):
    return {"x0": x0, "y0": y0, "x1": x1, "y1": y1, "conf": conf}


def test_single_box_is_its_own_primary():
    box = _box(0, 0, 100, 100)
    assert _primary_box([box]) is box


def test_the_larger_box_wins():
    small = _box(0, 0, 50, 50)      # area 2500
    big = _box(0, 0, 200, 200)      # area 40000
    assert _primary_box([small, big]) is big


def test_confidence_does_not_override_size():
    small_but_confident = _box(0, 0, 50, 50, conf=0.99)
    big_but_unsure = _box(0, 0, 200, 200, conf=0.31)
    assert _primary_box([small_but_confident, big_but_unsure]) is big_but_unsure
