"""Request models for crossing reconciliation."""

from __future__ import annotations

from pydantic import BaseModel


class CrossingUpdate(BaseModel):
    hull_id: str = ""
    confidence: float | None = None
