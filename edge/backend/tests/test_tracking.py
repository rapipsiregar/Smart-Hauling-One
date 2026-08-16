"""Truk beruntun harus menjadi lintasan yang terpisah.

Regresi yang diperbaiki modul ini, diukur pada satu rekaman 45 detik berisi
antrean truk: jeda antar kemunculan plat berturut-turut 0,3 / 0,4 / 0,9 / 0,6 /
0,2 / 2,2 detik -- seluruhnya di bawah masa tenggang 2,5 detik. Empat sampai
lima truk masuk ke SATU jendela, satu pemungutan suara berjalan, dan hanya
mayoritasnya tercatat. Dua truk dengan 106 dan 74 bacaan hilang tanpa jejak.

Yang diuji di sini adalah pemisahannya. Bahwa jendela yang sudah terpisah
menghasilkan suara dan foto yang benar sudah dijamin uji lain.
"""

from __future__ import annotations

import queue

import pytest

from agent.config import NO_DETECTION_GRACE_SEC, TunableStore, Tunables
from agent.tracking import TrackedWindows

FRAME_W = 1280.0


def _box(x0: float, x1: float, y0: float = 100.0, y1: float = 200.0, conf: float = 0.9):
    return {"x0": x0, "y0": y0, "x1": x1, "y1": y1, "conf": conf}


@pytest.fixture
def tracker():
    store = TunableStore(Tunables(yolo_fps=20, ocr_fps=4, detect_window_sec=6))
    return TrackedWindows(store, queue.Queue(), inbound_axis="ltr")


def _step(tracker, boxes, now):
    active = tracker.begin_frame(boxes, now, FRAME_W)
    tracker.end_frame(now)
    return active


# --- pemisahan ---------------------------------------------------------------

def test_satu_truk_tetap_satu_jejak(tracker):
    """Kotak yang bergeser sedikit tiap frame adalah truk yang sama."""
    for i in range(10):
        _step(tracker, [_box(100 + i * 20, 300 + i * 20)], now=i * 0.1)
    assert len(tracker) == 1


def test_dua_truk_bersamaan_mendapat_jejak_masing_masing(tracker):
    """Inilah kasus yang dulu tergabung: dua plat terlihat berdampingan."""
    for i in range(6):
        _step(tracker, [
            _box(100 + i * 15, 260 + i * 15),      # truk A, kiri
            _box(800 + i * 15, 960 + i * 15),      # truk B, kanan
        ], now=i * 0.1)
    assert len(tracker) == 2


def test_truk_berikutnya_datang_sebelum_masa_tenggang_habis(tracker):
    """Jeda 0,3 detik -- di bawah ambang 2,5 detik yang dulu menyatukannya."""
    for i in range(5):
        _step(tracker, [_box(100 + i * 20, 260 + i * 20)], now=i * 0.1)
    seen_first = {t.id for t in tracker.active}

    # Truk kedua muncul di sisi lain frame, 0,3 detik setelah yang pertama.
    for i in range(5):
        _step(tracker, [_box(900 - i * 20, 1060 - i * 20)], now=0.5 + i * 0.1)

    ids = {t.id for t in tracker.active}
    assert ids - seen_first, "truk kedua harus punya jejak sendiri"
    assert len(ids | seen_first) >= 2


def test_plat_hilang_sesaat_tidak_memecah_satu_truk(tracker):
    """Pada rekaman referensi plat pernah tak terlihat 1,87 detik di tengah lintasan.

    Memperpendek masa tenggang akan memecah truk ini menjadi beberapa lintasan --
    justru alasan kenapa pemisahan dilakukan per truk, bukan per jeda waktu.
    """
    for i in range(4):
        _step(tracker, [_box(100 + i * 20, 260 + i * 20)], now=i * 0.1)
    first = {t.id for t in tracker.active}

    for step in range(18):                       # 1,8 detik tanpa deteksi
        _step(tracker, [], now=0.4 + step * 0.1)

    _step(tracker, [_box(180, 340)], now=2.2)    # muncul lagi, posisi berdekatan
    assert {t.id for t in tracker.active} == first


def test_jejak_ditutup_setelah_truk_benar_benar_pergi(tracker):
    for i in range(4):
        _step(tracker, [_box(100, 260)], now=i * 0.1)
    assert len(tracker) == 1

    for step in range(int(NO_DETECTION_GRACE_SEC * 10) + 4):
        _step(tracker, [], now=0.4 + step * 0.1)
    assert len(tracker) == 0


# --- kepemilikan kotak -------------------------------------------------------

def test_satu_kotak_hanya_dimiliki_satu_jejak(tracker):
    """Dua jejak yang saling mencuri kotak akan mencampur bacaannya.

    Itu menghidupkan kembali persis masalah yang modul ini hapus, hanya lewat
    jalan lain.
    """
    _step(tracker, [_box(100, 260), _box(800, 960)], now=0.0)
    active = tracker.begin_frame([_box(110, 270)], now=0.1, frame_width=FRAME_W)
    assert len(active) == 1
    assert sum(1 for t in tracker.active if t.current_box is not None) == 1


def test_frame_kosong_tidak_membuka_jejak(tracker):
    _step(tracker, [], now=0.0)
    assert len(tracker) == 0


# --- penutupan paksa ---------------------------------------------------------

def test_close_all_menutup_jejak_yang_masih_terbuka(tracker):
    closed: list = []
    tracker._queue.put = closed.append
    for i in range(4):
        _step(tracker, [_box(100 + i * 30, 260 + i * 30)], now=i * 0.1)
    assert len(tracker) == 1

    tracker.close_all(now=1.0)
    assert len(tracker) == 0
    assert len(closed) == 1, "jendela yang terbuka harus diserahkan, bukan dibuang"


def test_tiap_jejak_menyerahkan_jendelanya_sendiri(tracker):
    """Dua truk harus menghasilkan dua jendela tertutup, bukan satu."""
    closed: list = []
    tracker._queue.put = closed.append
    for i in range(6):
        _step(tracker, [
            _box(100 + i * 15, 260 + i * 15),
            _box(800 + i * 15, 960 + i * 15),
        ], now=i * 0.1)

    tracker.close_all(now=1.0)
    assert len(closed) == 2
