"""Request model for per-device edge tunables (API_CONTRACT §2.2).

Deliberately separate from ``app/schemas/camera.py``: identity fields (name,
folder, rtsp_url) stay on ``PUT /api/cameras/{code}``; tunables stay here. Merging
them would let an identity edit silently bump ``config_version``.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class EdgeConfigUpdate(BaseModel):
    """Partial update -- every field optional, at least one required.

    Range validation lives in ``app/services/edge_config.py``, not here, so the
    API can return the contract's exact message
    (``"<field> must be between <lo> and <hi>"``) rather than a Pydantic 422.
    """

    model_config = ConfigDict(extra="ignore")

    yolo_fps: int | None = None
    ocr_fps: int | None = None
    detect_window_sec: int | None = None
    ocr_min_conf: float | None = None
    dedup_iou: float | None = None
    # "ltr" | "rtl". Typed as a plain string for the same reason the numbers are
    # not constrained here: the service owns validation so the API can answer
    # with the contract's own message instead of a Pydantic 422.
    inbound_axis: str | None = None
