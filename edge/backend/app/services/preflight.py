"""Commissioning check: is this device configured correctly, and if not, why?

``/api/status`` answers "is it working". This answers "what is stopping it",
which is a different question and the only one that matters while somebody is
standing at a gate with a laptop.

Every check reports the same three things: whether it passed, what was actually
observed, and -- when it failed -- the specific next action. A red light that
says "core unreachable" sends a technician to the network cabinet when the real
problem was a mistyped key, so each failure is distinguished from its
neighbours rather than collapsed into one status.
"""

from __future__ import annotations

import os
import socket
from urllib.parse import urlparse

import requests

# Long enough to cross a slow site link, short enough that the whole check comes
# back while somebody is still looking at it.
#
# Two seconds, not six: this runs on page load, and a device with two unreachable
# endpoints spent twelve seconds returning nothing — long enough that the console
# reloaded underneath it and the result never arrived. Anything on the gate's own
# LAN answers in milliseconds; a link slower than two seconds is itself the fault
# being reported.
PROBE_TIMEOUT_SEC = 2

REQUIRED_ENV = (
    "SMART_GATE_INDUK_URL",
    "SMART_GATE_API_KEY",
    "SMART_GATE_CAMERA_CODE",
    "SMART_GATE_RTSP_URL",
)


def _check(name: str, ok: bool, detail: str, fix: str = "") -> dict:
    return {"name": name, "ok": ok, "detail": detail, "fix": "" if ok else fix}


def _env_check() -> dict:
    missing = [name for name in REQUIRED_ENV if not os.environ.get(name)]
    if missing:
        return _check(
            "Berkas pengaturan (.env)",
            False,
            f"Belum diisi: {', '.join(missing)}",
            "Jalankan ./install.sh di folder edge, atau salin .env.example "
            "menjadi .env lalu isi nilai yang kosong.",
        )
    return _check(
        "Berkas pengaturan (.env)", True,
        f"Lengkap untuk pos {os.environ['SMART_GATE_CAMERA_CODE']}",
    )


def _reachable_check(core_url: str) -> dict:
    """Can this device open a TCP connection to the core at all?

    Separated from the authentication check below because the two have
    completely different remedies: this one is cabling, DNS, or a firewall;
    the next one is a wrong key. Reporting them as one status is what sends
    people to the wrong place.
    """
    parsed = urlparse(core_url)
    host = parsed.hostname
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    if not host:
        return _check(
            "Jaringan ke pusat", False, f"Alamat tidak dapat dibaca: {core_url}",
            "Periksa SMART_GATE_INDUK_URL — harus lengkap, contoh "
            "http://10.0.0.5:8000",
        )
    try:
        with socket.create_connection((host, port), timeout=PROBE_TIMEOUT_SEC):
            return _check("Jaringan ke pusat", True, f"{host}:{port} terjangkau")
    except OSError as err:
        return _check(
            "Jaringan ke pusat", False, f"{host}:{port} tidak terjangkau ({err})",
            "Periksa kabel/jaringan perangkat, dan pastikan server pusat menyala "
            "serta port-nya terbuka dari lokasi pos ini.",
        )


def _auth_check(core_url: str, api_key: str) -> dict:
    """Does the core accept this device's key, and does it know this camera?

    A 401 here is the single most common commissioning mistake: the key is
    issued once on the dashboard and pasted by hand, so a truncated paste looks
    exactly like a broken deployment until somebody reads the log.
    """
    try:
        response = requests.get(
            f"{core_url.rstrip('/')}/api/edge/config",
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=PROBE_TIMEOUT_SEC,
        )
    except requests.RequestException as err:
        return _check(
            "Kunci akses diterima pusat", False, f"Gagal menghubungi pusat ({err})",
            "Perbaiki dulu jaringan ke pusat di atas.",
        )

    if response.status_code == 401:
        return _check(
            "Kunci akses diterima pusat", False, "Pusat menolak kunci (401)",
            "Terbitkan ulang kunci di Konsol Pusat → Kamera Per Pos → pos ini → "
            "Terbitkan Ulang Kunci, lalu salin ke SMART_GATE_API_KEY dan mulai "
            "ulang perangkat.",
        )
    if response.status_code != 200:
        return _check(
            "Kunci akses diterima pusat", False,
            f"Pusat menjawab {response.status_code}",
            "Periksa versi server pusat dan log-nya.",
        )

    config = response.json()
    return _check(
        "Kunci akses diterima pusat", True,
        f"Dikenali sebagai {config.get('camera_code')} "
        f"(arah masuk: {config.get('inbound_axis', 'ltr')})",
    )


def _camera_match_check(core_url: str, api_key: str, camera_code: str) -> dict:
    """Is this device configured as the same gate the core issued the key for?

    A key belongs to one camera. Copying a working .env from gate A to gate B
    and changing only the camera code leaves the device authenticating as A
    while calling itself B — and then B's crossings are filed under A, quietly,
    which is exactly the kind of wrong-but-plausible data that survives review.
    """
    try:
        response = requests.get(
            f"{core_url.rstrip('/')}/api/edge/config",
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=PROBE_TIMEOUT_SEC,
        )
        if response.status_code != 200:
            return _check(
                "Kode pos cocok dengan kunci", False, "Belum bisa diperiksa",
                "Selesaikan pemeriksaan kunci di atas dulu.",
            )
        issued_for = response.json().get("camera_code")
    except (requests.RequestException, ValueError) as err:
        return _check(
            "Kode pos cocok dengan kunci", False, f"Tidak dapat diperiksa ({err})",
            "Selesaikan pemeriksaan kunci di atas dulu.",
        )

    if issued_for != camera_code:
        return _check(
            "Kode pos cocok dengan kunci", False,
            f"Perangkat menyebut dirinya {camera_code}, "
            f"tetapi kunci ini milik {issued_for}",
            f"Gunakan kunci milik {camera_code}, atau ubah "
            f"SMART_GATE_CAMERA_CODE menjadi {issued_for}. Jangan menyalin "
            "kunci antar pos — lintasan akan tercatat di pos yang salah.",
        )
    return _check("Kode pos cocok dengan kunci", True, f"Keduanya {camera_code}")


def _camera_source_check(rtsp_url: str) -> dict:
    """Is there something listening where the camera should be?

    A TCP probe only, deliberately: opening the stream needs the decoder and
    would block this endpoint for seconds. "Something is listening on the
    camera's port" separates a wrong address from a stream that connects but
    fails to decode, which is a different job for a different tool.
    """
    parsed = urlparse(rtsp_url)
    host = parsed.hostname
    port = parsed.port or 554
    if not host:
        return _check(
            "Sumber video kamera", False, f"Alamat tidak dapat dibaca: {rtsp_url}",
            "Periksa SMART_GATE_RTSP_URL, contoh rtsp://192.168.1.50:554/stream1",
        )
    if host in ("localhost", "127.0.0.1"):
        return _check(
            "Sumber video kamera", True,
            f"{host}:{port} (alamat contoh — ganti dengan kamera sungguhan "
            "sebelum dioperasikan)",
        )
    try:
        with socket.create_connection((host, port), timeout=PROBE_TIMEOUT_SEC):
            return _check("Sumber video kamera", True, f"{host}:{port} menjawab")
    except OSError as err:
        return _check(
            "Sumber video kamera", False, f"{host}:{port} tidak menjawab ({err})",
            "Periksa kamera menyala, kabel jaringannya, dan alamat RTSP-nya.",
        )


def run() -> dict:
    """Every check, in the order a technician should fix them.

    Ordered by dependency: a wrong URL makes the auth check meaningless, so the
    list reads top to bottom as a repair sequence rather than a pile of alarms.
    """
    checks = [_env_check()]

    core_url = os.environ.get("SMART_GATE_INDUK_URL", "")
    api_key = os.environ.get("SMART_GATE_API_KEY", "")
    camera_code = os.environ.get("SMART_GATE_CAMERA_CODE", "")
    rtsp_url = os.environ.get("SMART_GATE_RTSP_URL", "")

    if checks[0]["ok"]:
        reachable = _reachable_check(core_url)
        checks.append(reachable)
        if reachable["ok"]:
            checks.append(_auth_check(core_url, api_key))
            checks.append(_camera_match_check(core_url, api_key, camera_code))
        checks.append(_camera_source_check(rtsp_url))

    return {
        "ready": all(c["ok"] for c in checks),
        "cameraCode": camera_code or None,
        "coreUrl": core_url or None,
        "checks": checks,
    }
