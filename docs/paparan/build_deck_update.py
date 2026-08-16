"""Deck pembaruan — Agustus 2026.

Audiens umum: pengawas, operator, dan pemangku kepentingan yang tidak membaca
kode. Isinya satu siklus ritase dari gerbang sampai laporan, memakai tangkapan
layar dari SATU kali jalan yang sama pada 2026-08-16 — sepuluh klip referensi
melalui rantai deteksi sungguhan, bukan mockup.

Jalankan ulang setelah tangkapan layar diperbarui:

    uv run python docs/paparan/build_deck_update.py
"""

from pathlib import Path

from deck_kit import (
    cards_slide, closing_slide, new_deck, prose_slide, shot_slide,
    table_slide, title_slide,
)

HERE = Path(__file__).parent
SHOTS = HERE / "tangkapan-layar-update"
OUT = HERE.parents[1] / "ISHS-Pembaruan-2026-08-16.pptx"

FOOT = "Integrated Smart Hauling System · Pembaruan 16 Agustus 2026"
TOTAL = 14


def build() -> Path:
    prs = new_deck()
    n = 0

    def page():
        nonlocal n
        n += 1
        return n

    # 1 -------------------------------------------------------------------
    title_slide(
        prs,
        "PEMBARUAN SISTEM",
        "Perhitungan Ritase yang Bisa Dipertanggungjawabkan",
        "Arah masuk-keluar diperbaiki, laporan mengikuti hari tambang 06:00–06:00, "
        "dan rincian per pos cek — diuji ulang dengan sepuluh rekaman gerbang.",
        "16 AGUSTUS 2026",
    )
    page()

    # 2 -------------------------------------------------------------------
    cards_slide(
        prs, "RINGKASAN", "Tiga hal yang berubah untuk Anda",
        [
            ("01", "Arah terbaca benar",
             "Sistem sempat mencatat truk masuk sebagai keluar. Truk yang sudah "
             "pulang tetap terhitung berada di dalam area, dan ritase gagal "
             "berpasangan. Sekarang arah ditentukan dari gerak truk di layar, "
             "dan bisa disetel per pos dari dasbor."),
            ("02", "Satu hari = 06:00 ke 06:00",
             "Laporan harian mengikuti siklus tambang, bukan pergantian tanggal "
             "tengah malam. Shift malam tidak lagi terbelah ke dua laporan, "
             "sehingga angkanya bisa dicocokkan dengan berkas BIB."),
            ("03", "Dipecah per pos cek",
             "Angka dikelompokkan per CP 01–CP 04, sesuai keputusan rapat. "
             "Sebelumnya pengelompokan memakai area, dan dua pos yang berbagi "
             "area tampil menyatu."),
        ],
        FOOT, page(), TOTAL,
        note="Semua angka pada paparan ini berasal dari satu kali pengujian "
             "nyata: sepuluh rekaman gerbang, lima truk, masing-masing satu kali "
             "masuk dan satu kali keluar.",
    )

    # 3 -------------------------------------------------------------------
    prose_slide(
        prs, "MASALAH ASAL", "Apa yang sebelumnya keliru",
        [
            ("Gejalanya",
             "Sepuluh rekaman diuji di satu pos. Seharusnya menghasilkan 5 ritase "
             "dan tidak ada truk tersisa di dalam area. Yang terbaca: 3 truk "
             "dianggap masih di dalam, 1 di luar, dan 1 lintasan tidak muncul "
             "di mana pun."),
            ("Penyebabnya",
             "Kamera pos ini menghadap arah yang berlawanan dengan asumsi sistem, "
             "sehingga setiap lintasan tercatat persis kebalikannya. Satu lintasan "
             "lain tidak dapat ditentukan arahnya dan diam-diam hilang dari "
             "hitungan."),
            ("Kenapa berbahaya",
             "Kesalahan seperti ini tidak menampilkan pesan galat. Sistem tetap "
             "berjalan dan tetap menghasilkan angka — hanya angkanya yang salah, "
             "dan baru ketahuan saat dicocokkan dengan berkas lapangan."),
        ],
        FOOT, page(), TOTAL,
    )

    # 4 -------------------------------------------------------------------
    shot_slide(
        prs, "LANGKAH 1", "Perangkat pos siaga",
        str(SHOTS / "01-gerbang-siaga.jpg"),
        [
            "Tiap pos gerbang punya perangkat dan layarnya sendiri.",
            "Bagian bawah menunjukkan sambungan ke pusat dan jumlah data "
            "yang masih tertahan di perangkat.",
            "Daftar nomor lambung (584 unit) sudah disalin dari pusat, "
            "sehingga pos tetap bisa mengenali truk saat jaringan putus.",
        ],
        FOOT, page(), TOTAL,
        caption="Konsol Gerbang CAM-GATE-A · terhubung ke pusat, belum ada lintasan",
    )

    # 5 -------------------------------------------------------------------
    shot_slide(
        prs, "LANGKAH 2", "Truk terbaca saat melintas",
        str(SHOTS / "02-deteksi-ocr.jpg"),
        [
            "Kotak hijau menandai nomor lambung yang sedang dibaca.",
            "Garis kuning tegak adalah garis pembanding arah: sistem "
            "menilai truk bergerak ke kiri atau ke kanan terhadap garis itu.",
            "Nomor yang terbaca muncul seketika di panel kanan — di sini 2221.",
            "Satu truk dibaca puluhan kali selama melintas, lalu hasilnya "
            "disimpulkan lewat pemungutan suara.",
        ],
        FOOT, page(), TOTAL,
        caption="Pembacaan berlangsung · nomor 2221 terbaca dari rekaman gerbang",
    )

    # 6 -------------------------------------------------------------------
    shot_slide(
        prs, "LANGKAH 3", "Sepuluh rekaman, tanpa kegagalan",
        str(SHOTS / "03-sepuluh-klip-selesai.jpg"),
        [
            "Sepuluh rekaman selesai, nol gagal.",
            "Lima truk terbaca benar seluruhnya: 2152, 2221, 2222, 2241, 2264 "
            "— masing-masing dua kali.",
            "Setiap baris menyimpan foto potongan nomor lambungnya sebagai bukti.",
            "Tanda di kanan tiap baris berarti data sudah terkirim ke pusat.",
        ],
        FOOT, page(), TOTAL,
        caption="Selesai: 10 klip, 0 gagal · seluruhnya terkirim ke pusat",
    )

    # 7 -------------------------------------------------------------------
    shot_slide(
        prs, "LANGKAH 4", "Pusat menerima dan memasangkan",
        str(SHOTS / "04-pusat-ritase.jpg"),
        [
            "Pusat menerima kesepuluh lintasan dari pos.",
            "Satu ritase = satu lintasan masuk dipasangkan dengan satu "
            "lintasan keluar oleh truk yang sama.",
            "Peta menampilkan posisi keempat pos cek sesuai koordinat "
            "sebenarnya di lapangan.",
            "Angka 'Truk Di Dalam Area' kini dapat dipercaya, karena "
            "arah masuk-keluar sudah terbaca benar.",
        ],
        FOOT, page(), TOTAL,
        caption="Status Ritase & Posisi Truk · 4 ritase dari 10 lintasan",
    )

    # 8 -------------------------------------------------------------------
    shot_slide(
        prs, "LANGKAH 5", "Klik pos cek, lihat buktinya",
        str(SHOTS / "05-log-bukti-foto.jpg"),
        [
            "Mengklik satu pos cek membuka daftar unit yang melintas.",
            "Tiap baris membawa foto nomor lambung, waktu, arah, dan "
            "tingkat keyakinan pembacaan.",
            "Inilah yang mempercepat pengecekan silang dengan berkas BIB: "
            "angka yang meragukan bisa ditelusuri sampai fotonya, tanpa "
            "membuka berkas video yang besar.",
        ],
        FOOT, page(), TOTAL,
        caption="Log Unit CP 01 · 10 lintasan, masing-masing dengan foto bukti",
    )

    # 9 -------------------------------------------------------------------
    shot_slide(
        prs, "BARU", "Halaman Tren Produksi",
        str(SHOTS / "06-tren-ritase.jpg"),
        [
            "Halaman baru sesuai permintaan rapat.",
            "Skala waktu bisa dipilih: harian, mingguan, bulanan, tahunan.",
            "Arahkan kursor ke satu batang untuk melihat angka pastinya.",
            "Hari tanpa produksi tetap ditampilkan sebagai nol, supaya "
            "penghentian terlihat dan tidak tertutup garis grafik.",
            "Tabel di bawah memuat rincian angka beserta jumlahnya.",
        ],
        FOOT, page(), TOTAL,
        caption="Tren Produksi Ritase · rentang 7 hari, dipecah per pos cek",
    )

    # 10 ------------------------------------------------------------------
    shot_slide(
        prs, "LANGKAH 6", "Laporan mengikuti hari tambang",
        str(SHOTS / "07-laporan-hari-tambang.jpg"),
        [
            "Satu hari tambang = pukul 06:00 sampai 06:00 esok hari.",
            "Pemilih shift 12 jam yang lama sudah diganti pemilih hari tambang.",
            "Angka pada laporan kini benar-benar mengikuti rentang yang "
            "dipilih — sebelumnya rentang hanya menjadi keterangan.",
            "Rincian per pos cek ikut tercetak di Excel maupun PDF.",
        ],
        FOOT, page(), TOTAL,
        caption="Laporan Akhir Shift · hari tambang 2026-08-16, rincian per pos cek",
    )

    # 11 ------------------------------------------------------------------
    table_slide(
        prs, "HASIL UJI", "Sebelum dan sesudah, pada rekaman yang sama",
        ["Yang diukur", "Sebelum", "Sesudah"],
        [
            ["Truk terbaca benar", "4 dari 5", "5 dari 5"],
            ["Arah lintasan", "seluruhnya terbalik", "sesuai rekaman"],
            ["Ritase terbentuk", "3", "4"],
            ["Lintasan hilang dari hitungan", "1", "0"],
            ["Truk salah dianggap di dalam", "3", "0"],
        ],
        FOOT, page(), TOTAL,
        note="Satu pasang truk (2264) tetap tidak berpasangan, dan itu benar: "
             "rekaman keluarnya memperlihatkan truk bergerak ke arah yang sama "
             "dengan kedatangan. Sistem menandainya untuk ditinjau, bukan "
             "mengarang ritase yang tidak terbukti.",
    )

    # 12 ------------------------------------------------------------------
    cards_slide(
        prs, "KEANDALAN", "Yang diperkuat di balik layar",
        [
            ("01", "Pencadangan otomatis",
             "Sebelumnya tidak ada sama sekali — satu berkas rusak berarti "
             "seluruh riwayat ritase hilang. Kini dicadangkan tiap enam jam, "
             "diperiksa keutuhannya, dan disimpan 30 hari."),
            ("02", "Laporan jauh lebih cepat",
             "Diuji pada beban target 15.000 ritase per hari. Laporan harian "
             "yang tadinya butuh lebih dari empat menit kini selesai di bawah "
             "satu detik."),
            ("03", "Pemasangan pos baru",
             "Menambah pos gerbang cukup dengan satu perintah pemasangan. "
             "Sistem memeriksa sendiri sambungannya ke pusat dan menyebutkan "
             "penyebabnya bila ada yang belum beres."),
        ],
        FOOT, page(), TOTAL,
    )

    # 13 ------------------------------------------------------------------
    prose_slide(
        prs, "CATATAN", "Yang perlu diperhatikan",
        [
            ("Arah per pos disetel dari dasbor",
             "Tiap pos gerbang punya pengaturan arah sendiri di menu Kamera Per "
             "Pos. Bila satu pos mencatat lintasan terbalik, perbaikannya cukup "
             "dari dasbor — tidak perlu mendatangi perangkat."),
            ("Rekaman 2264 perlu ditinjau",
             "Pada rekaman keluar 2264, truk bergerak ke arah yang sama dengan "
             "kedatangan. Perlu dipastikan apakah rekamannya tertukar atau "
             "kamera sempat dipindahkan."),
            ("Angka pada paparan ini bukan produksi nyata",
             "Semua berasal dari sepuluh rekaman uji di satu pos. Angka "
             "sesungguhnya akan muncul setelah keempat pos beroperasi."),
        ],
        FOOT, page(), TOTAL,
    )

    # 14 ------------------------------------------------------------------
    closing_slide(
        prs, "LANGKAH BERIKUTNYA", "Yang menunggu keputusan",
        [
            "Pasang dan uji pos cek CP 02, CP 03, dan CP 04.",
            "Tetapkan arah masuk tiap pos setelah kameranya terpasang.",
            "Sambungkan dasbor ke portal Araswara lewat API.",
            "Siapkan kapasitas server untuk 15.000 ritase per hari.",
        ],
        FOOT, page(), TOTAL,
    )

    prs.save(OUT)
    return OUT


if __name__ == "__main__":
    path = build()
    print(f"tersimpan: {path}")
