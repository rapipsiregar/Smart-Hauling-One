"""Request models for fleet (registered-truck) mutations."""

from __future__ import annotations

from pydantic import BaseModel


class TruckCreate(BaseModel):
    hull_id: str
    status: str = "active"


class TruckUpdate(BaseModel):
    hull_id: str = ""
    status: str = "active"
