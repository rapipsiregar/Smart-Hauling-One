<!-- BEGIN:chain-of-truth-foundation -->
# Integrated Smart Hauling System — Chain of Truth Methodology

This project follows the **Chain of Truth (CoT)** methodology. All project knowledge lives inside structured **Source of Truth (SoT)** artifacts — not inside prompts or conversation history. Prompts are purely execution instructions.

## Source of Truth Chain

```text
PRD (docs/PRD.md)
 ↓
Information Architecture → (docs/information_architecture.md)
 ↓
Design System → (docs/design_system.md)
 ↓
Data Model → (docs/data_model.md)
 ↓
User Flows → (docs/user_flows/)
 ↓
System Logics → (docs/system_logics/)
 ↓
Implementation Plan → (plans/)
 ↓
Implementation
 ↓
Testing → (docs/test_plan.md, docs/test_cases.md, docs/test_execution_sheet.md)
 ↓
Validation
```

Each artifact is the single source of truth for the next phase. AI never stores requirements; artifacts do.

---

## Source of Truth Index

| Artifact | File | Status |
|----------|------|--------|
| SRS / PRD | `docs/PRD.md` | Active |
| Information Architecture | `docs/information_architecture.md` | Active |
| Design System | `docs/design_system.md` | Active |
| Data Model | `docs/data_model.md` | Active |
| User Flows | `docs/user_flows/` | Active (7 UCs) |
| System Logics (API Contracts) | `docs/system_logics/` | Active (7 UCs) |
| Implementation Plan | `plans/next-implementation/` | Active (edge-system build, `docs/edge-system/`) |
| Test Plan | `docs/test_plan.md` | Active |
| Test Cases | `docs/test_cases.md` | Active (50 TCs) |
| Test Execution Sheet | `docs/test_execution_sheet.md` | Active |
| Feature Inventory | `docs/feature-list.md` | Active |

---

## Project Anatomy

### Stack

| Layer | Technology |
|-------|-----------|
| OCR Pipeline | Python 3.12+, YOLO (custom .pt), PaddleOCR-VL, SAM 3 |
| Backend API | FastAPI, Uvicorn, SQLite |
| Frontend | Next.js 16, React 19, Tailwind CSS v4, Bun runtime (on the `frontend` branch) |
| Infrastructure | Docker, Nginx, uv (Python package manager) |

### Key Directories

```
.
├── app/              ← FastAPI backend (routers / services / repositories / schemas / core)
├── ai-model/         ← Trained YOLO .pt weights
├── data/             ← Videos, evidence, database (gitignored)
├── docs/             ← Source of Truth artifacts
├── labs/             ← Python lab scripts (numbered pipeline steps)
├── tests/            ← Pytest suite (API contract + data-layer)
├── main.py           ← Unified CLI entry point
├── tui.py            ← Terminal UI dashboard
├── pyproject.toml    ← Python project config + dependencies
└── sam3/             ← SAM 3 workspace submodule
```

The Next.js frontend lives on the separate `frontend` branch and consumes this
backend's `/api/*` endpoints (see `docs/system_logics/` for the API contracts).

---

## Agent Workflow Rules

### Feature Requests

- Read the relevant SoT artifact(s) under `docs/` before implementing.
- Implement the feature fully against the real data model.
- On completion:
  1. Document the new/updated feature in `docs/feature-list.md` under the appropriate section.
  2. Verify build integrity (run the `tests/` suite).

### Working an Implementation Plan (`plans/`)

Work large enough to need its own plan gets a folder under `plans/` — currently
`plans/next-implementation/` for the edge-system build. A plan sits between System Logics and
Implementation in the chain above: System Logics defines *what* the API contract is; a plan defines
*how* to build it against this actual codebase (file paths, DDL, complete function bodies),
detailed enough that no spec lookup is needed mid-task.

**Structure:** `README.md` is the index — read it first. It carries the section order, the global
rules, decisions already made, and a "things that will silently break" list. Numbered section files
(`00-...md`, `01-...md`, …) each deliver one coherent slice.

- Before starting work in an area a plan covers, read its `README.md` and the relevant section — it
  supersedes re-deriving the same layout from the SoT docs each time.
- Execute sections **in order**; sub-tasks within a section are ordered too.
- Flip a task from `[TODO]` to `[DONE]` only once its code exists and its tests pass (and, where
  the section says so, only once the matching `docs/test_execution_sheet.md` row has actually been
  executed — never mark that sheet `[✓]` preemptively).
- If you find yourself guessing while executing a plan, that's a defect in the plan: fix the plan
  first, then continue. A plan that sends the next reader down the same wrong path twice is worse
  than no plan.
- A plan's own `README.md` takes precedence over this section wherever the two differ.

---

## Code Quality Rules

- **400 LOC Threshold**: Any new or refactored file exceeding 400 lines must be split into smaller, logical modules.
- **Relative Paths**: All markdown references must use relative paths (e.g., `./`, `../`), never absolute or root-slashed paths.
- **Never edit git submodules** (e.g., `sam3/`).

---

## Package Manager

Use **uv** for all Python dependency and script management.

| Task | Command |
|------|---------|
| Add dependency | `uv add <package>` |
| Add dev dependency | `uv add --dev <package>` |
| Sync environment | `uv sync` |
| Run script | `uv run labs/script.py` |
| Run module | `uv run python -m <module>` |

---

## Prompting Convention

Prompts are execution instructions only — never embed requirements. When starting a new feature or enhancement:

1. Read the relevant SoT artifact from `docs/`.
2. Confirm understanding with a brief summary.
3. Proceed with implementation referencing the artifact as the ground truth.
