# 🚚 Integrated Smart Hauling System: High-Performance AI Hauling Portal (v2)

An enterprise-grade, GPU-accelerated **Edge Computer Vision & AI Web Dashboard** for automatically tracking and identifying Off-Highway Vehicles (OHV) and hauling truck hull IDs from gate camera footage.

---

## ⚡ Overview & Business Value

Integrated Smart Hauling System v2 transitions the system from a raw command-line utility into a **unified operational control center**. By replacing heavy, resource-intensive models (SAM 3) with a **fine-tuned custom YOLOv8 model**, the system achieves a **5x speedup** in processing latency while running efficiently on standard consumer-grade hardware.

```
   [ CCTV Camera ] ──► [ Custom YOLOv8 ] ──► [ PaddleOCR-VL ] ──► [ Levenshtein Voting ]
                                                                          │
                                                                          ▼
[ Interactive Live Map ] ◄── [ Live State Machine ] ◄── [ SQLite DB ] ◄──┘
```

---

## 🚀 Key Features

*   **Pusat Kendali Web Modern**: Mode gelap premium berbasis **FastAPI, FastHTML, Tailwind CSS**, dan **Lucide Icons** untuk pemantauan operasional tambang 24/7.
*   **Peta Site Plan Interaktif (`/map`)**: Pelacakan posisi armada masuk/keluar (*Inside Yard* vs *Outside Roadway*) secara live berdasarkan *state machine* arah lintasan gerbang.
*   **YOLOv8 Detektor Kustom (`pak-shomad-v1.pt`)**: Deteksi presisi area nomor lambung truk hauling tambang, tangguh terhadap guncangan, debu, dan pencahayaan minim.
*   **PaddleOCR-VL Transformers**: Pembacaan teks cepat (~10-25ms/crop) menggunakan akselerasi GPU CUDA murni langsung di memori RAM (*Zero Disk I/O*).
*   **Konsensus Voting Levenshtein**: Algoritma kedekatan teks cerdas untuk menyatukan variasi pembacaan plat (misal: `DT118`, `DT-118`, `DTI18`) menjadi satu ID lambung yang valid.
*   **Transcoder H.264 Otomatis**: Integrasi otomatis FFmpeg untuk mengonversi hasil video markup OpenCV (`mp4v`) menjadi format H.264 browser secara instan demi kelancaran pemutaran bukti video.
*   **Terminal TUI Interaktif (`tui.py`)**: Panel kendali baris perintah (CLI) berbasis keyboard untuk administrator server lengkap dengan grafik pemantauan metrik GPU.

---

## 🛠️ Installation & Quick Start

### Option A: Docker (recommended)

Runs the FastAPI backend in a container — no local Python/`uv` setup needed.

**Prerequisites:**
*   Docker + Docker Compose (v2, the `docker compose` plugin).
*   The `sam3` git submodule checked out (required to build the image):
    ```bash
    git submodule update --init sam3
    ```
*   The gitignored runtime data: `ai-model/pak-shomad-v2.pt` (YOLO weights) and a `data/` directory. Both are bind-mounted in, not baked into the image — create them if they don't exist yet:
    ```bash
    mkdir -p ai-model data
    # then place pak-shomad-v2.pt inside ai-model/
    ```

**Build & run (CPU):**
```bash
docker compose up -d --build
```
Open **`http://localhost:8000`** — health check at `/`, interactive API docs at `/docs`.

```bash
docker compose logs -f       # tail logs
docker compose down          # stop and remove the container
```

**GPU acceleration (optional):** the base `docker-compose.yml` runs CPU-only so it works everywhere. To enable NVIDIA GPU passthrough, layer the GPU override on top:
```bash
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d --build
```
This requires a host with `nvidia-container-toolkit` installed and configured for Docker. **Docker Desktop for Linux does not support GPU passthrough** (it runs containers inside a VM — see [docker/roadmap#497](https://github.com/docker/roadmap/issues/497)); GPU mode needs a native Docker Engine (`docker-ce`) installation instead. Verify GPU access before starting the stack:
```bash
docker run --rm --gpus all ubuntu:24.04 nvidia-smi
```

**Live CCTV viewing (optional):** the WebRTC relay that carries a gate's raw feed to the dashboard
runs as two extra containers, behind a Compose profile so batch-only deployments skip them:

```bash
cp infra/turnserver.conf.example infra/turnserver.conf   # then edit every CHANGE_ME value
docker compose --profile live-view up -d
```

This starts **MediaMTX** (WHIP ingest from the edge devices, WHEP playback to the browser) and
**coturn** (TURN relay, required because the gate devices sit behind cellular NAT). Set
`MEDIA_RELAY_BASE_URL` to the relay's publicly reachable address — the browser *and* the edge both
resolve it, so `localhost` only works for a single-machine test. Verify the relay is up:

```bash
curl http://localhost:9997/v3/paths/list      # empty path list = healthy, nothing streaming yet
```

`infra/turnserver.conf` is gitignored; only the `.example` template is tracked. See
`docs/edge-system/SRS.md` §8 for the architecture.

### Option B: Local Python with `uv`

**Prerequisites:**
*   **Python 3.12**
*   **NVIDIA GPU (CUDA-compatible)** for accelerated model inference.
*   **FFmpeg** (installed via winget or added to PATH for video transcoding).

**Setup Environment**
Sync Python dependencies and prepare the workspace using `uv`:

```bash
# Sync dependencies and virtual environment
uv sync --python 3.12
```

**Run the Web Dashboard**
Launch the web interface (FastAPI + FastHTML):

```bash
uv run python main.py web
```
Open **`http://127.0.0.1:8000`** in your browser.

**Run the Terminal TUI Dashboard**
For keyboard-driven terminal control:

```bash
uv run python main.py
```

---

## 📊 Dashboard Modules & Features

| Halaman | Tujuan Utama | Komponen UI/UX Kunci |
| :--- | :--- | :--- |
| **Dashboard** | Pantauan ringkasan aktivitas gerbang | KPI Stat Cards, Feed Transaksi Live, Progress Bar Akurasi |
| **Site Plan** | Live map posisi truk & status gate | Layout Yard Digital (Inside vs Outside), Pulsing Sensor Gate, Klik-Detail |
| **Process Video** | Analisis & unggah rekaman baru | Capsule Tabs, Drag-and-Drop Uploader, Validasi Format Video |
| **Fleet Registry** | Database inventarisasi kendaraan | Agregasi Ritase Per Truk, Tabel Log Kepatuhan, Status Aktif |
| **Reports** | Ekspor laporan ritase & audit trail | Barchart Ritase Gradien, Data-Dense Log Table, Keyakinan OCR |
| **Evidence Page** | Verifikasi detail hasil pembacaan AI | Plat Digital Neon, Video Anotasi H.264, Foto Bukti Snapshot |

---

## ⚙️ Pipeline Tuning & Parameters

Adjust detection speed and accuracy using these command line arguments in `main.py run-model`:

| Flag | Tipe | Default | Deskripsi |
| :--- | :--- | :--- | :--- |
| `--frame-stride` | `int` | `1` | Melompati frame video (nilai `3`-`5` mempercepat run hingga 4x tanpa merusak akurasi). |
| `--ocr-min-conf` | `float` | `0.30` | Mengabaikan pembacaan OCR jika keyakinan kotak deteksi di bawah batas ini. |
| `--dedup-iou` | `float` | `0.92` | Menghindari proses OCR berulang jika posisi plat tidak banyak bergerak. **(Mempercepat run hingga 15x)**. |
| `--batch-size` | `int` | `8` | Ukuran batch frame untuk komputasi inferensi YOLO pada GPU CUDA. |
| `--save-video` | `bool` | `False` | Menyimpan rekaman video baru beranotasi bounding box hijau & tag nomor lambung. |

---

## 📂 Project Structure

```
├── app/                             # FastAPI backend
│   ├── main.py                      # App factory (app.main:app) + dev runner
│   ├── routers/                     # HTTP layer (dashboard, analysis, reference, cameras)
│   ├── services/                    # Business logic (dataset, reference, cctv, jobs, ...)
│   ├── repositories/                # SQLite + JSON persistence
│   ├── schemas/                     # Pydantic request/response models
│   ├── core/                        # Config + database connection
│   └── utils/                       # FFmpeg transcoder & path helpers
├── labs/                            # Core CLI logic and research scripts
│   ├── custom_model/                # YOLOv8 + PaddleOCR core pipeline
│   ├── 12_run_custom_model.py       # YOLOv8 pak-shomad model runner
│   ├── 15_store_results_database.py # SQLite Database sync utility
│   └── ...                          # Previous pipeline sub-modules (labs 01-11)
├── ai-model/                        # Custom YOLOv8 model weights (.pt) — gitignored, bind-mounted into the container
├── tests/                           # Pytest suite (API contract + data layer)
├── main.py                          # Unified CLI entrypoint & TUI dashboard
├── Dockerfile                       # Multi-stage build (uv → slim runtime) for the FastAPI backend
├── docker-compose.yml               # CPU-only backend service (data/ + ai-model/ as volumes)
└── docker-compose.gpu.yml           # Optional override: adds NVIDIA GPU passthrough
```

---

## 🔒 Security & Data Integrity
*   **Audit Trail Transparan**: Setiap ritase pengangkutan divalidasi silang menggunakan potongan gambar pelat dan klip video berdurasi pendek sebagai bukti fisik mutlak untuk mencocokkan invoice kontraktor logistik.
*   **Proteksi Fraud**: Kombinasi deteksi YOLO, PaddleOCR, dan konsensus voting Levenshtein meminimalisasi tingkat kesalahan input manual dan manipulasi nomor lambung kendaraan di gerbang timbangan.
