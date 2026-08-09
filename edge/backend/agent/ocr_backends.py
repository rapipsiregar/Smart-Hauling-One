"""Selectable OCR engines behind one interface.

``vendor/ocr_utils.py`` must stay byte-identical to the core's copy
(tests/test_vendor_sync.py), so it can only ever call one shape of OCR object:

    pipeline.predict(crop, use_layout_detection=False, prompt_label="ocr")
      -> iterable of objects with a ``.json`` of
         {"res": {"parsing_res_list": [{"block_content": str, "confidence": float}]}}

That shape is PaddleOCR-VL's. Anything else has to be adapted to it here rather
than by loosening the shared helper -- which is why this module exists.

Two engines, and the choice is a real one:

``paddleocr-vl``  PaddleOCR-VL 1.6, a 0.9B vision-language model. 1.8 GB of
                  weights, ~0.5 s per crop on a desktop GPU. Reads degraded
                  plates that the small model gives up on.
``ppocrv6-tiny``  PP-OCRv6 tiny recogniser. 4.5 MB, ~57 ms per crop on CPU.
                  Recognition only -- no detector, because YOLO has already
                  found the panel and handed us the crop.

The gate runs on a Jetson Orin Nano Super behind a Starlink link with no other
connectivity, so 1.8 GB of first-run download and the storage to keep it is not
a detail (docs/sample-references/enhancement.md). ``ppocrv6-tiny`` is the
default for that reason; SMART_GATE_OCR_BACKEND overrides it.
"""

from __future__ import annotations

import os

DEFAULT_BACKEND = "ppocrv6-tiny"
BACKENDS = ("ppocrv6-tiny", "ppocrv6-small", "ppocrv6-medium", "paddleocr-vl")

# Which PaddleX recogniser each edge backend name maps to.
_REC_MODELS = {
    "ppocrv6-tiny": "PP-OCRv6_tiny_rec",
    "ppocrv6-small": "PP-OCRv6_small_rec",
    "ppocrv6-medium": "PP-OCRv6_medium_rec",
}


class _RecResult:
    """One recognition, wearing PaddleOCR-VL's result shape.

    ``extract_text_from_ocr_result`` walks ``parsing_res_list`` and averages the
    per-block confidences. A recogniser returns exactly one text and one score,
    so this is a single-block list -- the average of one number is that number,
    and the shared helper needs no special case.
    """

    __slots__ = ("_text", "_score")

    def __init__(self, text: str, score: float) -> None:
        self._text = text
        self._score = score

    @property
    def json(self) -> dict:
        return {
            "res": {
                "parsing_res_list": [
                    {"block_content": self._text, "confidence": self._score}
                ]
            }
        }


class PPOCRv6Pipeline:
    """PP-OCRv6 recognition, presented as a PaddleOCR-VL pipeline.

    Recognition only. The crop arriving here is already the hull-ID panel that
    YOLO located, padded by ``pad_crop`` -- running a text *detector* over it
    again would cost time to rediscover the box we were handed.
    """

    def __init__(self, model_name: str = "PP-OCRv6_tiny_rec", device: str = "cpu") -> None:
        from paddleocr import TextRecognition

        self.model_name = model_name
        # PaddleX wants "gpu"/"cpu", not torch's "cuda".
        self._rec = TextRecognition(
            model_name=model_name,
            device="gpu" if device.startswith(("cuda", "gpu")) else "cpu",
        )

    def predict(self, crop, use_layout_detection: bool = False, prompt_label: str = "ocr"):
        """Signature-compatible with PaddleOCRVL.predict; the extra kwargs are VL-only.

        They are accepted and ignored on purpose: the caller is the shared
        ``run_ocr_on_crop``, which cannot be changed to know which engine it holds.
        """
        results = []
        for raw in self._rec.predict(crop):
            res = raw.json.get("res", {})
            text = (res.get("rec_text") or "").strip()
            score = float(res.get("rec_score") or 0.0)
            if text:
                results.append(_RecResult(text, score))
        return results


def resolve_backend(name: str | None = None) -> str:
    """Which engine to build. Unknown names fall back rather than crash the thread.

    A typo in a device's env file must not take the gate's detection offline --
    it degrades to the default and says so, which is recoverable from the HUD.
    """
    requested = (name or os.environ.get("SMART_GATE_OCR_BACKEND") or DEFAULT_BACKEND).lower()
    if requested not in BACKENDS:
        print(f"ocr: unknown backend {requested!r}; using {DEFAULT_BACKEND}")
        return DEFAULT_BACKEND
    return requested


def build(backend: str | None = None, device: str = "cuda"):
    """Construct the selected OCR engine.

    Mirrors what ``agent/inference.py::build_ocr_pipeline`` used to do alone, so
    the batch and edge pipelines still agree on the VL settings when that engine
    is the one chosen (SRS §3.3).
    """
    backend = resolve_backend(backend)
    if backend == "paddleocr-vl":
        from paddleocr import PaddleOCRVL

        return PaddleOCRVL(
            pipeline_version="v1.6",
            engine="transformers",
            use_layout_detection=False,
            device="gpu" if device.startswith("cuda") else "cpu",
        )
    return PPOCRv6Pipeline(model_name=_REC_MODELS[backend], device=device)
