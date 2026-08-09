# Model evaluation against the sample footage

Run 2026-08-08 on the 15 clips in `sample-video/sample-videos/`. Hardware: RTX 2060 Max-Q (6 GB),
x86 CPU. Weights: `core/backend/ai-model/truck-id-yolo26n-det-v2-numeric-filtered-20260730.pt`.

Scripts used are throwaway probes, but every stage below is the **shipped** code path —
`InferenceLoop._detect`, `vendor/ocr_utils.pad_crop`, `run_ocr_on_crop`, `fuzzy_vote_distribution`.
Nothing here exercises a parallel implementation.

## Short answer

**The detector is good. The OCR is good. The model is not the risk it was recorded as being.**

Before this run the project's position was that the full detect→OCR→consensus chain had never
produced a real crossing from real footage, and that OCR was ~50x too slow. Both statements are now
out of date.

## 1. Detection (YOLO)

Fires on **15 of 15 clips**, mean confidence **0.87**.

| Clip | Frames w/ box | Hit rate | Mean conf | ms/frame |
| :--- | ---: | ---: | ---: | ---: |
| AbSvkl9ipeo | 80/80 | 1.00 | 0.91 | 19.0 |
| G6wMzrXFOMI | 89/90 | 0.99 | 0.93 | 19.0 |
| 6Ne6NCbtv-A | 117/121 | 0.97 | 0.84 | 30.3 |
| jqHrxYFM0cc | 353/367 | 0.96 | 0.97 | 30.3 |
| 1QJKRHf4ZsQ | 65/68 | 0.96 | 0.89 | 35.5 |
| FQnmGqO6cS4 | 572/603 | 0.95 | 0.89 | 17.4 |
| OOoMQCx36VQ | 251/279 | 0.90 | 0.85 | 16.5 |
| 4Q7gWF-3l08 | 65/74 | 0.88 | 0.91 | 20.4 |
| D6-bNlwnJ9s | 56/64 | 0.88 | 0.82 | 29.8 |
| MFZIp_ENJbY | 139/165 | 0.84 | 0.92 | 30.2 |
| pcRQfdi_2dw | 101/121 | 0.84 | 0.88 | 18.3 |
| kVVasZ0b0JU | 90/112 | 0.80 | 0.90 | 14.6 |
| UXZvu-dpZOk | 36/70 | 0.51 | 0.92 | 23.0 |
| RO8TzC_uKsA | 46/90 | 0.51 | 0.77 | 19.7 |
| p0D8lOdLqmo | 3/149 | 0.02 | 0.64 | 13.2 |

13–35 ms/frame is **30–75 fps**, comfortably above the `yolo_fps: 20` target.

The two ~0.5 hit rates are trucks that are only in frame for part of the clip — not misses. The
`p0D8lOdLqmo` outlier at 0.02 is a genuinely bad clip: 640x352, heavy compression, the plate is an
unreadable smear even to a person. The detector declining to fire there is correct behaviour.

## 2. Recognition (OCR)

Same crops fed to both engines, so any difference is the recogniser's.

| Engine | Weights on disk | Per crop | Device | Correct |
| :--- | ---: | ---: | :--- | ---: |
| **PP-OCRv6 tiny rec** | **4.5 MB** | **14.8 ms** | CPU | **12 / 13** |
| PaddleOCR-VL 1.6 | 1 800 MB | 514 ms | GPU | 13 / 13 |

"Correct" counts the 13 clips with a legible plate; `p0D8lOdLqmo` (unreadable) and its garbage
output are excluded from both, and both produce a code that is in no master row, so both are
correctly rejected downstream.

Per-clip votes:

| Clip | Truth | PP-OCRv6 tiny | PaddleOCR-VL |
| :--- | :--- | :--- | :--- |
| 1QJKRHf4ZsQ | 299 | 299 (1.00) | 299 (1.00) |
| 4Q7gWF-3l08 | 5600 | 5600 (0.89) | 5600 (1.00) |
| 6Ne6NCbtv-A | 133 | 133 (1.00) | 133 (1.00) |
| AbSvkl9ipeo | 308 | 308 (0.88) | 308 (0.88) |
| **D6-bNlwnJ9s** | **5806** | **J808 (0.29)** ✗ | 5806 (0.49) |
| FQnmGqO6cS4 | 368 | 368 (1.00) | 368 (1.00) |
| G6wMzrXFOMI | 2375 | 2375 (1.00) | 2375 (1.00) |
| MFZIp_ENJbY | 158 | 158 (1.00) | 158 (1.00) |
| OOoMQCx36VQ | 2208 | 2208 (1.00) | 2208 (1.00) |
| RO8TzC_uKsA | 001 | 001 (1.00) | 001 (1.00) |
| UXZvu-dpZOk | 7811 | 7811 (1.00) | 7811 (1.00) |
| jqHrxYFM0cc | 245 | 245 (1.00) | 245 (1.00) |
| kVVasZ0b0JU | 8901 | 8901 (1.00) | 8901 (1.00) |
| p0D8lOdLqmo | *illegible* | O2E | 6074 |
| pcRQfdi_2dw | 134 | 134 (1.00) | 134 (1.00) |

### The one failure is the interesting result

`D6-bNlwnJ9s` is a low-contrast red-on-white plate under motion blur. Crops read
`S0D / 50S / 500 / 380O / 580S / 5806 / J808 / J80D` — the plate really is `5806`, and the tiny
model gets there once out of eight.

It fails at **0.29 vote share** against its usual 1.00. That matters more than the miss: the
consensus confidence is doing its job, so this surfaces as a low-confidence reading a person can
review rather than as a confident wrong answer credited to the wrong contractor. PaddleOCR-VL gets
it right but only at 0.49 share — a hard frame for both.

### Why the small model is the default anyway

- **400x smaller.** 4.5 MB vs 1.8 GB, on a Jetson behind Starlink with no second link.
- **35x faster on worse hardware.** 15 ms CPU vs 514 ms GPU.
- **Its errors are the repairable kind.** The misreads are letter-for-digit substitutions
  (`56D0`, `5EO0`, `56O0`, `S0D`) — exactly what `hull_matching._DIGIT_CONFUSIONS` maps, and
  single-character variants already merge in the Levenshtein-1 consensus cluster before matching
  runs. That is why `4Q7gWF-3l08` still votes `5600` at 0.89 despite three of eight crops
  misreading a character.

`SMART_GATE_OCR_BACKEND=paddleocr-vl` switches any single device to the large model, for a gate
whose plates turn out to be consistently degraded.

## 3. Caveats — read these before quoting the numbers

1. **Not the real fleet.** These are YouTube mining clips. The hull codes are not in the 276-unit
   PT CK-BIB master, so most resolve to `unregistered`. This measures OCR, not end-to-end
   identification. One clip's plate (`2375`) happens to collide with a real unit and did resolve
   to `HD 2375` / `exact`.
2. **Not the real hardware.** An RTX 2060 Max-Q is roughly 3–5x an Orin Nano Super. Expect
   PaddleOCR-VL nearer 2 s/crop there. The tiny recogniser's 15 ms was measured on **CPU** and has
   far more headroom.
3. **Ground truth is by eye.** There is no label file; the "Truth" column is read off the crops.
   `D6-bNlwnJ9s` is ambiguous even to a person between `5806` and `5808`.
4. **Sampled, not exhaustive.** 8 crops per clip at a fixed stride, highest-confidence box per
   frame. A live window collects more.

## 4. The full end-to-end run

All 15 clips through the *real* service (`POST /api/test-runs` on the edge backend, the shipped
pipeline, `ppocrv6-tiny`): **15/15 processed, 0 failures, 45 Detection Windows**.

| Clip | Resolved | Outcome | Windows |
| :--- | :--- | :--- | ---: |
| G6wMzrXFOMI | **HD 2375** | exact | 3 |
| OOoMQCx36VQ | **HD 2239** | exact | 7 |
| 4Q7gWF-3l08 | HD 4600 | **fuzzy** — see 4.1 | 2 |
| D6-bNlwnJ9s | — | unregistered | 2 |
| UXZvu-dpZOk | — | unregistered | 1 |
| kVVasZ0b0JU | — | unregistered | 3 |
| 1QJKRHf4ZsQ, 6Ne6NCbtv-A, AbSvkl9ipeo, FQnmGqO6cS4, MFZIp_ENJbY, RO8TzC_uKsA, jqHrxYFM0cc, p0D8lOdLqmo, pcRQfdi_2dw | — | unreadable — see 4.2 | 21 |

This is the first time the full capture→detect→OCR→consensus→match→outbox chain has run on real
footage; the project's previous position was that it never had.

Note `OOoMQCx36VQ` resolves `HD 2239` here while §2's probe read `2208` from it. Both are right:
that clip carries several trucks (441 boxes over 279 sampled frames), the probe sampled the first
one and the run windowed all seven.

Two behaviours worth recording. Neither is a defect introduced by this work; both are the matcher
doing exactly what it was specified to do, on input it was never meant to see.

### 4.1 A correct reading was "corrected" onto the wrong truck

`4Q7gWF-3l08` reads `5600` — correctly, unanimously. `5600` is not in the PT CK-BIB master.
`4600` is, and it is the *only* master code within Levenshtein distance 1. So the matcher applied
a fuzzy correction and filed the crossing as **`HD 4600`, outcome `fuzzy`**.

That is `hull_matcher`'s documented rule working as designed. It is also, on this input, a
confident misattribution — and it is the shape of the ghost-load failure the whole system exists
to prevent. The distinction that saves it in production is that these are not fleet trucks: a
gate at the real site sees plates that *are* in the master, so a distance-1 neighbour is
overwhelmingly likely to be an OCR slip rather than a different real unit.

**The residual risk is genuine, though**: an unregistered truck at a real gate — a contractor's
visitor, or a unit not yet added to the master — can be corrected onto a registered one instead of
being flagged `unregistered`. Worth raising with the owner separately; it is a policy question
(should `fuzzy` require corroboration when the raw read is itself clean and unanimous?), not
something to change unilaterally on the evidence of one clip.

### 4.2 Three-digit plates are `unreadable` by construction

`1QJKRHf4ZsQ` (299), `6Ne6NCbtv-A` (133), `AbSvkl9ipeo` (308) all OCR perfectly and all resolve
`unreadable`. `hull_matching._FOUR_DIGITS` requires exactly four digits, because every one of the
276 units in the master is `HD`/`WT` plus four digits.

Correct for this fleet, and it means most of these YouTube clips cannot resolve to anything by
design. It is only worth remembering when reading the run output: `unreadable` here means "not a
hull code this fleet uses", not "the OCR failed".

## 5. What this changed in the code

- `agent/ocr_backends.py` — engine selection behind PaddleOCR-VL's interface, so
  `vendor/ocr_utils.py` stays byte-identical to core's copy.
- `agent/ocr_worker.py`, `agent/live_state.py` — OCR moved off the detection thread.
- `edge/backend/pyproject.toml` — `inference` extra is now the small stack;
  `inference-vl` is the opt-in heavy one.
- `docs/edge-system/PRD.md` §8 open question 4 — marked resolved, with the CPU-only figure
  corrected.
