"""Pure hull-code extraction and fuzzy matching. No framework, no database.

This module is **duplicated verbatim** into ``edge/backend/vendor/hull_matching.py``
so each side of the system is deployable on its own. That duplication is a
deliberate architectural choice, and it carries an obvious hazard: the two copies
drifting apart would make the same truck resolve differently at the gate and at
the centre.

``tests/test_vendor_sync.py`` guards against exactly that by asserting the two
files are byte-identical. **If you change this file, copy it across and let that
test confirm it.**

Everything here is a pure function of its arguments -- candidates are passed in,
never queried -- which is what makes the file portable in the first place.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# Maximum edit distance tolerated between a read and a master code. 1 is a
# deliberate ceiling: at distance 2, 4-digit codes collide constantly.
MAX_FUZZY_DISTANCE = 1

# Outcomes, most to least confident.
EXACT = "exact"                # the read is a master code verbatim
FUZZY = "fuzzy"                # exactly one master code within MAX_FUZZY_DISTANCE
AMBIGUOUS = "ambiguous"        # several equally close -- refuse to guess
UNREGISTERED = "unregistered"  # a clean 4-digit read that is in no master row
UNREADABLE = "unreadable"      # no 4-digit code could be extracted at all

_FOUR_DIGITS = re.compile(r"(?<!\d)(\d{4})(?!\d)")
_ANY_DIGITS = re.compile(r"\d+")

# Optical confusions, applied only because this fleet's hulls are *purely
# numeric*: any letter inside the code is necessarily a misread digit.
_DIGIT_CONFUSIONS = str.maketrans({
    "O": "0", "Q": "0", "D": "0",
    "I": "1", "L": "1", "|": "1",
    "Z": "2",
    "S": "5",
    "G": "6",
    "T": "7",
    "B": "8",
})


@dataclass(frozen=True)
class HullMatch:
    """The result of resolving one OCR reading."""

    outcome: str
    hull_code: str | None = None   # the 4 digits actually matched
    hull_id: str | None = None     # the master's display form, e.g. "HD 2152"
    raw_code: str | None = None    # what OCR read, before any correction
    distance: int = 0
    candidates: tuple[str, ...] = ()   # populated when AMBIGUOUS

    @property
    def is_registered(self) -> bool:
        return self.outcome in (EXACT, FUZZY)

    @property
    def was_corrected(self) -> bool:
        return self.outcome == FUZZY


def levenshtein(a: str, b: str) -> int:
    """Edit distance between two short strings.

    Mirrors ``custom_model.ocr_utils._levenshtein`` -- kept here so this module
    stays dependency-free and portable, which the vendored copy requires.
    """
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def extract_code(text: str | None) -> str | None:
    """Pull the 4-digit hull code out of a raw OCR reading.

    Handles the prefix/suffix noise a panel reading picks up: ``"HD 2152"``,
    ``"HD2152"``, ``"2152 CK"`` all yield ``"2152"``. Returns None when no
    unambiguous 4-digit run exists.
    """
    if not text:
        return None
    cleaned = str(text).upper()

    # Prefer a standalone 4-digit run -- the common, unambiguous case. Checked
    # before confusion-mapping so a clean reading is never touched.
    found = _FOUR_DIGITS.findall(cleaned)
    if len(found) == 1:
        return found[0]
    if len(found) > 1:
        # Several 4-digit runs (e.g. a year stencilled beside the hull number).
        # There is no principled way to pick one; refuse rather than guess.
        return None

    # No clean run: repair letters that are really misread digits ("215Z").
    repaired = cleaned.translate(_DIGIT_CONFUSIONS)
    found = _FOUR_DIGITS.findall(repaired)
    if len(found) == 1:
        return found[0]
    if len(found) > 1:
        return None

    # Last resort: OCR split the code across boxes ("21 52"). Accept only when
    # the digits present total exactly 4, so partial reads stay unreadable.
    digits = "".join(_ANY_DIGITS.findall(repaired))
    return digits if len(digits) == 4 else None


def match_code(hull_code: str | None, candidates: list[str]) -> HullMatch:
    """Resolve an extracted 4-digit code against a set of known master codes.

    A fuzzy correction is accepted **only when exactly one** candidate sits
    within the distance budget. Two equally-close candidates is not a 50/50
    guess; it is an unidentified read. The master codes are dense -- ``2152`` and
    ``2153`` are both real, different trucks -- so a nearest-wins matcher would
    silently credit one contractor's haul to another unit.

    ``hull_id`` is left None here; the caller resolves the display form from its
    own store, which is what keeps this function free of any database.
    """
    if not hull_code:
        return HullMatch(outcome=UNREADABLE)

    known = set(candidates)

    if hull_code in known:
        return HullMatch(outcome=EXACT, hull_code=hull_code, raw_code=hull_code)

    near = [(levenshtein(hull_code, c), c) for c in known]
    near = [(d, c) for d, c in near if d <= MAX_FUZZY_DISTANCE]

    if not near:
        return HullMatch(outcome=UNREGISTERED, hull_code=hull_code, raw_code=hull_code)

    best_distance = min(d for d, _ in near)
    closest = sorted(c for d, c in near if d == best_distance)

    if len(closest) > 1:
        return HullMatch(
            outcome=AMBIGUOUS,
            raw_code=hull_code,
            distance=best_distance,
            candidates=tuple(closest),
        )

    return HullMatch(
        outcome=FUZZY,
        hull_code=closest[0],
        raw_code=hull_code,
        distance=best_distance,
    )


def match_reading(text: str | None, candidates: list[str]) -> HullMatch:
    """Extract a 4-digit code from raw OCR text, then resolve it."""
    return match_code(extract_code(text), candidates)
