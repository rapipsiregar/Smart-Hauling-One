"""The shared retry policy (SRS §4.3)."""

from __future__ import annotations

from agent.backoff import MAX_DELAY_SEC, backoff_delay


def test_grows_then_caps():
    assert 1.6 <= backoff_delay(1) <= 2.4        # 2s +/-20%
    assert 3.2 <= backoff_delay(2) <= 4.8        # 4s
    assert 6.4 <= backoff_delay(3) <= 9.6        # 8s
    for attempt in range(6, 40):
        assert backoff_delay(attempt) <= MAX_DELAY_SEC * 1.2


def test_never_zero_or_negative():
    assert all(backoff_delay(a) > 0 for a in range(-5, 50))


def test_jitter_makes_delays_differ():
    assert len({round(backoff_delay(5), 6) for _ in range(20)}) > 1
