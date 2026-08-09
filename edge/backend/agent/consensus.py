"""Window finalizer: consensus vote + best snapshot (SRS §3.3, §3.4).

The voting math is NOT reimplemented here. ``fuzzy_vote_distribution`` is the same
function the batch pipeline calls, so both pipelines agree bit-for-bit -- an
explicit success criterion in ``docs/edge-system/PRD.md`` §6.
"""

from __future__ import annotations

# vendor/ocr_utils.py is a verbatim copy of the core's
# labs/custom_model/ocr_utils.py, kept here so a device deploys without core/
# on disk. tests/test_vendor_sync.py asserts the two stay byte-identical -- if it
# fails, copy the core file across rather than editing this side.
from vendor.ocr_utils import _levenshtein, fuzzy_vote_distribution


def avg_ocr_conf_per_cluster(reads: list[dict], distribution: list[dict]) -> dict:
    """Mean OCR confidence per consensus cluster (SRS §3.3 step 3).

    ``fuzzy_vote_distribution`` does not expose cluster membership, so reads are
    re-associated by nearest representative. This is an approximation: two
    equidistant clusters can attract a read the original clustering placed
    elsewhere. It only ever affects this diagnostic field -- never the winning
    ``hull_id``, which comes straight from the shared function. Accepted in SRS
    §11 rather than modifying the shared clustering code.
    """
    if not distribution:
        return {}
    groups: dict[str, list[float]] = {d["id"]: [] for d in distribution}
    for read in reads:
        closest = min(distribution, key=lambda d: _levenshtein(read["text"], d["id"]))
        groups[closest["id"]].append(read.get("ocr_conf") or 0.0)
    return {
        cluster_id: (sum(values) / len(values) if values else 0.0)
        for cluster_id, values in groups.items()
    }


def pick_best_snapshot(
    reads: list[dict], distribution: list[dict], hull_id: str
) -> bytes | None:
    """Highest-weight read in the winning cluster; ties break to the latest.

    A later frame is more likely to be squarely framed and less motion-blurred as
    the truck aligns with the camera (SRS §3.4).
    """
    if not reads or not distribution:
        return None
    winners = [
        r for r in reads
        if min(distribution, key=lambda d: _levenshtein(r["text"], d["id"]))["id"] == hull_id
    ]
    if not winners:
        winners = reads
    best = max(winners, key=lambda r: (r["weight"], r["ts"]))
    return best.get("crop_jpeg")


def finalize_window(
    window_start_ts: float, window_end_ts: float, reads: list[dict]
) -> dict:
    """Turn a closed window's reads into a submittable crossing result.

    An empty window still produces a crossing (SRS §3.3 step 1): operators must
    see that a truck crossed even when it could not be identified. That mirrors
    the induk's own ``UNIDENTIFIED_HULLS`` sentinel handling.
    """
    duration = max(0.0, window_end_ts - window_start_ts)

    if not reads:
        return {
            "hull_id": "UNKNOWN",
            "confidence": 0.0,
            "read_count": 0,
            "votes": [],
            "window_sec": duration,
            "snapshot": None,
        }

    hull_id, confidence, distribution = fuzzy_vote_distribution(
        [(r["text"], r["weight"]) for r in reads]
    )
    per_cluster = avg_ocr_conf_per_cluster(reads, distribution)
    votes = [
        {
            "text": cluster["id"],
            "count": cluster["reads"],
            "avg_ocr_conf": round(per_cluster.get(cluster["id"], 0.0), 4),
        }
        for cluster in distribution
    ]
    return {
        "hull_id": hull_id,
        "confidence": confidence,
        "read_count": len(reads),
        "votes": votes,
        "window_sec": duration,
        "snapshot": pick_best_snapshot(reads, distribution, hull_id),
    }
