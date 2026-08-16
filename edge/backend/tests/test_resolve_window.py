"""_resolve() membongkar apa yang benar-benar diserahkan sebuah jendela tertutup.

Menjaga kerusakan nyata: DetectionWindow mulai menyerahkan tuple berisi empat
nilai ``(mulai, selesai, reads, arah)`` begitu algoritma garis tengah virtual
masuk, sementara konsumen ini masih membongkar tiga -- setiap kali HUD
dijalankan muncul ``ValueError: too many values to unpack`` pada jendela
pertama yang menutup, yang bagi operator terbaca sebagai "detektornya mati".

Bentuknya berubah lagi saat jendela dipisah per truk: kini
``(id_jejak, (mulai, selesai, reads, arah))``. Identitas jejak harus ikut,
karena kartu di HUD ditutup per truk dengan nomor lambung truk itu sendiri --
tanpa itu kartunya menggantung di "memindai" selamanya.
"""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

os.environ.setdefault("SMART_GATE_RUN_AGENT", "false")
os.environ.setdefault(
    "SMART_GATE_EDGE_DB", str(Path(tempfile.mkdtemp()) / "edge-test.db")
)

from app.services.test_runs import _resolve  # noqa: E402


def test_resolve_membongkar_bentuk_yang_benar_benar_diserahkan() -> None:
    window = (7, (100.0, 106.0, [], "inbound"))
    resolved = _resolve(window)
    assert resolved["direction"] == "inbound"
    assert resolved["hull_id"] == "UNKNOWN"  # jendela sintetis ini tanpa bacaan


def test_resolve_meneruskan_arah_yang_tidak_diketahui_sebagai_none() -> None:
    window = (7, (100.0, 106.0, [], None))
    resolved = _resolve(window)
    assert resolved["direction"] is None


def test_resolve_membawa_id_jejak_ke_hasilnya() -> None:
    """Tanpa ini kartu HUD tidak bisa ditutup dengan truk yang benar."""
    assert _resolve((42, (100.0, 106.0, [], "inbound")))["track_id"] == 42
