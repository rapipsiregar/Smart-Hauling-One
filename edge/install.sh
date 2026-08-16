#!/usr/bin/env bash
#
# Commission one gate device.
#
#     ./install.sh                     # asks for the four values, then starts
#     ./install.sh --check             # only re-run the checks on a live device
#
# Everything a gate needs is these four answers. The script writes them to .env,
# builds, starts, and then VERIFIES against the core rather than reporting
# success because the containers came up — a device with a mistyped key starts
# perfectly and delivers nothing.

set -euo pipefail
cd "$(dirname "$0")"

BOLD=$'\033[1m'; DIM=$'\033[2m'; RED=$'\033[31m'; GREEN=$'\033[32m'
YELLOW=$'\033[33m'; RESET=$'\033[0m'

say()  { printf '%s\n' "$*"; }
ok()   { printf '%s✓%s %s\n' "$GREEN" "$RESET" "$*"; }
bad()  { printf '%s✗%s %s\n' "$RED" "$RESET" "$*"; }
warn() { printf '%s!%s %s\n' "$YELLOW" "$RESET" "$*"; }

API_PORT="${EDGE_API_PORT:-8100}"
UI_PORT="${EDGE_UI_PORT:-3100}"

# --- checks only -------------------------------------------------------------

run_checks() {
  say ""
  say "${BOLD}Memeriksa perangkat…${RESET}"
  local body
  if ! body=$(curl -sf --max-time 20 "http://127.0.0.1:${API_PORT}/api/preflight"); then
    bad "API perangkat di port ${API_PORT} belum menjawab."
    say "${DIM}  Lihat log:  docker compose logs -f edge-backend${RESET}"
    return 1
  fi

  # Rendered with python3 so the output reads like a checklist rather than JSON.
  printf '%s' "$body" | python3 -c '
import json, sys
report = json.load(sys.stdin)
GREEN, RED, DIM, RESET = "\033[32m", "\033[31m", "\033[2m", "\033[0m"
for check in report["checks"]:
    mark = f"{GREEN}✓{RESET}" if check["ok"] else f"{RED}✗{RESET}"
    print(f"  {mark} {check[\"name\"]}")
    print(f"    {DIM}{check[\"detail\"]}{RESET}")
    if check["fix"]:
        print(f"    → {check[\"fix\"]}")
sys.exit(0 if report["ready"] else 1)
'
}

if [[ "${1:-}" == "--check" ]]; then
  run_checks
  exit $?
fi

# --- gather ------------------------------------------------------------------

say "${BOLD}Pemasangan Perangkat Pos Gerbang${RESET}"
say "${DIM}Empat isian, lalu perangkat ini siap.${RESET}"
say ""

if [[ -f .env ]]; then
  warn "Berkas .env sudah ada. Nilai lama dipakai sebagai bawaan; tekan Enter untuk mempertahankannya."
  # shellcheck disable=SC1091
  source .env
fi

ask() {
  local prompt="$1" var="$2" current="${3:-}" answer
  if [[ -n "$current" ]]; then
    read -rp "$prompt [$current]: " answer
    answer="${answer:-$current}"
  else
    read -rp "$prompt: " answer
  fi
  while [[ -z "$answer" ]]; do
    read -rp "  Wajib diisi. $prompt: " answer
  done
  printf -v "$var" '%s' "$answer"
}

say "1. Kode pos gerbang — harus sama persis dengan yang terdaftar di Konsol Pusat"
ask "   Kode pos" CAMERA_CODE "${SMART_GATE_CAMERA_CODE:-}"

say ""
say "2. Alamat server pusat — salin dari Konsol Pusat → Kamera Per Pos → Alamat Pusat"
ask "   Alamat pusat" CORE_URL "${SMART_GATE_INDUK_URL:-}"

say ""
say "3. Kunci akses — terbitkan di Konsol Pusat → Kamera Per Pos → pos ini"
say "   ${DIM}Kunci hanya tampil sekali saat diterbitkan.${RESET}"
ask "   Kunci akses" API_KEY "${SMART_GATE_API_KEY:-}"

say ""
say "4. Alamat kamera (RTSP)"
ask "   Alamat RTSP" RTSP_URL "${SMART_GATE_RTSP_URL:-rtsp://192.168.1.50:554/stream1}"

# --- write -------------------------------------------------------------------

cat > .env <<ENVEOF
# Ditulis oleh install.sh — aman untuk diedit tangan, jalankan ./install.sh --check setelahnya.
SMART_GATE_CAMERA_CODE=${CAMERA_CODE}
SMART_GATE_INDUK_URL=${CORE_URL}
SMART_GATE_API_KEY=${API_KEY}
SMART_GATE_RTSP_URL=${RTSP_URL}

# Deteksi butuh kamera, GPU, dan berkas model. Nyalakan setelah pemeriksaan lulus.
SMART_GATE_RUN_AGENT=${SMART_GATE_RUN_AGENT:-false}

EDGE_API_PORT=${API_PORT}
EDGE_UI_PORT=${UI_PORT}
ENVEOF

# The key is in here. World-readable would leave a device credential lying
# around on a machine several people can log into.
chmod 600 .env
ok "Pengaturan tersimpan di edge/.env"

mkdir -p "data/${CAMERA_CODE}" model

# --- start -------------------------------------------------------------------

say ""
say "${BOLD}Membangun dan menjalankan…${RESET} ${DIM}(pertama kali bisa beberapa menit)${RESET}"
docker compose up -d --build

say ""
say "${DIM}Menunggu perangkat siap…${RESET}"
for _ in $(seq 1 60); do
  if curl -sf -o /dev/null --max-time 3 "http://127.0.0.1:${API_PORT}/api/status"; then
    break
  fi
  sleep 2
done

# --- verify ------------------------------------------------------------------

if run_checks; then
  say ""
  ok "Perangkat pos ${CAMERA_CODE} siap."
  say "   Konsol Gerbang : http://$(hostname -I 2>/dev/null | awk '{print $1}'):${UI_PORT}"
  say "   ${DIM}Nyalakan deteksi dengan SMART_GATE_RUN_AGENT=true di .env, lalu: docker compose up -d${RESET}"
else
  say ""
  bad "Perangkat berjalan, tetapi ada yang belum beres — perbaiki poin di atas."
  say "   ${DIM}Setelah memperbaiki .env:  docker compose up -d && ./install.sh --check${RESET}"
  exit 1
fi
