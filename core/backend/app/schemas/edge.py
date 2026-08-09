"""Request models for the edge-facing API (``docs/edge-system/API_CONTRACT.md`` §1).

snake_case field names, matching every other schema in this package. The camelCase
in ``build_cctv_detections`` is a historical exception for one legacy view -- do
not copy that pattern here.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class HeartbeatRequest(BaseModel):
    """``POST /api/edge/heartbeat`` body (API_CONTRACT §1.2)."""

    model_config = ConfigDict(extra="ignore")

    agent_version: str
    applied_config_version: int = Field(ge=0)
    local_queue_depth: int = Field(ge=0)
    # A device never reports "offline" about itself -- that is inferred centrally
    # from missed heartbeats (SRS §5.1). Pydantic rejects it with a 422.
    status: Literal["online", "maintenance"]


class VoteEntry(BaseModel):
    """One consensus cluster from ``fuzzy_vote_distribution`` (API_CONTRACT §1.3)."""

    model_config = ConfigDict(extra="ignore")

    text: str
    count: int = Field(ge=0)
    avg_ocr_conf: float = Field(ge=0.0, le=1.0)


class CrossingPayload(BaseModel):
    """The ``payload`` form field of ``POST /api/edge/crossings`` (API_CONTRACT §1.3)."""

    model_config = ConfigDict(extra="ignore")

    camera_code: str
    detected_at: str                       # ISO 8601 UTC, Detection Window close time
    window_sec: float = Field(ge=0.0)
    hull_id: str
    # The 4 digits the gate actually read, before registration was considered.
    #
    # ``hull_id`` is the device's own resolution and is "UNKNOWN" whenever the
    # reading matched no registered unit -- which threw the digits away at the
    # gate. A truck that is genuinely on site but missing from the master then
    # arrived here as an anonymous UNKNOWN, indistinguishable from a window that
    # read nothing at all, and could never be counted or paired.
    #
    # Optional so a device running older firmware still submits successfully;
    # such a device simply cannot report unregistered trucks by number.
    raw_code: str | None = None
    confidence: float = Field(ge=0.0, le=1.0)
    read_count: int = Field(ge=0)
    votes: list[VoteEntry]


class LiveSessionRef(BaseModel):
    """Body of ``/live/heartbeat`` and ``/live/stop`` (API_CONTRACT §2.4)."""

    model_config = ConfigDict(extra="ignore")

    session_id: str
