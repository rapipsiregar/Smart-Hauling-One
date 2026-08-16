# Pusat (Core)

Mengumpulkan lintasan dari seluruh pos gerbang, memasangkannya menjadi ritase,
dan menyusun laporan. Pusat **tidak mendeteksi apa pun** — deteksi terjadi di
perangkat pos (lihat [`../edge/`](../edge/)).

| Bagian | Isi |
| :--- | :--- |
| [`backend/`](backend/) | API FastAPI, basis data, pemasangan ritase, laporan |
| [`frontend/`](frontend/) | Konsol Pusat (Next.js) |

## Menjalankan

Cara termudah dari akar repositori, menjalankan pusat sekaligus pos:

```bash
make up
```

Menjalankan pusat saja:

```bash
docker compose up -d core-backend core-frontend
```

| Alamat | Isi |
| :--- | :--- |
| `http://localhost:3000` | Konsol Pusat |
| `http://localhost:8000` | API pusat |
| `http://localhost:8000/docs` | Dokumentasi API interaktif |

### Tanpa Docker

```bash
cd core/backend  && uv sync && uv run uvicorn app.main:app --port 8000
cd core/frontend && npm install && npm run dev
```

Konsol Pusat membaca API lewat proksi yang **dibakukan saat build**. Bila port
API diubah, bangun ulang UI-nya dengan port yang sama — mengubahnya saat
`next start` tidak berpengaruh.

## Yang dikerjakan pusat

**Memasangkan ritase.** Satu ritase = satu lintasan masuk dipasangkan dengan satu
lintasan keluar oleh nomor lambung yang sama. Lintasan yang tidak menemukan
pasangannya tidak dibuang, melainkan ditandai — supaya terlihat dan bisa
ditinjau, bukan hilang diam-diam dari hitungan.

**Hari tambang.** Satu hari dihitung pukul 06:00 sampai 06:00 esok hari,
mengikuti siklus pelaporan di lapangan. Memotong per tanggal kalender akan
membelah setiap shift malam ke dua laporan, sehingga tidak ada satu pun yang
cocok dengan berkas lapangan.

**Pos cek.** Angka dikelompokkan per CP 01–CP 04. Pengelompokan per area tetap
tersedia untuk tampilan peta, tetapi dua pos bisa berbagi satu area — jadi bukan
satuan yang dipakai untuk rekonsiliasi.

**Master truk.** Daftar 584 unit dari berkas operator. Perangkat pos menyalinnya
supaya tetap bisa mengenali truk saat jaringan putus.

**Pencadangan.** Basis data dicadangkan sendiri tiap enam jam, diperiksa
keutuhannya, dan disimpan 30 hari. Yang gagal diperiksa dibuang, bukan disimpan.

## Pengaturan perangkat pos

Pusat yang memegang pengaturan tiap pos, di menu **Kamera Per Pos**:

- **Arah masuk** — gerakan mana di layar yang berarti truk masuk. Bila satu pos
  mencatat lintasan terbalik, perbaikannya dari sini, bukan dengan mendatangi
  perangkat.
- **Kunci akses** — terbitkan atau ganti kunci perangkat. Kunci hanya tampil
  sekali saat diterbitkan; sistem menyimpan sidik digitalnya saja.
- **Alamat RTSP dan IP perangkat.**

## Pengujian

```bash
cd core/backend && uv run pytest
```

## Dokumentasi rinci

- [`backend/README.md`](backend/README.md) — struktur API dan basis data
- [`frontend/README.md`](frontend/README.md) — halaman dan komponen
- [`backend/docs/`](backend/docs/) — PRD, model data, alur pengguna, kontrak API
