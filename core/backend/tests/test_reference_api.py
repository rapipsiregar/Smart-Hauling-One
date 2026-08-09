"""TDD: FastAPI endpoints serving the reference-shaped real data."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_get_crossings_list(require_crossings):
    r = client.get("/api/crossings")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list) and len(data) > 0
    assert {"id", "hullId", "isReconciled", "processedAt"} <= set(data[0])


def test_get_cctv_detections(require_crossings):
    from app.repositories.video_results_repo import run_meta

    r = client.get("/api/cctv-detections")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list) and len(data) > 0
    # The point is that aiModel is read from the runs table rather than
    # hardcoded in the response builder. Pinning the literal name instead tied
    # this to whichever dataset happened to be seeded.
    assert data[0]["aiModel"] == run_meta()["model"]
    assert "frameResults" in data[0]


def test_get_fleet_registry():
    r = client.get("/api/fleet-registry")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list) and len(data) > 0
    assert {"hullId", "status", "passages", "bestConf"} <= set(data[0])


def test_get_performance_kpis(require_crossings):
    r = client.get("/api/performance-kpis")
    assert r.status_code == 200
    data = r.json()
    assert data["totalPassages"] == data["identified"] + data["unknown"]
    assert len(data["perGate"]) > 0


def test_get_shift_report():
    r = client.get("/api/shift-report")
    assert r.status_code == 200
    data = r.json()
    assert data["date"].startswith("2026-")
    assert "perTruck" in data


def test_post_sync_ritase():
    r = client.post("/api/sync-ritase", json={"crossings": [], "source": "pytest"})
    assert r.status_code == 200
    receipt = r.json()
    assert receipt["status"] == "success"
    assert receipt["source"] == "pytest"


def test_existing_dataset_endpoint_still_works():
    r = client.get("/api/dataset")
    assert r.status_code == 200
    assert "crossings" in r.json()
