# System Logics — Source of Truth Index

**Document Version:** v1.0  
**Project:** Smart Gate — Integrated Smart Hauling System (ISHS)  
**Status:** Active  
**Last Updated:** 2026-08-02  
**Author:** System Analyst AI  
**Source:** Derived from `docs/user_flows/` (SoT-5). UC-008–UC-010 additionally derived from
`docs/edge-system/` and follow that folder's real API conventions, not this index's fictional
response envelope below (see each UC's header note).

---

## Overview

Each system logic document defines the API contract, sequence diagram, and interaction contract for a single use case.

## Logic Index

| UC ID | Name | Primary Endpoint |
|-------|------|-----------------|
| UC-001 | User Login | `POST /api/v1/auth/login` |
| UC-002 | View Live Crossing Feed | `GET /api/crossings` + WebSocket |
| UC-003 | Audit & Verify Crossing | `GET /api/crossings/{id}`, `PUT /api/crossings/{id}/verify`, `PUT /api/crossings/{id}/correct` |
| UC-004 | Generate Shift Report | `GET /api/reports/shift-summary`, `GET /api/reports/contractor-performance` |
| UC-005 | Manage Fleet Registry | `GET /api/fleet`, `POST /api/fleet`, `PUT /api/fleet/{id}` |
| UC-006 | Monitor Telemetry Status | `GET /api/telemetry/current`, `GET /api/telemetry/history` |
| UC-007 | Configure System | `PUT /api/admin/alert-thresholds`, `POST /api/admin/backup`, `POST /api/admin/restore` |
| UC-008 | Configure Edge Device Settings | `GET`/`PUT /api/cameras/{camera_code}/edge-config` |
| UC-009 | View Live Raw CCTV Feed | `POST /api/cameras/{camera_code}/live/start`/`/live/heartbeat`/`/live/stop` |
| UC-010 | Edge Device Reports Crossing & Heartbeat | `POST /api/edge/crossings`, `POST /api/edge/heartbeat`, `GET /api/edge/config` |

## Common API Response Envelope

**Applies to UC-001–UC-007 only.** UC-008–UC-010 (the edge-system endpoints) use the real
backend's actual conventions instead — `{"status": "success", ...}` / `{"error": "..."}"`, per
`docs/edge-system/API_CONTRACT.md` §0 — not the envelope below.

All API responses follow this structure:

```json
{
  "success": true | false,
  "data": { ... },
  "message": "Human-readable status message",
  "errors": []
}
```

## Common Error Codes

| Code | HTTP Status | Meaning |
|------|-------------|---------|
| UNAUTHORIZED | 401 | Missing or invalid session token |
| FORBIDDEN | 403 | Authenticated but insufficient role |
| NOT_FOUND | 404 | Requested entity does not exist |
| VALIDATION_ERROR | 400 | Input validation failed |
| INTERNAL_ERROR | 500 | Unexpected server error |
