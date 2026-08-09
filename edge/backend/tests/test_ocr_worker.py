"""The OCR pool: never blocks the caller, drops rather than grows, survives a bad crop."""

from __future__ import annotations

import threading
import time

import numpy as np
import pytest

from agent.ocr_worker import OcrJob, OcrPool


class FakeResult:
    """A recognition wearing the PaddleOCR-VL result shape ocr_utils expects."""

    def __init__(self, text: str, conf: float = 0.9) -> None:
        self._text, self._conf = text, conf

    @property
    def json(self) -> dict:
        return {"res": {"parsing_res_list": [
            {"block_content": self._text, "confidence": self._conf}
        ]}}


class FakePipeline:
    def __init__(self, text: str = "2152", delay: float = 0.0, raises: bool = False) -> None:
        self.text, self.delay, self.raises = text, delay, raises
        self.calls = 0

    def predict(self, crop, use_layout_detection=False, prompt_label="ocr"):
        self.calls += 1
        if self.delay:
            time.sleep(self.delay)
        if self.raises:
            raise RuntimeError("engine exploded")
        return [FakeResult(self.text)]


def _job(index: int = 1, track: int = 1) -> OcrJob:
    return OcrJob(track_id=track, crop_index=index,
                  crop=np.zeros((10, 20, 3), np.uint8),
                  det_conf=0.8, frame_index=index, ts=float(index))


@pytest.fixture
def pool_factory():
    made: list[OcrPool] = []

    def make(pipeline, **kwargs) -> OcrPool:
        pool = OcrPool(pipeline, **kwargs)
        made.append(pool)
        pool.start()
        return pool

    yield make
    for pool in made:
        pool.stop()


def _drain_until(pool: OcrPool, count: int, timeout: float = 5.0) -> list:
    out: list = []
    deadline = time.time() + timeout
    while len(out) < count and time.time() < deadline:
        out.extend(pool.drain())
        if len(out) < count:
            time.sleep(0.01)
    return out


def test_reading_comes_back_normalised(pool_factory) -> None:
    pool = pool_factory(FakePipeline("HD 2152"))
    pool.submit(_job())

    result = _drain_until(pool, 1)[0]
    assert result.text == "HD2152"      # normalize_hull_id strips whitespace
    assert result.raw == "HD 2152"
    assert result.job.crop_index == 1


def test_unreadable_crop_returns_a_result_with_no_text(pool_factory) -> None:
    """Not an error, and not silence: the window gets one fewer sample and the
    HUD still shows that an attempt was made."""
    pool = pool_factory(FakePipeline(""))
    pool.submit(_job())

    result = _drain_until(pool, 1)[0]
    assert result.text is None


def test_submit_never_blocks_and_drops_when_full(pool_factory) -> None:
    """The caller is the detection thread. Blocking here is the exact stall this
    module was written to remove."""
    pool = pool_factory(FakePipeline(delay=0.4), queue_size=2)

    start = time.time()
    accepted = sum(pool.submit(_job(i)) for i in range(12))
    elapsed = time.time() - start

    assert elapsed < 0.3, "submit blocked -- the detection thread would stall"
    assert accepted < 12, "queue grew without bound"
    assert pool.dropped() == 12 - accepted


def test_a_throwing_engine_does_not_kill_the_pool(pool_factory) -> None:
    """One odd crop must not take the gate's OCR offline for good."""
    pipeline = FakePipeline(raises=True)
    pool = pool_factory(pipeline)
    pool.submit(_job(1))

    result = _drain_until(pool, 1)[0]
    assert result.text is None

    pipeline.raises = False
    pool.submit(_job(2))
    assert _drain_until(pool, 1)[0].text == "2152"
    assert pool.is_alive()


def test_results_carry_their_job_so_late_readings_can_be_placed(pool_factory) -> None:
    """A reading that returns after its window closed has to be identifiable as
    such -- which is what the track id on the job is for."""
    pool = pool_factory(FakePipeline())
    pool.submit(_job(index=7, track=42))

    result = _drain_until(pool, 1)[0]
    assert result.job.track_id == 42
    assert result.job.crop_index == 7
    assert result.job.ts == 7.0


def test_drain_is_empty_rather_than_blocking_when_nothing_is_ready(pool_factory) -> None:
    pool = pool_factory(FakePipeline(delay=1.0))
    pool.submit(_job())

    start = time.time()
    assert pool.drain() == []
    assert time.time() - start < 0.1


def test_on_result_callback_fires_off_the_detection_thread(pool_factory) -> None:
    seen = threading.Event()
    pool = pool_factory(FakePipeline(), on_result=lambda r: seen.set())
    pool.submit(_job())

    assert seen.wait(timeout=5.0)
