#!/usr/bin/env bash
#
# Start, restart and stop the whole demo: the centre plus any number of gate
# consoles on one machine.
#
# The split is deliberate, not laziness. The centre runs in Docker because it
# has no hardware to talk to. The gates run directly on the host because
# detection needs the GPU, and a container without device passthrough silently
# falls back to a CPU that cannot keep up -- which looks like a broken pipeline
# rather than a missing flag.
#
#   ./scripts/demo.sh up          start everything (builds what is missing)
#   ./scripts/demo.sh down        stop everything
#   ./scripts/demo.sh restart     down, then up -- what you want after editing code
#   ./scripts/demo.sh status      what is running, and which device each UI talks to
#   ./scripts/demo.sh build       rebuild the gate UIs only
#   ./scripts/demo.sh logs a      tail one gate's backend log
#
# Which gates start is set by GATES, default "a b":
#
#   GATES="a b c d" ./scripts/demo.sh up
#
set -uo pipefail

cd "$(dirname "$0")/.."
ROOT=$(pwd)
RUN_DIR="$ROOT/.run"
GATES=${GATES:-"a b"}

# shellcheck disable=SC1091
[ -f .env ] && set -a && . ./.env && set +a

CORE_API_PORT=${CORE_API_PORT:-8000}
CORE_UI_PORT=${CORE_UI_PORT:-3000}

# --- per-gate settings --------------------------------------------------------
# Ports are derived so adding a gate needs no new table: gate a is the first.
gate_index() { case "$1" in a) echo 0;; b) echo 1;; c) echo 2;; d) echo 3;; *) echo -1;; esac; }
gate_code()  { echo "CAM-GATE-$(echo "$1" | tr '[:lower:]' '[:upper:]')"; }
gate_api()   { echo $((8150 + $(gate_index "$1"))); }
gate_ui()    { echo $((3150 + $(gate_index "$1"))); }

gate_key() {
  # Gate a uses EDGE_API_KEY; the rest use EDGE_API_KEY_B and friends. Issue one
  # with: make provision GATE=CAM-GATE-C
  local suffix; suffix=$(echo "$1" | tr '[:lower:]' '[:upper:]')
  if [ "$1" = "a" ]; then echo "${EDGE_API_KEY:-}"; else
    local name="EDGE_API_KEY_$suffix"; echo "${!name:-}"; fi
}

say()  { printf '  %s\n' "$*"; }
fail() { printf '  ERROR: %s\n' "$*" >&2; }

# --- stopping -----------------------------------------------------------------

# `next start` is three processes deep -- npx, sh, next-server -- and next-server
# does not match the pattern the others do. Killing only what we recorded left it
# holding the port, which then looks exactly like a genuine port conflict. So:
# signal the process group, then sweep whatever still holds the port.
free_port() {
  local port=$1 pids
  pids=$(ss -ltnp 2>/dev/null | grep ":$port " | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u)
  [ -z "$pids" ] && return 0
  kill $pids 2>/dev/null
  sleep 2
  pids=$(ss -ltnp 2>/dev/null | grep ":$port " | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u)
  [ -n "$pids" ] && kill -9 $pids 2>/dev/null
  return 0
}

cmd_down() {
  say "stopping gates..."
  for f in "$RUN_DIR"/*.pid; do
    [ -f "$f" ] || continue
    kill -- "-$(cat "$f")" 2>/dev/null || kill "$(cat "$f")" 2>/dev/null
  done
  sleep 1
  for g in $GATES; do free_port "$(gate_api "$g")"; free_port "$(gate_ui "$g")"; done
  rm -rf "$RUN_DIR"
  say "stopping the centre..."
  docker compose stop core-backend core-frontend >/dev/null 2>&1
  say "stopped"
}

# --- starting -----------------------------------------------------------------

build_gate_ui() {
  local g=$1 api; api=$(gate_api "$g")
  # Next bakes rewrites into routes-manifest.json at BUILD time, so setting the
  # origin before `next start` does nothing. Each gate needs its own output or
  # they all proxy to whichever backend was built last.
  ( cd edge/frontend && EDGE_NEXT_DIST=".next-$g" \
      EDGE_BACKEND_ORIGIN="http://127.0.0.1:$api" npx next build ) \
    > "$RUN_DIR/ui-build-$g.log" 2>&1
}

cmd_build() {
  mkdir -p "$RUN_DIR"
  for g in $GATES; do
    printf '  building gate %s UI... ' "$g"
    if build_gate_ui "$g"; then echo "ok"; else
      echo "FAILED"; fail "see $RUN_DIR/ui-build-$g.log"; return 1; fi
  done
}

start_gate() {
  local g=$1 code api ui key data
  code=$(gate_code "$g"); api=$(gate_api "$g"); ui=$(gate_ui "$g"); key=$(gate_key "$g")
  data="./data/$code"

  if [ -z "$key" ]; then
    fail "gate $g has no API key. Issue one: make provision GATE=$code"
    return 1
  fi
  mkdir -p "edge/backend/$data"

  ( cd edge/backend && setsid sh -c "echo \$\$ > '$RUN_DIR/gate-$g-api.pid'; exec env \
      SMART_GATE_CAMERA_CODE='$code' \
      SMART_GATE_INDUK_URL='http://127.0.0.1:$CORE_API_PORT' \
      SMART_GATE_API_KEY='$key' \
      SMART_GATE_EDGE_DB='$data/edge.db' \
      SMART_GATE_OUTBOX_DB='$data/outbox.db' \
      SMART_GATE_SNAPSHOT_DIR='$data/snapshots' \
      SMART_GATE_CROSSING_SNAPSHOTS='$data/crops' \
      SMART_GATE_IDLE_STILL='./data/idle-frame.jpg' \
      SMART_GATE_RTSP_URL=none \
      SMART_GATE_RUN_AGENT=false \
      SMART_GATE_MODEL_PATH='../../core/backend/ai-model/truck-id-yolo26n-det-v2-numeric-filtered-20260730.pt' \
      PYTHONPATH=. ../../core/backend/.venv/bin/python -m uvicorn app.main:app \
      --host 0.0.0.0 --port $api --log-level warning" \
      > "$RUN_DIR/gate-$g-api.log" 2>&1 & )

  # 0.0.0.0, not localhost: the centre's reset button reaches the gates from
  # inside its container, which cannot see the host's loopback.

  ( cd edge/frontend && setsid sh -c "echo \$\$ > '$RUN_DIR/gate-$g-ui.pid'; exec env \
      EDGE_NEXT_DIST='.next-$g' EDGE_BACKEND_ORIGIN='http://127.0.0.1:$api' \
      npx next start -p $ui" > "$RUN_DIR/gate-$g-ui.log" 2>&1 & )
}

wait_for() {
  local url=$1 name=$2
  for _ in $(seq 1 90); do
    curl -sf --max-time 3 "$url" >/dev/null 2>&1 && return 0
    sleep 2
  done
  fail "$name never came up"
  return 1
}

cmd_up() {
  mkdir -p "$RUN_DIR"

  say "starting the centre..."
  docker compose up -d core-backend core-frontend >/dev/null 2>&1 || {
    fail "docker compose failed; is port $CORE_API_PORT taken by something else?"; return 1; }
  wait_for "http://127.0.0.1:$CORE_API_PORT/api/crossings-reset-preview" "core API" || return 1

  for g in $GATES; do
    [ -d "edge/frontend/.next-$g" ] || { printf '  building gate %s UI... ' "$g"
      build_gate_ui "$g" && echo "ok" || { echo "FAILED"; return 1; }; }
  done

  for g in $GATES; do say "starting gate $g..."; start_gate "$g" || return 1; done
  for g in $GATES; do
    wait_for "http://127.0.0.1:$(gate_api "$g")/api/status" "gate $g API" || return 1
    wait_for "http://127.0.0.1:$(gate_ui "$g")" "gate $g UI" || return 1
  done

  echo
  cmd_status
}

cmd_status() {
  printf '  %-18s %-34s %s\n' "SERVICE" "URL" "SERVES"
  printf '  %-18s %-34s %s\n' "Pusat (dashboard)" "http://localhost:$CORE_UI_PORT" \
    "$(curl -sf --max-time 3 "http://127.0.0.1:$CORE_UI_PORT" >/dev/null && echo up || echo DOWN)"
  printf '  %-18s %-34s %s\n' "Pusat (API)" "http://localhost:$CORE_API_PORT" \
    "$(curl -sf --max-time 3 "http://127.0.0.1:$CORE_API_PORT/api/crossings-reset-preview" >/dev/null && echo up || echo DOWN)"
  for g in $GATES; do
    local ui; ui=$(gate_ui "$g")
    # Asked through the UI on purpose: it proves the proxy points where it should,
    # which is the failure this layout exists to prevent.
    printf '  %-18s %-34s %s\n' "Gate $(echo "$g" | tr '[:lower:]' '[:upper:]')" \
      "http://localhost:$ui" \
      "$(curl -sf --max-time 3 "http://127.0.0.1:$ui/api/status" 2>/dev/null \
         | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d["camera_code"], d["direction"] or "arah belum diketahui")' 2>/dev/null \
         || echo DOWN)"
  done
}

case "${1:-}" in
  up)      cmd_up ;;
  down)    cmd_down ;;
  restart) cmd_down; echo; cmd_up ;;
  build)   cmd_build ;;
  status)  cmd_status ;;
  logs)    tail -f "$RUN_DIR/gate-${2:-a}-api.log" ;;
  *)       sed -n '2,26p' "$0" | sed 's/^#//' ;;
esac
