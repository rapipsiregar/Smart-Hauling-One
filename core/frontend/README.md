# SmartGate — Mining Operations Web Console

Frontend for the hauling-truck OCR / ritase reconciliation system. A control-room
web console for real-time crossing detection, fleet management, reconciliation, and
shift reporting.

Built with **Next.js 16** (App Router), **React 19**, **Bun**, **Tailwind CSS 4**, and
**TypeScript**. This repository is frontend-only — the Python backend lives on the
[`backend`](https://github.com/abdshomad/ocr-hauling-truck/tree/backend) branch, which
also carries the Source-of-Truth specs (`docs/edge-system/`, `docs/system_logics/`) this
console is built against.

> The Edge Devices and Live Gate View pages are built against endpoints that are specced
> but **not yet deployed** on the backend. They render their gate list and state the
> endpoint is unavailable rather than showing placeholder values; both work as-is once the
> backend mounts the routes. See [plans/next-implementation.md](plans/next-implementation.md).

## Run it

The backend (`backend` branch) should be running first — by default the
frontend expects it at `http://127.0.0.1:8000`.

**With Docker** (simplest — no local Node/Bun setup needed):

```bash
docker compose up --build
```

Open http://localhost:3000.

If the backend runs somewhere other than `http://127.0.0.1:8000`, set that
before building:

```bash
BACKEND_ORIGIN=http://127.0.0.1:8000 docker compose up --build
```

(If the backend runs on your host machine rather than in a container, use
`http://host.docker.internal:8000` — `127.0.0.1` inside the container refers
to the container itself, not the host.)

`BACKEND_ORIGIN` must be set before `up --build` runs, not changed afterwards
— the `/api` and `/media` proxy rewrites in `next.config.ts` are resolved once
at build time. To run the plain `docker build`/`docker run` equivalent:

```bash
docker build --build-arg BACKEND_ORIGIN=http://127.0.0.1:8000 -t smartgate-frontend .
docker run -p 3000:3000 smartgate-frontend
```

**Without Docker** (requires [Bun](https://bun.sh/)):

```bash
bun install
bun dev
```

Open http://localhost:3000. `next.config.ts` proxies `/api/:path*` and
`/media/:path*` to `BACKEND_ORIGIN`, so no CORS setup or env vars are needed
in development.

## Scripts

| Command | Purpose |
|---------|---------|
| `bun dev`   | Start the dev server (Turbopack) |
| `bun run build` | Production build |
| `bun start` | Serve the production build |
| `bun run lint` | Run ESLint |

## Pages

| Route | Screen |
|-------|--------|
| `/` | Dashboard Monitoring — real-time detection feed and inspector |
| `/ledger` | Reconciliation Ledger |
| `/crossing/[id]` | Crossing Detail — evidence, votes, reconciliation |
| `/cctv-history` | CCTV History Archive |
| `/fleet` | Fleet Registry & Assets |
| `/reports` | Daily & Shift Report |
| `/settings` | System Configuration — camera registry |
| `/settings/devices` | Edge Devices — per-gate inference settings & health |
| `/live/[camera_code]` | Live Gate View — one gate's raw camera feed (WebRTC) |

## Project layout

| Path | Description |
|------|-------------|
| `src/app/` | Routes (App Router pages + `layout.tsx`, `globals.css`) |
| `src/components/` | Feature components (`crossing/`, `fleet/`, `monitoring/`, `reports/`, `settings/`) and shared `ui/` |
| `src/components/app-shell.tsx` | Sidebar + header shell, navigation, theme toggle |
| `src/lib/api-client.ts` | Typed backend API client (fleet, crossings, cameras, reports) |
| `src/lib/types.ts` | Shared domain types |
| `src/lib/theme-context.tsx` | Light/dark theme provider |
| `src/lib/guide-context.tsx` | In-app guide / tutorial state |
| `public/` | Static assets |

## Backend

The API and media endpoints are served by the Python backend on the `backend`
branch (formerly `simplified-ui`). See `src/lib/api-client.ts` for the full list of
endpoints the frontend consumes.

See [AGENTS.md](AGENTS.md) for agent/AI conventions.
