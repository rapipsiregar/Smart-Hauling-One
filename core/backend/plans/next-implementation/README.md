# Next Implementation — Edge-System Build

> **Status: all 12 sections executed and marked `[DONE]` (2026-08-02).** Backend suite: 101 passed
> / 18 failed, where those 18 are a pre-existing environmental baseline (an empty `data/` — the
> video files are gitignored — so tests that index `[0]` into a crossing list raise `IndexError`).
> With a single seeded row the suite goes to 117 passed / 2 failed. Edge suite: 26 passed.
> Kept as a record of what was built and why; see each section's Acceptance block.
>
> **Not done, deliberately:** the dashboard pages (PAGE-008/PAGE-009) live on the `frontend`
> branch, and `WhipPusher._push` in the edge agent is left `NotImplementedError` until a real
> media relay exists to develop it against.

Index for the edge-device build (`docs/edge-system/`). Each section below is its own file with
**complete, copy-paste-ready code** — the goal is that you never need to open the spec docs
mid-task. If you find yourself guessing, that's a bug in this plan; fix the plan, then continue.

**What is being built:** 4 mining gates, each with 1 CCTV camera + 1 NVIDIA Jetson Orin Nano Super
running YOLO+OCR detection *locally* and reporting consensus-voted hull-ID crossings to this
FastAPI backend ("induk"). Plus: a per-gate settings API, device health tracking, and on-demand
raw live video (never a detection overlay).

---

## Section files — execute in this order

| # | File | What it delivers | Depends on |
| :--- | :--- | :--- | :--- |
| 00 | [00-environment-setup.md](./00-environment-setup.md) | A working Python env + green baseline test run | — |
| 01 | [01-schema-foundations.md](./01-schema-foundations.md) | DB columns, config constants, `edge_repo`, camera-attribution fix | 00 |
| 02 | [02-device-auth.md](./02-device-auth.md) | API-key hashing, `authenticate_device` dependency, provisioning CLI | 01 |
| 03 | [03-edge-ingestion-api.md](./03-edge-ingestion-api.md) | `/api/edge/config`, `/heartbeat`, `/crossings` | 02 |
| 04 | [04-device-settings-api.md](./04-device-settings-api.md) | `/api/cameras/{code}/edge-config` GET+PUT, extended `GET /cameras` | 01 |
| 05 | [05-offline-sweep.md](./05-offline-sweep.md) | Background job flipping silent devices to `offline` | 01 |
| 06 | [06-live-view-orchestration.md](./06-live-view-orchestration.md) | Live session store + `/live/start\|heartbeat\|stop` + edge long-poll | 03 |
| 07 | [07-media-relay-infra.md](./07-media-relay-infra.md) | MediaMTX + coturn docker-compose scaffold | 06 |
| 08 | [08-tests-and-docs.md](./08-tests-and-docs.md) | Full test suite + doc/traceability updates | 03–07 |
| 09 | [09-edge-agent-scaffold.md](./09-edge-agent-scaffold.md) | `edge/` package, config, capture thread, backoff | 03 |
| 10 | [10-edge-agent-pipeline.md](./10-edge-agent-pipeline.md) | Detection Window state machine + consensus + snapshot | 09 |
| 11 | [11-edge-agent-sync.md](./11-edge-agent-sync.md) | Outbox, heartbeat client, live-view client, retention, entrypoint | 10 |

Sections 04 and 05 only need 01, so they can be done before 03 if you prefer — but the order above
is the recommended path (it gets one end-to-end data path working before branching out).

---

## Global rules — apply to every section

1. **400-line limit.** Any file exceeding 400 lines must be split into logical modules
   (`AGENTS.md` Code Quality Rules). Applies to files you create *and* files you touch.
2. **Run the tests after every section**: `uv run pytest tests/ -q`. Do not start the next section
   with a failing suite. Section 00 is what makes this command work at all.
3. **Never edit `sam3/`** — it's a git submodule.
4. **Never modify `labs/custom_model/ocr_utils.py`.** Both the batch pipeline and the new edge
   agent call it; `docs/edge-system/SRS.md` §3.3 is explicit that it stays byte-identical so the
   two pipelines can't silently drift apart in their voting math.
5. **Markdown links use relative paths** (`./`, `../`) — never absolute.
6. Update `docs/feature-list.md` §6 and `docs/test_execution_sheet.md` as you complete sections —
   Section 08 covers exactly what to change.

---

## Three things that will silently break if you don't know them

Read these before writing any code. Each has burned a previous attempt.

### A. `tests/test_response_contract.py` freezes exact response key sets

It asserts `set(item) == FROZEN_KEYS` — an **equality**, not a subset. Adding *any* new key to a
crossing/fleet/KPI response dict fails these tests instantly:

```python
DATASET_CROSSING_KEYS = {
    "id", "hull_id", "video", "confidence", "reads", "frames", "lane",
    "direction", "camera_id", "camera_code", "camera_name", "rtsp_url",
    "snapshot", "annotated_video", "known", "crossed_at",
}
```

**Consequence for this build:** the new `source` / `idempotency_key` / `votes_json` / `window_sec`
columns are stored in the DB and readable by future reports, but are **NOT** added to the crossing
response dicts in `app/services/dataset.py` or `app/services/reference.py`. If a future task
genuinely needs `source` on the wire, that task must update the frozen key set *and* the frontend
TypeScript type together — as that file's own docstring instructs. Not this build's job.

`GET /api/cameras` has **no** frozen-shape test, which is why Section 04 can add health fields to
it freely.

### B. There is no startup hook in `app/main.py`

`docs/feature-list.md` §1.12 describes an "Automatic Database Backup Scheduler" running as a
daemon thread at startup. **That code does not exist in this repo** — it's legacy documentation
from an earlier webapp iteration. `app/main.py::create_app()` currently has no `@app.on_event`, no
`lifespan=`, and no background threads.

**Consequence:** Section 05 must *create* the startup mechanism, not imitate an existing one. Do
not go looking for a pattern to copy in `app/main.py` — there isn't one. (The `threading.Thread`
calls in `app/services/jobs.py` and `batch_runs.py` are per-request job workers, a different thing
entirely.)

### C. Live sessions use `threading`, not `asyncio`

The obvious design for a long-poll is `asyncio.Future`. **Don't.** This codebase has no
`pytest-asyncio` in its dev dependencies, and nearly every route is a plain `def`. Mixing an
asyncio primitive into sync routes running in FastAPI's threadpool does not work correctly and
would be untestable without adding a new dependency.

Section 06 uses `threading.Event` with sync routes throughout. With only 4 devices, at most 4
long-poll requests are ever parked at once — trivial against FastAPI's default 40-thread pool.

---

## Key decisions already made — do not re-litigate

| # | Decision | Why |
| :--- | :--- | :--- |
| 1 | A "crossing" is a row in the existing **`video_results`** table — no new table | `docs/edge-system/SRS.md` §9 defers to "whatever backs `run_write_repo.py` today." There is no literal `crossings` table; `GET /api/crossings` is a computed view built by `dataset.py::build_dataset()`. |
| 2 | Device provisioning is a **CLI command**, not an HTTP endpoint | `docs/edge-system/API_CONTRACT.md` §5: "no `POST /edge/register` endpoint exists in this contract." SRS §7.3 describes manual, out-of-band key issuance. |
| 3 | **No auth** on the new dashboard-facing endpoints | `docs/edge-system/PRD.md` §3 Non-Goals: the spec "assumes a single trusted operator role... matching the existing app's current lack of auth on `/api/*`." Verified: no auth router or middleware exists. Only `/edge/*` is authenticated (per-device API key). |
| 4 | Edge snapshots are named `{video_stem}__edge.jpg` in `SNAPSHOT_DIR` | Makes them discoverable by the existing, unmodified `dataset.py::_snapshot_for()` glob (`{stem}__*.jpg`). Zero changes to the read path. |
| 5 | The edge agent lives in `backend/edge/` with its **own `pyproject.toml`** | Per SRS §10; it targets ARM64/JetPack, a different platform. Intended to become an independent repo later, so it must never `import app.*`. |
| 6 | The edge agent **may** import `labs/custom_model/ocr_utils.py` | Deliberate shared-code exception (SRS §10) — both pipelines must call the identical voting functions. |
| 7 | WHIP client library: **`aiortc`** | Pure-Python WebRTC, no native build step beyond its own wheel. For a 4-device fleet, deploy simplicity beats the encoder performance a GStreamer pipeline might win. |

---

## Scope boundaries — what this plan does NOT cover

- **Frontend UI.** PAGE-008 (`/settings/devices`) and PAGE-009 (`/live/[camera_code]`) live on the
  separate `frontend` git branch, not in this checkout. `docs/design_system.md` §7.9–7.11 specifies
  them; building them is a separate effort on that branch. `docs/feature-list.md` §6.5/6.6/6.7 stay
  `[PLANNED]` after this build.
- **Real relay deployment.** Section 07 scaffolds MediaMTX + coturn containers and config file
  shapes. Real TURN credentials, a public IP, and DNS are a live-deployment step this plan can't
  supply. Session orchestration is fully testable without them; actual video traversing cellular
  NAT is not.
- **Real hardware validation.** No Jetson, no RTSP camera, no TensorRT export in this environment.
  Sections 09–11 are verified against a mock induk + a video file standing in for the RTSP stream.
  `docs/test_plan.md` §2.2 puts "edge hardware deployment and field camera calibration" explicitly
  out of scope.
- **Footage retrieval endpoint** (`docs/edge-system/SRS.md` §7.2). No endpoint is defined in the
  API contract because the business owner hasn't chosen remote-pull vs. physical retrieval. Do not
  invent one.

---

## Open questions carried from `docs/edge-system/PRD.md` §8

These have safe proposed defaults already baked into the code this plan produces. They don't block
anything, but should be confirmed with the hardware owner before the fleet ships:

1. **Local video retention** — 7 days / evict under 10% free disk (Section 11). Confirm against the
   Jetsons' real storage.
2. **Camera stream protocol** — RTSP assumed throughout (the existing `Camera.rtsp_url` field
   implies it). Confirm against the 4 physical cameras' actual configuration.
3. **Outbox size ceiling** — 500 MB (Section 11). Confirm against real Jetson storage; it shares a
   disk with the video buffer from item 1.
