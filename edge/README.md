# Perangkat Pos Gerbang

Satu pos gerbang = satu kamera = satu perangkat, dengan backend dan konsolnya
sendiri. Perangkat menyimpan datanya sendiri dan tetap merekam saat jaringan ke
pusat putus, lalu mengirim susulan begitu tersambung lagi.

## Memasang perangkat baru

Di Konsol Pusat lebih dulu:

1. Daftarkan pos di **Konfigurasi Sistem** — catat kode posnya (misal `CAM-GATE-E`).
2. Buka **Kamera Per Pos** → pos tersebut → **Terbitkan Kunci**.
   Salin kuncinya sekarang; kunci hanya ditampilkan satu kali.
   Salin juga **Alamat Pusat** dari kartu yang sama.

Lalu di perangkat:

```bash
git clone <repo> smart-gate && cd smart-gate/edge
./install.sh
```

Skrip menanyakan empat hal — kode pos, alamat pusat, kunci akses, alamat RTSP
kamera — menuliskannya ke `.env`, membangun, menjalankan, lalu **memeriksa
sambungannya ke pusat**. Selesai.

Pemeriksaan itu penting: perangkat dengan kunci salah ketik tetap menyala
sempurna dan tidak mengirim apa pun. Skrip ini melaporkan penyebabnya, bukan
sekadar "gagal".

## Setelah terpasang

```bash
./install.sh --check      # periksa ulang sambungan kapan saja
docker compose up -d      # jalankan
docker compose logs -f    # lihat log
```

Konsol Gerbang ada di `http://<alamat-perangkat>:3100`.

## Rekaman untuk pengujian

Tombol **Jalankan Uji** di Konsol Gerbang menawarkan dua kelompok:

| Kelompok | Asal | Isi |
| :--- | :--- | :--- |
| Klip gate ini | `backend/video-sources/` | Sepuluh rekaman gerbang asli, lima truk masuk dan keluar |
| Video contoh | `docs/sample-references/sample-video/sample-videos/` | Rekaman rujukan, bukan armada pos ini |

Video contoh dipasang read-only dan **tidak pernah digabung** ke rekaman pos:
mencampurnya akan menaruh video tak berkaitan ke dalam folder yang diperlakukan
pos sebagai catatannya sendiri, dan itu tidak bisa dibatalkan. Bila ada nama yang
sama, rekaman pos yang menang.

Pilihan **"Semua klip gate"** sengaja hanya menjalankan rekaman pos. Video contoh
harus dipilih satu per satu berdasarkan namanya — karena menjalankannya **tetap
mencatat lintasan di pos ini**, dan menyapu seluruh rujukan sekaligus akan
mengisi catatan pos dengan truk milik orang lain.

Menambah rekaman contoh cukup dengan menaruh berkasnya di folder tersebut; tidak
ada langkah lain. Folder yang dipakai bisa diubah lewat `SMART_GATE_SAMPLE_CLIP_DIR`.

## Menyalakan deteksi

Deteksi butuh kamera, GPU, dan berkas model, jadi bawaannya mati supaya
perangkat bisa dipasang dan diperiksa lebih dulu. Setelah pemeriksaan lulus:

1. Letakkan berkas model di `edge/model/model.pt`
2. Ubah `SMART_GATE_RUN_AGENT=true` di `edge/.env`
3. `docker compose up -d`

## Pengaturan yang dipegang pusat

Arah gerak truk, laju deteksi, dan ambang pembacaan **tidak** diatur di
perangkat. Semuanya diatur di Konsol Pusat → Kamera Per Pos, dan perangkat
mengambilnya pada detak berikutnya (±30 detik).

Termasuk **arah masuk** — kalau satu pos mencatat semua lintasan terbalik,
betulkan dari dasbor, bukan dengan SSH ke perangkat.

## Kalau perlu ganti kunci

Terbitkan ulang di Konsol Pusat, lalu di perangkat:

```bash
nano .env                 # ganti SMART_GATE_API_KEY
docker compose up -d
./install.sh --check
```

Kunci lama berhenti berlaku seketika saat yang baru diterbitkan. Selama
terputus, lintasan tetap ditahan di perangkat dan terkirim setelah tersambung.

> Jangan menyalin `.env` dari pos lain lalu hanya mengganti kode posnya. Satu
> kunci milik satu pos, dan perangkat akan terautentikasi sebagai pos yang salah
> — lintasannya tercatat di pos yang keliru, diam-diam. Pemeriksaan
> `./install.sh --check` menangkap hal ini.
