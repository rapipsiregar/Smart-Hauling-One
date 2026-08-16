"""Foto bukti harus milik bacaan yang tercatat.

Sebuah lintasan menyimpan satu nomor lambung dan satu foto. Bila keduanya
berasal dari truk yang berbeda, bukti itu bukan sekadar tidak berguna --
ia menyesatkan: pemeriksa akan mencocokkan angka pada layar dengan foto yang
memperlihatkan truk lain, dan menyimpulkan sistemnya benar.

Yang membuat ini nyata: satu rekaman bisa memuat beberapa truk. Diamati pada
rekaman contoh, satu jendela menghasilkan bacaan "4529" (18 kali) berdampingan
dengan "4540" (4 kali, keyakinan OCR 0,95) -- angka yang cukup meyakinkan untuk
tampak seperti truk lain. Foto yang disimpan harus datang dari klaster yang
menang, bukan sekadar bacaan terbaik mana pun di jendela itu.
"""

from __future__ import annotations

from agent.consensus import finalize_window, pick_best_snapshot
from vendor.ocr_utils import fuzzy_vote_distribution


def _read(text: str, weight: float, ts: float, crop: bytes) -> dict:
    return {
        "text": text, "weight": weight, "ts": ts, "crop_jpeg": crop,
        "det_conf": 0.9, "ocr_conf": weight,
    }


def _crop(label: str) -> bytes:
    """Berdiri sebagai potongan gambar; isinya menandai bacaan asalnya."""
    return f"CROP:{label}".encode()


def test_foto_berasal_dari_bacaan_yang_menang() -> None:
    reads = [
        _read("4529", 0.95, 1.0, _crop("4529-a")),
        _read("4529", 0.98, 2.0, _crop("4529-b")),
        _read("4529", 0.91, 3.0, _crop("4529-c")),
    ]
    result = finalize_window(0.0, 6.0, reads)
    assert result["hull_id"] == "4529"
    assert result["snapshot"].startswith(b"CROP:4529")


def test_truk_kedua_di_jendela_yang_sama_tidak_menyumbang_fotonya() -> None:
    """Justru kasus inilah yang berbahaya.

    Bacaan truk kedua punya bobot TERTINGGI di jendela ini. Bila foto dipilih
    dari bobot tertinggi tanpa memandang klaster, lintasan akan tercatat sebagai
    4529 sambil memperlihatkan foto bertuliskan 4540.
    """
    reads = [
        _read("4529", 0.90, 1.0, _crop("4529-a")),
        _read("4529", 0.92, 2.0, _crop("4529-b")),
        _read("4529", 0.93, 3.0, _crop("4529-c")),
        _read("4529", 0.91, 4.0, _crop("4529-d")),
        # Truk lain, terbaca lebih meyakinkan tetapi lebih jarang.
        _read("4540", 0.99, 5.0, _crop("4540-x")),
    ]
    result = finalize_window(0.0, 6.0, reads)
    assert result["hull_id"] == "4529"
    assert b"4540" not in result["snapshot"]
    assert result["snapshot"].startswith(b"CROP:4529")


def test_foto_diambil_dari_bacaan_terbaik_di_dalam_klaster_pemenang() -> None:
    """Di dalam klaster pemenang, bobot tertinggi yang dipakai."""
    reads = [
        _read("4173", 0.70, 1.0, _crop("buram")),
        _read("4173", 0.99, 2.0, _crop("tajam")),
        _read("4173", 0.80, 3.0, _crop("sedang")),
    ]
    assert finalize_window(0.0, 6.0, reads)["snapshot"] == _crop("tajam")


def test_seri_bobot_dimenangkan_bingkai_yang_lebih_akhir() -> None:
    """Truk makin lurus menghadap kamera menjelang akhir lintasan."""
    reads = [
        _read("2152", 0.95, 1.0, _crop("awal")),
        _read("2152", 0.95, 9.0, _crop("akhir")),
    ]
    assert finalize_window(0.0, 10.0, reads)["snapshot"] == _crop("akhir")


def test_jendela_tanpa_bacaan_tidak_mengarang_foto() -> None:
    """Lintasan tetap tercatat -- truk memang lewat -- tetapi tanpa bukti palsu."""
    result = finalize_window(0.0, 6.0, [])
    assert result["hull_id"] == "UNKNOWN"
    assert result["snapshot"] is None
    assert result["read_count"] == 0


def test_bacaan_tanpa_potongan_gambar_tidak_membuat_foto_palsu() -> None:
    reads = [_read("2264", 0.95, 1.0, None)]
    assert finalize_window(0.0, 6.0, reads)["snapshot"] is None


def test_pemilihan_foto_konsisten_dengan_klaster_yang_dihitung() -> None:
    """Pemilih foto dan penghitung suara harus memakai pengelompokan yang sama.

    Keduanya memakai jarak Levenshtein ke pusat klaster. Bila salah satunya
    berubah sendiri, foto dan angka bisa berpisah tanpa satu pun uji lain gagal.
    """
    reads = [
        _read("2221", 0.90, 1.0, _crop("2221")),
        _read("2221", 0.92, 2.0, _crop("2221-b")),
        _read("2222", 0.99, 3.0, _crop("2222")),
        _read("2222", 0.98, 4.0, _crop("2222-b")),
        _read("2222", 0.97, 5.0, _crop("2222-c")),
    ]
    hull, _, distribution = fuzzy_vote_distribution(
        [(r["text"], r["weight"]) for r in reads]
    )
    snapshot = pick_best_snapshot(reads, distribution, hull)
    assert snapshot.decode().startswith(f"CROP:{hull}")
