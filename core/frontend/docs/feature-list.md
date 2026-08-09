# Feature List

## Sidebar Navigation

### Flat, grouped menu
Every page is its own row — nothing is nested behind an expander, so no
destination costs more than one click and none can be hidden by a collapsed
parent. Related pages are kept together under a section heading:

| Section | Pages |
|---|---|
| **Pemantauan** | Monitoring CCTV (`/`), Peta Gate (`/map`) |
| **Data Ritase** | Buku Lintasan (`/ledger`), Pemeriksa Lintasan (`/crossing`), Riwayat Pembacaan (`/cctv-history`), Daftar Nomor Lambung (`/fleet`) |
| **Laporan** | Laporan Harian & Shift (`/reports`) |
| **Pengaturan** | Konfigurasi Sistem (`/settings`) |

Each row highlights when its route is active. When the sidebar is collapsed to
icons the headings have nowhere to go, so a rule between groups carries the
grouping instead.

## Daily & Shift Report (`/reports`)

### Shift window controls
The shift date, start hour and end hour are real state. Presets (Day 07:00–19:00,
Night 19:00–07:00, Custom) drive the hours; editing an hour flips the preset to
Custom. Night windows are recognised as crossing midnight, so the window end is
stamped with the following day's date, and the window length in hours is shown
under the controls. The selected window is carried onto both downloads, and both
share one filename stem so the CSV and PDF of a shift sort together.

### CSV export
The **CSV** button downloads the complete shift sheet, not just the truck table:

- Provenance header — shift, window start/end, window hours, detection run date,
  model, generation timestamp and source.
- Shift summary — trips, targets, identified/unknown/reconciled counts,
  reconciliation rate, unique trucks, OCR reads, average confidence, trips per
  hour and estimated tonnage. Every row carries a `basis` column marking it
  `measured`, `derived`, `operational target` or `estimate`.
- Lane breakdown — trips, identified, estimated tons and share per lane.
- Per-truck ritase — hull ID, trips, OCR reads, best confidence, estimated tons
  and status, plus a TOTAL row.
- Notes — the measured-vs-estimated disclaimer.

Implementation details: fields are escaped per RFC 4180 (quotes doubled, values
containing `,`/`"`/newlines quoted), leading `=`/`+`/`@` is neutralised so
OCR-derived text cannot be executed as a spreadsheet formula, the file is written
with CRLF line endings and a UTF-8 BOM so Excel decodes it correctly, and the
download uses a Blob object URL (revoked after the download starts) rather than a
size-capped `data:` URI. Filenames follow
`SHIFT_REPORT_<date>_<SHIFT>_<start>-<end>.csv`. The button is disabled with an
explanatory tooltip when the backend returned an empty report, and a status line
confirms the row counts and filename, or reports the failure.

### PDF export
The **PDF** button downloads a finished A4 report document — one click, no print
dialog and no "Save as PDF" step. `SHIFT_REPORT_<date>_<SHIFT>_<start>-<end>.pdf`
contains:

- A masthead with the shift badge, reporting window, window length, detection run
  date, model, trip count and generation timestamp.
- A **Shift Summary** table, each row tagged `measured`, `derived`,
  `operational target` or an estimate basis.
- A **Lane Breakdown** table — trips, identified, estimated tons and share.
- A **Per-Truck Ritase** table with a TOTAL row; it repeats its header on each
  page and never splits a truck across a page break.
- The measured-vs-estimated disclaimer plus Shift Supervisor / Operations Auditor
  signature blocks, kept whole on one page.
- `Page X of Y` and the reporting window in the footer of every page.

Implementation details: rendered with jsPDF + autotable as vector text, so the
document is selectable and searchable rather than a rasterised screenshot, and it
paginates properly. jsPDF is loaded through a dynamic `import()`, keeping ~430 kB
of PDF machinery out of the initial bundle until an operator actually asks for a
report; the button shows a "Building…" spinner while that loads. All text is run
through a WinAnsi sanitiser first, because jsPDF's built-in Helvetica cannot
encode characters like the `→` used in window labels. `renderShiftReportPdf`
returns a `Blob` and is separate from the download step, so the document can be
generated and inspected without a DOM.

### Browser print (Ctrl+P)
The report downloads as a generated PDF, so the print stylesheet is only a safety
net for anyone hitting Ctrl+P: it drops the app chrome, unlocks the scroll-locked
flex shell so the page paginates instead of clipping, and repaints the design
tokens for white stock so it prints the same from either theme.

### Report content
KPI tiles (shift trips, estimated tonnage, OCR precision, reconciliation rate),
the per-lane trip load bar chart and the lane volume table are unchanged in
substance and are laid out explicitly for print.

## Notes on data scope

The backend's `/api/shift-report` returns one aggregated detection run and does
not expose per-crossing timestamps, so the shift window scopes and labels the
report sheet rather than re-filtering the underlying trips. Both outputs state
the detection run date alongside the selected window so the two are never
confused.

## CCTV Monitoring Wall (`/`)

The landing page is the gate-watching screen and nothing else: pick a source,
pick which camera to process, start the run, watch the footage, and read the OCR
result — all without leaving the page. The ritase counters that used to sit here
now live on the pages that explain them (see *Shared ritase counters* below), and
the stored-detection list moved wholly to Riwayat Pembacaan (`/cctv-history`),
which already carries the same list with fuller filters.

### Source selector: CCTV or recorded video
A `Sumber` dropdown chooses where the picture comes from. `CCTV langsung (RTSP)`
is the eventual production source; it is not connected yet, so choosing it shows
each pane's registered RTSP address with an explicit "belum tersambung" notice
and disables the run button rather than faking a stream. `Video (klip rekaman)`
replays the clips in each camera's folder through the detection + OCR pipeline.
The choice is remembered per browser (`localStorage`), defaulting to video.

### Two-screen wall with per-pane gate selection
Two viewports split the top of the page side by side, each with its own camera
dropdown, so a gate pair (masuk / keluar) can be watched together; the OCR
Inspection HUD runs full width beneath them. They default to the first two
registered gates. When a run moves onto a gate neither pane is showing, the left
pane follows it once — after that the operator's choice stands.

Each pane plays the gate's footage with the reading laid over it: while the
pipeline is scanning that gate it shows the clip being read plus the live vote,
frames scanned, and OCR/detection counts; otherwise it shows the clip that gate
read most recently, paused with playback controls, labelled with its stored hull
ID and confidence. The clip plays at its own pace — it is the same file the
pipeline reads, not a frame-synced mirror of the inference loop, so the overlay
numbers (live) and the picture can drift apart within a clip.

### Camera-scoped clip runner, on the same page
The `Kamera diproses` dropdown selects the run scope — one camera or all of them
— using the same folder attribution the rest of the app relies on
(`data/01-playlist/gate-a` → `CAM-GATE-A`). Options come from the camera
registry, so registering a camera adds it here with no code change; folders with
no registered camera still appear. The control bar states how many clips will be
processed and how many of them overwrite an earlier result.

### OCR Inspection HUD, live and idle
The HUD spans the page under the wall, laid out in three columns — the reading,
the progress behind it, then the queue — and keeps that footprint whether or not
a run is in flight, so starting one doesn't reshuffle the page. During a run it
shows queue progress, frames scanned, the hull ID currently winning the vote,
competing candidates, and a per-clip outcome list. The run lives on the backend and is streamed over SSE
(polling as fallback), so a reload or a second tab picks up the same run. The
operator can stop a run from the HUD or the control bar; it finishes the current
clip and halts.

When idle, the HUD lists the clips currently in scope with the result each one
already has stored — what the next run would cover. When a run ends, it keeps
showing the result until dismissed, and the clip list reloads so each viewport
reflects what was actually saved.

### Shared ritase counters
`Lintasan Gate`, `Nomor Lambung Terbaca`, and `Gagal Terbaca` now head both
Buku Lintasan (`/ledger`) and Laporan Harian & Shift (`/reports`). Each card
still links to the page that explains its number; on the page it already points
at, it renders as a plain tile instead of a link to nowhere.

### Real persistence, no duplicates
Clips are processed one at a time (the detection and OCR models hold a GPU) and
each finished clip is written to the database as a real crossing — a `runs` row
plus `video_results` and per-frame `detections`, attributed to its camera.
Re-processing a clip **overwrites** its previous row instead of duplicating it,
and carries over the crossing-time columns, which describe when a truck passed a
gate rather than when the clip was processed. Only one run may be active at a
time; a second request is refused.

Backend: `GET /api/video-sources`, `POST /api/test-runs`,
`GET /api/test-runs/active`, `GET /api/test-runs/{id}`,
`GET /api/test-runs/{id}/stream`, `POST /api/test-runs/{id}/cancel`.

### Configurable backend origin
The dev proxy target is read from `BACKEND_ORIGIN` (default
`http://127.0.0.1:8000`), so a frontend can be pointed at a backend on another
host or port without editing the config.

## Docker Packaging

### Standalone container image
`Dockerfile` builds the app as a self-contained image: a Bun-based dependency
and build stage produces Next.js's `output: "standalone"` bundle (a pruned
`node_modules` plus a plain `server.js`), copied into a minimal Bun-alpine
runtime stage running as a non-root user. Image serves on port 3000
(`bun server.js`).

Because `next.config.ts`'s `rewrites()` (the `/api` and `/media` proxy to the
backend) is resolved once at `next build` time into the routes manifest,
`BACKEND_ORIGIN` must be supplied as a Docker **build arg**, not just a
runtime env var, to change the backend the built image points at:

```bash
docker build --build-arg BACKEND_ORIGIN=http://127.0.0.1:8000 -t smartgate-frontend .
docker run -p 3000:3000 smartgate-frontend
```

`docker-compose.yml` wraps the same build, reading `BACKEND_ORIGIN` from the
shell environment (falling back to `http://127.0.0.1:8000`):

```bash
BACKEND_ORIGIN=http://backend:8000 docker compose up --build
```

If the backend runs on the host rather than in the same Compose network, point
`BACKEND_ORIGIN` at `http://host.docker.internal:8000` instead of
`127.0.0.1`, since `127.0.0.1` inside the container refers to the container
itself. `.dockerignore` keeps `node_modules`, `.next`, docs and video output
out of the build context.

## Explainer Video Pipeline (`../video/`)

### 90-second product explainer, rendered from code
A SaaS-style explainer video for the ritase product, built as HTML/CSS/Three.js
and rendered through headless Chrome into `../video/out/smartgate-ritase.mp4`
(1920x1080, 60fps, silent). Structure: the manual-tally problem, the brand, gate
detection through to `IN + OUT = 1 ritase`, a hard flip to the light theme, a
tour of the real screens, then the payoff and outro.

### Deterministic frame capture
The scene exposes `window.__seek(t)` and is a pure function of time: no CSS
transitions, no `requestAnimationFrame`, no `Math.random()`. Frame *N* is
rendered at exactly *N*/60 seconds, so output is perfectly smooth regardless of
how long any individual frame takes to rasterise. Frames pipe straight into
ffmpeg's stdin, keeping intermediate storage at zero rather than ~15GB of PNGs.

### Recreated UI, real numbers
The screens in the video are rebuilt as live DOM rather than screenshotted, so
individual rows, bars and counters animate independently. Layout, labels, nav
order and design tokens are traced from the shipping app, and the hull IDs,
read counts and per-gate splits come from the real detection run
(`run 2026-07-19`, `pak-shomad-v1.pt`).

### Preview workflow
`node video/preview.js --sheet` renders a contact sheet of every beat in
seconds, so composition can be checked without waiting on a full render.
Full render is roughly 15-20 minutes with hardware rasterisation; see
`../video/README.md` for the measured software-versus-GPU cost breakdown.

## Edge Devices (`/settings/devices`)

The deployment is four gates, each with exactly one CCTV camera and one NVIDIA
Jetson Orin Nano Super running detection locally. Because a gate has one camera
and one device, the camera row *is* the device row — this console and the camera
registry are two views of one resource, not two registries. Built against the
backend branch's `docs/edge-system/API_CONTRACT.md` §2.1–§2.3.

### Per-gate inference settings
One card per registered camera, each with numeric steppers for the five tunables
the device exposes: `yolo_fps` (1–30, typically 18–25), `ocr_fps` (1–15,
typically ~4), `detect_window_sec` (1–30, typically 5–7), `ocr_min_conf` and
`dedup_iou` (0.0–1.0). The API's range is the hard input limit; the operating
range the site prefers is helper text only, so commissioning can deliberately go
outside it. Changed fields are marked inline with their previous value, and only
those fields are sent — the endpoint takes a partial update and rejects an empty
body, which is exactly what keeps the save button disabled until something
differs.

### Saved vs. pending, as a real state
A save increments the server's `config_version` immediately, but the device only
collects the change on its next 30-second heartbeat and then reports back
`applied_config_version`. Equal versions read **"Pengaturan tersimpan"**;
unequal reads **"Menunggu perangkat"**. Pending is an operational condition, not
a spinner — a card stuck there means the device is not picking up config, and
its health badge says why. The page re-polls every 30 seconds so a normal
pending resolves without a manual reload.

### Device health badge
Status (online / offline / perawatan), time since last heartbeat, queue depth
and agent version. A backlog on a *connected* device is coloured as a warning
even though the device itself is online: a growing local queue is a distinct
failure from being unreachable and must not look identical to a healthy
`antrean 0`.

### Validation stays server-side
The steppers clamp to the API range, but the server is authoritative. A `400`
from the API is surfaced verbatim and attached to the field it names, rather
than being replaced with a client-side guess at what went wrong.

### Honest empty state
None of the edge endpoints are deployed on the backend yet. Rather than render
default values that would read as live settings, each card says the endpoint
isn't mounted and that the page will populate once it is. A 404 carrying an
`error` key is a real contract response ("Camera not found"); a 404 without one
is FastAPI's unmounted-route default — `isEndpointMissing()` in
`src/lib/api-client.ts` splits the two so the UI never reports a missing feature
as a fault.

## Live Gate View (`/live/[camera_code]`)

On-demand, real-time view of one gate's **raw** camera feed, reached from a
device card's "Lihat Langsung". One gate at a time by construction: the session
is scoped to the route's camera code and closes when the page does.

### Raw video only — permanently
No bounding boxes, no hull-ID readout, no "show detections" toggle, by design
(backend `docs/edge-system/PRD.md` Goal 7 and Non-Goals). Live video and
inference are separate paths: results reach the console only after consensus
voting, as crossing events on Buku Lintasan and Riwayat Pembacaan. The page
links there rather than duplicating the data over the stream.

### Session lifecycle
`POST /live/start` on mount, a keep-alive every 10 seconds while the view is
open, `POST /live/stop` on unmount and on `pagehide`. The server ends a session
after ~20 seconds of silence, so an unclean exit (crashed tab) is covered
without the frontend having to guarantee the stop call fires — no edge is left
streaming to nobody.

### WHEP playback, no player dependency
Playback negotiates over WHEP with a plain `RTCPeerConnection`: POST the SDP
offer to the relay as `application/sdp`, apply the answer. That is small enough
that a player library would cost more than it saves, and it keeps third-party
code out of the media path. ICE gathering is bounded by a 2-second timeout so a
network where one candidate type never resolves cannot hang the connection.
Teardown `DELETE`s the relay's session resource.

### Connecting vs. unreachable
Starting a session against an offline device returns `200` and then simply never
streams, so a spinner alone would be indistinguishable from a working
connection. After 8 seconds without media the player states the device is
unreachable, with a Wifi-off icon and a retry — never an infinite loader. A
third state covers the backend not having the endpoint or media relay yet.
