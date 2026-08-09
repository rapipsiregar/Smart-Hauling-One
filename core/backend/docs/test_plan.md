# Test Plan — Source of Truth #7

**Document Version:** v1.0  
**Project:** Smart Gate — Integrated Smart Hauling System (ISHS)  
**Status:** Draft  
**Last Updated:** 2026-08-02  
**Author:** System Analyst AI  
**Source:** Derived from `docs/user_flows/` (SoT-5) and `docs/system_logics/` (SoT-6). UC-008–
UC-010 additionally derived from `docs/edge-system/` — planned, not yet implemented; their test
cases describe intended coverage, not executed results (see `docs/test_execution_sheet.md`).

---

## 1. Introduction

### 1.1 Purpose

This document defines the testing strategy, scope, resources, and schedule for validating the Smart Gate ISHS web dashboard against the requirements defined in the PRD and downstream SoT artifacts.

### 1.2 Test Objectives

- Verify all 7 use cases (UC-001 through UC-007) function per their system logic specifications.
- Validate real-time WebSocket behavior, REST API contracts, and database integrity.
- Ensure visual proof linkage (100% evidence per crossing) is enforced.
- Confirm alerting and telemetry threshold logic triggers correctly.

---

## 2. Test Scope

### 2.1 In Scope

| UC ID | Use Case | Related Features | Test Cases |
|-------|----------|-----------------|------------|
| UC-001 | User Login | Authentication | 6 |
| UC-002 | View Live Crossing Feed | Dashboard, WS, Filters | 8 |
| UC-003 | Audit & Verify Crossing | Detail page, Correction, Reprocess | 8 |
| UC-004 | Generate Shift Report | Reports, Export, Charts | 6 |
| UC-005 | Manage Fleet Registry | CRUD, Import CSV | 8 |
| UC-006 | Monitor Telemetry Status | Telemetry, Thresholds, Simulation | 6 |
| UC-007 | Configure System | Admin, Backup/Restore, Prune | 8 |
| UC-008 | Configure Edge Device Settings | Settings form, range validation, saved/pending state | 6 |
| UC-009 | View Live Raw CCTV Feed | WebRTC start/stop/heartbeat, offline handling, no-overlay guarantee | 6 |
| UC-010 | Edge Device Reports Crossing & Heartbeat | Idempotent ingestion, outbox retry, offline sweep | 8 |
| **Total** | | | **70** |

> **Correction:** this total previously read **78**; the per-UC counts sum to **70**
> (6+8+8+6+8+6+8 = 50, plus 6+6+8 = 20). Corrected to match `docs/test_execution_sheet.md`.

> UC-008–UC-010 are **implemented and executed** (`docs/edge-system/`, built per
> `plans/next-implementation/`), except for rows that require a browser page, a deployed media
> relay, or real Jetson hardware. See `docs/test_execution_sheet.md` for per-row status and the
> stated reason for each exception.

### 2.2 Out of Scope

- Edge hardware deployment and field camera calibration
- UHF radio modem communication testing
- LTE/Starlink failover network testing
- Physical skid tower power subsystem validation
- Cross-browser testing beyond Chrome + Firefox latest
- Real cellular-carrier NAT/TURN traversal behavior for UC-009 (SRS §11 risk — requires testing
  against the actual SIM/carrier the devices use, not reproducible in this test environment)

---

## 3. Test Strategy

### Levels

| Level | Target | Approach | Tool |
|-------|--------|----------|------|
| Unit | API endpoints, business logic | Automated | pytest |
| Integration | Frontend → API → DB | Automated | pytest + httpx |
| E2E | Full user flows in browser | Manual | Browser DevTools |
| UAT | Real-world scenarios by operator | Manual | Production staging |

### Defect Severity

| Severity | Definition | Response |
|----------|-----------|----------|
| Critical | Core flow broken, data loss | Stop testing, fix immediately |
| Major | Feature unusable but has workaround | Fix before next phase |
| Minor | Cosmetic, non-blocking | Log and fix later |
| Trivial | Typo, label misalignment | Log |

---

## 4. Test Environment

- **Frontend:** Chrome 120+ / Firefox 120+
- **Backend:** Python 3.12+, FastAPI, Uvicorn
- **Database:** SQLite (test file, auto-created per test run)
- **Network:** localhost (API + WS on port 8000)
- **Test Data:** Seed script creates 3 users, 20 trucks, 200 crossings with varied statuses
- **Edge-system testing (UC-008–UC-010, not yet buildable):** requires a mock/stub edge agent
  capable of hitting `POST /api/edge/heartbeat` and `/api/edge/crossings` with controllable
  network-failure injection (for outbox/retry testing, SRS §4), and a running media relay
  (MediaMTX + TURN, SRS §8) for UC-009 — neither exists yet, they're prerequisites for executing
  these UCs, not just for building the feature itself.

---

## 5. Entry / Exit Criteria

| Type | Criteria |
|------|----------|
| **Entry** | All SoT artifacts approved; test environment ready; seed data loaded |
| **Exit** | 100% test cases executed; no Critical/Major open defects; UAT signed off |
| **Suspend** | Critical defect blocking > 50% of tests; unstable environment |

---

## 6. Deliverables

| Artifact | Description |
|----------|-------------|
| Test Plan | This document |
| Test Cases | `docs/test_cases.md` |
| Test Execution Sheet | `docs/test_execution_sheet.md` |
| Defect Log | Recorded during execution |
| Test Summary Report | Final pass/fail + metrics |
