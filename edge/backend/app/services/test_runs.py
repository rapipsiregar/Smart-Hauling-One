"""On-device test runs: push recorded clips through the real detection chain.

This is the OCR Inspection HUD's engine, and it lives HERE rather than on the
core deliberately. The gate is what detects; the core only receives what the
gate decided. A test bench on the core could only ever exercise a second,
parallel implementation -- which is precisely the drift the vendored copies and
tests/test_vendor_sync.py exist to prevent.

Every stage below is the shipped code, not a rehearsal of it:

    InferenceLoop._detect         YOLO, same conf threshold as live
    DetectionWindow               the SRS §3.2 state machine, unmodified
    finalize_window               the shared consensus vote
    local_matcher.match_reading   matching against the replicated master
    Outbox                        the same durable queue live crossings use

One deviation, and it is the honest one: the window's clock advances with video
time (frame index / fps) rather than wall time. A recorded clip is not paced by
a camera, and on a CPU-only box an OCR call costs far more than the ocr_fps
budget, so wall-clock pacing would drop nearly every frame and measure the host
instead of the pipeline. Throughput is a separate question with its own answer.
"""

from __future__ import annotations

import json
import queue as queuelib
import threading
import time
import uuid
from collections import deque
from datetime import datetime, timezone
from pathlib import Path

from app import store
from app.services import clip_sources, local_matcher

ACTIVE_STATUSES = ("queued", "running")

# How many recent OCR attempts the live feed carries. Enough to show the reading
# settling on an answer, short enough that pushing it on every publish stays cheap.
FEED_LENGTH = 10

# How long the end of a clip waits for OCR still in the queue. Generous, because
# unlike the live loop nothing else is competing for the device by then -- and
# discarding those readings would throw away the samples the vote is made of.
OCR_DRAIN_TIMEOUT_SEC = 30.0

# Track ids are handed out per clip and shared with the live loop's numbering
# only in format, not in sequence -- a run and a camera never drive the HUD at
# the same time, since a run needs the device's one OCR pool.
_TRACK_SEQ = [1000]


def _next_track_id() -> int:
    with _LOCK:
        _TRACK_SEQ[0] += 1
        return _TRACK_SEQ[0]

_RUNS: dict[str, dict] = {}
_ORDER: list[str] = []
_CANCEL: dict[str, bool] = {}
# Readings and OCR attempts summed per run, so the HUD can show a total that
# keeps climbing rather than restarting with every clip.
_RUN_TOTALS: dict[str, dict] = {}
_LOCK = threading.RLock()

# Loading YOLO plus the OCR pipeline takes the better part of a minute on CPU.
# Held across runs so only the first one pays for it.
_ENGINE: dict = {}
_ENGINE_LOCK = threading.Lock()


class RunBusy(RuntimeError):
    """Raised when a run is requested while another is still active."""


def _now() -> str:
    return datetime.now().isoformat(timespec="seconds")


def _snapshot(run: dict) -> dict:
    copy = dict(run)
    copy["items"] = [dict(i) for i in run["items"]]
    copy["progress"] = dict(run["progress"]) if run.get("progress") else None
    copy["current"] = dict(run["current"]) if run.get("current") else None
    return copy


def get_run(run_id: str) -> dict | None:
    with _LOCK:
        run = _RUNS.get(run_id)
        return _snapshot(run) if run else None


def active_run() -> dict | None:
    with _LOCK:
        for rid in reversed(_ORDER):
            run = _RUNS.get(rid)
            if run and run["status"] in ACTIVE_STATUSES:
                return _snapshot(run)
    return None


def latest_run() -> dict | None:
    with _LOCK:
        return _snapshot(_RUNS[_ORDER[-1]]) if _ORDER else None


def cancel_run(run_id: str) -> bool:
    with _LOCK:
        run = _RUNS.get(run_id)
        if run is None or run["status"] not in ACTIVE_STATUSES:
            return False
        _CANCEL[run_id] = True
        run["message"] = "Berhenti setelah klip yang sedang diproses selesai..."
    return True


def _set_run(run_id: str, **fields) -> None:
    with _LOCK:
        if run_id in _RUNS:
            _RUNS[run_id].update(fields)


def _set_item(run_id: str, index: int, **fields) -> None:
    with _LOCK:
        run = _RUNS.get(run_id)
        if run and 0 <= index < len(run["items"]):
            run["items"][index].update(fields)


# --- the engine ---------------------------------------------------------------

def _engine():
    """YOLO + OCR + the window machine + the delivery queue, built once and reused.

    The outbox and its sender are part of this on purpose. A reading that never
    leaves the device is only half the job: the gate detects, then the result
    travels to the core. Running a test through the UI has to exercise that whole
    path, or it proves something narrower than it appears to.
    """
    with _ENGINE_LOCK:
        if _ENGINE:
            return _ENGINE
        from agent.config import Settings, TunableStore, Tunables
        from agent.induk_client import IndukClient
        from agent.inference import InferenceLoop
        from agent.ocr_worker import OcrPool
        from agent.outbox import Outbox, OutboxSender

        settings = Settings.from_env()
        loop = InferenceLoop(
            ring=None,
            tunables=TunableStore(Tunables()),
            finalizer_queue=queuelib.Queue(),
            settings=settings,
        )
        loop._load_models()

        # The same pool the live loop uses, for the same reason: recognition must
        # not sit on the thread that is decoding frames. Held on the engine so
        # its workers and their loaded model outlive a single run.
        ocr_pool = OcrPool(loop._ocr, queue_size=8)
        ocr_pool.start()

        client = IndukClient(settings)
        outbox = Outbox(settings)
        sender = OutboxSender(outbox, client, on_delivered=store.mark_synced)
        sender.start()
        _sync_master(client)
        _sync_core_contact(client)
        _ENGINE.update(loop=loop, settings=settings, outbox=outbox, sender=sender,
                       ocr_pool=ocr_pool)
        return _ENGINE


def _sync_master(client) -> None:
    """Make sure the local roster is current before matching against it.

    A device that has never synced holds no trucks, so every reading resolves to
    UNKNOWN however well the OCR did -- the pipeline looks broken when only the
    roster is missing. The agent's MasterSync does this on boot; a run started
    from the UI on a device with the agent disabled has to do it too.

    Failure is not fatal: the existing replica is still the best answer available,
    and refusing to run because the core is unreachable would defeat the point of
    a gate that works offline.
    """
    try:
        payload = client.get_master(known_version=store.master_version())
        if payload.get("changed"):
            stored = store.replace_master(payload["trucks"], payload["master_version"])
            print(f"test-run: master replica updated -> {stored} units")
    except Exception as err:
        print(f"test-run: master sync failed ({err}); using the local replica")


def _sync_core_contact(client) -> None:
    """Note that the core answered, for /status's core_reachable fallback.

    A run started from the UI is the same round trip the agent's own boot-time
    config fetch makes, so it doubles as a reachability probe when the agent
    itself is not running.
    """
    try:
        client.get_config()
        clip_sources.remember_core_contact()
    except Exception as err:
        print(f"test-run: could not reach the core ({err})")


def engine_ready() -> bool:
    return bool(_ENGINE)


def _process_clip(run_id: str, clip: Path, tunables) -> tuple[list[tuple], int, int]:
    """Run one clip through the window machine. Returns the closed windows.

    OCR is asynchronous here for the same reason it is in the live loop: a
    recogniser called inline blocks frame decoding, so the console freezes on one
    image for the length of every reading instead of showing the clip playing
    with boxes tracking the truck. The window machine is still driven from this
    thread alone; readings come back through the pool's queue.
    """
    import cv2

    from agent.annotate import annotated_jpeg
    from agent.inference import _primary_box
    from agent.live_state import LIVE
    from agent.ocr_worker import OcrJob
    from agent.config import inbound_axis_from_env
    from agent.pipeline import DetectionWindow
    from vendor.ocr_utils import fuzzy_vote_distribution, pad_crop

    engine = _engine()
    loop = engine["loop"]
    pool = engine["ocr_pool"]
    # Same mounting geometry the live loop uses -- a bench that assumed the
    # default axis would report every replayed clip's direction backwards on a
    # right-to-left gate, which is exactly the discrepancy this bench exists to
    # catch rather than introduce.
    window = DetectionWindow(
        tunables, queuelib.Queue(), inbound_axis=inbound_axis_from_env()
    )

    closed: list = []
    window._queue.put = closed.append   # collect instead of handing to a thread

    capture = cv2.VideoCapture(str(clip))
    fps = capture.get(cv2.CAP_PROP_FPS) or 24.0
    frames_total = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)

    frame_index = 0
    ocr_reads = 0
    reads: list[tuple[str, float]] = []
    # The last few OCR attempts, newest last, for the live feed on screen. A run
    # is otherwise silent for tens of seconds and then produces an answer, which
    # is indistinguishable from a hang. Bounded because this is pushed on every
    # publish, and nobody reads more than the last handful.
    feed: deque[dict] = deque(maxlen=FEED_LENGTH)

    track_id = _next_track_id()
    crop_index = 0
    inflight = 0
    LIVE.open_track(track_id)
    wall_start = time.time()

    def drain() -> int:
        """Fold finished readings in. Returns how many jobs came back."""
        nonlocal ocr_reads, inflight
        results = pool.drain()
        for result in results:
            job = result.job
            inflight = max(0, inflight - 1)
            ocr_reads += 1
            LIVE.add_crop(
                job.track_id, crop_index=job.crop_index, jpeg=result.crop_jpeg,
                text=result.text, raw=result.raw, ocr_conf=result.ocr_conf,
                det_conf=job.det_conf, frame=job.frame_index,
            )
            feed.append({
                "frame": job.frame_index,
                "text": result.text,
                "raw": result.raw,
                "ocr_conf": round(result.ocr_conf or 0.0, 3),
                "det_conf": round(job.det_conf, 3),
            })
            if result.text is None:
                continue
            weight = job.det_conf * (result.ocr_conf or 0.5)
            reads.append((result.text, weight))
            window.record_read(
                text=result.text, weight=weight, det_conf=job.det_conf,
                ocr_conf=result.ocr_conf or 0.0, now=job.ts, crop_jpeg=result.crop_jpeg,
            )
            voted, share, distribution = fuzzy_vote_distribution(list(reads))
            LIVE.update_votes(job.track_id, voted, share, distribution)
        if results:
            _publish(run_id, frame_index, frames_total, reads, ocr_reads, feed)
        return len(results)

    while not _CANCEL.get(run_id):
        ok, frame = capture.read()
        if not ok:
            break
        now = frame_index / fps
        frame_index += 1
        drain()

        # Play the clip at its own speed. The window's clock stays on video time
        # (see the module docstring), but the *display* has to look like a lane
        # with a truck crossing it, not a slideshow that jumps whenever the host
        # happens to be free.
        lag = now - (time.time() - wall_start)
        if lag > 0:
            time.sleep(min(lag, 0.25))

        if frame_index % 2 == 0 or frame_index == frames_total:
            _publish(run_id, frame_index, frames_total, reads, ocr_reads, feed)

        if not window.should_run_yolo(now):
            continue
        boxes = loop._detect(frame)
        # Published before OCR is queued: boxes must never wait on a reading.
        LIVE.publish_frame(
            annotated_jpeg(frame, boxes, detail=False),
            boxes, source=clip.name,
            detail_jpeg=(
                annotated_jpeg(frame, boxes, track_id=track_id if boxes else None,
                               detail=True)
                if LIVE.detail_wanted() else None
            ),
        )
        if not window.begin_frame(bool(boxes), now):
            continue

        if boxes:
            # The virtual-center-line trajectory this bench has to exercise too
            # (module docstring: "shipped code, not a rehearsal of it") --
            # without this every window here reports direction=None regardless
            # of which way the truck actually crossed in the clip.
            window.note_position(_primary_box(boxes), frame.shape[1])

        for box in boxes:
            if not window.wants_ocr(box, now):
                continue
            window.note_ocr(box, now)
            crop = pad_crop(
                frame, int(box["x0"]), int(box["y0"]), int(box["x1"]), int(box["y1"])
            )
            if crop.size == 0:
                continue
            crop_index += 1
            if pool.submit(OcrJob(
                track_id=track_id, crop_index=crop_index, crop=crop.copy(),
                det_conf=box["conf"], frame_index=frame_index, ts=now,
            )):
                inflight += 1
                LIVE.note_ocr_queued(track_id)

        window.end_frame(now)

    capture.release()
    # Let the queue empty before the vote is counted. Without this the clip ends,
    # the window closes on whatever had come back so far, and a slow recogniser
    # turns every run into "tidak ada truk terdeteksi".
    deadline = time.time() + OCR_DRAIN_TIMEOUT_SEC
    while inflight > 0 and time.time() < deadline and not _CANCEL.get(run_id):
        if not drain():
            time.sleep(0.05)

    # The clip ran out; close whatever is still open, as the grace period would.
    if window.state != "IDLE" and window.window_start_ts is not None:
        window._close_window(frame_index / fps)
    # The track is left open here on purpose: the caller resolves the vote
    # against the master and closes it with the hull id, so the HUD's card goes
    # straight from "scanning" to a named truck rather than blanking in between.
    return closed, len(reads), ocr_reads, track_id


def _publish(run_id: str, scanned: int, total: int, reads, ocr_reads: int, feed=()) -> None:
    """Push the vote as it currently stands to whoever is watching the HUD.

    Carries two different things, and the distinction matters on screen:

    * the CLIP figures -- this truck's vote, its candidates, its frame count.
      Voting across different trucks would be meaningless, so these are per-clip
      by necessity and reset when the next clip starts.
    * the RUN totals -- readings and OCR attempts summed over every clip so far.
      These only ever climb, so the panel still shows what a multi-clip run has
      achieved instead of dropping back to zero between clips.
    """
    from vendor.ocr_utils import fuzzy_vote_distribution

    voted, share, distribution = fuzzy_vote_distribution(list(reads))
    with _LOCK:
        totals = _RUN_TOTALS.setdefault(run_id, {"reads": 0, "ocr_reads": 0})
        run_reads = totals["reads"] + len(reads)
        run_ocr = totals["ocr_reads"] + ocr_reads
    _set_run(run_id, progress={
        "voted_hull_id": voted,
        "vote_confidence": share,
        "frames_scanned": scanned,
        "frames_total": total,
        "reads": len(reads),
        "ocr_reads": ocr_reads,
        "total_reads": run_reads,
        "total_ocr_reads": run_ocr,
        "distribution": distribution,
        "feed": list(feed),
    })


def _bank_clip_totals(run_id: str, reads: int, ocr_reads: int) -> None:
    """Fold a finished clip's counts into the run total before the next starts."""
    with _LOCK:
        totals = _RUN_TOTALS.setdefault(run_id, {"reads": 0, "ocr_reads": 0})
        totals["reads"] += reads
        totals["ocr_reads"] += ocr_reads


def _resolve(window: tuple) -> dict:
    """Vote and match a closed window. Stores nothing.

    Split out from ``_record`` so a clip's windows can be compared *before* any
    of them becomes a crossing -- see ``select_crossings``.
    """
    from agent.consensus import finalize_window

    start_ts, end_ts, window_reads, direction = window
    result = finalize_window(start_ts, end_ts, window_reads)
    match = local_matcher.match_reading(result["hull_id"])
    return {
        "result": result,
        "match": match,
        "hull_id": match.hull_id if (match.is_registered and match.hull_id) else "UNKNOWN",
        "direction": direction,
    }


def select_crossings(resolved: list[dict]) -> list[dict]:
    """Pick which of a clip's windows become crossings.

    A clip is one truck passing, and these clips run about 8 s against a 6 s
    ``detect_window_sec`` -- so the cap closes a window mid-pass, the cooldown
    expires, and a second window opens on the same truck. Recording every window
    therefore filed one pass as several crossings, and that is not merely
    double-counting:

        the 2264 departure produced two windows. The first read 2264 correctly
        and, at the centre, took that truck out of the pit. The second misread it
        as 2254 -- and with 2264 no longer inside there was nothing left to match
        against, so a phantom "unregistered truck 2254" was recorded at full
        confidence.

    So: one crossing per distinct *registered* unit the clip identified. Windows
    that resolved to nobody are dropped when the clip identified someone, because
    they cannot be told apart from a misread of a truck already counted here.
    When nothing was identified at all, the strongest unresolved window is kept
    on its own -- that is how a genuinely unregistered truck still gets exactly
    one crossing instead of none.

    Live detection is untouched: there, one window really is one pass, and
    ``LocalFinalizer`` still records each as it closes.
    """
    def rank(entry: dict) -> tuple:
        return (
            entry["match"].outcome in ("exact", "fuzzy"),
            entry["result"]["read_count"],
            entry["result"]["confidence"],
        )

    identified: dict[str, dict] = {}
    for entry in resolved:
        if entry["hull_id"] == "UNKNOWN":
            continue
        current = identified.get(entry["hull_id"])
        if current is None or rank(entry) > rank(current):
            identified[entry["hull_id"]] = entry
    if identified:
        return [
            _with_observed_direction(entry, resolved)
            for entry in identified.values()
        ]

    unresolved = [e for e in resolved if e["result"]["read_count"] > 0]
    if not unresolved:
        return []
    return [_with_observed_direction(max(unresolved, key=rank), resolved)]


def _with_observed_direction(winner: dict, resolved: list[dict]) -> dict:
    """Carry a direction observed by the same truck's other windows.

    The winner is chosen by read count and confidence -- direction plays no part,
    and it should not, because the clearest reading of the plate is not
    necessarily the window that saw the truck move. On the reference footage the
    6 s cap splits one pass in two, and the trailing fragment routinely has the
    better reading while travelling too little to resolve a direction at all. The
    recorded crossing then had no direction, which is precisely what leaves a
    ritase unpaired.

    Both windows are the same truck on the same pass, so a direction seen by
    either is evidence about this crossing rather than a guess.

    When the windows DISAGREE the ambiguity is real -- a truck that reversed, or
    a second vehicle caught in the frame -- and None is kept. Picking a side
    there would be inventing the one fact the whole pairing depends on.
    """
    if winner.get("direction"):
        return winner

    seen = {
        entry["direction"]
        for entry in resolved
        if entry["hull_id"] == winner["hull_id"] and entry.get("direction")
    }
    if len(seen) != 1:
        return winner
    return {**winner, "direction": seen.pop()}


def _record(resolved: dict, camera_code: str, detected_at: str | None = None) -> dict:
    """Store a resolved window and queue it for the core, exactly as live does.

    Both halves, in the live order: the gate keeps its own record and its own
    crop, then the same result goes into the durable outbox. The sender drains it
    in the background and marks the row delivered, so the gate screen shows the
    crossing immediately and its delivery tick turns green once the core has it.
    """
    result = resolved["result"]
    match = resolved["match"]
    hull_id = resolved["hull_id"]
    detected_at = detected_at or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    payload = {
        "camera_code": camera_code,
        "detected_at": detected_at,
        "window_sec": round(result["window_sec"], 2),
        "hull_id": hull_id,
        # See agent_runner.LocalFinalizer: the digits travel even when this gate
        # could not name the unit.
        "raw_code": match.raw_code,
        "confidence": result["confidence"],
        "read_count": result["read_count"],
        "votes": result["votes"],
        # Same field the live loop reports (agent/pipeline.py
        # DetectionWindow.direction) -- this bench runs the shipped code, not a
        # rehearsal of it, so a test run has to exercise this too.
        "direction": resolved.get("direction"),
    }
    # The outbox mints the idempotency key, so the gate's own row and the one the
    # core stores are the same crossing rather than two records of one truck.
    key = _engine()["outbox"].enqueue(
        camera_code=camera_code, payload=payload, snapshot=result["snapshot"]
    )
    snapshot_path = store.save_snapshot(key, result["snapshot"])
    store.record_crossing(
        idempotency_key=key, hull_id=hull_id, raw_code=match.raw_code,
        match_outcome=match.outcome, confidence=result["confidence"],
        read_count=result["read_count"], window_sec=result["window_sec"],
        votes_json=json.dumps(result["votes"]), snapshot_path=snapshot_path,
        detected_at=detected_at,
    )
    return {
        "hullId": hull_id,
        "voted": result["hull_id"],
        "outcome": match.outcome,
        "confidence": result["confidence"],
        "reads": result["read_count"],
        "snapshot": snapshot_path,
    }


def _worker(run_id: str, clips: list[Path], camera_code: str) -> None:
    from agent.config import TunableStore, Tunables
    from agent.live_state import LIVE

    _set_run(run_id, status="running", message="Memuat model deteksi dan OCR...")
    try:
        _engine()
    except Exception as err:
        _set_run(run_id, status="error", finishedAt=_now(),
                 message=f"Gagal menyiapkan mesin deteksi: {err}")
        return

    settings = store_settings()
    tunables = TunableStore(Tunables(**settings))

    completed = failed = 0
    for index, clip in enumerate(clips):
        if _CANCEL.get(run_id):
            _set_item(run_id, index, status="cancelled",
                      message="Dihentikan operator.")
            continue
        _set_run(run_id, currentIndex=index, current={"name": clip.name},
                 message=f"Memproses {clip.name}")
        _set_item(run_id, index, status="processing")
        try:
            windows, clip_reads, clip_ocr, track_id = _process_clip(run_id, clip, tunables)
            _bank_clip_totals(run_id, clip_reads, clip_ocr)
            if not windows:
                LIVE.close_track(track_id)
                _set_item(run_id, index, status="unread", reads=0,
                          message="Tidak ada truk terdeteksi.")
            else:
                # A clip is one truck passing; its windows are repeat views of
                # that pass, so the strongest one is what the clip produced.
                #
                # The crossing is stamped with the time this gate actually read
                # it -- `_record` defaults to now -- not with the timestamp in
                # the clip's filename.
                #
                # The filename stamp was the honest-looking choice and it was
                # wrong. Replaying the same clip produced crossings identical in
                # time to the first run, so: two INs at the same instant paired
                # as one ritase and one orphan, and a truck read inbound a moment
                # ago still counted as outside because an OUT dated 2023 was
                # "more recent". Cycle time measured the gap between two
                # recordings from 2023 rather than between two readings.
                #
                # Now a run at 10:00 through the IN gate and 11:00 through the
                # OUT gate yields a one-hour cycle, which is what actually
                # happened here.
                detected_at = None
                selected = select_crossings([_resolve(w) for w in windows])
                if not selected:
                    LIVE.close_track(track_id)
                    _set_item(run_id, index, status="unread", reads=0,
                              message=f"Terdeteksi tapi tidak terbaca "
                                      f"({len(windows)} window)")
                    completed += 1
                    _set_run(run_id, completed=completed, failed=failed)
                    continue
                best = None
                for entry in selected:
                    outcome = _record(entry, camera_code, detected_at)
                    rank = (outcome["outcome"] in ("exact", "fuzzy"), outcome["reads"])
                    if best is None or rank > best[0]:
                        best = (rank, outcome)
                result = best[1]
                LIVE.close_track(
                    track_id, hull_id=result["hullId"], outcome=result["outcome"],
                    confidence=result["confidence"],
                )
                _set_item(
                    run_id, index,
                    status="done" if result["hullId"] != "UNKNOWN" else "unread",
                    hullId=result["hullId"], confidence=result["confidence"],
                    reads=result["reads"], snapshot=result["snapshot"],
                    message=f"{result['outcome']} "
                            f"({len(selected)} lintasan dari {len(windows)} window)",
                )
            completed += 1
        except Exception as err:
            failed += 1
            _set_item(run_id, index, status="error", message=f"Gagal: {err}")
        # progress is deliberately left standing: blanking it here made the
        # panel fall back to "MEMINDAI... 0%" between clips and at the end,
        # hiding what the run had just achieved.
        _set_run(run_id, completed=completed, failed=failed)

    cancelled = _CANCEL.get(run_id)
    _set_run(
        run_id,
        status="cancelled" if cancelled else ("error" if failed and not completed
                                              else "done"),
        finishedAt=_now(), current=None,
        message=("Dihentikan operator." if cancelled
                 else f"Selesai: {completed} klip, {failed} gagal."),
    )


def store_settings() -> dict:
    """The device's current tunables, so a test run uses the real settings."""
    defaults = {"yolo_fps": 20, "ocr_fps": 4, "detect_window_sec": 6,
                "ocr_min_conf": 0.30, "dedup_iou": 0.92}
    out = {}
    for key, default in defaults.items():
        raw = store.get_meta(f"setting_{key}")
        out[key] = default if raw is None else (
            float(raw) if isinstance(default, float) else int(float(raw))
        )
    return out


def start_run(clips: list[str] | None, camera_code: str) -> dict:
    """Queue the requested clips and start processing in the background."""
    if active_run() is not None:
        raise RunBusy(active_run()["id"])

    paths = clip_sources.resolve(clips)
    if not paths:
        raise ValueError("Tidak ada klip uji di perangkat ini.")

    run_id = "run_" + uuid.uuid4().hex[:10]
    run = {
        "id": run_id,
        "cameraCode": camera_code,
        "status": "queued",
        "message": "Menyiapkan...",
        "startedAt": _now(),
        "finishedAt": None,
        "total": len(paths),
        "completed": 0,
        "failed": 0,
        "currentIndex": 0,
        "current": None,
        "progress": None,
        "items": [
            {"name": p.name, "status": "queued", "hullId": None, "confidence": None,
             "reads": None, "snapshot": None, "message": ""}
            for p in paths
        ],
    }
    with _LOCK:
        _RUNS[run_id] = run
        _ORDER.append(run_id)
        _CANCEL[run_id] = False

    threading.Thread(
        target=_worker, args=(run_id, paths, camera_code), daemon=True
    ).start()
    return get_run(run_id) or run
