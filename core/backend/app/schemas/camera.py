"""Request models for the camera registry.

All fields are optional so partial updates work; the service layer enforces the
``camera_code``/``name`` requirements and normalises enums. ``extra="ignore"``
mirrors the previous behaviour of silently dropping unknown keys.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class CameraBase(BaseModel):
    model_config = ConfigDict(extra="ignore")

    camera_code: str | None = None
    name: str | None = None
    gate_location: str | None = None
    status: str | None = None
    rtsp_url: str | None = None
    ip_host: str | None = None
    username: str | None = None
    resolution: str | None = None
    fps: int | None = None
    folder: str | None = None
    install_date: str | None = None
    last_seen: str | None = None
    notes: str | None = None


class CameraCreate(CameraBase):
    """New-camera payload; ``camera_code`` and ``name`` validated in the service."""


class CameraUpdate(CameraBase):
    """Partial-update payload; only explicitly-set fields are applied."""
