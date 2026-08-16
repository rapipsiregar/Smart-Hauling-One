# Perangkat Pos — Layanan

FastAPI + SQLite yang berjalan di perangkat pos gerbang. Membaca kamera,
mendeteksi nomor lambung, dan mengirim lintasan ke pusat. **Tetap bekerja saat
jaringan ke pusat putus** — lintasan ditahan di antrean lokal dan menyusul saat
sambungan pulih.

Untuk memasang pos baru, mulai dari [`../README.md`](../README.md).

## Menjalankan

Bersama konsolnya, dari folder `edge/`:

```bash
cd edge && docker compose up -d
```

Sendirian, tanpa Docker:

```bash
cd edge/backend
uv sync                      # tambahkan --extra inference untuk deteksi nyata
uv run uvicorn app.main:app --port 8100
```

Perlu berkas `.env` di [`../`](../) — sudah ikut di repositori dengan nilai
pengembangan.

| Alamat | Isi |
| :--- | :--- |
| `http://localhost:8100/api/status` | Kondisi perangkat |
| `http://localhost:8100/api/preflight` | Pemeriksaan pemasangan |
| `http://localhost:8100/docs` | Dokumentasi API |

### Menyalakan deteksi

Deteksi butuh berkas model dan pustaka tambahan, jadi bawaannya mati supaya
perangkat bisa dipasang dan diperiksa lebih dulu.

```bash
uv sync --extra inference     # ultralytics + paddleocr
# letakkan berkas model di ./model.pt
# lalu isi SMART_GATE_RUN_AGENT=true di ../.env
```

## Struktur

```
agent/       jalur deteksi langsung: kamera, YOLO, OCR, jendela deteksi, antrean kirim
app/         API perangkat dan mesin uji rekaman
vendor/      salinan persis modul pencocokan milik pusat (lihat di bawah)
video-sources/  sepuluh rekaman gerbang untuk pengujian
tests/       pytest
```

## Yang perlu dipahami sebelum mengubah

**Jendela deteksi** (`agent/pipeline.py`) — satu truk melintas = satu jendela =
satu lintasan. Jendela membuka pada deteksi pertama dan menutup saat batas durasi
atau setelah jeda tanpa deteksi.

**Arah** (`agent/pipeline.py::travel_direction`) — ditentukan dari perpindahan
bersih truk di layar, bukan dari perpotongan garis tengah frame. Lajur yang
terbingkai di satu sisi frame tetap terbaca. Sumbunya (`ltr`/`rtl`) adalah
geometri pemasangan kamera; **salah setel berarti setiap lintasan tercatat
terbalik, tanpa pesan galat.** Pusat yang memegang nilai ini setelah perangkat
terhubung.

**Antrean kirim** (`agent/outbox.py`) — basis data tahan-mati. Tiap lintasan
membawa kunci idempoten, jadi pengiriman ulang saat jaringan tersendat tidak
menggandakan ritase. Ini yang membuat pos tetap berguna saat pusat tidak
terjangkau.

**Pemeriksaan pemasangan** (`app/services/preflight.py`) — menjawab "apa yang
menghalangi", bukan sekadar "jalan atau tidak". Tiap kegagalan dibedakan dari
tetangganya, karena "pusat tidak terjangkau" dan "kunci salah ketik" punya
perbaikan yang sama sekali berbeda.

**`vendor/`** — salinan persis modul pencocokan milik pusat, supaya pos dan pusat
tidak pernah berbeda pendapat tentang nomor lambung yang sama. Dijaga oleh
`tests/test_vendor_sync.py`; jangan disunting sebelah pihak.

## Pengujian

```bash
cd edge/backend && uv run pytest
```

Menguji rekaman lewat rantai deteksi sungguhan bisa dari Konsol Gerbang, tombol
**Jalankan Uji** — memakai kode yang sama dengan operasi nyata, bukan tiruannya.
