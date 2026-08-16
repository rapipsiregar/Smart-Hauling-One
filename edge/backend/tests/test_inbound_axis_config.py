"""The device's provisioned inbound axis must not be silently overridden.

Found by replaying the ten reference clips end to end: a gate provisioned as
``rtl`` recorded every crossing backwards. The environment variable was set, the
documentation said it was the value used before the core's config arrives, and
it was ignored — because ``Tunables.inbound_axis`` carried a literal ``"ltr"``
default, and a literal default is always a valid value, so it always won.

Failure is silent by construction: the device runs, detects, reports, and files
every arrival as a departure. That is why these are tests and not a comment.
"""

from __future__ import annotations

import pytest

from agent.config import Tunables, inbound_axis_from_env

BASE = {
    "yolo_fps": 20, "ocr_fps": 4, "detect_window_sec": 6,
    "ocr_min_conf": 0.30, "dedup_iou": 0.92, "config_version": 3,
}


def test_a_fresh_tunables_takes_the_devices_own_axis(monkeypatch):
    monkeypatch.setenv("SMART_GATE_INBOUND_AXIS", "rtl")
    assert Tunables().inbound_axis == "rtl"


def test_it_still_defaults_to_ltr_when_nothing_is_provisioned(monkeypatch):
    monkeypatch.delenv("SMART_GATE_INBOUND_AXIS", raising=False)
    assert Tunables().inbound_axis == "ltr"


def test_the_core_wins_when_it_states_an_axis(monkeypatch):
    """The core owns this setting; the environment is only the pre-fetch value."""
    monkeypatch.setenv("SMART_GATE_INBOUND_AXIS", "rtl")
    assert Tunables.from_api({**BASE, "inbound_axis": "ltr"}).inbound_axis == "ltr"


def test_an_older_core_saying_nothing_does_not_flip_the_gate(monkeypatch):
    """Absent is not the same as 'left-to-right'.

    A core that predates the field omits it. Snapping to "ltr" there would flip
    a correctly installed rtl gate the moment it fetched its config.
    """
    monkeypatch.setenv("SMART_GATE_INBOUND_AXIS", "rtl")
    assert Tunables.from_api(BASE).inbound_axis == "rtl"


def test_a_nonsense_axis_falls_back_to_the_device_rather_than_a_guess(monkeypatch):
    monkeypatch.setenv("SMART_GATE_INBOUND_AXIS", "rtl")
    assert Tunables.from_api({**BASE, "inbound_axis": "miring"}).inbound_axis == "rtl"


@pytest.mark.parametrize("raw,expected", [
    ("RTL", "rtl"), (" rtl ", "rtl"), ("", "ltr"), ("   ", "ltr"),
])
def test_the_environment_value_is_normalised(monkeypatch, raw, expected):
    monkeypatch.setenv("SMART_GATE_INBOUND_AXIS", raw)
    assert inbound_axis_from_env() == expected
