# Agent Instructions

This is the **frontend** branch of `abdshomad/ocr-hauling-truck` — a Next.js 16 / React 19 /
Bun / Tailwind 4 console for the SmartGate hauling-truck OCR system. It is frontend-only.

## 0. Where the truth lives

The Python backend is a **separate branch of this same repository**:
`abdshomad/ocr-hauling-truck`, branch `backend`. Do not confuse it with
`abdshomad/smart-hauling-one`, which is a different, similar-looking project (React/Vite +
Express, solar-tower telemetry) whose specs do **not** describe this system.

The backend branch carries the Chain of Truth (CoT) Source-of-Truth artifacts. When a task
touches behaviour this frontend shares with the backend — endpoints, field names, device
semantics — read the artifact before writing code rather than inferring the contract:

| Artifact (on the `backend` branch) | Covers |
|---|---|
| `docs/edge-system/PRD.md` | Edge-device goals, non-goals, canonical defaults (§9) |
| `docs/edge-system/SRS.md` | Algorithms, state machines, data-model impact |
| `docs/edge-system/API_CONTRACT.md` | **Authoritative** endpoint/field reference |
| `docs/system_logics/sys_uc_0NN.md` | Per-use-case sequence diagrams + security rules |
| `docs/information_architecture.md` | Page inventory and routes (PAGE-001…009) |
| `docs/design_system.md` | Component specs (§7.x) |

Two rules from those documents override any local convenience:

1. **The live CCTV view is raw video only.** No detection overlay, no bounding boxes, no
   hull-ID readout on a live stream, ever (PRD Goal 7 / Non-Goals). Inference reaches this
   UI only as finished, consensus-voted crossing events.
2. **The server is authoritative on validation.** Client-side range checks guard the input;
   they never replace the server's `400`.

Where an endpoint is specced but not yet deployed, the UI must say so plainly rather than
render plausible-looking defaults — a fabricated value read as a live setting is worse than
an empty state. `isEndpointMissing()` in `src/lib/api-client.ts` distinguishes "route not
mounted" from a genuine contract `404`.

## 1. Trigger "e" or "enhance"

If the user types "e", "enhance", or requests an enhancement plan:
- Read `plans/next-enhancements.md` to understand the current platform structure, history, and active tasks.
- Overwrite or update the active tasks list inside `plans/next-enhancements.md`.
- The plan must cover each main section/module of the application.
- Inside the tasks list, define **exactly 3 new enhancements per section** with:
  1. A unique number (e.g., `1.1`, `1.2`, `1.3`).
  2. A clear, specific description of the functional change.
  3. A status (initially set to `[TODO]`).
- Present this plan to the user in your final summary response.

## 2. Trigger "n", "next", or "n{x}"

If the user types "n", "next", "n{x}" (where `{x}` is a positive integer representing the number of enhancements, e.g., "n3"), or requests execution of the next enhancement task(s):
- Read `plans/next-enhancements.md` to check the status of tasks.
- If all enhancement tasks are marked `[DONE]` (or none are `[TODO]`), automatically execute the **Trigger "e" or "enhance"** workflow to generate a new set of tasks.
- Otherwise, identify and select the most impactful enhancement task(s) currently marked `[TODO]` (evaluating which tasks have the highest strategic value, functional impact, or user experience contribution). If `{x}` is specified, select the top `{x}` most impactful tasks and execute them sequentially.
- Implement the selected task(s) fully in this codebase. Work that genuinely requires backend
  changes belongs on the `backend` branch — note it in the plan rather than stubbing a fake
  API here.
- Once completed:
  1. Update the specific task(s) status in `plans/next-enhancements.md` to `[DONE]`.
  2. Document the new or updated feature(s) in `docs/feature-list.md` under the appropriate section heading.
- Verify build integrity (§6).
- In your final response, state which task(s) are complete and the exact menu/navigation path where the user can interact with them.

## 3. Larger builds — `plans/next-implementation.md`

Multi-page work derived from the backend's SoT artifacts is planned in
`plans/next-implementation.md` (phased, with a scope boundary and a verification section),
separate from the rolling `next-enhancements.md` task list. Keep its phase statuses current
as work lands.

## 4. File Size & Refactoring Rules

- **Threshold Rule**: Any new or refactored file exceeding 256 lines of code (LOC) must be split into smaller, modular, logical components/files.
- Known exception under review: `src/lib/types.ts` is a pre-existing shared type barrel above
  the threshold. Add new domain types in their own module and re-export them from there
  (see `src/lib/edge-types.ts`) rather than growing it further.

## 5. Ad-hoc Feature Requests

- For direct feature requests not using "n"/"next", implement the feature and document it in `docs/feature-list.md`.

## 6. Verification

| Task | Command |
|------|---------|
| Install dependencies | `bun install` |
| Dev server | `bun dev` |
| Production build (must pass) | `bun run build` |
| Lint | `bun run lint` |

Where `bun` is unavailable, `npm install` / `npx next build` / `npx eslint src/` are
equivalent for verification. Lint `src/` specifically: `video/` carries pre-existing errors
unrelated to app code, so a whole-repo lint never reads clean and is not a useful gate.

## 7. Relative Paths in Documentation

- Do not use absolute or root-slashed paths in markdown. Always use paths relative to the file's directory (e.g., `./`, `../`).

## 8. Project Layout

| Path | Description |
|------|-------------|
| `src/app/` | App Router routes (`layout.tsx`, `globals.css`, one folder per page) |
| `src/components/` | Feature components — `crossing/`, `devices/`, `fleet/`, `live/`, `monitoring/`, `reports/`, `settings/` — plus shared `ui/` |
| `src/lib/` | API client, domain types, contexts, and pure helpers |
| `docs/` | `feature-list.md`, presentation deck and screenshots |
| `plans/` | `next-enhancements.md` (rolling tasks), `next-implementation.md` (phased builds) |
| `public/` | Static assets |
| `video/` | Standalone explainer-video pipeline (plain Node, not part of the app build) |

Backend concerns — Python, `uv`, `labs/`, `data/`, the FastAPI app — live on the `backend`
branch and are not edited from here. Never edit files inside git submodules.
