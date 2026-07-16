# Agent Instructions

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
