# Integrated Smart Hauling System

Membaca nomor lambung truk OHT dari kamera gerbang tambang secara otomatis, lalu
menghitung ritase tanpa pencatatan manual. **Deteksi berjalan di tiap gerbang**;
pusat mengumpulkan hasilnya dan menyusun laporan.

```
  GERBANG A ─ Jetson ─┐
  GERBANG B ─ Jetson ─┤      ┌──────────────────────────┐
  GERBANG C ─ Jetson ─┼─────▶│  PUSAT                   │
  GERBANG D ─ Jetson ─┘      │  kumpulkan + laporan     │
       │                     │  master truk (276 unit)  │
       │                     └──────────────────────────┘
  konsol lokal                          │
  tiap gerbang                   dashboard lintas-gerbang
```

Tiap gerbang berdiri sendiri: kamera → deteksi plat → OCR → voting konsensus →
cocokkan ke replika master lokal → simpan → antre kirim ke pusat. **Kalau
jaringan ke pusat mati, gerbang tetap mendeteksi, tetap mengenali truk, dan tetap
menyimpan** — datanya menyusul saat sambungan pulih.

---

## Daftar isi

| | |
| :--- | :--- |
| [Hasil pengujian nyata](#hasil-pengujian-nyata) | Angka dari 10 rekaman gerbang |
| [Menjalankan](#menjalankan) | Satu perintah untuk demo, atau lewat Docker |
| [Tampilan tiap halaman](#tampilan-tiap-halaman) | Tangkapan layar seluruh konsol |
| [Cara kerjanya](#cara-kerjanya) | Alur, algoritma, dan angka penyetelan |
| [Isi repositori](#isi-repositori) | Peta folder dan aturan duplikasi |
| [Dokumen presentasi](#dokumen-presentasi) | Dua deck siap pakai |
| [Pengujian](#pengujian) | Cara menjalankan suite |
| [Kalau ada yang aneh](#kalau-ada-yang-aneh) | Empat kegagalan nyata dan tandanya |
| [Yang belum selesai](#yang-belum-selesai) | Disebut apa adanya |

---

## Hasil pengujian nyata

Sepuluh rekaman gerbang asli (kamera CAM 04, 27 Oktober 2023), dijalankan lewat
tombol **Jalankan Uji** di konsol gerbang, mulai dari basis data kosong:

| Yang diuji | Hasil |
| :--- | :--- |
| Rekaman diproses | 10 |
| Nomor lambung terbaca benar | **10 / 10** |
| Cocok persis ke master 276 unit | **10 / 10** |
| Lintasan tercatat | **10** — satu rekaman = satu lintasan |
| Ritase terbentuk | **5**, tanpa sisa |
| Potongan plat tersimpan | **10 / 10** |
| Terkirim ke pusat | **10 / 10** (HTTP 201) |

Lama siklus diambil dari **jam yang tercetak di rekaman**, bukan waktu pemrosesan:

| Nomor Lambung | Masuk | Keluar | Siklus |
| :--- | :--- | :--- | :--- |
| HD 2152 | 08:14:02 | 08:22:47 | 8m 45s |
| HD 2221 | 09:03:15 | 09:11:50 | 8m 35s |
| HD 2222 | 10:05:33 | 10:14:09 | 8m 36s |
| HD 2241 | 11:02:21 | 11:10:58 | 8m 37s |
| HD 2264 | 13:47:12 | 13:56:40 | 9m 28s |

> **Belum ada klaim kecepatan.** Pengujian berjalan di GPU kelas desktop, bukan di
> Jetson. Angka fps dari perangkat berbeda tidak bisa dipindahkan begitu saja,
> jadi tidak ada janji throughput di dokumen mana pun sampai diukur di perangkat
> yang sebenarnya.

---

## Menjalankan

### Cara yang dipakai untuk demo — pusat + gerbang, dengan OCR sungguhan

Ini yang Anda butuhkan kalau ingin **benar-benar menjalankan deteksi**: pusat di
Docker, gerbang langsung di host supaya dapat GPU.

```bash
make demo-up        # nyalakan pusat + Gerbang A dan B
make demo-status    # lihat apa yang jalan dan tiap konsol menunjuk ke mana
make demo-restart   # setelah mengubah kode
make demo-down      # matikan semuanya
```

| Layanan | Alamat |
| :--- | :--- |
| Dashboard pusat | http://localhost:3050 |
| API pusat | http://localhost:8050/docs |
| Gerbang A (inbound) | http://localhost:3150 |
| Gerbang B (outbound) | http://localhost:3151 |

Lebih banyak gerbang: `GATES="a b c d" make demo-up`. Tiap gerbang butuh kunci
API sendiri — terbitkan dengan `make provision GATE=CAM-GATE-C`.

> **Kenapa gerbangnya tidak di Docker?** Deteksi butuh CUDA. Kontainer tanpa
> device passthrough akan diam-diam jatuh ke CPU yang tidak sanggup mengejar, dan
> hasilnya terlihat seperti pipeline rusak padahal cuma kurang satu flag.

> **GPU harus muat.** Tiap gerbang memuat YOLO + PaddleOCR-VL, sekitar 1,7 GB.
> Kalau ada proses lain yang memakan VRAM, gerbang akan OOM dan **semua truk
> terbaca UNKNOWN tanpa pesan galat apa pun**. Periksa dengan `nvidia-smi`
> sebelum menuduh OCR-nya yang salah.

### Cara cepat — Docker

```bash
make up        # bangun + nyalakan keempat layanan, lalu impor master truk
make urls      # tampilkan alamatnya
make down      # matikan
```

| Layanan | Alamat |
| :--- | :--- |
| Dashboard pusat | http://localhost:3000 |
| API pusat | http://localhost:8000/docs |
| Konsol gerbang | http://localhost:3100 |
| API gerbang | http://localhost:8100/docs |

### Keempat gerbang sekaligus

Untuk melihat konsol tiap gerbang berdampingan (hanya untuk pengembangan — di
produksi tiap pasang berjalan di Jetson-nya sendiri):

```bash
docker compose -f docker-compose.yml -f docker-compose.gates.yml up -d
```

| | Konsol | API |
| :--- | :--- | :--- |
| Gerbang A | http://localhost:3100 | :8100 |
| Gerbang B | http://localhost:3101 | :8101 |
| Gerbang C | http://localhost:3102 | :8102 |
| Gerbang D | http://localhost:3103 | :8103 |

Tiap gerbang punya basis datanya sendiri di `edge/backend/data/CAM-GATE-*/`.
Itu disengaja: kalau berbagi satu basis data, lintasan yang terdeteksi di gerbang
A akan muncul di riwayat gerbang B — justru kebalikan dari alasan konsol ini
dipisah.

### Tanpa Docker

Dibutuhkan saat ingin memakai stack deteksi sungguhan, yang sengaja tidak
dimasukkan ke image dev:

```bash
make build-ui  # sekali saja: pasang dependency & build kedua frontend
make dev
make dev-stop
```

Perintah lain: `make test`, `make seed` (impor master), `make demo` (isi lintasan
contoh), `make provision GATE=CAM-GATE-A` (terbitkan kunci API perangkat).

> **Port bentrok.** `make dev` memeriksa keempat port lebih dulu dan berhenti
> kalau ada yang sudah terpakai. Ini disengaja: sebelumnya port 8000 dipakai
> container proyek lain, dan UI diam-diam mem-proxy ke aplikasi asing lalu
> menampilkan 404-nya seolah milik kita.
>
> Kalau perlu port lain, **bangun ulang UI dengan port yang sama**, karena
> Next.js membakukan alamat backend saat `next build`, bukan saat `next start`:
>
> ```bash
> CORE_API_PORT=8001 make build-ui
> CORE_API_PORT=8001 make dev
> ```

> **GPU.** `pyproject.toml` menunjuk index CUDA PyTorch. Kalau venv terlanjur
> memasang wheel CPU, deteksi tetap berjalan tapi jauh lebih lambat. Periksa
> dengan `python -c "import torch; print(torch.cuda.is_available())"`.

---

## Tampilan tiap halaman

Seluruh tangkapan layar di [`tangkapan-layar/`](tangkapan-layar/) diambil dari
sistem yang berjalan dengan data hasil 10 rekaman nyata — bukan mockup.

### Konsol Pusat

| Halaman | Isinya |
| :--- | :--- |
| [Monitoring CCTV](tangkapan-layar/core-01-monitoring-cctv.jpg) | Dua layar gerbang berdampingan. Gambar mentah tanpa anotasi |
| [Riwayat Pembacaan](tangkapan-layar/core-02-riwayat-pembacaan.jpg) | Posisi armada & ritase, daftar pembacaan, rincian + foto plat |
| [Laporan Harian & Shift](tangkapan-layar/core-03-laporan-harian-shift.jpg) | Ritase per shift, sebaran per gerbang, ekspor Excel/PDF |
| [Konfigurasi Sistem](tangkapan-layar/core-04-konfigurasi-sistem.jpg) | Registri kamera, arah gerbang, model yang dipakai |
| [Perangkat Edge](tangkapan-layar/core-05-perangkat-edge.jpg) | Setelan inferensi dan kesehatan tiap perangkat |
| [Tayangan Langsung](tangkapan-layar/core-06-tayangan-langsung.jpg) | Video mentah satu gerbang — **belum tersambung** |

### Konsol Gerbang

| Bagian | Isinya |
| :--- | :--- |
| [Status & Proses Deteksi](tangkapan-layar/edge-01-konsol-gerbang.jpg) | Empat penanda status, panel uji pembacaan |
| [Lintasan Terbaru](tangkapan-layar/edge-02-lintasan-terbaru.jpg) | Riwayat milik gerbang itu sendiri |
| [Voting & potongan plat](tangkapan-layar/edge-03-voting-dan-crop-plat.jpg) | Bukti di balik satu pembacaan |

Empat penanda status di atas: **Kamera**, **Arah Gerbang**, **Kiriman ke Pusat**,
**Menunggu Dikirim**. Arah gerbang datang dari pusat, bukan ditebak dari kode
kamera — kode `CAM-GATE-A` tidak mengandung petunjuk apa pun soal arah, padahal
arah itulah yang menentukan sebuah lintasan dihitung sebagai masuk atau keluar.
Kalau pusat belum menyinkronkan, tertulis "Belum diketahui" alih-alih menebak.

**Panel deteksi menampilkan prosesnya, bukan cuma hasilnya.** Selama rekaman
diproses, tiap percobaan OCR muncul satu per satu — nomor gambar, apa yang
terbaca, dan keyakinannya — termasuk percobaan yang gagal. Contoh nyata dari
rekaman `2221 - Out`:

| Gambar | Terbaca |
| :--- | :--- |
| #167 | 2221 |
| #175 | **2018** ← salah baca |
| #181 | tak terbaca |
| **Konsensus** | **2221** ✓ |

Percobaan gagal sengaja ikut ditampilkan: itu tetap tanda perangkat sedang
bekerja, dan menyembunyikannya membuat rekaman yang platnya sulit terbaca
terlihat seperti proses macet. Sebelum ini panel diam puluhan detik lalu tiba-tiba
memunculkan jawaban — tidak bisa dibedakan dari hang, dan refleksnya menekan
tombol dua kali.

### Alur deteksi

| Tahap | |
| :--- | :--- |
| [Gerbang masuk](tangkapan-layar/alur-01-gerbang-masuk.jpg) | HD 2152 dikenali, 31 pembacaan, langsung terkirim |
| [Gerbang keluar](tangkapan-layar/alur-02-gerbang-keluar.jpg) | Truk yang sama keluar — satu ritase terbentuk |

> **Mode Panduan.** Ikon buku di pojok kanan atas konsol pusat mengganti isi
> setiap kartu menjadi penjelasan: kartu itu untuk apa, angkanya dari mana, dan
> apa yang perlu diperhatikan. Berguna saat melatih operator baru.

---

## Cara kerjanya

### Enam utas di dalam perangkat gerbang

| Utas | Tugas |
| :--- | :--- |
| `CaptureThread` | Baca RTSP ke ring buffer dangkal (3 frame). Frame lama dibuang kalau inferensi tertinggal |
| `InferenceLoop` | YOLO lalu OCR, berurutan per frame |
| `DetectionWindow` | Mesin status yang menentukan batas satu truk |
| `LocalFinalizer` | Voting, cocokkan ke replika master, simpan |
| `OutboxSender` | Antrean kirim tahan mati listrik, satu baris pada satu waktu |
| `MasterSync` + `Heartbeat` | Jaga replika master, laporkan kesehatan |

### Angka penyetelan, dan asalnya

| Setelan | Nilai | Dasar |
| :--- | :--- | :--- |
| `detect_window_sec` | 10 detik | Truk terlihat ~8 detik di rekaman; window harus lebih panjang |
| `NO_DETECTION_GRACE_SEC` | 2,5 detik | **Diukur**: jeda terpanjang plat tidak terlihat 1,87 detik |
| `POST_WINDOW_COOLDOWN_SEC` | 1 detik | Cegah ekor truk membuka jendela kedua |
| `MAX_FUZZY_DISTANCE` | 1 | Pada jarak 2, kode 4 digit bertabrakan terus |

Ambang jeda sebelumnya 1,5 detik dan **memecah satu truk jadi dua lintasan** —
jendela kedua hanya menangkap logo CAT di kabin. Nilainya diukur ulang di
kesepuluh rekaman, bukan ditebak.

### Voting konsensus

Tiap jendela mengumpulkan puluhan pembacaan, dikelompokkan dengan jarak edit
maksimal 1. Bobot satu pembacaan = keyakinan deteksi × keyakinan OCR. Kelompok
dengan bobot terbesar menang.

Contoh nyata: `2152` menang **95%** dari 18 pembacaan, `CA7` (logo CAT) kalah
**5%** dari 1 pembacaan. Tanpa voting, satu frame yang kebetulan menangkap logo
bisa jadi jawaban akhir.

### Pencocokan ke daftar armada

Kamera hanya membaca 4 digit — awalan operator tidak dicat sebesar itu. Cocok
persis dipakai; selisih 1 digit dikoreksi; **kalau dua unit sama dekatnya,
sengaja tidak ditebak** dan disimpan sebagai tidak dikenali. Menebak berarti
ritase tercatat pada truk yang salah.

**Khusus gerbang keluar**: dicocokkan dulu ke truk yang sedang di dalam pit —
truk yang keluar pasti truk yang tadi masuk. Himpunan itu biasanya beberapa unit,
bukan 276. Kalau gagal, baru jatuh ke master penuh, supaya satu deteksi masuk
yang terlewat tidak menghukum truk itu selamanya.

### Mengulang pengujian dari nol

**Konfigurasi Sistem → Hapus Hasil Deteksi** mengosongkan lintasan di pusat
**dan** di tiap perangkat gerbang lewat satu tombol.

Keduanya perlu karena tiap gerbang menyimpan basis datanya sendiri. Kalau hanya
pusat yang dihapus, gerbang masih memegang bacaan lama dan pengujian berikutnya
dimulai dari dua catatan yang tidak sama — justru kebingungan yang tombol ini
ada untuk mencegahnya.

Hasilnya dilaporkan **per gerbang, termasuk yang gagal**. Gerbang yang sedang
tidak terjangkau ditandai merah dengan keterangan bahwa perangkat itu masih
memegang datanya — bukan diam-diam dianggap berhasil. Satu gerbang mati tidak
menghentikan yang lain.

Yang **tidak** ikut terhapus: daftar armada 276 unit, registri kamera, dan kunci
API perangkat. Kehilangan salah satunya membuat sistem terlihat rusak padahal
hanya kehilangan pengaturannya.

Alamat gerbang yang dijangkau diambil dari `DEV_GATE_RESET_URLS` di `.env`.
Gerbang yang tidak terdaftar di sana **tidak akan tersentuh dan tidak muncul di
laporan sama sekali** — itu batasan nyata dari pendekatan berbasis daftar ini.

---

## Isi repositori

| Folder | Isi | Jalan di |
| :--- | :--- | :--- |
| `core/backend` | FastAPI: penampung lintasan, master truk, laporan, API perangkat | server |
| `core/frontend` | Dashboard lintas-gerbang (Next.js) | server |
| `edge/backend` | FastAPI lokal + thread deteksi | tiap Jetson |
| `edge/frontend` | Konsol satu gerbang | tiap Jetson |
| `tangkapan-layar/` | Bukti tampilan tiap halaman | — |

`edge/` sengaja **tidak** mengimpor apa pun dari `core/` — harus bisa dipasang
sendirian ke perangkat. Algoritma bersama (pencocokan dan voting) disalin ke
`edge/backend/vendor/`, dan `edge/backend/tests/test_vendor_sync.py` memastikan
salinannya identik byte demi byte.

> Kalau tes itu gagal, **salin ulang dari `core/`** — jangan perbaiki salinan
> edge sendiri-sendiri. Justru itu yang membuat truk yang sama dikenali berbeda
> di gerbang dan di pusat, lalu rekonsiliasi ritase diam-diam berhenti cocok
> dengan dirinya sendiri.

---

## Dokumen presentasi

| Berkas | Untuk |
| :--- | :--- |
| [`Integrated-Smart-Hauling-System-Panduan-Halaman.pptx`](Integrated-Smart-Hauling-System-Panduan-Halaman.pptx) | Panduan pakai, halaman per halaman. Dua bagian: pusat dan gerbang |
| [`Integrated-Smart-Hauling-System-Teknis.pptx`](Integrated-Smart-Hauling-System-Teknis.pptx) | Teknis penuh: sejarah arsitektur, alur, algoritma, pertimbangan perangkat |

---

## Pengujian

```bash
make test            # kedua suite
```

| Suite | Jumlah | Menjaga |
| :--- | ---: | :--- |
| `core/backend` | 174 | Kontrak API, bentuk respons, ritase, pencocokan, ingestion |
| `edge/backend` | 105 | Jendela deteksi, antrean, API gerbang, sinkronisasi salinan |

Termasuk tes yang memastikan salinan algoritma di gerbang identik byte demi byte
dengan aslinya di pusat, dan tes yang memastikan seluruh modul perangkat
benar-benar bisa diimpor — celah yang pernah membuat agen gerbang tidak bisa
start sama sekali tanpa satu tes pun gagal.

---

## Kalau ada yang aneh

Empat kegagalan yang pernah benar-benar terjadi, beserta tandanya. Ketiganya
menyamar sebagai masalah lain, dan itulah alasan dicatat di sini.

### Semua truk terbaca UNKNOWN

Hampir selalu **GPU kehabisan memori**, bukan OCR yang salah.

```bash
nvidia-smi --query-compute-apps=pid,used_memory --format=csv
```

Tiap gerbang memuat YOLO + PaddleOCR-VL, sekitar **1,7 GB**. Kalau ada proses
lain yang memakan VRAM, gerbang OOM dan menghasilkan nol pembacaan — yang lalu
dicatat sebagai `unreadable` → `UNKNOWN`.

> **Ini cacat yang belum diperbaiki.** Kegagalan perangkat keras saat ini
> **tidak bisa dibedakan** dari "plat memang tidak terbaca": `last_error` tetap
> `null` dan tidak ada peringatan di layar mana pun. Di lapangan, Jetson yang
> kehabisan VRAM akan diam-diam melaporkan seluruh truk sebagai UNKNOWN tanpa
> alarm apa pun. Sampai diperbaiki, `nvidia-smi` adalah satu-satunya cara tahu.

### Dua konsol gerbang menampilkan perangkat yang sama

Next.js membekukan aturan rewrite ke `routes-manifest.json` **saat build**, bukan
saat start — jadi menyetel `EDGE_BACKEND_ORIGIN` sebelum `next start` tidak
berpengaruh. Gerbang yang berbagi satu build akan semuanya menunjuk ke backend
yang terakhir di-build.

`make demo-up` sudah menanganinya: tiap gerbang mendapat direktori build sendiri
lewat `EDGE_NEXT_DIST`. Periksa dengan `make demo-status` — kolom terakhir
menyebut perangkat mana yang sebenarnya dilayani tiap konsol.

Di Jetson sungguhan hal ini tidak berlaku: satu perangkat, satu backend, selalu
localhost.

### Port sudah terpakai padahal sudah dihentikan

`next start` bersarang tiga proses — `npx`, `sh`, `next-server` — dan
`next-server` tidak cocok dengan pola yang mematikan dua lainnya. Ia bertahan
memegang port, lalu terlihat seperti bentrok port sungguhan.

`make demo-down` menyapu berdasarkan port, bukan hanya PID tercatat.

### Tombol reset tidak mengosongkan gerbang

Periksa `DEV_GATE_RESET_URLS` di `.env`. Gerbang yang tidak terdaftar di sana
tidak akan tersentuh, dan karena tidak terdaftar ia juga tidak muncul sebagai
kegagalan di laporan.

---

## Catatan penerapan

`docker-compose.yml` di sini **khusus pengembangan** — menyalakan keempat layanan
di satu mesin. Di produksi tidak pernah begitu: pasangan `edge/*` berjalan di
masing-masing dari 4 Jetson Orin Nano Super (ARM64, lewat
`edge/backend/Dockerfile.jetson`), dan pasangan `core/*` di server.

Image dev `edge-backend` juga tidak memuat `ultralytics`/`paddleocr`: dengan
`SMART_GATE_RUN_AGENT=false`, API, replika master, dan pencocokan lokal tetap
bisa diuji tanpa kamera, model, atau GPU.

> Variabel `SMART_GATE_*`, nama container, dan `smart_gate.db` sengaja **tidak**
> ikut diganti nama saat produk berganti nama. Itu identitas teknis; mengubahnya
> mematikan deployment yang berjalan dan kunci API perangkat yang sudah
> di-provision.

---

## Dokumentasi

Proyek ini memakai metodologi **Chain of Truth** — lihat
[`core/backend/AGENTS.md`](core/backend/AGENTS.md):

* [`docs/PRD.md`](core/backend/docs/PRD.md) — narasi bisnis dari RFQ
* [`docs/edge-system/`](core/backend/docs/edge-system/) — spesifikasi teknis perangkat gerbang
* [`docs/data_model.md`](core/backend/docs/data_model.md) · [`docs/information_architecture.md`](core/backend/docs/information_architecture.md) · [`docs/design_system.md`](core/backend/docs/design_system.md)
* [`docs/feature-list.md`](core/backend/docs/feature-list.md) — inventaris fitur

---

## Yang belum selesai

* **Rantai deteksi belum pernah berjalan dari kamera langsung** — baru dari
  rekaman. Semua angka di dokumen ini berasal dari rekaman.
* **Kecepatan belum diukur di Jetson.** Karena itu tidak ada klaim fps di mana
  pun. Rinciannya di `core/backend/docs/edge-system/PRD.md` §8.
* **Tayangan langsung WebRTC** (`WhipPusher._push`) sengaja belum
  diimplementasikan sampai ada media relay sungguhan untuk mengujinya — menulis
  negosiasi WebRTC tanpa lawan uji menghasilkan kode yang tampak benar dan tidak
  pernah bekerja.
* **Kegagalan GPU menyamar sebagai hasil deteksi normal.** OOM CUDA
  menghasilkan nol pembacaan, dicatat sebagai `unreadable`/`UNKNOWN`, dan
  `last_error` tetap `null` — tidak terbedakan dari plat yang memang tidak
  terbaca. Perbaikannya: tangkap `torch.cuda.OutOfMemoryError` di jalur
  inferensi, isi `last_error`, dan tandai lintasannya sebagai gagal-perangkat.
* **Penyimpanan rekaman 7 hari** untuk sengketa sudah ada kodenya
  (`agent/video_retention.py`) tapi belum dirangkai ke layanan gerbang.
* **Pemisahan compose per-peran** untuk produksi ditunda sampai arsitekturnya
  mengendap.
