"""Engine selection, and the adapter that keeps vendor/ocr_utils.py untouched."""

from __future__ import annotations

import pytest

from agent import ocr_backends
from vendor.ocr_utils import extract_text_from_ocr_result


def test_default_is_the_small_engine() -> None:
    """A Jetson behind Starlink cannot afford 1.8 GB of weights as a default."""
    assert ocr_backends.DEFAULT_BACKEND == "ppocrv6-tiny"
    assert ocr_backends.resolve_backend(None) == "ppocrv6-tiny"


def test_env_selects_the_engine(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SMART_GATE_OCR_BACKEND", "paddleocr-vl")
    assert ocr_backends.resolve_backend() == "paddleocr-vl"


def test_explicit_argument_beats_the_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SMART_GATE_OCR_BACKEND", "paddleocr-vl")
    assert ocr_backends.resolve_backend("ppocrv6-tiny") == "ppocrv6-tiny"


def test_an_unknown_name_falls_back_instead_of_crashing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A typo in a device's env file must not take detection offline -- that is
    a failure nobody can recover from at the gate."""
    monkeypatch.setenv("SMART_GATE_OCR_BACKEND", "ppocrv7-imaginary")
    assert ocr_backends.resolve_backend() == ocr_backends.DEFAULT_BACKEND


def test_adapter_result_is_readable_by_the_shared_helper() -> None:
    """The contract that lets vendor/ocr_utils.py stay byte-identical to core's.

    If this breaks, every reading on the device silently becomes empty.
    """
    result = ocr_backends._RecResult("2152", 0.97)
    text, conf = extract_text_from_ocr_result(result.json)

    assert text == "2152"
    assert conf == pytest.approx(0.97)


def test_adapter_presents_paddleocr_vls_call_signature() -> None:
    """run_ocr_on_crop passes VL-only kwargs; a recogniser must accept and ignore
    them rather than raise TypeError."""

    class FakeRec:
        def predict(self, crop):
            return [type("R", (), {"json": {"res": {"rec_text": "830E",
                                                    "rec_score": 0.88}}})()]

    pipeline = ocr_backends.PPOCRv6Pipeline.__new__(ocr_backends.PPOCRv6Pipeline)
    pipeline._rec = FakeRec()

    out = pipeline.predict(object(), use_layout_detection=False, prompt_label="ocr")
    text, conf = extract_text_from_ocr_result(out[0].json)
    assert text == "830E"
    assert conf == pytest.approx(0.88)


def test_adapter_drops_empty_recognitions() -> None:
    """An empty string is "read nothing", which run_ocr_on_crop reports as ("", 0.0)
    -- not as a block of whitespace that would join a vote."""

    class FakeRec:
        def predict(self, crop):
            return [type("R", (), {"json": {"res": {"rec_text": "  ",
                                                    "rec_score": 0.1}}})()]

    pipeline = ocr_backends.PPOCRv6Pipeline.__new__(ocr_backends.PPOCRv6Pipeline)
    pipeline._rec = FakeRec()

    assert pipeline.predict(object()) == []
