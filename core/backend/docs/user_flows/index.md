# User Flows — Source of Truth Index

**Document Version:** v1.0  
**Project:** Smart Gate — Integrated Smart Hauling System (ISHS)  
**Status:** Active  
**Last Updated:** 2026-08-02  
**Author:** System Analyst AI  
**Source:** Derived from `docs/information_architecture.md` (SoT-2). UC-008–UC-010 additionally
derived from `docs/edge-system/` — planned, not yet implemented.

---

## Flow Index

| UC ID | Name | Primary Actor | Page |
|-------|------|---------------|------|
| UC-001 | User Login | Supervisor | PAGE-001 |
| UC-002 | View Live Crossing Feed | Supervisor | PAGE-002 |
| UC-003 | Audit & Verify Crossing | Supervisor | PAGE-003 |
| UC-004 | Generate Shift Report | Operations Analyst | PAGE-004 |
| UC-005 | Manage Fleet Registry | Administrator | PAGE-005 |
| UC-006 | Monitor Telemetry Status | IT Administrator | PAGE-006 |
| UC-007 | Configure System | Administrator | PAGE-007 |
| UC-008 | Configure Edge Device Settings | Administrator | PAGE-008 |
| UC-009 | View Live Raw CCTV Feed | Supervisor | PAGE-009 |
| UC-010 | Edge Device Reports Crossing & Heartbeat | Edge Agent (automated) | — |

---

## Traceability (IA → User Flows)

| Page ID | Page Name | UC ID |
|---------|-----------|-------|
| PAGE-001 | Login | UC-001 |
| PAGE-002 | Dashboard / Live Feed | UC-002 |
| PAGE-003 | Crossing Detail | UC-003 |
| PAGE-004 | Shift Summary | UC-004 |
| PAGE-005 | Fleet Master | UC-005 |
| PAGE-006 | Skid Telemetry | UC-006 |
| PAGE-007 | Admin Panel | UC-007 |
| PAGE-008 | Device Settings | UC-008 |
| PAGE-009 | Live Gate View | UC-009 |
