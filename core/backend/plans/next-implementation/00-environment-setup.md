# Section 00 — Environment Setup & Baseline

**Goal:** `uv run pytest tests/ -q` runs and passes before any feature work starts.
**Depends on:** nothing. **Blocks:** everything.

Do not skip this. Every later section ends with "run the tests," and that command currently fails
with a confusing interpreter error that has nothing to do with your code.

---

## 0.1 [DONE] Diagnose the current state

Run these and note the output:

```bash
cd /home/fhanyuh/orca/workspaces/ocr-hauling-truck/backend
cat .python-version
ls -d .venv 2>&1
python3 --version
```

Expected (broken) state on a Linux machine:
```
cpython-3.12.10-windows-x86_64-none      # <-- a WINDOWS interpreter pin
ls: cannot access '.venv': No such file or directory
Python 3.14.4                             # system python, has no fastapi
```

The `.python-version` file pins a Windows CPython build. On Linux, `uv run` tries to download that
exact build and fails with:
```
error: Python interpreter not found at `.../cpython-3.12.10-windows-x86_64-none/python3.12`
```
This is an environment problem, **not** a code problem. It will not go away by retrying.

---

## 0.2 [DONE] Repin the interpreter for this platform

`pyproject.toml` requires `>=3.12,<3.14`, so 3.12 or 3.13 both work.

```bash
uv python pin 3.12
cat .python-version    # should now read something like "3.12" or a linux-tagged build
```

**Do not commit this change without checking with the repo owner first.** The Windows pin may be
correct for their primary development machine. Two acceptable resolutions — pick one and say which
you did in your commit message / final summary:

- **(a) Leave it uncommitted.** Repin locally to unblock work, and `git checkout .python-version`
  before committing anything else. Safest default if you're unsure.
- **(b) Replace the pin with a bare version.** Change the file's contents to just `3.12` — this is
  platform-agnostic and works on Windows *and* Linux, which is almost certainly what was intended.
  Mention it explicitly in the commit body so the owner can object.

---

## 0.3 [DONE] Sync dependencies

```bash
uv sync
```

This creates `.venv/` and installs everything in `pyproject.toml` plus the `dev` dependency group
(`pytest`, `playwright`).

Expect this to take a while and pull a lot — `torch`, `paddlepaddle-gpu`, `ultralytics`,
`transformers`, and the `sam3` workspace member are all heavy. If it fails on a GPU-specific
package (`paddlepaddle-gpu`, or `torch` from the pinned CUDA index) on a machine without CUDA, note
the exact failure and continue to 0.4 — the API tests you'll be writing don't import torch or
paddle, so a partial environment may still be workable. Do **not** start editing `pyproject.toml`
to drop dependencies; that's a much larger decision than this plan authorizes.

---

## 0.4 [DONE] Establish the baseline test result

```bash
uv run pytest tests/ -q
```

**Record the exact output before you change any code.** You need to know which failures (if any)
are pre-existing, so you never spend time debugging a failure you didn't cause.

Notes on this suite:
- There is **no `tests/conftest.py`**. Each test file constructs its own
  `TestClient(app)` and defines its own `autouse` cleanup fixture.
- Tests run against the **real** database at `DATA_DIR / "smart_gate.db"` — not a temp DB. The
  convention is to prefix test-created rows with `PYTEST-` and delete them in a fixture. See
  `tests/test_camera_api.py::_purge` for the canonical example.
- Several tests (`tests/test_response_contract.py`) index `[0]` into list responses, so they need
  **existing data** in the DB. If the DB is empty they fail with `IndexError`.
- `tests/test_e2e_playwright.py` needs a browser and a running frontend; it may fail or skip in a
  headless environment. That's expected — note it as pre-existing.

If the DB is empty or missing, seed it:
```bash
uv run python -m app.seed
```
This splits the real playlist clips across `gate-a`..`gate-d` subfolders, registers 4 cameras
(`CAM-GATE-A`..`CAM-GATE-D`), and runs the real attribution sync. Reverse with `--undo`. It needs
actual video files in `data/01-playlist/` — if `data/` is empty (it's gitignored), the seed produces
no crossings and the shape-contract tests will still fail on `IndexError`. In that case, note it and
move on; the tests you write in later sections create their own fixtures and don't depend on
pre-existing crossings.

---

## 0.5 [DONE] Add a shared test fixture module

The 8 new test files from Sections 03–08 all need the same setup: a registered camera with a known
API key. Without a shared fixture, that's copy-pasted 8 times.

Create **`tests/conftest.py`** (new file — nothing exists at this path today; adding it does not
affect existing test files, which keep their own local fixtures):

```python
"""Shared fixtures for the edge-system test suites.

Existing test modules predate this file and define their own local fixtures;
they are unaffected. New edge tests use the fixtures here.

Convention (inherited from tests/test_camera_api.py): tests run against the REAL
database and clean up after themselves by prefixing every row they create with
``PYTEST-``. Never point these at a temp DB — several suites rely on the real
one's seeded content.
"""

from __future__ import annotations

import sqlite3

import pytest
from fastapi.testclient import TestClient

from app.core.database import connect
from app.main import app
from app.services import cameras as cam
from app.services.dataset import invalidate_cache

EDGE_TEST_CODE = "PYTEST-EDGE-GATE"
EDGE_TEST_KEY = "pytest-plaintext-device-key-do-not-use-in-production"


def _purge_edge_rows() -> None:
    """Delete every row this suite could have created, in FK-safe order."""
    cam.ensure_schema()
    conn = connect()
    try:
        conn.execute(
            "DELETE FROM detections WHERE video_result_id IN "
            "(SELECT id FROM video_results WHERE video LIKE 'edge-PYTEST-%')"
        )
        conn.execute("DELETE FROM video_results WHERE video LIKE 'edge-PYTEST-%'")
        conn.execute("DELETE FROM cameras WHERE camera_code LIKE 'PYTEST-%'")
        conn.commit()
    finally:
        conn.close()
    invalidate_cache()


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def edge_camera():
    """A registered camera provisioned with a known plaintext API key.

    Yields the camera row dict. Cleaned up automatically.
    """
    from app.repositories import edge_repo
    from app.services import edge_devices

    _purge_edge_rows()
    created = cam.create_camera({
        "camera_code": EDGE_TEST_CODE,
        "name": "Pytest Edge Gate",
        "gate_location": "Pytest North",
        "direction": "inbound",
        "status": "offline",
        "folder": "pytest-edge-gate",
    })
    assert created is not None, "fixture setup failed: camera_code already taken?"
    edge_repo.set_api_key_hash(EDGE_TEST_CODE, edge_devices.hash_api_key(EDGE_TEST_KEY))
    yield cam.get_camera(EDGE_TEST_CODE)
    _purge_edge_rows()


@pytest.fixture
def auth_headers() -> dict:
    return {"Authorization": f"Bearer {EDGE_TEST_KEY}"}
```

**This file references code that doesn't exist yet** (`edge_repo.set_api_key_hash`,
`edge_devices.hash_api_key`) — those arrive in Sections 01 and 02. Write `conftest.py` now anyway;
the imports are inside the fixture function body, so pytest can still collect other test modules
until then. Any test *using* `edge_camera` will error until Section 02 lands, which is expected and
correct ordering.

---

## Acceptance for Section 00

- [ ] `uv run pytest tests/ -q` executes (no interpreter error) and its result is written down.
- [ ] `tests/conftest.py` exists with the content above.
- [ ] You can state which pre-existing failures (if any) are NOT your responsibility.
