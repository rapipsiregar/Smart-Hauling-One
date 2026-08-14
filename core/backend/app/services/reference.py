"""Reference-shaped read views for the Integrated Smart Hauling System frontend.

Everything here derives from the REAL dataset (``build_dataset`` +
``detections``/``runs``). No sensor telemetry or business targets are
fabricated; fields without a real source are simply omitted. Keys are camelCase
to match the frontend's TypeScript contract exactly.
"""

from __future__ import annotations

from app.core.config import RECONCILE_THRESHOLD
from app.repositories.video_results_repo import detections_by_video, run_meta
from app.services.cctv import build_cctv_detections  # re-exported; see routers
from app.services.dataset import build_dataset, filter_by_camera
from app.services.ritase import build_ritase

__all__ = [
    "build_crossings",
    "build_fleet",
    "build_performance_kpis",
    "build_shift_report",
    "build_ritase_report",
    "build_cctv_detections",
]


# --- Crossings ---------------------------------------------------------------

def build_crossings(
    camera_code: str | None = None, camera_id: int | None = None
) -> list[dict]:
    ds = build_dataset()
    meta = run_meta()
    det_map = detections_by_video()
    crossings: list[dict] = []
    for c in ds["crossings"]:
        video = c["video"]
        ocr_reads = len(det_map.get(video, {}).get("reads", []))
        reconciled = bool(c["known"] and c["confidence"] >= RECONCILE_THRESHOLD)
        crossings.append({
            "id": c["id"],
            "hullId": c["hull_id"],
            "confidence": c["confidence"],
            "video": video,
            "lane": c["lane"],
            "direction": c["direction"],
            "cameraId": c.get("camera_id"),
            "cameraCode": c.get("camera_code"),
            "cameraName": c.get("camera_name"),
            "rtspUrl": c.get("rtsp_url"),
            "reads": c["reads"],
            "frames": c["frames"],
            "known": c["known"],
            # known = "a number was read". registered = "that number is a unit in
            # the master". They come apart for a truck that is genuinely on site
            # but missing from the operator's spreadsheet, which the system now
            # records rather than discards -- so the UI has to be able to tell
            # them apart and label the second case.
            "registered": c["registered"],
            "isReconciled": reconciled,
            "reconciledBy": "auto-match@smartgate" if reconciled else None,
            "ocrReads": ocr_reads,
            "imageProofUrl": c["snapshot"],
            "contextImageUrl": c["annotated_video"],
            # When the truck actually crossed the gate — null until a real time
            # source supplies it. Distinct from processedAt, which is when the
            # detection run happened and is the same for every crossing.
            "crossedAt": c.get("crossed_at"),
            "processedAt": meta["timestamp"],
            "modelType": c.get("model_type"),
            "unitType": c.get("unit_type"),
            "contractor": c.get("contractor"),
        })
    return filter_by_camera(crossings, camera_code, camera_id)


# --- Fleet -------------------------------------------------------------------

def build_fleet(
    camera_code: str | None = None, camera_id: int | None = None
) -> list[dict]:
    ds = build_dataset()
    meta = run_meta()
    seen: dict[str, list[str]] = {}
    for c in ds["crossings"]:
        if not c["known"]:
            continue
        label = c.get("camera_name") or c["lane"]
        bucket = seen.setdefault(c["hull_id"], [])
        if label and label not in bucket:
            bucket.append(label)
    fleet: list[dict] = []
    for f in ds["fleet"]:
        fleet.append({
            "id": f["hull_id"],
            "hullId": f["hull_id"],
            "status": f.get("status", "active"),
            "passages": f["passages"],
            "reads": f["reads"],
            "bestConf": f["best_conf"],
            "snapshot": f.get("snapshot"),
            "camerasSeen": seen.get(f["hull_id"], []),
            "lastActive": meta["timestamp"] if f["passages"] > 0 else None,
            "modelType": f.get("model_type"),
            "unitType": f.get("unit_type"),
            "contractor": f.get("contractor"),
        })

    if camera_code is not None or camera_id is not None:
        # Keep only trucks actually observed at the requested camera.
        seen_at = {
            c["hullId"] for c in build_crossings(camera_code, camera_id) if c["known"]
        }
        fleet = [f for f in fleet if f["hullId"] in seen_at]
    return fleet


# --- Performance KPIs (real aggregation) -------------------------------------

def build_performance_kpis() -> dict:
    crossings = build_crossings()
    kpis = build_dataset()["kpis"]
    per_gate: dict[str, dict] = {}
    for c in crossings:
        g = per_gate.setdefault(c["lane"], {"gate": c["lane"], "passages": 0, "identified": 0})
        g["passages"] += 1
        if c["known"]:
            g["identified"] += 1
    return {
        "totalPassages": len(crossings),
        "identified": kpis["identified"],
        "unknown": kpis["unknown"],
        "uniqueTrucks": kpis["unique_trucks"],
        "totalReads": kpis["total_reads"],
        "avgConfidence": kpis["avg_confidence"],
        "perGate": sorted(per_gate.values(), key=lambda x: x["gate"]),
    }



# --- Shift / daily report (real aggregation) ---------------------------------

def build_shift_report() -> dict:
    crossings = build_crossings()
    meta = run_meta()
    kpis = build_performance_kpis()
    ritase = build_ritase(crossings)
    reconciled = sum(1 for c in crossings if c["isReconciled"])
    per_truck = [
        {
            "hullId": h["hullId"],
            # Carried through to the exports. Without it the PDF and the
            # spreadsheet -- the artefacts that get signed and filed -- show a
            # truck the master has never heard of as though it were a fleet unit.
            # That is the one place the flag matters most, because the point of
            # flagging is to get somebody to add the unit to the master.
            "registered": h["registered"],
            "ritase": h["ritase"],
            "inCount": h["inCount"],
            "outCount": h["outCount"],
            "unpaired": h["unpaired"],
            "reads": h["reads"],
            "bestConf": h["bestConf"],
            "avgCycleSeconds": h["avgCycleSeconds"],
        }
        for h in ritase["perHull"]
    ]
    return {
        "date": meta["timestamp"].split("T")[0],
        "model": meta["model"],
        "totalPassages": len(crossings),
        # Headline figure is paired ritase, not raw gate passages.
        "totalRitase": ritase["totalRitase"],
        # Of the headline figure, how much was hauled by units the master does
        # not list. Reported alongside the total rather than folded into it: a
        # shift partly hauled by unknown trucks is a registry gap to go and
        # close, and the number is what prompts closing it.
        "unregisteredRitase": ritase["unregisteredRitase"],
        "unregisteredHulls": ritase["unregisteredHulls"],
        "totalCrossings": ritase["totalCrossings"],
        "unpairedCount": ritase["unpairedCount"],
        "pairingBasis": ritase["pairingBasis"],
        "hasCrossingTimes": ritase["hasCrossingTimes"],
        "identified": kpis["identified"],
        "unknown": kpis["unknown"],
        "reconciled": reconciled,
        "uniqueTrucks": kpis["uniqueTrucks"],
        "totalReads": kpis["totalReads"],
        "avgConfidence": kpis["avgConfidence"],
        "perGate": ritase["perGate"],
        "perTruck": per_truck,
        "unpaired": ritase["unpaired"],
    }


# --- Ritase (IN + OUT pairing) & Sync ----------------------------------------

def build_ritase_report(
    camera_code: str | None = None, camera_id: int | None = None
) -> dict:
    return build_ritase(build_crossings(camera_code=camera_code, camera_id=camera_id))


def sync_ritase(payload: dict) -> dict:
    import json
    import time
    from app.core.config import SYNC_LOG

    crossings = payload.get("crossings")
    count = len(crossings) if isinstance(crossings, list) else len(build_crossings())
    receipt = {
        "syncedAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "count": count,
        "source": payload.get("source", "Integrated Smart Hauling System"),
        "status": "success",
    }
    try:
        log = []
        if SYNC_LOG.exists():
            log = json.loads(SYNC_LOG.read_text(encoding="utf-8"))
        log.append(receipt)
        SYNC_LOG.write_text(json.dumps(log[-50:], indent=2), encoding="utf-8")
    except Exception as err:  # pragma: no cover - defensive
        print(f"reference: sync log write failed: {err}")
    return receipt
