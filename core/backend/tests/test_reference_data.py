"""TDD: real-data reference layer.

These tests assert that the reference-shaped data served to the new Integrated Smart Hauling System
frontend is derived from the REAL SQLite dataset (video_results + detections +
registered_trucks.json) — never fabricated. They rely on the shipped dataset in
`data/smart_gate.db`.
"""

from __future__ import annotations

import pytest

from app.services import reference as rd
from app.services.dataset import build_dataset


@pytest.fixture(scope="module")
def dataset():
    return build_dataset()


# --- Crossings ---------------------------------------------------------------

def test_crossings_count_matches_real_video_results(require_crossings, dataset):
    crossings = rd.build_crossings()
    assert len(crossings) == len(dataset["crossings"]) > 0


def test_crossing_shape_and_real_fields(require_crossings):
    crossings = rd.build_crossings()
    c = crossings[0]
    for key in (
        "id", "hullId", "confidence", "lane", "direction", "reads", "frames",
        "known", "isReconciled", "ocrReads", "processedAt",
    ):
        assert key in c, f"missing key {key}"
    # processedAt is the real run timestamp, not an invented value
    assert c["processedAt"].startswith("2026-")
    # confidence is a real 0-100 percentage
    assert 0.0 <= c["confidence"] <= 100.0


def test_reconciled_implies_known():
    for c in rd.build_crossings():
        if c["isReconciled"]:
            assert c["known"] is True


# --- Fleet -------------------------------------------------------------------

def test_fleet_derived_from_registry_and_real_stats(require_crossings):
    fleet = rd.build_fleet()
    assert len(fleet) > 0
    unit = fleet[0]
    for key in ("id", "hullId", "status", "passages", "reads", "bestConf"):
        assert key in unit
    # No fabricated business identity fields leak in as fake values
    assert "driverName" not in unit or unit["driverName"] is None

    # Every fleet hull id traces to a real registered unit. Asserted against the
    # registry itself rather than a hardcoded hull: the fleet roster now comes
    # from the imported truck master (app/services/master_import.py), so naming a
    # specific unit here would just re-encode whichever dataset happened to be
    # loaded when the test was written.
    from app.repositories import truck_master_repo

    hull_ids = {u["hullId"] for u in fleet}
    assert hull_ids, "fleet has no hull ids"

    master = {t["hull_id"] for t in truck_master_repo.list_all()}
    if master:
        unknown = hull_ids - master
        assert not unknown, f"fleet contains units absent from the master: {sorted(unknown)[:5]}"


# --- CCTV detections (real per-frame OCR) ------------------------------------

def test_cctv_detections_carry_real_frame_reads(require_crossings):
    from app.repositories.video_results_repo import run_meta

    dets = rd.build_cctv_detections()
    assert len(dets) > 0
    d = dets[0]
    for key in (
        "id", "towerId", "ocrText", "confidence", "framesProcessed",
        "frameResults", "isConsistent", "aiModel",
    ):
        assert key in d
    # Read from the runs table, not hardcoded in the response builder. Asserting
    # a literal name tied this to whichever dataset happened to be seeded.
    assert d["aiModel"] == run_meta()["model"]
    # frameResults comes from the detections table, which only the batch pipeline
    # writes: an edge device submits one consensus-voted crossing per truck, not
    # its per-frame reads (SRS §3.4). So this asserts the shape is real, and the
    # per-frame content only when batch-sourced rows are present.
    assert all(isinstance(x["frameResults"], list) for x in dets)
    if any(x.get("source") == "batch" for x in rd.build_crossings()):
        assert any(len(x["frameResults"]) > 0 for x in dets)


# --- Performance KPIs (real aggregation) -------------------------------------

def test_performance_kpis_are_real_aggregations(require_crossings):
    kpis = rd.build_performance_kpis()
    assert kpis["totalPassages"] == len(rd.build_crossings())
    assert kpis["identified"] + kpis["unknown"] == kpis["totalPassages"]
    assert isinstance(kpis["perGate"], list) and len(kpis["perGate"]) > 0
    assert sum(g["passages"] for g in kpis["perGate"]) == kpis["totalPassages"]


# --- Shift / daily report (real aggregation) ---------------------------------

def test_shift_report_totals_match_crossings():
    report = rd.build_shift_report()
    crossings = rd.build_crossings()
    assert report["totalPassages"] == len(crossings)
    assert report["date"].startswith("2026-")
    ritase_sum = sum(t["ritase"] for t in report["perTruck"])
    assert ritase_sum == report["totalRitase"]



def test_shift_report_reconciled_is_real_subset():
    report = rd.build_shift_report()
    crossings = rd.build_crossings()
    assert report["reconciled"] == sum(1 for c in crossings if c["isReconciled"])
    # a reconciled crossing is always an identified one
    assert report["reconciled"] <= report["identified"]


# --- Pit occupancy (one bucket per truck) -------------------------------------
# /api/map used to return every inbound crossing as "inside" and every outbound
# one as "outside", so a truck that entered and left appeared in BOTH lists and
# the totals counted crossings rather than trucks. A fleet of 5 that had each
# done one round trip reported 5 inside AND 5 outside.

def test_a_truck_is_in_exactly_one_place(require_crossings):
    from app.routers.dashboard import gate_map

    m = gate_map()
    inside = {c["hull_id"] for c in m["inside"]}
    outside = {c["hull_id"] for c in m["outside"]}
    assert not (inside & outside), (
        f"counted as both inside and outside: {sorted(inside & outside)}"
    )
    assert m["total_inside"] == len(m["inside"])
    assert m["total_outside"] == len(m["outside"])


def test_pit_totals_count_trucks_not_crossings(require_crossings):
    from app.routers.dashboard import gate_map

    m = gate_map()
    for bucket in ("inside", "outside"):
        hulls = [c["hull_id"] for c in m[bucket]]
        assert len(hulls) == len(set(hulls)), f"{bucket} lists a truck twice"


def test_active_lanes_come_from_the_registry(require_crossings):
    """They were hardcoded to four gates; a three-gate site was told it had four."""
    from app.routers.dashboard import gate_map

    lanes = gate_map()["active_lanes"]
    real = {c["lane"] for c in rd.build_crossings() if c.get("lane")}
    assert set(lanes) <= real
