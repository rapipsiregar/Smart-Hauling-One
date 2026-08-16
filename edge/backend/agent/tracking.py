"""Satu jendela deteksi per truk, bukan satu jendela per periode waktu.

Sebelumnya seluruh gerbang berbagi satu ``DetectionWindow``: jendela dibuka pada
deteksi pertama dan ditutup setelah 2,5 detik tanpa deteksi. Itu benar selama
truk datang berjauhan -- dan komentar pada ``NO_DETECTION_GRACE_SEC`` menyebut
asumsinya terang-terangan: "observed cycles are minutes apart".

Pada antrean rapat asumsi itu runtuh. Diukur pada satu rekaman 45 detik: jeda
antar kemunculan plat berturut-turut adalah 0,3 / 0,4 / 0,9 / 0,6 / 0,2 / 2,2
detik -- seluruhnya di bawah ambang. Empat sampai lima truk masuk ke satu
jendela, satu pemungutan suara berjalan, dan hanya mayoritasnya tercatat. Dua
truk dengan 106 dan 74 bacaan hilang tanpa jejak.

Memperpendek ambangnya bukan jawaban: pada rekaman referensi plat pernah tak
terlihat sampai 1,87 detik di tengah SATU lintasan, jadi ambang yang cukup rapat
untuk memisahkan antrean akan memecah satu truk menjadi beberapa lintasan. Yang
salah bukan angkanya, melainkan satuannya -- yang memisahkan truk seharusnya
truknya sendiri, bukan waktu.

Jadi tiap kotak deteksi dilacak antar frame, dan tiap jejak memegang jendelanya
sendiri. Jendela sebuah jejak menutup saat jejak itu menghilang, bukan saat
gerbang sepi. Antrean rapat maupun renggang sama-sama benar, tanpa satu pun
konstanta waktu perlu disetel ulang.
"""

from __future__ import annotations

import queue
from dataclasses import dataclass, field

from agent.config import NO_DETECTION_GRACE_SEC, TunableStore
from agent.pipeline import ACTIVE, LTR, DetectionWindow, iou

# Seberapa mirip posisi kotak antar frame agar dianggap truk yang sama.
#
# Rendah dengan sengaja. Truk bergerak cepat melintasi frame, jadi kotak pada dua
# frame berurutan bisa hanya bertumpang sedikit -- pada rekaman referensi truk
# menempuh sampai 0,8 lebar frame dalam satu lintasan. Ambang tinggi akan memecah
# satu truk menjadi banyak jejak, kesalahan yang persis sama dengan yang sedang
# diperbaiki, hanya dari arah berlawanan.
MATCH_IOU = 0.15

# Bila kotak tidak bertumpang sama sekali (plat sempat tak terlihat lalu muncul
# lagi beberapa frame kemudian), jarak pusat masih boleh menyambungkannya --
# selama masih di bawah sekian bagian lebar frame.
MATCH_CENTER_FRACTION = 0.25


class _TrackSink:
    """Penerima jendela tertutup milik satu jejak.

    Menyamar sebagai antrean supaya ``DetectionWindow`` tidak perlu tahu apa pun
    tentang penjejakan: ia tetap memanggil ``put`` seperti biasa. Di sini
    identitas jejaknya dicatat, lalu jendelanya diteruskan ke antrean sungguhan
    agar pemanggil lama (finalizer di loop langsung) tetap menerimanya seperti
    sebelum ada penjejakan.
    """

    def __init__(self, owner: "TrackedWindows", track_id: int, downstream) -> None:
        self._owner = owner
        self._track_id = track_id
        self._downstream = downstream

    def put(self, item) -> None:
        self._owner.finished.append((self._track_id, item))
        if self._downstream is not None:
            self._downstream.put(item)


@dataclass
class Track:
    """Satu truk yang sedang diikuti, beserta jendelanya sendiri."""

    id: int
    window: DetectionWindow
    last_box: dict
    last_seen: float
    #: Kotak yang cocok dengan jejak ini pada frame berjalan, bila ada.
    current_box: dict | None = field(default=None, compare=False)


def _center(box: dict) -> tuple[float, float]:
    return ((box["x0"] + box["x1"]) / 2.0, (box["y0"] + box["y1"]) / 2.0)


def _as_tuple(box: dict) -> tuple[float, float, float, float]:
    return (box["x0"], box["y0"], box["x1"], box["y1"])


class TrackedWindows:
    """Mengelola satu ``DetectionWindow`` untuk tiap truk yang terlihat.

    Bentuk pemanggilannya sengaja dibuat mirip ``DetectionWindow`` supaya kedua
    pemanggil yang ada (loop langsung dan bangku uji rekaman) berubah sesedikit
    mungkin: ``begin_frame`` lalu ``end_frame``, dengan jejak aktif dikembalikan
    di antaranya.
    """

    def __init__(
        self,
        tunables: TunableStore,
        finalizer_queue: queue.Queue,
        inbound_axis: str = LTR,
    ) -> None:
        self._tunables = tunables
        self._queue = finalizer_queue
        self._inbound_axis = inbound_axis
        self._tracks: dict[int, Track] = {}
        self._next_id = 0
        #: ``[(track_id, (mulai, selesai, reads, arah)), ...]`` untuk jendela yang
        #: sudah ditutup. Pemanggil yang perlu tahu jendela milik truk yang mana
        #: membacanya dari sini; tuple-nya sendiri tidak membawa identitas.
        self.finished: list[tuple[int, tuple]] = []
        #: Daftar bacaan tiap jejak, tetap dapat dijangkau setelah jendelanya
        #: menutup. ``_close_window`` MENGIKAT ULANG ``self.reads`` ke daftar
        #: baru alih-alih mengosongkannya, jadi daftar lama tetap hidup di dalam
        #: tuple yang sudah diserahkan -- itulah yang membuat bacaan OCR yang
        #: telat datang masih bisa mendarat di jendela yang benar.
        self._reads: dict[int, list] = {}
        self._last_yolo_ts = 0.0

    # -- throttle -------------------------------------------------------------

    def should_run_yolo(self, now: float) -> bool:
        """``yolo_fps`` throttle -- lewati frame ini bila terlalu cepat.

        Keputusan tingkat PERANGKAT, bukan per truk: yang dibatasi adalah berapa
        kali detektor dijalankan atas frame, dan satu frame hanya dideteksi
        sekali berapa pun truk di dalamnya. Menaruhnya di tiap jejak akan
        membuat laju deteksi naik seiring jumlah truk -- persis saat perangkat
        paling sibuk.
        """
        config = self._tunables.get()
        if now - self._last_yolo_ts < 1.0 / max(1, config.yolo_fps):
            return False
        self._last_yolo_ts = now
        return True

    # -- pencocokan -----------------------------------------------------------

    def _match(self, box: dict, frame_width: float, taken: set[int]) -> Track | None:
        """Jejak yang paling mungkin memiliki kotak ini, atau None.

        Tumpang-tindih diutamakan; jarak pusat menjadi cadangan untuk plat yang
        sempat hilang beberapa frame lalu muncul lagi sedikit bergeser.
        """
        best, best_score = None, 0.0
        for track in self._tracks.values():
            if track.id in taken:
                continue
            score = iou(_as_tuple(box), _as_tuple(track.last_box))
            if score > best_score:
                best, best_score = track, score
        if best is not None and best_score >= MATCH_IOU:
            return best

        if frame_width <= 0:
            return None
        cx, cy = _center(box)
        limit = MATCH_CENTER_FRACTION * frame_width
        nearest, nearest_dist = None, limit
        for track in self._tracks.values():
            if track.id in taken:
                continue
            tx, ty = _center(track.last_box)
            dist = ((cx - tx) ** 2 + (cy - ty) ** 2) ** 0.5
            if dist < nearest_dist:
                nearest, nearest_dist = track, dist
        return nearest

    # -- siklus frame ---------------------------------------------------------

    def begin_frame(self, boxes: list[dict], now: float, frame_width: float) -> list[Track]:
        """Cocokkan kotak ke jejak, buka jejak baru, kembalikan yang aktif.

        Tiap kotak dimiliki paling banyak satu jejak: dua truk bersebelahan yang
        kotaknya bertumpang tidak boleh saling mencuri, karena bacaannya akan
        tercampur dan justru menghidupkan kembali masalah yang sedang dihapus.
        """
        for track in self._tracks.values():
            track.current_box = None

        taken: set[int] = set()
        for box in boxes:
            track = self._match(box, frame_width, taken)
            if track is None:
                self._next_id += 1
                track_id = self._next_id
                window = DetectionWindow(
                    self._tunables, self._queue, inbound_axis=self._inbound_axis
                )
                # Jendela tiap jejak diserahkan lewat penampung yang tahu jejak
                # mana pemiliknya. Tuple bawaan hanya berisi waktu, bacaan, dan
                # arah -- tanpa identitas, pemanggil tidak bisa memisahkan
                # jendela dua truk yang menutup pada frame yang sama.
                window._queue = _TrackSink(self, track_id, self._queue)
                window.begin_frame(True, now)
                track = Track(id=track_id, window=window, last_box=box, last_seen=now)
                self._reads[track_id] = window.reads
                self._tracks[track.id] = track
            else:
                track.window.begin_frame(True, now)
            track.current_box = box
            track.last_box = box
            track.last_seen = now
            taken.add(track.id)
            if track.window.state == ACTIVE and frame_width > 0:
                track.window.note_position(box, frame_width)

        return [t for t in self._tracks.values() if t.current_box is not None]

    def end_frame(self, now: float, can_close=None) -> list[int]:
        """Tutup jejak yang sudah lewat masa tenggang atau batas durasinya.

        ``DetectionWindow.end_frame`` yang memutuskan keduanya, memakai
        ``last_qualifying_ts`` milik jejak itu sendiri -- jadi truk yang platnya
        sempat tak terlihat 1,87 detik di tengah lintasan tetap satu jendela,
        sementara truk berikutnya yang datang 0,3 detik kemudian sudah punya
        jejak sendiri sejak awal.

        ``can_close(track_id)`` menahan penutupan selama pemanggil belum siap --
        loop langsung memakainya untuk menunggu OCR jejak itu selesai, karena
        menutup lebih dulu berarti membuang bacaan yang sudah terlanjur dikirim
        ke pengenal. Mengembalikan id jejak yang benar-benar ditutup.
        """
        closed: list[int] = []
        for track_id, track in list(self._tracks.items()):
            if can_close is not None and not can_close(track_id):
                continue
            if track.window.end_frame(now):
                del self._tracks[track_id]
                closed.append(track_id)
        return closed

    def close_all(self, now: float) -> None:
        """Tutup semua jejak yang masih terbuka. Dipakai saat rekaman habis."""
        for track_id, track in list(self._tracks.items()):
            if track.window.state != "IDLE" and track.window.window_start_ts is not None:
                track.window._close_window(now)
            del self._tracks[track_id]

    def record_read(
        self,
        track_id: int,
        *,
        text: str,
        weight: float,
        det_conf: float,
        ocr_conf: float,
        now: float,
        crop_jpeg: bytes | None,
    ) -> None:
        """Simpan satu bacaan OCR pada jejak pemiliknya.

        Bentuk dict-nya dibuat persis sama dengan ``DetectionWindow.record_read``
        -- termasuk ``now`` yang disimpan sebagai ``ts``. Pemilih foto membaca
        ``ts`` untuk memutuskan seri bobot, jadi kunci yang meleset akan membuat
        bukti diambil dari bingkai yang salah tanpa satu pun galat muncul.

        Berlaku juga setelah jendela jejak itu menutup: OCR berjalan asinkron,
        jadi hasil sebuah potongan gambar bisa kembali beberapa frame setelah
        truknya keluar. Tanpa ini bacaan tersebut hilang, dan yang hilang justru
        cenderung bacaan terakhir -- bingkai paling lurus menghadap kamera.
        """
        reads = self._reads.get(track_id)
        if reads is None:
            return
        reads.append({
            "text": text, "weight": weight, "det_conf": det_conf,
            "ocr_conf": ocr_conf, "ts": now, "crop_jpeg": crop_jpeg,
        })

    def reads_for(self, track_id: int) -> list:
        """Bacaan yang sudah terkumpul untuk satu jejak. Kosong bila tak dikenal."""
        return self._reads.get(track_id, [])

    @property
    def active(self) -> list[Track]:
        return list(self._tracks.values())

    def __len__(self) -> int:
        return len(self._tracks)
