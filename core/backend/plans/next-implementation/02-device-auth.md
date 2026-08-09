# Section 02 — Device Identity & Auth

**Goal:** each of the 4 Jetsons authenticates with its own API key; an admin can issue and rotate
keys from the CLI.
**Depends on:** [01](./01-schema-foundations.md). **Blocks:** 03, 06.

---

## 2.1 [DONE] Create `app/services/edge_devices.py`

**New file.**

```python
"""Per-device API key generation, hashing, and request authentication.

Plaintext keys are never stored -- only their SHA-256 hash, in
``Camera.api_key_hash`` (docs/edge-system/SRS.md §6 Security NFR). They are never
logged either: the Authorization header must stay out of any request logging.

Revocation is just overwriting the hash (SRS §7.3 step 5) -- the device's next
request gets a 401 and its outbox grows until it is re-provisioned. No separate
'revoked' device state is needed.
"""

from __future__ import annotations

import hashlib
import secrets

from fastapi import Header, HTTPException

from app.repositories import edge_repo

_UNAUTHORIZED = {"error": "Invalid device credentials"}


def generate_api_key() -> str:
    """A fresh, URL-safe device credential (SRS §7.3 step 2)."""
    return secrets.token_urlsafe(32)


def hash_api_key(plaintext: str) -> str:
    """SHA-256 hex digest. The only form of a key that ever touches the DB."""
    return hashlib.sha256(plaintext.encode("utf-8")).hexdigest()


def authenticate_device(authorization: str = Header(default="")) -> dict:
    """FastAPI dependency: resolve ``Authorization: Bearer <key>`` to a camera row.

    Raises 401 with the exact body docs/edge-system/API_CONTRACT.md §1 specifies,
    for every failure mode (missing header, wrong scheme, empty or unknown key).
    Returns the full camera row so handlers never re-query for the caller.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail=_UNAUTHORIZED)
    plaintext = authorization.removeprefix("Bearer ").strip()
    if not plaintext:
        raise HTTPException(status_code=401, detail=_UNAUTHORIZED)
    camera = edge_repo.get_by_api_key_hash(hash_api_key(plaintext))
    if camera is None:
        raise HTTPException(status_code=401, detail=_UNAUTHORIZED)
    return camera


def provision(camera_code: str) -> str:
    """Issue a new key for a camera and persist only its hash.

    Returns the plaintext exactly once -- the caller is responsible for showing
    it to the operator and never persisting it. Rotating is the same operation:
    the old hash is overwritten, so the previous key stops working immediately.
    """
    plaintext = generate_api_key()
    edge_repo.set_api_key_hash(camera_code, hash_api_key(plaintext))
    return plaintext
```

---

## 2.2 [DONE] Make `{"error": ...}` the wire format for auth failures

`docs/edge-system/API_CONTRACT.md` §0 requires errors to be `{"error": "<message>"}`. FastAPI's
default handler wraps `HTTPException.detail` as `{"detail": ...}`, which would produce
`{"detail": {"error": "Invalid device credentials"}}` — one level too deep.

**File:** `app/main.py` — add to `create_app()`, after `app.include_router(api_router)`.

```python
def create_app() -> FastAPI:
    ensure_directories()
    app = FastAPI(title="Smart Gate Hauling API Backend")
    app.mount("/media", StaticFiles(directory=str(DATA_DIR)), name="media")
    app.include_router(api_router)

    @app.exception_handler(StarletteHTTPException)
    async def _dict_detail_exception_handler(request: Request, exc: StarletteHTTPException):
        """Return dict-shaped HTTPException details verbatim.

        The edge API's contract is {"error": "..."} (API_CONTRACT §0), not
        FastAPI's default {"detail": ...} envelope. Only exceptions raised with a
        dict detail (currently just device auth) are unwrapped; everything else
        -- including framework 404s with a plain string detail -- keeps FastAPI's
        default behavior untouched.
        """
        if isinstance(exc.detail, dict):
            return JSONResponse(exc.detail, status_code=exc.status_code)
        return await http_exception_handler(request, exc)

    @app.get("/")
    def health_check() -> dict:
        return {
            "status": "online",
            "service": "Smart Gate Hauling API Backend",
            "frontend": "http://localhost:3000",
        }

    return app
```

Add these imports at the top of `app/main.py`:

```python
from fastapi import FastAPI, Request
from fastapi.exception_handlers import http_exception_handler
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException
```

> Delegating non-dict details back to `http_exception_handler` is deliberate. A blanket
> `{"error": str(exc.detail)}` would change the body of every framework-generated 404 across the
> whole app — a silent contract change for existing routes. Don't do that.

---

## 2.3 [DONE] Add the `provision-device` CLI command

`docs/edge-system/API_CONTRACT.md` §5 is explicit that no HTTP provisioning endpoint exists in this
contract, and SRS §7.3 describes manual, out-of-band key issuance. So this is a CLI command.

**File:** `main.py`

Add this function after `run_nextjs()`:

```python
def run_provision_device(args):
    """Issue (or rotate) an edge-device API key for a registered camera.

    The plaintext key is printed exactly once and never stored -- only its hash
    goes to the database (docs/edge-system/SRS.md §7.3).
    """
    if not args or args[0].startswith("-"):
        print("Usage: provision-device <camera_code> [--rotate]", file=sys.stderr)
        return 1

    camera_code = args[0]
    rotating = "--rotate" in args[1:]

    from app.services import cameras, edge_devices

    camera = cameras.get_camera(camera_code)
    if camera is None:
        print(f"Error: no camera registered with code '{camera_code}'.", file=sys.stderr)
        print("Register it first via POST /api/cameras (SRS §7.3 step 1).", file=sys.stderr)
        return 1

    if camera.get("api_key_hash") and not rotating:
        print(
            f"Error: '{camera_code}' is already provisioned.\n"
            f"Re-run with --rotate to replace its key (this immediately invalidates the old one).",
            file=sys.stderr,
        )
        return 1

    plaintext = edge_devices.provision(camera_code)
    action = "Rotated" if rotating else "Provisioned"
    print(f"\n{action} device credential for {camera_code} ({camera.get('name')})")
    print("-" * 78)
    print(f"  {plaintext}")
    print("-" * 78)
    print("Store this now -- it is NOT recoverable. Only its hash was saved.")
    print("Write it to the edge agent's .env as SMART_GATE_API_KEY before first boot.")
    if rotating:
        print("The previous key stopped working immediately.")
    return 0
```

Wire it into `main()`, next to the other special commands (after the `web` branch):

```python
    if cmd_arg in ("provision-device", "provision"):
        sys.exit(run_provision_device(sys.argv[2:]))
```

And document it in `print_help()`, under "Special commands":

```python
    print("  provision-device <code> [--rotate]")
    print("                          Issue an edge-device API key for a registered camera")
```

**Line budget:** `main.py` starts at 253 lines; this adds roughly 45, landing near 300 — within the
400-line limit, no split required. Verify with `wc -l main.py` after editing.

---

## 2.4 [DONE] Test the auth path

**New file:** `tests/test_edge_auth.py`

Uses the `edge_camera` / `auth_headers` fixtures from `tests/conftest.py` (Section 00.5).

```python
"""Device API-key authentication for the /api/edge/* endpoints.

Covers TC-010-04 (invalid API key -> 401 with the contract's exact body).
"""

from __future__ import annotations

from app.repositories import edge_repo
from app.services import edge_devices
from tests.conftest import EDGE_TEST_CODE, EDGE_TEST_KEY


def test_hash_is_stable_and_not_the_plaintext():
    assert edge_devices.hash_api_key("abc") == edge_devices.hash_api_key("abc")
    assert edge_devices.hash_api_key("abc") != "abc"
    assert len(edge_devices.hash_api_key("abc")) == 64  # sha256 hex


def test_generated_keys_are_unique():
    assert edge_devices.generate_api_key() != edge_devices.generate_api_key()


def test_valid_key_authenticates(client, edge_camera, auth_headers):
    r = client.get("/api/edge/config", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["camera_code"] == EDGE_TEST_CODE


def test_missing_header_rejected(client, edge_camera):
    r = client.get("/api/edge/config")
    assert r.status_code == 401
    assert r.json() == {"error": "Invalid device credentials"}


def test_wrong_scheme_rejected(client, edge_camera):
    r = client.get("/api/edge/config", headers={"Authorization": EDGE_TEST_KEY})
    assert r.status_code == 401
    assert r.json() == {"error": "Invalid device credentials"}


def test_unknown_key_rejected(client, edge_camera):
    r = client.get("/api/edge/config", headers={"Authorization": "Bearer not-a-real-key"})
    assert r.status_code == 401
    assert r.json() == {"error": "Invalid device credentials"}


def test_revoked_key_rejected(client, edge_camera, auth_headers):
    # Revocation == clearing the hash (SRS §7.3 step 5).
    edge_repo.set_api_key_hash(EDGE_TEST_CODE, None)
    r = client.get("/api/edge/config", headers=auth_headers)
    assert r.status_code == 401


def test_rotation_invalidates_the_old_key(client, edge_camera, auth_headers):
    new_key = edge_devices.provision(EDGE_TEST_CODE)
    assert new_key != EDGE_TEST_KEY

    assert client.get("/api/edge/config", headers=auth_headers).status_code == 401
    r = client.get("/api/edge/config", headers={"Authorization": f"Bearer {new_key}"})
    assert r.status_code == 200
```

These tests exercise `GET /api/edge/config`, which lands in Section 03 — they will fail with 404
until then. That is the expected ordering; run them at the end of Section 03.

---

## Acceptance for Section 02

- [ ] `app/services/edge_devices.py` exists with all five functions.
- [ ] `app/main.py` has the dict-detail exception handler and its imports.
- [ ] `uv run python main.py provision-device CAM-GATE-A` prints a key once; re-running without
      `--rotate` errors; with `--rotate` prints a different key.
- [ ] `wc -l main.py` is under 400.
- [ ] `tests/test_edge_auth.py` exists (passing is gated on Section 03).
