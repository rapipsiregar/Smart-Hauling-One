"""Resolving OCR readings to registered trucks.

The safety property under test: a correction is applied ONLY when exactly one
master code is close enough. Two equally-close candidates must never be resolved
by guessing -- that would move a haul between two real trucks silently.
"""

from __future__ import annotations

import pytest

from app.services import hull_matcher as hm

# A deliberately dense candidate set: 2152/2153 are one edit apart, as real
# master codes are.
CANDIDATES = ["2152", "2253", "4561", "4562", "6018", "9001"]


# --- extraction --------------------------------------------------------------

@pytest.mark.parametrize("raw,expected", [
    ("HD 2152", "2152"),          # the operator's own format
    ("HD2152", "2152"),           # no separator
    ("2152", "2152"),             # bare code, what the camera really sees
    ("  2152  ", "2152"),
    ("hd-2152", "2152"),          # lowercase + punctuation
    ("HD 2152 (777)", "2152"),    # trailing unit type
    ("WT 6018", "6018"),          # water trucks share the 4-digit shape
    ("21 52", "2152"),            # OCR split the code across boxes
])
def test_extracts_the_four_digit_code(raw, expected):
    assert hm.extract_code(raw) == expected


@pytest.mark.parametrize("raw,expected", [
    ("215Z", "2152"),             # Z misread for 2
    ("HD 2I52", "2152"),          # I for 1
    ("ZI5Z", "2152"),             # several at once
    ("S152", "5152"),             # S for 5
    ("B152", "8152"),             # B for 8
])
def test_repairs_optical_confusions(raw, expected):
    """The fleet's hulls are purely numeric, so a letter is a misread digit."""
    assert hm.extract_code(raw) == expected


@pytest.mark.parametrize("raw", [
    None, "", "   ",
    "ABC",              # nothing numeric
    "215",              # too short -- a partial read must not be padded
    "21523",            # too long
    "2152 2018",        # two 4-digit runs: year beside the hull, unresolvable
])
def test_refuses_to_invent_a_code(raw):
    assert hm.extract_code(raw) is None


# --- matching ----------------------------------------------------------------

def test_exact_match():
    r = hm.match_code("2152", candidates=CANDIDATES)
    assert r.outcome == hm.EXACT
    assert r.hull_code == "2152"
    assert r.distance == 0
    assert r.is_registered and not r.was_corrected


def test_unambiguous_single_char_error_is_corrected():
    # 4562 is one edit from 4561 only (4562 itself is in the set, so use 4563).
    r = hm.match_code("4563", candidates=["4561", "2152"])
    assert r.outcome == hm.FUZZY
    assert r.hull_code == "4561"
    assert r.raw_code == "4563"
    assert r.distance == 1
    assert r.is_registered and r.was_corrected


def test_ambiguous_correction_is_refused():
    """THE safety property: equally-close candidates are not a coin flip."""
    r = hm.match_code("4560", candidates=["4561", "4562"])
    assert r.outcome == hm.AMBIGUOUS
    assert r.hull_code is None          # nothing is claimed
    assert not r.is_registered
    assert set(r.candidates) == {"4561", "4562"}


def test_far_read_is_unregistered_not_snapped():
    r = hm.match_code("7777", candidates=CANDIDATES)
    assert r.outcome == hm.UNREGISTERED
    assert r.hull_code == "7777"        # preserved verbatim for the audit trail
    assert not r.is_registered


def test_distance_two_is_never_corrected():
    # 2100 -> 2152 is two edits; the budget is one.
    r = hm.match_code("2100", candidates=["2152"])
    assert r.outcome == hm.UNREGISTERED


def test_unreadable_when_nothing_extractable():
    assert hm.match_reading("ABC", candidates=CANDIDATES).outcome == hm.UNREADABLE
    assert hm.match_reading(None, candidates=CANDIDATES).outcome == hm.UNREADABLE


def test_match_reading_goes_end_to_end():
    r = hm.match_reading("HD 215Z", candidates=CANDIDATES)
    assert r.outcome == hm.EXACT      # Z->2 repair lands it exactly on 2152
    assert r.hull_code == "2152"


# --- display resolution ------------------------------------------------------

def test_display_hull_uses_the_master_format(edge_master_truck):
    """A registered read stores the operator's own 'HD ####' form."""
    assert hm.resolve_display_hull("2152") == "HD 2152"
    assert hm.resolve_display_hull("HD 2152") == "HD 2152"


def test_display_hull_is_unknown_when_unresolved(edge_master_truck):
    """Anything not confidently registered uses the existing UNKNOWN sentinel.

    UNKNOWN is already in UNIDENTIFIED_HULLS, so the dataset layer treats these
    as unidentified without needing to learn a new value.
    """
    from app.core.config import UNIDENTIFIED_HULLS

    for reading in ("7777", "ABC", None, ""):
        assert hm.resolve_display_hull(reading) in UNIDENTIFIED_HULLS


@pytest.fixture
def edge_master_truck():
    """Guarantee 'HD 2152' exists in the master for display-resolution tests."""
    from app.repositories import truck_master_repo

    if truck_master_repo.get_by_hull_code("2152") is None:
        truck_master_repo.upsert_many([{
            "hull_id": "HD 2152", "hull_code": "2152", "contractor": "PYTEST",
            "unit_type": "OHT", "brand": "CATERPILLAR", "model_type": "773D",
            "year": 2018, "status": "Layak",
        }])
    yield
