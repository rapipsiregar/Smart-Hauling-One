"""The single shared retry policy (``docs/edge-system/SRS.md`` §4.3).

2s, 4s, 8s, 16s, 32s, 60s, 60s... with +/-20% jitter. Used by the outbox sender
(§4.2) and the RTSP capture reconnect (§3.1) alike -- SRS §4.3 is explicit that
there should be "only one retry policy to implement, not two."
"""

from __future__ import annotations

import random

INITIAL_DELAY_SEC = 2.0
MAX_DELAY_SEC = 60.0
JITTER_FRACTION = 0.2


def backoff_delay(attempt: int) -> float:
    """Delay before retry number ``attempt`` (1-based). Always positive."""
    if attempt < 1:
        attempt = 1
    base = min(MAX_DELAY_SEC, INITIAL_DELAY_SEC * (2 ** (attempt - 1)))
    jitter = base * random.uniform(-JITTER_FRACTION, JITTER_FRACTION)
    return max(0.1, base + jitter)
