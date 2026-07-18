# OCR Hauling Truck

Pipeline for analyzing hauling-truck footage: download a YouTube playlist, extract frames, segment truck ID regions with [SAM 3](https://github.com/facebookresearch/sam3), and run OCR with [PaddleOCR-VL 1.6](https://github.com/PADDLEPADDLE/PADDLEOCR) or [NVIDIA Nemotron OCR v2](https://huggingface.co/nvidia/nemotron-ocr-v2).

## Prerequisites

- [uv](https://docs.astral.sh/uv/) (Python package manager)
- Python 3.13+ (main project environment)
- Python 3.12 (Nemotron OCR v2 — separate venv)
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) — playlist download (lab 01)
- [ffmpeg](https://ffmpeg.org/) / ffprobe — frame extraction (lab 02)
- CUDA-capable GPU recommended for SAM 3 and OCR inference

## Setup

```bash
git submodule update --init --recursive
uv sync
```

Submodules:

| Path | Purpose |
|------|---------|
| `sam3/` | SAM 3 segmentation (editable workspace dependency) |
| `PADDLEOCR/` | PaddleOCR upstream source |
| `nemotron-ocr-v2/` | NVIDIA Nemotron OCR v2 source |

### Nemotron OCR v2 (optional)

Labs 05 and 07 use a separate Python 3.12 environment to avoid dependency conflicts with the main project:

```bash
uv venv .venv-nemotron --python 3.12
uv pip install --python .venv-nemotron/bin/python torch torchvision \
  --index-url https://download.pytorch.org/whl/cu126
uv pip install --python .venv-nemotron/bin/python hatchling editables setuptools ninja
CUDA_HOME=/usr/local/cuda-12.6 uv pip install --python .venv-nemotron/bin/python \
  --no-build-isolation ./nemotron-ocr-v2/nemotron-ocr
```

Lab 05 re-execs into `.venv-nemotron` automatically. Lab 07 runs Nemotron OCR in a subprocess from the main environment.

## Unified CLI

You can use the unified `ocr-hauling-truck` CLI command to run any of the labs or pipeline commands:

```bash
uv run ocr-hauling-truck <command> [options]
```

### Available Commands

| Command | Alias | Target Script | Purpose |
|---------|-------|---------------|---------|
| `01` | `download` | `labs/01-download-playlist.py` | Download YouTube playlist |
| `01b` | `convert-mp4` | `labs/01b-convert-videos-to-mp4.py` | Convert downloaded videos to mp4 |
| `02` | `extract` | `labs/02-extract-videos.py` | Extract frames from videos |
| `03` | `segment` | `labs/03-extract-truck-id.py` | Segment truck IDs with SAM 3 |
| `04` | `ocr-paddle` | `labs/04-ocr-truck-id-using-paddle-ocr-vl-1.6.py` | Run OCR with PaddleOCR-VL 1.6 |
| `05` | `ocr-nemotron` | `labs/05-ocr-truck-id-using-nvidia-nemotron-ocr-2.py` | Run OCR with Nemotron OCR v2 |
| `06` | `pipeline` | `labs/06-extract-video-using-sam3-and-ocr.py` | End-to-end video pipeline |
| `07` | `pipeline-nemotron` | `labs/07-extract-video-using-sam3-and-ocr-using-nvidia-nemotron-ocr-v2.py` | End-to-end pipeline with Nemotron |
| `08` | `detect-yolo26` | `labs/08-detect-truck-using-yolo26.py` | Detect trucks/vehicles with YOLO26n |

For help with any command, run:
```bash
uv run ocr-hauling-truck <command> --help
```

## Project layout

| Path | Description |
|------|-------------|
| `labs/` | Numbered lab scripts (`01-`, `02-`, …) |
| `data/01-playlist/` | Downloaded videos |
| `data/01b-videos-converted-to-mp4/` | Converted MP4 videos |
| `data/02-extracted-images-from-videos/` | Extracted JPEG frames |
| `data/03-extract-truck-id/` | SAM 3 detections, YOLO labels, annotated frames |
| `data/04-ocr-truck-id-using-paddle-ocr-vl-1.6/` | PaddleOCR-VL crops and results |
| `data/05-ocr-truck-id-using-nvidia-nemotron-ocr-2/` | Nemotron OCR crops and results |
| `data/06-extract-video-using-sam3-and-ocr-using-*/` | End-to-end video pipeline (lab 06) |
| `data/07-extract-video-using-sam3-and-ocr-using-nvidia-nemotron-ocr-v2/` | Nemotron end-to-end shortcut (lab 07) |
| `data/08-detect-truck-using-yolo26/` | YOLO26n annotated videos and per-video JSON summaries |
| `sam3/` | SAM 3 git submodule |

## Labs

Run labs in order with `uv run`. Labs 03+ require a GPU and will download model weights on first run.

### 01 — Download playlist

Downloads the Truck Hauling 2026 YouTube playlist to `data/01-playlist/`. Uses `yt-dlp` with a download archive so reruns skip already-fetched videos.

```bash
uv run labs/01-download-playlist.py
```

### 01b — Convert videos to MP4

Converts all WebM and MKV video files in `data/01-playlist/` to standard MP4 format (using libx264/AAC encoding in `ffmpeg`) under `data/01b-videos-converted-to-mp4/`.

```bash
uv run labs/01b-convert-videos-to-mp4.py
```

### 02 — Extract frames

Extracts 8 evenly spaced frames from each video in `data/01-playlist/` and writes JPEGs to `data/02-extracted-images-from-videos/`. Existing frames are skipped.

```bash
uv run labs/02-extract-videos.py
```

Output naming: `{video_id}_frame01.jpg` … `{video_id}_frame08.jpg`.

### 03 — Segment truck IDs (SAM 3)

Segments truck number regions in extracted frames using SAM 3 with a text prompt (default: `"truck number"`). Writes YOLO bbox/segmentation labels, per-frame JSON annotations, and annotated preview images to `data/03-extract-truck-id/`.

```bash
uv run labs/03-extract-truck-id.py
uv run labs/03-extract-truck-id.py --limit 5          # test on first 5 frames
uv run labs/03-extract-truck-id.py --force            # reprocess existing frames
```

### 04 — OCR with PaddleOCR-VL 1.6

Crops each SAM 3 detection from lab 03 and runs [PaddleOCR-VL 1.6](https://github.com/PADDLEPADDLE/PADDLEOCR) text extraction. Writes crops, per-detection JSON results, `summary.json`, and `extracted-texts.txt` to `data/04-ocr-truck-id-using-paddle-ocr-vl-1.6/`.

```bash
uv run labs/04-ocr-truck-id-using-paddle-ocr-vl-1.6.py
uv run labs/04-ocr-truck-id-using-paddle-ocr-vl-1.6.py --engine transformers --device cuda
```

### 05 — OCR with NVIDIA Nemotron OCR v2

Same workflow as lab 04, using Nemotron OCR v2 instead. Requires the `.venv-nemotron` setup above. Output goes to `data/05-ocr-truck-id-using-nvidia-nemotron-ocr-2/`.

```bash
uv run labs/05-ocr-truck-id-using-nvidia-nemotron-ocr-2.py
uv run labs/05-ocr-truck-id-using-nvidia-nemotron-ocr-2.py --lang en --merge-level word
```

### 06 — End-to-end video pipeline

Runs the full pipeline on source videos: extract frames → SAM 3 segmentation → OCR. Supports both OCR backends and can produce annotated output videos.

```bash
# PaddleOCR-VL (default)
uv run labs/06-extract-video-using-sam3-and-ocr.py

# Nemotron OCR v2
uv run labs/06-extract-video-using-sam3-and-ocr.py --ocr-backend nvidia-nemotron-ocr-v2

# Single video, limited frames
uv run labs/06-extract-video-using-sam3-and-ocr.py --video-id _6IZuVvNNYo --frames-per-video 4
```

### 07 — End-to-end with Nemotron (shortcut)

Wrapper around lab 06 that defaults to Nemotron OCR v2 and runs OCR in a subprocess so the main `.venv` stays on Python 3.13. Output goes to `data/07-extract-video-using-sam3-and-ocr-using-nvidia-nemotron-ocr-v2/`.

```bash
uv run labs/07-extract-video-using-sam3-and-ocr-using-nvidia-nemotron-ocr-v2.py
uv run labs/07-extract-video-using-sam3-and-ocr-using-nvidia-nemotron-ocr-v2.py --video-id _6IZuVvNNYo
```

Accepts the same CLI flags as lab 06 (e.g. `--frames-per-video`, `--force`, `--no-output-video`).

### 08 — Detect trucks/vehicles (YOLO26n)

Runs Ultralytics YOLO26n on videos from `data/01-playlist/`, keeping COCO vehicle classes (`bicycle`, `car`, `motorcycle`, `bus`, `train`, `truck`). Writes annotated MP4s and per-video JSON summaries to `data/08-detect-truck-using-yolo26/`.

```bash
uv run labs/08-detect-truck-using-yolo26.py
uv run labs/08-detect-truck-using-yolo26.py --video-id _6IZuVvNNYo
uv run labs/08-detect-truck-using-yolo26.py --limit 1 --max-frames 60   # smoke test
uv run labs/08-detect-truck-using-yolo26.py --force
uv run labs/08-detect-truck-using-yolo26.py --confidence 0.4
```

## Pipeline overview

```
YouTube playlist
      │
      ▼
  01-download-playlist  →  data/01-playlist/
      │
      ▼
  02-extract-videos     →  data/02-extracted-images-from-videos/
      │
      ▼
  03-extract-truck-id   →  data/03-extract-truck-id/  (SAM 3)
      │
      ├──────────────────────────────┐
      ▼                              ▼
  04-paddle-ocr-vl-1.6          05-nemotron-ocr-v2
      │                              │
      └──────────┬───────────────────┘
                 ▼
  06/07 end-to-end video pipeline (frames + SAM 3 + OCR + optional annotated video)
```

## Development

- Use `uv` for all Python commands (`uv add`, `uv sync`, `uv run`).
- Lab scripts live in `labs/` with numeric prefixes; outputs go under `data/<lab-name>/`.
- See [AGENTS.md](AGENTS.md) for agent/AI conventions.
