"""The HUD's per-frame feed: what the panel shows while a clip is being read.

Before this existed the panel sat silent for tens of seconds and then produced
an answer, which is indistinguishable from a hang -- the reflex was to press the
button again and start a second run. These tests pin the parts that make the
work visible while it happens.
"""

from __future__ import annotations

from collections import deque

from app.services import test_runs


def _make_run(run_id: str = "run_test") -> None:
    test_runs._RUNS[run_id] = {
        "id": run_id, "status": "running", "items": [], "progress": None,
        "current": None,
    }
    test_runs._ORDER.append(run_id)


def teardown_function():
    test_runs._RUNS.clear()
    test_runs._ORDER.clear()
    test_runs._RUN_TOTALS.clear()


def test_publish_carries_the_feed_to_the_panel():
    _make_run()
    feed = [{"frame": 12, "text": "2221", "raw": "2221", "ocr_conf": 0.9, "det_conf": 0.8}]

    test_runs._publish("run_test", scanned=12, total=192, reads=[("2221", 0.7)],
                       ocr_reads=1, feed=feed)

    progress = test_runs.get_run("run_test")["progress"]
    assert progress["feed"] == feed
    assert progress["frames_scanned"] == 12
    assert progress["frames_total"] == 192


def test_feed_defaults_to_empty_rather_than_missing():
    """The UI reads progress.feed directly; absent would be a runtime error."""
    _make_run()

    test_runs._publish("run_test", scanned=2, total=192, reads=[], ocr_reads=0)

    assert test_runs.get_run("run_test")["progress"]["feed"] == []


def test_feed_is_bounded():
    """It is pushed on every publish, so it cannot be allowed to grow with the clip."""
    feed = deque(maxlen=test_runs.FEED_LENGTH)
    for frame in range(test_runs.FEED_LENGTH * 3):
        feed.append({"frame": frame, "text": None, "raw": None,
                     "ocr_conf": 0.0, "det_conf": 0.0})

    assert len(feed) == test_runs.FEED_LENGTH
    # Oldest dropped, newest kept -- the panel shows what just happened.
    assert feed[-1]["frame"] == test_runs.FEED_LENGTH * 3 - 1


def test_progress_snapshot_does_not_alias_the_live_feed():
    """get_run() hands its result to a serialiser while the run keeps writing."""
    _make_run()
    feed = [{"frame": 1, "text": "2152", "raw": "2152", "ocr_conf": 0.9, "det_conf": 0.8}]
    test_runs._publish("run_test", scanned=1, total=10, reads=[], ocr_reads=1, feed=feed)

    snapshot = test_runs.get_run("run_test")["progress"]
    feed.append({"frame": 2, "text": None, "raw": None, "ocr_conf": 0.0, "det_conf": 0.0})

    assert len(snapshot["feed"]) == 1
