"""Shared response/request models used across routers."""

from __future__ import annotations

from pydantic import BaseModel


class StatusResponse(BaseModel):
    """Uniform ``{"status": "success"}`` acknowledgement."""

    status: str = "success"
