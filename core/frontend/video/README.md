# SmartGate ritase explainer

A 90-second SaaS explainer video for the ritase counting product, rendered from
HTML, CSS and Three.js through headless Chrome into an MP4.

Output: `./out/smartgate-ritase.mp4` — 1920x1080, 60fps, silent.

## Why it is built this way

The scene is a **pure function of time**. `window.__seek(t)` puts the whole
scene into the state that time `t` implies, and nothing anywhere reads a
wall clock or accumulates state between frames. That single constraint is what
makes the output smooth: frame `N` is rendered at exactly `N/60` seconds no
matter how long the rasteriser took, so a frame that costs 200ms and a frame
that costs 2s both land on their exact timestamp.

Screen-recording the page instead would drop and duplicate frames under load.
That is the main reason this does not use a capture tool.

Two consequences worth knowing when editing:

- **No CSS transitions or `@keyframes` anywhere.** Every animated property is
  written as an inline style by JS from `t`. A CSS transition would desync the
  moment a frame ran long.
- **No `Math.random()`.** Dust positions, paper jitter and grain all come from
  seeded hashes, so re-rendering produces the same pixels.
- **Never record "when did this first happen".** Derive it from `t` instead.
  This one bit twice. The typewriter originally stamped each character with the
  time it was first drawn and faded it in from there. That makes the line's
  appearance depend on which frames were rendered before it — and the boot
  warm-up sweep visits t=80 before t=0, so characters carried stamps in the
  future, `(t - stamp)` went negative, and every line rendered with its opening
  letters invisible. The fix is to invert the reveal curve and compute each
  character's reveal time analytically (`KineticLine._revealAt`). If you need
  "when should X have started", solve for it; do not remember it.

Regression check for the above:

```js
// Seeking to a frame must equal arriving at it in order.
await page.evaluate(() => window.__seek(79.6));  const direct = read();
await page.evaluate(() => window.__seek(5));
await page.evaluate(() => window.__seek(88));
await page.evaluate(() => window.__seek(79.6));  const scrubbed = read();
// direct === scrubbed
```

## Motion doctrine

The first cut of this video read as a stack of slides rather than one
continuous move. The fix was choreography, not rendering. These rules are load
bearing — breaking one brings the slideshow feel straight back. Adapted from
the HyperFrames motion doctrine (`heygen-com/hyperframes`, Apache 2.0), applied
to this scene rather than ported to their runtime.

**1. Every seam is a velocity-matched cut, never a crossfade.**
The outgoing side accelerates on `power4In`, the cut lands while both sides are
still moving, and the incoming side continues the SAME direction on
`power4Out`. Those two eases are the halves of one `power4InOut`, so velocity
matches exactly at the boundary. An `.inOut` ease on one side alone puts a
velocity of zero at the cut, which is precisely what reads as a slide change.
Implemented in `src/seam.js`.

**2. The overlap window is the whole point.**
The incoming side ignites ~0.2s BEFORE the cut and the outgoing side survives
~0.3s past it. An earlier attempt had both hit zero opacity on the same frame —
symmetrical, and wrong: the screen empties for a beat. If you retime a seam,
check the frames either side of it, not just the cut itself.

**3. One current: LEFT.**
Every ordinary seam travels left. Two vectors are reserved and spending one is
a statement:

| Vector | Meaning | Spent on |
|---|---|---|
| LEFT | neutral forward progress | every ordinary seam |
| Z forward | pushing deeper into one thought | the camera closing on the hull number |
| UP | elevation, a conclusion | the success ring rising into the outro |

Never run consecutive seams in opposing directions. The ledger screen used to
enter from the left while the dashboard exited left — that ping-pong reads as
an error rather than as motion.

**4. Partial travel, ~12% of frame (230px).**
Content moves `TRAVEL` and fades; it never flies fully off-stage. Long travel
leaves a gap with nothing in it.

**5. Every seam hands a carrier across it.**
The eye follows objects, not abstractions. A concrete thing crosses each
boundary at matched position and velocity:

| Seam | Carrier |
|---|---|
| 14.0s | the hero tally sheet shrinks and docks into the mark's slot |
| 22.0s | the mark docks into the gate feed's slot |
| 48.3s | the `1 RITASE` badge survives the theme flip, still travelling |
| 52.3s | the sparkle docks at the dashboard's corner |
| 78.3s | the success ring rises into the payoff line |

Carrier destinations are `SLOTS` in `timeline.js`; the next act's first element
ignites at that same point and scale.

**6. No idle wobble.**
Sine loops — breathe, float, drift, glow pulse — are banned as sustained
motion; they read as "the video is waiting". Every stretch between entry and
exit is owned by a named route: **camera with intent** (a mapped push/pan),
**staged reveals** (content held back and paid off), or **sequenced UI life**
(counts ticking, rows reconciling). Test: pause on any second and something
meaningful must be mid-flight. The `drift()` helper still exists in `anim.js`
but is deliberately unused by the acts.

**7. The theme flip lands ON its seam.**
`THEME_FLIP` must equal `SEAMS.solutionToFlip.t`. When they drifted apart the
palette changed 0.7s after the cut and the boundary read as two separate
events.

## Commands

```bash
# Contact sheet of every beat — seconds, not minutes. Use this while iterating.
node video/preview.js --sheet

# Specific moments
node video/preview.js --at 26,38.6,77.9

# Full render
node video/render.js

# A slice, for checking one act
node video/render.js --from 22 --to 48 --out video/out/act3.mp4

# Draft quality (mjpeg pipe, faster preset)
node video/render.js --fast

# If no GPU is available
node video/render.js --swiftshader
```

Requires `ffmpeg` on PATH.

## Performance

Frames are piped straight into ffmpeg's stdin. 5400 lossless 1080p frames is
roughly 15GB on disk; piping keeps intermediate storage at zero.

Rasterisation dominates the render — seeking the scene costs 1-16ms per frame,
screenshotting costs 120-6900ms. Measured screenshot cost at 1920x1080:

| act | swiftshader | d3d11 |
|-----|------------:|------:|
| 1 (blurred depth of field) | 6866ms | 210ms |
| 3 (camera feed + HUD) | 1301ms | 178ms |
| 5 (tour panels) | 1398ms | 128ms |

The CSS `blur()` behind the depth-of-field effect is what makes software
rasterisation impractical here, so hardware rasterisation is the default.
Full render lands around 15-20 minutes.

## Structure

```
scene/
  index.html            layer stack: WebGL, 3D world, type, fx, post
  styles/
    tokens.css          design tokens mirrored from src/app/globals.css
    stage.css           stage, layers, vignette, grain, flash
    type.css            kinetic typography
  fonts/                Inter + JetBrains Mono, vendored for deterministic text
  vendor/               three.module.js
  src/
    timeline.js         act boundaries, copy, cue times, real detection data
    director.js         per-frame contract: t -> full scene state
    clock-free modules: anim.js, easing.js
    gl/                 glow shader, dust, outro line-art
    type/kinetic.js     typewriter reveal with caret
    ui/                 recreated SmartGate screens + gate camera
    acts/               one module per act
render.js               headless capture -> ffmpeg
preview.js              stills and contact sheets
server.js              static server (ES modules need a real origin)
```

## The screens

The UI in the video is **recreated** rather than screenshotted, so individual
rows, bars and counters can animate. Layout, labels, nav order and numbers are
traced from the real app (`docs/presentation-screenshots/`) and its design
tokens, so it matches what ships. Screens covered:

- Monitoring Ritase — KPI tiles, OCR Detections, OCR Inspection HUD
- Buku Lintasan — the crossing ledger reconciling row by row
- Laporan Harian & Shift — per-gate bars, then the PDF export

Hull IDs, read counts and gate splits come from the real detection run shown in
the screenshots (`run 2026-07-19`, `pak-shomad-v1.pt`).

## Structure of the video

| # | t | beat |
|---|---|------|
| 1 | 0-14s | Problem: paper tally sheets drifting in a dark pit |
| 2 | 14-22s | Brand: SmartGate lockup and positioning line |
| 3 | 22-48s | Solution: gate camera, detection, OCR reads, vote, IN + OUT = 1 ritase |
| 4 | 48-52s | Act break: hard flip to the light theme |
| 5 | 52-78s | Tour: dashboard, ledger reconciling, shift report export |
| 6 | 78-90s | Payoff line and outro lockup |

Copy is English; the product UI stays in Indonesian, as it ships.

## Audio

Rendered silent by design. Transitions sit on a 120 BPM grid (`BEAT` in
`timeline.js`), so a track dropped in afterwards lands on the cuts.

```bash
ffmpeg -i out/smartgate-ritase.mp4 -i track.mp3 -c:v copy -c:a aac \
  -shortest -af "afade=t=out:st=87:d=3" out/smartgate-ritase-scored.mp4
```
