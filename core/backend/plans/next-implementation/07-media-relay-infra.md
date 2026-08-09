# Section 07 — Media Relay Infrastructure (MediaMTX + coturn)

**Goal:** the WebRTC relay containers exist, start cleanly, and are wired to the backend by config.
**Depends on:** [06](./06-live-view-orchestration.md). **Blocks:** 08.

`docs/edge-system/SRS.md` §8.1: the relay runs **alongside, not inside**, the FastAPI process. The
backend only orchestrates *which* session may be active; it never touches video frames.

**What this section does NOT do:** supply real TURN credentials, a public IP, or DNS. Those are a
live-deployment step. `docs/edge-system/PRD.md` §7 Key Decision 1 requires the induk to be publicly
reachable for the live feed to traverse cellular NAT — until that happens, the containers run but
no edge can actually reach them. That is expected at this stage.

---

## 7.1 [DONE] Create `infra/mediamtx.yml`

**New file.**

```yaml
# MediaMTX configuration for Smart Gate live raw CCTV viewing.
# docs/edge-system/SRS.md §8.1 -- WHIP ingest from edges, WHEP playback to browsers.
#
# Paths are created on demand: the backend issues URLs of the form
#   /whip/{camera_code}/{session_id}   (edge pushes)
#   /whep/{camera_code}/{session_id}   (browser plays)
# so no per-gate path needs to be predeclared here.

logLevel: info
logDestinations: [stdout]

# --- WebRTC (WHIP ingest + WHEP playback) ------------------------------------
webrtc: yes
webrtcAddress: :8889
webrtcEncryption: no          # TLS terminates at the reverse proxy in production
webrtcAllowOrigin: '*'        # tighten to the dashboard origin before production

# ICE servers advertised to both peers. The coturn container below is what lets
# traffic traverse the cellular NAT the 4 edge devices sit behind (SRS §11 risk).
webrtcICEServers2:
  - url: turn:coturn:3478
    username: smartgate
    password: CHANGE_ME_BEFORE_DEPLOYMENT

# Additional hosts to advertise in ICE candidates. Set PUBLIC_HOST to the
# induk's public IP/hostname in production, or WebRTC will only ever offer
# unroutable container-internal addresses.
webrtcAdditionalHosts: []

# --- Control API (health checks / session introspection) ---------------------
api: yes
apiAddress: :9997

# --- Disable protocols this deployment does not use --------------------------
rtsp: no
rtmp: no
hls: no
srt: no

paths:
  all_others:
```

> **Verify these keys against the image tag you actually pull.** MediaMTX's config schema changes
> between releases (`webrtcICEServers2` replaced an older `webrtcICEServers`, for instance). If the
> container logs a config-parse error on boot, check that release's `mediamtx.yml` reference rather
> than guessing.

---

## 7.2 [DONE] Create `infra/turnserver.conf.example`

**New file.** The `.example` suffix matters — see 7.4.

```conf
# coturn configuration for Smart Gate WebRTC NAT traversal.
# Copy to infra/turnserver.conf and replace every CHANGE_ME before deploying.
#
# Required because the 4 edge devices sit behind cellular NAT and cannot accept
# inbound connections (docs/edge-system/SRS.md §8.2, §11).

listening-port=3478
fingerprint

# Long-term credentials. MUST match webrtcICEServers2 in infra/mediamtx.yml.
lt-cred-mech
user=smartgate:CHANGE_ME_BEFORE_DEPLOYMENT
realm=smartgate.local

# The induk's PUBLIC address. Without this, coturn hands out unroutable
# candidates and relaying silently fails.
# external-ip=CHANGE_ME_PUBLIC_IP

# Relay port range. Must be open in the host firewall / security group.
min-port=49152
max-port=49252

# Keep the relay narrow: it exists for this one application.
no-multicast-peers
no-cli
no-tlsv1
no-tlsv1_1
```

---

## 7.3 [DONE] Add the services to `docker-compose.yml`

**File:** `docker-compose.yml` — the existing file has a single `backend` service. Add two more,
behind a Compose **profile** so deployments that only do batch processing don't run a relay they
never use.

```yaml
services:
  backend:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: smart-gate-backend
    ports:
      - "${PORT:-8000}:8000"
    environment:
      - PORT=8000
      # Where live/start and live-session hand out WHIP/WHEP URLs. Point this at
      # the relay's PUBLIC address in production -- the browser and the edge both
      # resolve it, so a container-internal hostname will not do.
      - MEDIA_RELAY_BASE_URL=${MEDIA_RELAY_BASE_URL:-http://localhost:8889}
    volumes:
      - ./data:/app/data
      - ./ai-model:/app/ai-model
    restart: unless-stopped

  # --- Live raw CCTV viewing (docs/edge-system/SRS.md §8) ---------------------
  # Started only with: docker compose --profile live-view up -d
  media-relay:
    image: bluenviron/mediamtx:latest
    container_name: smart-gate-media-relay
    profiles: ["live-view"]
    ports:
      - "8889:8889"        # WHIP ingest + WHEP playback (HTTP signalling)
      - "8189:8189/udp"    # WebRTC media
      - "9997:9997"        # control API (health check)
    volumes:
      - ./infra/mediamtx.yml:/mediamtx.yml:ro
    restart: unless-stopped

  coturn:
    image: coturn/coturn:latest
    container_name: smart-gate-coturn
    profiles: ["live-view"]
    # coturn needs a wide UDP relay range; host networking is the simplest
    # correct setup for Compose, at the cost of port-mapping granularity.
    # Acceptable for a 4-device fleet.
    network_mode: host
    volumes:
      - ./infra/turnserver.conf:/etc/coturn/turnserver.conf:ro
    command: ["-c", "/etc/coturn/turnserver.conf"]
    restart: unless-stopped
```

> **Pin the image tags before production.** `:latest` is fine for scaffolding but makes deployments
> irreproducible — a relay that worked last week can break on a `docker compose pull`. Replace with
> explicit versions once you've confirmed a working combination.

> **`network_mode: host` and `profiles` interact awkwardly on Docker Desktop for macOS/Windows**,
> where host networking is limited. This stack is intended for a Linux host (the same constraint
> the GPU compose override already documents in `README.md`).

---

## 7.4 [DONE] Keep real credentials out of git

**File:** `.gitignore` — append:

```gitignore
# Real relay credentials (infra/turnserver.conf.example is the tracked template)
infra/turnserver.conf
```

The existing `.gitignore` already covers `.env` with a `!.env.example` exception; this follows the
same convention. `infra/mediamtx.yml` stays tracked — its only secret is the TURN password, which
must match `turnserver.conf`. If you put a real password there, move it to an env-var substitution
and gitignore it too rather than committing it.

Create the working copy locally:
```bash
cp infra/turnserver.conf.example infra/turnserver.conf
```

---

## 7.5 [DONE] Document it in the README

**File:** `README.md` — add after the existing GPU-acceleration paragraph in the Docker section.

```markdown
**Live CCTV viewing (optional):** the WebRTC relay that carries a gate's raw feed to the dashboard
runs as two extra containers, behind a Compose profile so batch-only deployments skip them:

```bash
cp infra/turnserver.conf.example infra/turnserver.conf   # then edit the CHANGE_ME values
docker compose --profile live-view up -d
```

This starts **MediaMTX** (WHIP ingest from the edge devices, WHEP playback to the browser) and
**coturn** (TURN relay, required because the gate devices sit behind cellular NAT). Set
`MEDIA_RELAY_BASE_URL` to the relay's publicly reachable address — the browser and the edge both
resolve it, so `localhost` only works for a single-machine test. Verify the relay is up:

```bash
curl http://localhost:9997/v3/paths/list
```

See `docs/edge-system/SRS.md` §8 for the full architecture.
```

---

## 7.6 [DONE] Verify

```bash
cp infra/turnserver.conf.example infra/turnserver.conf
docker compose --profile live-view up -d media-relay coturn
docker compose ps                 # both containers Up, not restarting
docker compose logs media-relay   # no config-parse errors
curl -s http://localhost:9997/v3/paths/list
docker compose --profile live-view down
```

The `curl` should return JSON with an empty item list — that confirms MediaMTX parsed its config
and its API is live. An empty path list is correct: no edge is pushing yet.

If `coturn` fails on `network_mode: host` (common on Docker Desktop), note it and continue — the
orchestration tests in Section 06 don't need it, and TURN only matters once real devices connect
over cellular.

---

## Acceptance for Section 07

- [ ] `infra/mediamtx.yml` and `infra/turnserver.conf.example` exist; `infra/turnserver.conf` is
      gitignored.
- [ ] `docker compose --profile live-view up -d` starts both containers without crash-looping.
- [ ] `curl http://localhost:9997/v3/paths/list` returns valid JSON.
- [ ] `docker compose up -d` (no profile) still starts **only** the backend — the relay must not
      become a hard dependency of the normal deployment.
- [ ] `README.md` documents the profile and `MEDIA_RELAY_BASE_URL`.
