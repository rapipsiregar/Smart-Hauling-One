"""OCR extraction, crop padding, hull-ID normalization, and fuzzy consensus voting."""

from __future__ import annotations

import re
import sys
from collections import Counter, defaultdict

import cv2
import numpy as np


def extract_text_from_ocr_result(ocr_json: dict) -> tuple[str, float]:
    """Extract text and mean confidence from a PaddleOCR-VL result dict."""
    blocks = ocr_json.get("res", {}).get("parsing_res_list", [])
    texts, confidences = [], []
    for block in blocks:
        content = block.get("block_content", "").strip()
        if content:
            texts.append(content)
            conf = block.get("confidence", 0.9)
            confidences.append(float(conf) if isinstance(conf, (int, float)) else 0.9)
    text = " ".join(texts).strip()
    avg_conf = sum(confidences) / len(confidences) if confidences else 0.0
    return text, avg_conf


def pad_crop(frame: np.ndarray, x0: int, y0: int, x1: int, y1: int, pad: float = 0.15) -> np.ndarray:
    """Crop bbox with proportional padding so edge characters are not clipped (#10)."""
    h, w = frame.shape[:2]
    bw, bh = x1 - x0, y1 - y0
    px, py = int(bw * pad), int(bh * pad)
    cx0, cy0 = max(0, x0 - px), max(0, y0 - py)
    cx1, cy1 = min(w, x1 + px), min(h, y1 + py)
    return frame[cy0:cy1, cx0:cx1]


def run_ocr_on_crop(crop: np.ndarray, pipeline) -> tuple[str, float]:
    """Run PaddleOCR-VL directly on an in-memory numpy crop (no temp file, #4)."""
    try:
        # PaddleOCR-VL accepts numpy arrays (BGR) directly; avoids disk I/O per crop.
        output = pipeline.predict(crop, use_layout_detection=False, prompt_label="ocr")
        for result in output:
            return extract_text_from_ocr_result(result.json)
        return "", 0.0
    except Exception as e:
        print(f"OCR error: {e}", file=sys.stderr)
        return "", 0.0


def normalize_hull_id(text: str) -> str:
    """Normalize OCR text to a canonical hull ID.

    Position-aware: only maps optical confusions inside the DT-number segment,
    leaving alphanumeric fleet codes (830E, C1F-X, 5600) intact (#9).
    """
    text = text.upper().strip()
    text = re.sub(r"\s+", "", text)

    # DT-format plates: force digits in the numeric group only.
    m = re.search(r"D[T7][-\s]?([0-9OISB]{2,4})", text)
    if m:
        digits = (m.group(1)
                  .replace("O", "0").replace("I", "1")
                  .replace("S", "5").replace("B", "8"))
        return f"DT-{digits}"

    # Non-DT fleet code: keep as-is, just strip stray punctuation.
    cleaned = re.sub(r"[^A-Z0-9\-]", "", text)
    return cleaned if cleaned else "UNKNOWN"


def _levenshtein(a: str, b: str) -> int:
    """Edit distance between two short strings."""
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


def fuzzy_vote(candidates: list[tuple[str, float]], max_dist: int = 1) -> tuple[str, float]:
    """Consensus vote with fuzzy clustering + confidence weighting (#7/#8).

    candidates: list of (normalized_text, weight). Near-identical readings
    (edit distance <= max_dist) merge into one cluster. Winner = highest total
    weight; representative = highest-weight member of the winning cluster.
    """
    if not candidates:
        return "UNKNOWN", 0.0

    clusters: list[dict] = []
    for text, weight in candidates:
        placed = False
        for cl in clusters:
            if _levenshtein(text, cl["rep"]) <= max_dist:
                cl["weight"] += weight
                cl["members"][text] += weight
                # promote most-weighted member as representative
                cl["rep"] = max(cl["members"].items(), key=lambda kv: kv[1])[0]
                placed = True
                break
        if not placed:
            clusters.append({
                "rep": text,
                "weight": weight,
                "members": defaultdict(float, {text: weight}),
            })

    best = max(clusters, key=lambda c: c["weight"])
    total = sum(c["weight"] for c in clusters) or 1.0
    return best["rep"], round(best["weight"] / total, 4)

def fuzzy_vote_distribution(
    candidates: list[tuple[str, float]], max_dist: int = 1
) -> tuple[str, float, list[dict]]:
    """Like ``fuzzy_vote`` but also returns the full ranked candidate distribution.

    Returns ``(winner_id, winner_share, distribution)`` where ``distribution`` is a
    list of dicts sorted by weight desc::

        {"id": str, "weight": float, "reads": int, "share": float, "winner": bool}

    ``share`` is the cluster's fraction of total weight (0..1). This surfaces the
    consensus voting so the UI can show *why* a hull ID was chosen.
    """
    if not candidates:
        return "UNKNOWN", 0.0, []

    clusters: list[dict] = []
    for text, weight in candidates:
        placed = False
        for cl in clusters:
            if _levenshtein(text, cl["rep"]) <= max_dist:
                cl["weight"] += weight
                cl["reads"] += 1
                cl["members"][text] += weight
                cl["rep"] = max(cl["members"].items(), key=lambda kv: kv[1])[0]
                placed = True
                break
        if not placed:
            clusters.append({
                "rep": text,
                "weight": weight,
                "reads": 1,
                "members": defaultdict(float, {text: weight}),
            })

    total = sum(c["weight"] for c in clusters) or 1.0
    best = max(clusters, key=lambda c: c["weight"])
    clusters.sort(key=lambda c: c["weight"], reverse=True)

    distribution = [
        {
            "id": c["rep"],
            "weight": round(c["weight"], 4),
            "reads": c["reads"],
            "share": round(c["weight"] / total, 4),
            "winner": c is best,
        }
        for c in clusters
    ]
    return best["rep"], round(best["weight"] / total, 4), distribution
