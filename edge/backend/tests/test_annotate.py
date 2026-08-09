"""Drawing: the green box always, the caption only when Detail is on.

The box says "the system is looking here" and an operator should always see it.
The caption is a track id and a detection score -- a number nobody asked about,
which invites a question nobody wanted. That is the whole distinction the Detail
switch exists to make.
"""

from __future__ import annotations

import numpy as np
import pytest

cv2 = pytest.importorskip("cv2")

from agent.annotate import annotate  # noqa: E402

BOX = {"x0": 40.0, "y0": 60.0, "x1": 160.0, "y1": 110.0, "conf": 0.89}


def _frame():
    return np.zeros((360, 640, 3), np.uint8)


def _green_pixels(image) -> int:
    """Count pixels of the box colour (120, 255, 90) in BGR."""
    return int(np.all(image == np.array([120, 255, 90], np.uint8), axis=-1).sum())


def _label_pixels(image) -> int:
    """The caption plate is drawn filled in (16, 20, 24)."""
    return int(np.all(image == np.array([16, 20, 24], np.uint8), axis=-1).sum())


def test_the_box_is_drawn_with_detail_off() -> None:
    plain = annotate(_frame(), [BOX], track_id=7, detail=False)
    assert _green_pixels(plain) > 0


def test_no_caption_with_detail_off() -> None:
    plain = annotate(_frame(), [BOX], track_id=7, detail=False)
    assert _label_pixels(plain) == 0


def test_the_caption_appears_with_detail_on() -> None:
    detailed = annotate(_frame(), [BOX], track_id=7, detail=True)
    assert _label_pixels(detailed) > 0
    # And the box is still there -- Detail adds, it does not replace.
    assert _green_pixels(detailed) > 0


def test_an_empty_frame_draws_nothing() -> None:
    assert _green_pixels(annotate(_frame(), [], detail=True)) == 0


def test_the_frame_handed_in_is_never_drawn_on() -> None:
    """It belongs to the capture ring and other threads read it -- drawing in
    place would put boxes into the crops the recogniser is about to read."""
    frame = _frame()
    annotate(frame, [BOX], track_id=1, detail=True)
    assert frame.sum() == 0


def test_output_is_downscaled_to_the_stream_size() -> None:
    out = annotate(np.zeros((1080, 1920, 3), np.uint8), [BOX], scale_to=960)
    assert max(out.shape[:2]) == 960
