"""Deck 2 — Panduan Penggunaan, mengikuti satu siklus ritase dari awal ke akhir.

Setiap tangkapan layar di deck ini diambil dari jalannya sistem yang sama pada
2026-08-08: enam truk masuk lewat Gate A, keluar lewat Gate B, lalu laporannya
diekspor. Bukan mockup, dan bukan data contoh.
"""

import sys
sys.path.insert(0, sys.argv[1])

from deck_kit import (  # noqa: E402
    cards_slide, closing_slide, new_deck, shot_slide, table_slide, title_slide,
)

S = sys.argv[1]
SHOTS = f"{S}/deck-shots"
FOOT = "ISHS  ·  Panduan Penggunaan"
TOTAL = 15

prs = new_deck()
p = 0


def nxt():
    global p
    p += 1
    return p


title_slide(
    prs,
    "PANDUAN PENGGUNAAN  ·  SATU SIKLUS PENUH",
    "Cara Menggunakan Integrated Smart Hauling System",
    "Mengikuti enam truk dari gerbang masuk sampai laporan PDF dan Excel.\n"
    "Semua tangkapan layar berasal dari satu kali jalan yang sama, dengan data "
    "sungguhan — termasuk satu truk yang tidak ada di master.",
    "Tangkapan layar: 8 Agustus 2026  ·  Gate A masuk, Gate B keluar",
)
nxt()

cards_slide(
    prs, "KONSEP INTI", "Satu Ritase = Masuk + Keluar",
    [
        ("01", "Terbaca Masuk",
         "Kamera di gerbang masuk membaca nomor lambung. Pusat mencatat truk itu "
         "berada di dalam area tambang."),
        ("02", "Di Dalam Area",
         "Selama belum terbaca di gerbang keluar, truk dihitung masih di dalam. "
         "Belum jadi ritase."),
        ("03", "Terbaca Keluar",
         "Nomor yang sama terbaca di gerbang keluar. Siklus tertutup, dan tercatat "
         "satu ritase beserta durasinya."),
    ],
    FOOT, nxt(), TOTAL,
    note="Pemasangan dilakukan per nomor lambung, bukan per pasangan gate. Truk boleh masuk "
         "dan keluar lewat gerbang yang berbeda. Lintasan yang tidak menemukan pasangannya "
         "tidak dibuang — ia ditandai supaya bisa ditelusuri.",
)

table_slide(
    prs, "PETA LAYAR", "Dua Jenis Konsol, Tugas Berbeda",
    ["Konsol", "Dipakai di", "Untuk"],
    [
        ["Konsol Gate", "layar di gerbang, satu per perangkat",
         "melihat pembacaan terjadi, memeriksa hasil baca, mengecek kesehatan perangkat"],
        ["Konsol Pusat", "kantor / ruang kendali",
         "posisi truk, penghitungan ritase, riwayat pembacaan, laporan shift dan ekspor"],
    ],
    FOOT, nxt(), TOTAL,
    col_w=[2.6, 3.6, 6.0],
    note="Konsol gate dilayani oleh perangkat gate itu sendiri, jadi tetap bisa dibuka saat "
         "jaringan ke pusat terputus — hasil bacanya mengantre dan terkirim sendiri begitu "
         "jaringan pulih.",
)

shot_slide(
    prs, "LANGKAH 1  ·  KONSOL GATE", "Gerbang Siap, Belum Ada Truk",
    f"{SHOTS}/01-gate-a-siaga.jpg",
    [
        "Kiri atas: kode gate dan arahnya — CAM-GATE-A, MASUK. Arah ini datang dari pusat, "
        "bukan disetel di perangkat.",
        "Kotak hijau menandai tempat sistem sedang mencari nomor lambung.",
        "Strip bawah adalah kesehatan perangkat: kamera, arah, sambungan ke pusat, jumlah "
        "antrean kirim, mesin pembaca, dan jumlah unit di master.",
        "Saklar Detail: OFF adalah tampilan kerja sehari-hari — tanpa angka teknis.",
        "Tombol Jalankan Uji memutar rekaman lewat proses yang sama persis dengan truk "
        "sungguhan, untuk pembuktian tanpa menunggu truk lewat.",
    ],
    FOOT, nxt(), TOTAL,
    caption="Konsol Gate A  ·  Detail: OFF",
)

shot_slide(
    prs, "LANGKAH 2  ·  PEMBACAAN MASUK", "Truk Lewat, Nomornya Terbaca",
    f"{SHOTS}/02-gate-a-membaca.jpg",
    [
        "Kotak hijau mengikuti nomor lambung selama truk bergerak.",
        "Panel kanan atas — NOMOR TERBARU — menunjukkan potongan gambar yang dibaca, "
        "diperbesar agar bisa dinilai mata.",
        "Panel SEDANG DIBACA menampilkan truk yang masih dalam proses. Satu truk bisa dibaca "
        "dari banyak gambar sebelum sistem menyimpulkan.",
        "Kotak muncul lebih dulu, angkanya menyusul. Itu memang dirancang begitu: deteksi "
        "tidak menunggu pembacaan selesai.",
    ],
    FOOT, nxt(), TOTAL,
    caption="Sedang membaca 2152  ·  Detail: OFF",
)

shot_slide(
    prs, "LANGKAH 2b  ·  BILA PERLU DIPERIKSA", "Detail: ON — Menunjukkan Dasar Pembacaan",
    f"{SHOTS}/03-gate-a-detail-on.jpg",
    [
        "Dipakai hanya ketika sebuah hasil baca perlu ditelusuri. Sehari-hari biarkan OFF.",
        "Strip TRUCK ID: seluruh potongan gambar yang dipakai membaca, beserta hasil baca "
        "masing-masing. Di sinilah terlihat kenapa sistem sampai pada satu angka.",
        "Panel kanan menambah jejak, nomor sampel, dan porsi suara — dasar kesimpulannya.",
        "Daftar kiri menambah keyakinan dan hasil pencocokan; baris bisa diklik untuk membuka "
        "rincian voting.",
        "Kembalikan ke OFF setelah selesai, agar layar operator tetap bersih.",
    ],
    FOOT, nxt(), TOTAL,
    caption="Detail: ON — tampilan diagnosa",
)

shot_slide(
    prs, "LANGKAH 3  ·  HASIL DI GATE", "Enam Truk Tercatat Masuk",
    f"{SHOTS}/04-gate-a-selesai.jpg",
    [
        "Daftar Lintasan Terbaru: setiap truk dengan potongan gambar nomornya, tersimpan di "
        "perangkat ini sendiri.",
        "Ikon di kanan tiap baris adalah status pengiriman ke pusat, bukan status pembacaan. "
        "Hijau berarti pusat sudah menerimanya.",
        "8901 tampil tanpa awalan HD karena nomor itu tidak ada di master — tetap dicatat, "
        "dan ditandai di konsol pusat.",
        "Strip bawah: ANTRE 0 berarti semua hasil sudah sampai ke pusat.",
    ],
    FOOT, nxt(), TOTAL,
    caption="Gate A selesai  ·  6 lintasan masuk",
)

shot_slide(
    prs, "LANGKAH 4  ·  KONSOL PUSAT", "Pusat Tahu Truk Mana yang Di Dalam",
    f"{SHOTS}/05-pusat-di-dalam.jpg",
    [
        "Halaman Ritase & Posisi Truk. Karena Gate A adalah gerbang masuk, pusat menyimpulkan "
        "keenam truk berada di dalam area tambang.",
        "Tabel Posisi Truk menyebut buktinya: lewat gate mana, jam berapa, dengan keyakinan "
        "berapa.",
        "8901 diberi tanda BELUM TERDAFTAR — nomornya terbaca yakin, tapi tidak ada di master "
        "data. Ia tetap dihitung sebagai truk di dalam area.",
        "Ritase masih 0. Belum ada yang keluar, jadi belum ada siklus yang tertutup.",
        "Panel kanan menjelaskan hal itu, bukan menampilkan tabel kosong.",
    ],
    FOOT, nxt(), TOTAL,
    caption="Konsol Pusat  ·  6 truk di dalam, 0 ritase",
)

shot_slide(
    prs, "LANGKAH 5  ·  PEMBACAAN KELUAR", "Truk Keluar Lewat Gate B",
    f"{SHOTS}/06-gate-b-keluar.jpg",
    [
        "Konsol yang sama, perangkat yang berbeda: CAM-GATE-B, KELUAR.",
        "Arah ini juga datang dari pusat. Karena itu Gate B hanya ditawari rekaman keluar — "
        "memutar rekaman masuk di gerbang keluar akan salah mencatat arahnya.",
        "Di gerbang keluar, pusat mendahulukan daftar truk yang sedang di dalam saat "
        "mencocokkan nomor: truk hanya bisa keluar kalau tadi masuk.",
        "Dua kotak sekaligus berarti dua truk terlihat di frame yang sama.",
    ],
    FOOT, nxt(), TOTAL,
    caption="Konsol Gate B  ·  sedang membaca 2241",
)

shot_slide(
    prs, "LANGKAH 6  ·  RITASE TERCATAT", "Enam Siklus Tertutup",
    f"{SHOTS}/07-pusat-ritase-selesai.jpg",
    [
        "Ritase Selesai 6. Truk Di Dalam Area kembali 0 — semuanya sudah keluar.",
        "Tabel Ritase per Truk memberi jumlah masuk, keluar, dan durasi siklus tiap unit: "
        "sekitar 9 menit untuk pasangan operasional.",
        "8901 tetap dihitung satu ritase dan tetap ditandai. Truknya benar mengangkut; "
        "mengabaikannya akan mengurangi laporan haulage, menyembunyikan tandanya akan "
        "menambah armada tanpa sepengetahuan siapa pun.",
        "Lintasan per Gate menunjukkan arah tiap gerbang: A enam masuk, B enam keluar.",
        "Belum Berpasangan 0 — tidak ada lintasan yang menggantung.",
    ],
    FOOT, nxt(), TOTAL,
    caption="Konsol Pusat  ·  6 ritase, 0 belum berpasangan",
)

shot_slide(
    prs, "LANGKAH 7  ·  RIWAYAT", "Menelusuri Pembacaan Satu per Satu",
    f"{SHOTS}/08-pusat-riwayat.jpg",
    [
        "Halaman Riwayat Pembacaan: ringkasan posisi armada di atas, daftar pembacaan di "
        "bawah, rincian satu pembacaan di panel kanan.",
        "Durasi siklus di sini ditampilkan lebih presisi — 8m 45s, 9m 28s — karena "
        "dipasangkan menurut waktu lintasan sebenarnya.",
        "Klik satu baris di Daftar Pembacaan Nomor Lambung untuk melihat foto nomor lambung "
        "dan gambar penuhnya di panel kanan.",
        "Pemilih gate di atas daftar menyaring per gerbang.",
    ],
    FOOT, nxt(), TOTAL,
    caption="Konsol Pusat  ·  Riwayat Pembacaan",
)

shot_slide(
    prs, "LANGKAH 8  ·  LAPORAN SHIFT", "Menyusun Laporan dan Mengekspornya",
    f"{SHOTS}/09-pusat-laporan.jpg",
    [
        "Pilih shift: SHIFT SIANG, SHIFT MALAM, atau KUSTOM dengan tanggal dan jam sendiri. "
        "Isi laporan mengikuti jendela waktu yang dipilih.",
        "Kartu ringkas: ritase, lintasan gate, belum berpasangan, dan presisi pembacaan.",
        "Dua tombol ekspor di kanan jendela waktu: Excel untuk diolah lagi, PDF untuk "
        "lampiran resmi.",
        "Berkas dibuat di browser dari data yang sedang tampil, jadi isinya persis apa yang "
        "terlihat di layar.",
    ],
    FOOT, nxt(), TOTAL,
    caption="Konsol Pusat  ·  Laporan Harian & Shift",
)

shot_slide(
    prs, "HASIL EKSPOR  ·  PDF", "Berkas PDF untuk Lampiran Resmi",
    f"{SHOTS}/10-pdf-1.png",
    [
        "Nama berkas menyebut sendiri jendelanya: "
        "LAPORAN_RITASE_2026-08-08_SIANG_0700-1900.pdf",
        "Kepala laporan mencantumkan jendela waktu, tanggal run deteksi, dan model deteksi "
        "yang dipakai — supaya angkanya bisa dipertanggungjawabkan.",
        "Kolom Dasar pada Ringkasan Shift membedakan angka terukur, turunan, dan setelan "
        "sistem. Pembaca tahu mana yang diukur dan mana yang dihitung.",
        "Baris \"di antaranya belum terdaftar\" duduk tepat di bawah angka ritase utama, jadi "
        "yang menandatangani halaman ini melihatnya tanpa harus mencari.",
        "Tabel per nomor lambung punya kolom Status: 8901 tertulis BELUM TERDAFTAR, sisanya "
        "terdaftar. Nomornya sendiri dibiarkan bersih agar mudah disalin ke master.",
        "Halaman kedua memuat definisi ritase — termasuk sebutan eksplisit nomor yang belum "
        "terdaftar — dan dua kolom tanda tangan: Pengawas Shift dan Auditor Operasi.",
    ],
    FOOT, nxt(), TOTAL,
    caption="Halaman 1 dari 2  ·  44 KB",
)

shot_slide(
    prs, "HASIL EKSPOR  ·  EXCEL", "Berkas Excel untuk Diolah Lagi",
    f"{SHOTS}/11-excel-isi.png",
    [
        "Empat sheet: Ringkasan, Per Gate, Per Nomor Lambung, dan Belum Berpasangan.",
        "Ringkasan memuat dua baris khusus: Ritase belum terdaftar, dan daftar nomornya — "
        "jadi celah registri terbaca tanpa perlu menyisir tabel.",
        "Per Nomor Lambung punya kolom Status tersendiri, bukan tanda yang menempel pada "
        "nomornya. Nomor tetap bisa disortir, difilter, dan disalin ke master.",
        "Sheet Belum Berpasangan tetap ada meski kosong — kolomnya siap dipakai saat ada "
        "lintasan yang menggantung.",
        "Angka disimpan sebagai angka, bukan teks, jadi bisa langsung dijumlah dan di-pivot.",
        "Gambar ini hasil render berkas aslinya; beberapa kolom paling kanan terpotong oleh "
        "pemenggalan halaman — di Excel semuanya utuh.",
    ],
    FOOT, nxt(), TOTAL,
    caption="Isi berkas .xlsx  ·  10 KB  ·  4 sheet",
)

closing_slide(
    prs, "RINGKAS", "Alur Lengkap dalam Satu Halaman",
    [
        "Truk lewat gerbang masuk → kamera membaca nomor lambung → hasilnya tersimpan di "
        "perangkat gate dan terkirim ke pusat.",
        "Pusat melihat gate itu bergerbang masuk → truk dicatat berada di dalam area tambang.",
        "Truk lewat gerbang keluar → nomor yang sama terbaca → siklus tertutup, tercatat satu "
        "ritase beserta durasinya.",
        "Nomor yang terbaca yakin tapi tidak ada di master tetap dicatat dan dihitung, dengan "
        "tanda BELUM TERDAFTAR supaya bisa didaftarkan.",
        "Halaman Ritase & Posisi Truk menjawab dua hal sekaligus: sudah berapa banyak "
        "terangkut, dan apa yang masih di dalam.",
        "Laporan shift diekspor ke Excel untuk diolah, atau PDF untuk ditandatangani.",
        "Bila jaringan ke pusat terputus: gerbang tetap membaca dan mengantre. Hasilnya "
        "terkirim sendiri begitu jaringan pulih.",
    ],
    FOOT, nxt(), TOTAL,
)

out = f"{sys.argv[2]}"
prs.save(out)
print(f"saved {out}  ({p} slides)")
