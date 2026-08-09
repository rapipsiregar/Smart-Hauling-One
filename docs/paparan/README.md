# Paparan (deck) — 8 Agustus 2026

Dua deck, dan bahan mentahnya. Keduanya memakai gaya rumah yang sama dengan
`core/frontend/docs/SmartGate-Monitoring-Ritase.pptx` (13,33 × 7,5 in, dasar
`#07090D`, garis aksen amber, judul Segoe UI, Consolas untuk apa pun yang
bersifat mesin).

| Berkas | Isi |
| :--- | :--- |
| `../../ISHS-Perubahan-Teknis-2026-08-08.pptx` | 17 slide. Audiens teknis: empat gelombang perubahan hari ini, menyebut berkas dan endpoint, plus setiap bug beserta kegagalan yang dicegahnya. |
| `../../ISHS-Panduan-Penggunaan-2026-08-08.pptx` | 15 slide. Satu siklus ritase dari ujung ke ujung: gerbang siaga → pembacaan masuk → posisi truk di pusat → pembacaan keluar → ritase → laporan → PDF → Excel. |

## Bahan

- `tangkapan-layar/` — sebelas tangkapan layar, semuanya dari **satu kali jalan
  yang sama** pada 2026-08-08: enam truk masuk lewat CAM-GATE-A, keluar lewat
  CAM-GATE-B, salah satunya (`8901`) memang tidak ada di master 276 unit. Bukan
  mockup dan bukan data contoh.
- `LAPORAN_RITASE_2026-08-08_SIANG_0700-1900.pdf` / `.xlsx` — berkas ekspor
  sungguhan dari jalan tersebut, diunduh dari halaman Laporan Harian & Shift.
  Inilah yang di-render pada dua slide terakhir deck panduan.
- `deck_kit.py`, `build_deck_perubahan.py`, `build_deck_panduan.py` — pembangun
  deck. Jalankan ulang setelah tangkapan layar diperbarui, jangan mengedit
  `.pptx` sebagai sumber:

```bash
# dari akar repo, memakai venv yang punya python-pptx + Pillow
core/backend/.venv/bin/python docs/paparan/build_deck_perubahan.py \
    docs/paparan ISHS-Perubahan-Teknis-2026-08-08.pptx
core/backend/.venv/bin/python docs/paparan/build_deck_panduan.py \
    docs/paparan ISHS-Panduan-Penggunaan-2026-08-08.pptx
```

Argumen pertama adalah folder yang memuat `tangkapan-layar/`; argumen kedua
adalah berkas keluaran.

## Catatan isi

Angka pada deck teknis diukur pada 2026-08-08, bukan dikutip dari dokumen. Slide
penutupnya memuat daftar hal yang **belum** selesai — termasuk bahwa pengukuran
belum dilakukan di Orin Nano Super yang sebenarnya, dan bahwa tanda "belum
terdaftar" belum ikut ke PDF/Excel.

Deck panduan memakai `Detail: OFF` di hampir semua slide, sesuai permintaan IT
lokasi agar angka keyakinan dan hasil pencocokan tidak tampil. Satu slide
(Langkah 2b) sengaja memakai `Detail: ON` untuk menunjukkan gunanya saklar itu
ketika sebuah pembacaan perlu ditelusuri.
