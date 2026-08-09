"""Deck 1 — Perubahan Teknis 2026-08-08 (core + edge).

Technical audience: names files, endpoints and the failure each change prevents.
Scope is this session only; every number in here was measured today, not quoted
from a document.
"""

import sys
sys.path.insert(0, sys.argv[1])

from deck_kit import (  # noqa: E402
    cards_slide, closing_slide, new_deck, prose_slide, shot_slide, table_slide,
    title_slide, two_shot_slide,
)

S = sys.argv[1]
SHOTS = f"{S}/deck-shots"
FOOT = "ISHS  ·  Perubahan Teknis  ·  2026-08-08"
TOTAL = 17

prs = new_deck()
p = 0


def nxt():
    global p
    p += 1
    return p


title_slide(
    prs,
    "CATATAN PERUBAHAN  ·  CORE + EDGE",
    "Perubahan Teknis 8 Agustus 2026",
    "Empat gelombang kerja: OCR keluar dari thread deteksi, arah gate dari pusat, "
    "penghitungan ritase IN→OUT, dan pemisahan tampilan operator dari tampilan diagnosa.\n"
    "Semua angka di deck ini hasil pengukuran hari ini, bukan kutipan dokumen.",
    "Suite: core 196 lulus  ·  edge 186 lulus",
)
nxt()

cards_slide(
    prs, "RINGKAS", "Empat Gelombang",
    [
        ("01", "HUD Gate Async",
         "OCR dipindah keluar dari thread deteksi. Mesin pembaca jadi bisa dipilih. "
         "Konsol gate dibangun ulang mengikuti sample-ui."),
        ("02", "Arah Gate",
         "Edge belajar arahnya dari pusat saat boot: Gate A masuk, Gate B keluar. "
         "Tiga bug yang membuat sambungan ini terlihat tidak jalan."),
        ("03", "Ritase IN→OUT",
         "Angka hasil baca akhirnya sampai ke pusat, sehingga posisi truk dan "
         "ritase bisa dihitung. Truk di luar master tercatat dan ditandai."),
        ("04", "Detail ON/OFF",
         "Satu saklar memisahkan tampilan operator dari tampilan diagnosa. "
         "Kata \"OCR\" hilang dari seluruh layar."),
    ],
    FOOT, nxt(), TOTAL,
    note="Yang tidak berubah: algoritma voting dan pencocokan. vendor/ocr_utils.py dan "
         "vendor/hull_matching.py tetap byte-identik dengan salinan core — dijaga "
         "tests/test_vendor_sync.py.",
)

prose_slide(
    prs, "GELOMBANG 01  ·  AKAR MASALAH", "OCR Memblokir Thread Deteksi",
    [
        ("Yang terjadi sebelumnya",
         "InferenceLoop.run memanggil run_ocr_on_crop di dalam loop, di antara satu frame "
         "dan berikutnya. Pada ~0,5 detik per potongan gambar, penangkapan frame berhenti "
         "setengah detik setiap kali menemukan sesuatu."),
        ("Akibat yang terlihat",
         "Kotak deteksi membeku di layar setiap kali sistem menemukan plat — persis saat "
         "operator paling ingin melihatnya bergerak. Frame terlewat, dan jam jendela "
         "deteksi terus berjalan tanpa ada yang mengawasi."),
        ("Perbaikan",
         "agent/ocr_worker.py — OcrPool: kumpulan thread pembaca di belakang antrean "
         "berbatas. Thread deteksi tidak pernah menunggu; submit() tidak pernah memblokir."),
        ("Dua invarian yang menahannya",
         "(1) Hasil baca hanya dimasukkan oleh thread deteksi, sehingga DetectionWindow "
         "tetap mesin status satu-thread sesuai SRS §3.2. (2) Antrean membuang, bukan "
         "menumpuk — backlog berarti jendela menerima bacaan truk yang sudah lewat."),
    ],
    FOOT, nxt(), TOTAL,
)

prose_slide(
    prs, "GELOMBANG 01  ·  JEBAKAN", "Perangkap yang Dibuat Perbaikan Itu",
    [
        ("Jendela tutup sebelum bacaannya kembali",
         "Jendela yang tutup sesuai jadwal sementara potongan gambarnya masih di antrean "
         "akan mencatat UNKNOWN untuk setiap truk. Diam-diam, dan total."),
        ("Penjaga: OCR_DRAIN_GRACE_SEC = 4,0",
         "Penutupan ditunda selama masih ada pekerjaan berjalan, dan dibatasi 4 detik agar "
         "satu worker yang macet tidak menahan jendela selamanya. Dua-duanya gagal secara "
         "senyap — itu sebabnya dibatasi di kedua ujung."),
        ("Bus tampilan: agent/live_state.py",
         "Frame, kotak, dan potongan gambar per jejak. Berbatas 8 jejak × 24 potongan — "
         "perangkat berjalan berbulan-bulan, buffer tak berbatas adalah kebocoran dengan "
         "sekring panjang."),
        ("Byte gambar tidak masuk JSON",
         "Potongan gambar diambil lewat URL terpisah. Menyisipkannya sebagai base64 akan "
         "menaruh satu megabyte gambar di setiap polling layar yang menyegar beberapa kali "
         "per detik."),
    ],
    FOOT, nxt(), TOTAL,
)

table_slide(
    prs, "GELOMBANG 01  ·  MESIN PEMBACA", "Dua Mesin, Diukur pada Potongan Gambar Identik",
    ["Mesin", "Berkas model", "Per potongan", "Perangkat", "Benar (13 klip terbaca)"],
    [
        ["PP-OCRv6 tiny", "4,5 MB", "15 ms", "CPU", "12 / 13"],
        ["PaddleOCR-VL 1.6", "1 800 MB", "514 ms", "GPU", "13 / 13"],
    ],
    FOOT, nxt(), TOTAL,
    col_w=[3.0, 2.2, 2.0, 1.8, 3.2],
    highlight=0,
    note="Yang kecil jadi bawaan: 400× lebih ringan dan 35× lebih cepat di perangkat yang "
         "lebih lemah — menentukan untuk Jetson di balik Starlink tanpa jalur kedua. "
         "agent/ocr_backends.py; SMART_GATE_OCR_BACKEND=paddleocr-vl untuk pindah per perangkat.\n"
         "Adapter ada supaya vendor/ocr_utils.py tetap byte-identik: PP-OCR mengembalikan "
         "{rec_text, rec_score}, helper bersama hanya mengerti bentuk PaddleOCR-VL.",
)

table_slide(
    prs, "GELOMBANG 01  ·  UJI MODEL", "15 Klip Rekaman Tambang Nyata",
    ["Tahap", "Hasil", "Target", "Kesimpulan"],
    [
        ["Deteksi plat (YOLO)", "15/15 klip, rata-rata 0,87", "yolo_fps 20", "13–35 ms/frame = 30–75 fps"],
        ["Pembacaan (tiny)", "12/13 klip terbaca benar", "—", "1 gagal, di plat kontras rendah"],
        ["Pembacaan (VL)", "13/13 klip terbaca benar", "—", "menang di plat yang sulit itu"],
        ["Klip tak terbaca", "1 klip (640×352, kabur)", "—", "ditolak dengan benar"],
    ],
    FOOT, nxt(), TOTAL,
    col_w=[3.2, 3.4, 2.0, 3.6],
    note="Satu kegagalan itu justru hasil yang menenangkan: plat sebenarnya 5806, terbaca "
         "J808 — tapi dengan porsi suara 0,29 dari biasanya 1,00. Jadi muncul sebagai bacaan "
         "berkeyakinan rendah yang bisa ditinjau, bukan jawaban salah yang terlihat yakin.\n"
         "Catatan penting: ini klip YouTube, nomornya tidak ada di master 276 unit — mengukur "
         "pembacaan, bukan identifikasi. Dan belum diukur di Orin Nano Super yang sebenarnya.\n"
         "Angka lama \"12–15 detik per potongan, 50× terlalu lambat\" ternyata hasil CPU saja; "
         "di GPU 0,5 detik. Sudah dikoreksi di docs/edge-system/PRD.md §8.",
)

shot_slide(
    prs, "GELOMBANG 01  ·  KONSOL GATE", "Konsol Gate Dibangun Ulang",
    f"{SHOTS}/03-gate-a-detail-on.jpg",
    [
        "Tata letak mengikuti sample-ui.mp4; warna, kaca dan tipografi memakai token yang "
        "sama dengan konsol pusat.",
        "Kiri: lintasan dengan potongan gambarnya. Tengah: tayangan + kotak. Bawah: potongan "
        "yang dipakai membaca. Kanan: nomor diperbesar + voting. Bawah: kesehatan perangkat.",
        "Tidak ada yang dibuang: kartu kesehatan jadi strip bawah, pengaturan dan uji "
        "pencocokan masuk drawer, rincian voting dibuka dari daftar kiri.",
        "Endpoint baru: GET /api/live/state, /api/live/crops/{track}/{index}, "
        "/api/live/stream (MJPEG), POST /api/live/reset.",
        "Jejak = jendela deteksi, jadi potongan berlabel T#7 C#3 bisa dilacak ke voting yang "
        "tepat.",
    ],
    FOOT, nxt(), TOTAL,
    caption="Detail: ON — tampilan diagnosa",
)

prose_slide(
    prs, "GELOMBANG 02  ·  ARAH GATE", "Pusat yang Memiliki Arah, Edge yang Belajar",
    [
        ("Rantainya",
         "cameras.direction di pusat adalah pemiliknya. GET /api/edge/config mengirimkannya, "
         "edge menyimpannya di meta gate_direction agar tetap tahu arah saat jaringan mati. "
         "Terverifikasi: Gate A masuk, Gate B keluar, 276 unit master direplikasi saat boot."),
        ("Bug 1 — klip hilang",
         "list_clips mewajibkan penanda IN/OUT di nama berkas. Begitu gate tahu arahnya, "
         "folder rekaman tanpa penanda jadi \"Semua klip (0)\" tanpa penjelasan. Sekarang klip "
         "disembunyikan hanya kalau namanya mengklaim arah sebaliknya."),
        ("Bug 2 — pusat dilaporkan terputus",
         "core_reachable dipaku false tanpa agent, jadi layar bilang \"Terputus\" pada "
         "perangkat yang baru saja mengambil config dari pusat. Sekarang jatuh ke waktu "
         "kontak terakhir; /api/status juga mengembalikan core_last_contact."),
        ("Bug 3 — master tidak direplikasi",
         "Tanpa agent, konsol baru menunjukkan 0 unit — dan dengan roster kosong setiap "
         "bacaan jadi UNKNOWN sebagus apa pun pembacaannya. _learn_gate_direction menjadi "
         "_sync_from_core dan ikut menarik roster."),
    ],
    FOOT, nxt(), TOTAL,
)

prose_slide(
    prs, "GELOMBANG 03  ·  RITASE", "Angkanya Tidak Pernah Sampai ke Pusat",
    [
        ("Bug intinya",
         "Edge mencocokkan ke replika miliknya sendiri lalu mengirim hull_id = \"UNKNOWN\" "
         "bila gagal. Angkanya dibuang di gerbang. Truk yang benar ada di lokasi tapi tidak "
         "terdaftar sampai ke pusat sebagai UNKNOWN anonim — tak bisa dibedakan dari jendela "
         "yang tidak membaca apa pun."),
        ("Akibat kedua: match_outbound jadi kode mati",
         "Fungsi itu mempersempit kandidat ke truk yang sedang di dalam pit, justru supaya "
         "bacaan yang ambigu terhadap 276 unit terselesaikan terhadap segelintir yang di "
         "dalam. Tapi ia selalu menerima string \"UNKNOWN\", yang tidak mungkin cocok."),
        ("Perbaikan",
         "raw_code ditambahkan ke CrossingPayload (opsional, jadi firmware lama tetap "
         "mengirim). edge_ingest.record_crossing mencocokkan dengan angka mentah bila "
         "hull_id UNKNOWN, lalu jatuh ke unregistered_hull()."),
        ("known vs registered",
         "known = ada angka terbaca. registered = angka itu unit di master. Keduanya berbeda "
         "untuk truk yang terbaca yakin tapi tidak terdaftar. Hanya yang registered mengisi "
         "tampilan armada — agar mencatat truk asing tidak diam-diam menambah roster."),
    ],
    FOOT, nxt(), TOTAL,
)

table_slide(
    prs, "GELOMBANG 03  ·  AMBANG", "Kapan Truk Belum Terdaftar Dicatat dengan Nomornya",
    ["Syarat", "Nilai", "Alasan"],
    [
        ["Panjang kode", "tepat 4 digit", "sudah dijamin extract_code: hanya satu rentetan 4 digit yang tak ambigu"],
        ["Porsi suara", "≥ 0,70", "di atas porsi setiap salah-baca yang teramati (terburuk 0,29)"],
        ["Jumlah pembacaan", "> 0", "nol pembacaan berarti tidak ada yang dilihat"],
    ],
    FOOT, nxt(), TOTAL,
    col_w=[3.0, 2.6, 6.6],
    note="Sengaja lebih ketat daripada yang dibutuhkan truk terdaftar: truk terdaftar "
         "dikonfirmasi master, ini tidak — dan truk hantu akan menghitung ritase-nya sendiri. "
         "Konstanta: UNREGISTERED_MIN_CONFIDENCE di app/services/edge_ingest.py.",
)

prose_slide(
    prs, "GELOMBANG 03  ·  TRUK HANTU", "Bug yang Ditemukan Justru Saat Dijalankan",
    [
        ("Gejala",
         "Jalan pertama menghasilkan 23 lintasan, 11 belum berpasangan, dan truk \"2254\" "
         "yang tidak pernah ada — tercatat sebagai truk belum terdaftar dengan keyakinan 100%."),
        ("Sebabnya, persis",
         "Klip keberangkatan 2264 menghasilkan dua jendela. Jendela pertama membaca 2264 "
         "dengan benar dan, di pusat, mengeluarkan truk itu dari pit. Jendela kedua salah "
         "baca jadi 2254 — dan karena 2264 sudah tidak di dalam, match_outbound tidak punya "
         "apa pun untuk dicocokkan."),
        ("Akar: satu lintasan jadi beberapa jendela",
         "Klip ini berjalan ~8 detik terhadap detect_window_sec 6, jadi batas durasi memotong "
         "satu lintasan menjadi beberapa jendela dan tiap jendela dicatat sebagai lintasan. "
         "Bukan sekadar hitung ganda — ia memproduksi truk palsu."),
        ("Tanda ikut ke ekspor",
         "build_shift_report tadinya membuang registered padahal perHull sudah punya, jadi PDF "
         "dan Excel — artefak yang ditandatangani dan diarsipkan — menampilkan truk asing "
         "seperti unit armada. Sekarang: baris ringkasan, kolom Status, dan sebutan eksplisit "
         "di catatan kaki PDF."),
        ("Perbaikan: test_runs.select_crossings()",
         "Satu lintasan per unit terdaftar yang berbeda. Jendela tanpa identifikasi dibuang "
         "kalau klip sudah mengenali seseorang; kalau tidak ada yang dikenali, jendela "
         "terkuat berdiri sendiri agar truk belum terdaftar tetap dapat tepat satu lintasan. "
         "Deteksi langsung tidak disentuh."),
    ],
    FOOT, nxt(), TOTAL,
)

shot_slide(
    prs, "GELOMBANG 03  ·  HALAMAN BARU", "Ritase & Posisi Truk di Konsol Pusat",
    f"{SHOTS}/07-pusat-ritase-selesai.jpg",
    [
        "Rute /ritase, bagian nav \"Data Ritase\".",
        "Empat penghitung: ritase selesai, truk di dalam area, total lintasan, dan ritase "
        "belum terdaftar — yang terakhir dipisah karena itu celah registri yang perlu ditutup.",
        "Posisi Truk dan laporan ritase diambil dalam satu Promise.all: truk yang tercatat di "
        "dalam adalah siklus yang belum tertutup, jadi memuatnya di dua waktu berbeda bisa "
        "menampilkan angka yang saling bertentangan.",
        "Endpoint: GET /api/pit-occupancy (baru); GET /api/ritase kini membawa registered per "
        "hull, unregisteredRitase, unregisteredHulls.",
        "registered ditambahkan ke dua frozen key set di tests/test_response_contract.py — "
        "perubahan kontrak yang disengaja, bukan kebetulan.",
    ],
    FOOT, nxt(), TOTAL,
)

two_shot_slide(
    prs, "GELOMBANG 04  ·  SATU SAKLAR", "Detail ON/OFF",
    f"{SHOTS}/01-gate-a-siaga.jpg", "Detail: OFF — tampilan operator",
    f"{SHOTS}/03-gate-a-detail-on.jpg", "Detail: ON — tampilan diagnosa",
    [
        "Menggantikan tombol BBox, dan bawaannya OFF. Kotak hijau tetap ada — ia hanya "
        "menyatakan \"sistem sedang melihat di sini\".",
        "OFF menyembunyikan: label T#id skor di atas kotak, baris 100% · exact di tiap "
        "lintasan, strip potongan gambar, penghitung frame, serta baris jejak/keyakinan dan "
        "hasil pencocokan di panel kanan.",
        "Label digambar ke dalam JPEG oleh perangkat, jadi saklarnya benar-benar meminta ke "
        "perangkat: GET /api/live/stream?detail=1. Frame ber-label adalah encode JPEG kedua "
        "yang hanya dikerjakan selama ada yang menonton begitu (LiveState.detail_wanted()).",
    ],
    FOOT, nxt(), TOTAL,
)

table_slide(
    prs, "GELOMBANG 04  ·  ISTILAH", "Kata \"OCR\" Dihapus dari Seluruh Layar",
    ["Sebelum", "Sesudah", "Letak"],
    [
        ["SAMPEL OCR", "TRUCK ID", "konsol gate — strip potongan gambar"],
        ["Dibaca OCR", "Nomor terbaca", "konsol gate — rincian lintasan"],
        ["Mesin OCR", "Mesin Pembaca Nomor", "konsol gate — drawer pengaturan"],
        ["chip OCR", "PEMBACA", "konsol gate — strip kesehatan"],
        ["ppocrv6-tiny", "Ringan / Sedang / Besar / Lengkap", "nama mesin, lewat READER_NAMES"],
        ["Daftar Pembacaan OCR", "Daftar Pembacaan Nomor Lambung", "konsol pusat"],
        ["Presisi OCR", "Presisi Pembacaan", "konsol pusat — laporan shift"],
        ["OCR FPS / Ambang Keyakinan OCR", "FPS Pembacaan / Ambang Keyakinan Pembacaan", "konsol pusat — perangkat edge"],
    ],
    FOOT, nxt(), TOTAL,
    col_w=[4.0, 4.4, 3.85],
    note="Termasuk kolom di PDF dan XLSX laporan shift. Pengenal internal (ocr_backend, "
         "ocr_fps, SMART_GATE_OCR_BACKEND, nama modul) tidak diubah — aturannya soal piksel, "
         "bukan kode.",
)

prose_slide(
    prs, "BUG TAMBAHAN", "Tiga Cacat yang Hanya Terlihat di Browser",
    [
        ("Sambungan MJPEG bocor",
         "Konsol menyambung ulang setiap kali frame_seq tidak bergerak ~12 polling — yaitu "
         "keadaan normal jalur yang sepi. Setiap sambungan ulang membuka respons baru tanpa "
         "menutup yang lama, dan browser hanya punya 6 sambungan per origin. Kolam habis, "
         "polling macet, halaman beku pada data lama — dan tab lain ke perangkat itu ikut "
         "menggantung."),
        ("Penjaganya",
         "Menyambung ulang hanya bila ada bukti soket mati sementara perangkat jelas "
         "berproduksi (frame_age_sec < 3 dan urutan kami macet), src lama dikosongkan lebih "
         "dulu, dan perangkat membatasi penonton di 4 dengan pelepasan slot di finally."),
        ("Bagian hanya digambar saat batas berikutnya tiba",
         "Perangkat yang menerbitkan satu frame lalu diam meninggalkan panel kosong — "
         "JPEG-nya sudah terkirim dan mengendap di parser. STREAM_KEEPALIVE_SEC = 1,0 "
         "mengirim ulang frame terkini untuk membilasnya."),
        ("Potongan gambar tercache menampilkan truk sesi sebelumnya",
         "URL potongan dicache satu jam, tapi id jejak dimulai dari 1001 setiap proses "
         "restart — jadi konsol menggambar foto truk sesi lalu di sebelah nomor sekarang. "
         "Teramati: label 308, gambar 8901. LiveState._session kini ada di URL potongan."),
    ],
    FOOT, nxt(), TOTAL,
)

table_slide(
    prs, "VERIFIKASI", "Dijalankan Ujung ke Ujung, Bukan Diuji Sebagian",
    ["Yang diukur", "Sebelum perbaikan", "Sesudah"],
    [
        ["Truk di dalam pit setelah run masuk", "—", "6 (1 belum terdaftar)"],
        ["Ritase setelah run keluar", "—", "6 (1 belum terdaftar)"],
        ["Lintasan tercatat untuk 12 kali lewat", "23", "12"],
        ["Lintasan belum berpasangan", "11", "0"],
        ["Truk hantu", "1 (\"2254\", keyakinan 100%)", "0"],
        ["Antrean kirim ke pusat / belum tersinkron", "—", "0 / 0"],
        ["Suite core / edge", "159 / 119", "196 / 186"],
    ],
    FOOT, nxt(), TOTAL,
    col_w=[5.4, 3.6, 3.25],
    note="Dua proses edge sungguhan terhadap pusat sungguhan, 12 klip, termasuk satu truk "
         "(8901) yang memang tidak ada di master 276 unit. Waktu siklus terhitung: 9 menit "
         "untuk pasangan operasional.",
)

closing_slide(
    prs, "TERBUKA", "Yang Belum Selesai",
    [
        "Belum diukur di Orin Nano Super yang sebenarnya. 15 ms PP-OCRv6 tiny terukur di CPU "
        "x86 dan punya banyak ruang; 0,5 detik PaddleOCR-VL tidak.",
        "Klip uji adalah rekaman YouTube — nomornya bukan armada PT CK-BIB, jadi angka "
        "akurasi mengukur pembacaan, bukan identifikasi ujung ke ujung.",
        "Koreksi fuzzy bisa memindahkan bacaan yang benar ke truk lain: 5600 terbaca benar, "
        "tidak ada di master, dan 4600 satu-satunya tetangga berjarak 1 — jadi tercatat "
        "HD 4600. Di lokasi nyata plat memang ada di master, tapi truk tak terdaftar tetap "
        "berisiko dikoreksi ke unit terdaftar. Pertanyaan kebijakan, bukan tambalan kode.",
        "Konsol pusat belum punya saklar Detail; keyakinan masih tampil di Riwayat Pembacaan "
        "dan Laporan Shift.",
        "3 error lint di lib/{backend-status,guide,theme}-context.tsx adalah baseline lama, "
        "bukan dari perubahan ini.",
    ],
    FOOT, nxt(), TOTAL,
)

out = f"{sys.argv[2]}"
prs.save(out)
print(f"saved {out}  ({p} slides)")
