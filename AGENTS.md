# Agent Instructions

You must follow these workflow rules strictly to support rapid, iterative enhancements of the platform:

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
- If all enhancement tasks in `plans/next-enhancements.md` are marked `[DONE]` (or there are no tasks marked `[TODO]`), automatically execute the **Trigger "e" or "enhance"** workflow to generate a new set of tasks.
- Otherwise, identify and select the most impactful enhancement task(s) currently marked `[TODO]` (evaluating which tasks have the highest strategic value, functional impact, or user experience contribution). If `{x}` is specified, select the top `{x}` most impactful enhancement tasks and execute them sequentially.
- Implement the selected enhancement task(s) fully in the codebase. Note: all enhancement tasks must operate exclusively on the OCR smart hauling web application and dashboard, utilizing Python for the backend.
- Once completed:
  1. Update the specific task(s) status of `plans/next-enhancements.md` to `[DONE]`.
  2. Document the new or updated feature(s) in the `docs/feature-list.md` file (maintaining an organized list of all platform features under the appropriate section heading).
- Verify the build integrity of the workspace.
- In your final response, state which task(s) have been completed and inform the user of the exact menu or navigation path where they can view and interact with the new/updated feature(s).

## 3. File Size & Refactoring Rules
- **Threshold Rule**: Any new or refactored file exceeding 256 lines of code (LOC) must be refactored and split into multiple smaller, modular, and logical components/files.

## 4. Ad-hoc Feature Requests
- For direct feature requests not using "n"/"next", implement the feature and document it in `docs/feature-list.md`.

## 5. Relative Paths in Documentation
- Do not use absolute full paths or root-slashed paths in markdown files/documentation. Always use relative paths (e.g., `./` or `../` relative to the file's directory).

## Package Manager

Use **uv** for all Python work. Do not use `pip`, `pipenv`, `poetry`, or bare `python`/`python3` for dependency or script execution.

| Task | Command |
|------|---------|
| Initialize project | `uv init` |
| Add dependency | `uv add <package>` |
| Add dev dependency | `uv add --dev <package>` |
| Sync environment | `uv sync` |
| Run script | `uv run labs/script.py` |
| Run module | `uv run python -m <module>` |
| Run one-liner | `uv run python -c "..."` |

If `pyproject.toml` is missing, run `uv init` before adding packages or running scripts.

## Project Layout

- `labs/` — Python lab scripts (numbered)
- `data/` — downloaded/generated data (gitignored as needed)

Never edit files inside git submodules.
