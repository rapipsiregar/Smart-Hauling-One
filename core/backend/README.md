# API Pusat

FastAPI + SQLite. Menerima lintasan dari perangkat pos, memasangkannya menjadi
ritase, dan menyajikan laporan. **Tidak mendeteksi apa pun** — deteksi terjadi di
perangkat pos ([`../../edge/`](../../edge/)).

## Menjalankan

Dari akar repositori, bersama seluruh sistem:

```bash
make up
```

Sendirian, tanpa Docker:

```bash
cd core/backend
uv sync
uv run uvicorn app.main:app --port 8000
```

| Alamat | Isi |
| :--- | :--- |
| `http://localhost:8000/api/...` | API |
| `http://localhost:8000/docs` | Dokumentasi interaktif |
| `http://localhost:8000/media/...` | Foto bukti lintasan |

Tabel dibuat sendiri saat proses menyala, jadi basis data kosong pun langsung
bisa dipakai. Basis data awal beserta master truk sudah ikut di repositori.

## Perintah

```bash
uv run python main.py --help                       # seluruh perintah
uv run python main.py import-master <berkas.xlsx>  # impor master truk
uv run python main.py provision-device CAM-GATE-A  # terbitkan kunci perangkat
uv run pytest                                      # jalankan pengujian
```

## Struktur

```
app/
  routers/        endpoint HTTP — tipis, tanpa logika
  services/       logika: pemasangan ritase, hari tambang, pencocokan, backup
  repositories/   akses SQLite
  schemas/        model permintaan/tanggapan
  core/           konfigurasi dan koneksi basis data
data/             basis data, master truk, foto bukti
docs/             PRD, model data, alur pengguna, kontrak API
tests/            pytest
```

## Yang perlu dipahami sebelum mengubah

**Hari tambang** (`services/mining_day.py`) — satu hari = 06:00 sampai 06:00 esok
hari. Semua angka berjendela melewati modul ini, jadi definisi "hari" hanya ada
satu. Memotong per tanggal kalender akan membelah tiap shift malam ke dua
laporan.

**Pemasangan ritase** (`services/ritase.py`) — satu masuk dipasangkan dengan satu
keluar per nomor lambung. Lintasan yang tidak berpasangan ditandai, tidak
dibuang.

**Pos cek** (`services/reference.py`) — pengelompokan memakai nama kamera
(CP 01–CP 04), bukan kolom `lane` yang berisi area. Dua pos bisa berbagi satu
area, jadi mengelompokkan per area akan menyatukan keduanya.

**Pencocokan keluar** (`services/hull_matcher.py`) — bacaan yang cocok persis
dengan master selalu menang. Penyempitan ke daftar truk yang sedang di dalam
hanya membantu bacaan yang memang meragukan; sebelumnya penyempitan itu
"mengoreksi" bacaan sempurna menjadi truk lain.

**Jendela waktu dieksekusi di SQL** (`repositories/video_results_repo.py`) —
bukan disaring di Python setelah seluruh tabel dimuat. Pada beban target 15.000
ritase per hari, perbedaannya 68 detik lawan kurang dari satu detik.

**Pencadangan** (`services/backup.py`) — memakai API backup SQLite, bukan salin
berkas: menyalin basis data yang hidup menghasilkan berkas robek. Tiap cadangan
diperiksa keutuhannya sebelum diterima.

## Pengaturan

Lewat berkas `.env` di akar repositori. Yang dibaca layanan ini:

| Variabel | Kegunaan |
| :--- | :--- |
| `SMART_GATE_CORE_PUBLIC_URL` | Alamat pusat sebagaimana dihubungi perangkat pos |
| `SMART_GATE_DISABLE_BACKUP` | Isi `true` bila pencadangan diurus di luar aplikasi |
| `DEV_GATE_RESET_URLS` | Alamat reset pos yang ikut dibersihkan tombol reset |

## Dokumentasi

Rincian ada di [`docs/`](docs/) — PRD, model data, alur pengguna, kontrak API,
dan rencana implementasi. Berkas-berkas itu adalah sumber kebenaran; kode
mengikutinya, bukan sebaliknya.
