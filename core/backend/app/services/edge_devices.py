"""Per-device API key generation, hashing, and request authentication.

Plaintext keys are never stored -- only their SHA-256 hash, in
``Camera.api_key_hash`` (``docs/edge-system/SRS.md`` §6 Security NFR). They are
never logged either: the Authorization header must stay out of any request log.

Revocation is just overwriting the hash (SRS §7.3 step 5) -- the device's next
request gets a 401 and its outbox grows until it is re-provisioned. No separate
"revoked" device state is needed.
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
    """SHA-256 hex digest. The only form of a key that ever touches the database."""
    return hashlib.sha256(plaintext.encode("utf-8")).hexdigest()


def authenticate_device(authorization: str = Header(default="")) -> dict:
    """FastAPI dependency: resolve ``Authorization: Bearer <key>`` to a camera row.

    Raises 401 with the exact body ``docs/edge-system/API_CONTRACT.md`` §1
    specifies, for every failure mode (missing header, wrong scheme, empty or
    unknown key). Returns the full camera row so handlers never re-query for the
    caller.
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

    Returns the plaintext exactly once -- the caller is responsible for showing it
    to the operator and never persisting it. Rotating is the same operation: the
    old hash is overwritten, so the previous key stops working immediately.
    """
    plaintext = generate_api_key()
    edge_repo.set_api_key_hash(camera_code, hash_api_key(plaintext))
    return plaintext
