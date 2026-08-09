"""Request models for the analysis endpoints."""

from __future__ import annotations

from pydantic import BaseModel


class AnalyzeExistingRequest(BaseModel):
    name: str = ""
