# User Flow Specification: UC-004 Generate Shift Report

**Version:** v1.0  
**Status:** Draft  
**Primary Actor:** Operations Analyst / Supervisor  
**Page:** PAGE-004 (Shift Summary)  
**Related Requirements:** PRD Epic 4 (Shift Reporting Module), PRD Phase 1 Dashboards

---

## 1. Overview

Supervisor reviews shift-end productivity metrics, contractor compliance rates, and generates exportable reports for subcontractor reconciliation.

---

## 2. Trigger

- User clicks "Reports" in sidebar navigation

---

## 3. Preconditions

| ID | Condition |
|----|-----------|
| PRE-001 | User authenticated |
| PRE-002 | Crossing data exists for the selected period |

---

## 4. Main Flow

| Step | Actor Action | System Response |
|------|-------------|-----------------|
| 1 | User navigates to `/reports` | System loads current shift's summary data |
| 2 | | System displays KPI cards: total verified crossings, completed cycles, active fleet count, compliance % |
| 3 | | System renders subcontractor compliance gauge bars |
| 4 | | System renders donut chart showing ritase allocation per contractor |
| 5 | | System populates discrepancies feed (low conf, unregistered, cycle disc) |
| 6 | User selects a different date/shift from date picker | System reloads data for selected period |
| 7 | User clicks "Export PDF" | System opens print settings modal with title + date range + column selector |
| 8 | User configures options and clicks "Generate" | System opens print preview iframe with formatted report |
| 9 | User clicks browser's native print | System generates PDF via browser print dialog |

---

## 5. Alternative Flows

### AF-001: Filter Discrepancies

| Step | Actor Action | System Response |
|------|-------------|-----------------|
| 1 | User sees discrepancy items in the feed | |
| 2 | User checks/unchecks lane, contractor, severity filter checkboxes | System dynamically hides/shows matching discrepancy cards |
| 3 | User exports | Filter state is preserved in exported PDF |

### AF-002: Send Compliance Warning

| Step | Actor Action | System Response |
|------|-------------|-----------------|
| 1 | User sees a contractor below compliance target | |
| 2 | User clicks "Send Warning" on contractor card | System shows form with recipient email field |
| 3 | User enters recipient and sends | System creates DispatchLog, broadcasts via WebSocket |
| 4 | | System shows success toast: "Warning dispatched to [recipient]" |

---

## 6. Postconditions

| ID | Condition |
|----|-----------|
| POST-001 | Report data reflects most recent crossing records |
| POST-002 | Export file generated and downloaded |
| POST-003 | Any warning dispatches logged in system |

---

## 7. Business Rules

| ID | Rule |
|----|------|
| BR-001 | Only `verified` or `corrected` crossings count as completed cycles |
| BR-002 | Duplicate crossings (is_duplicate = 1) excluded from all stats |
| BR-003 | Compliance gauge threshold colors: ≥ 85% green, 50–84% amber, < 50% red |

---

## 8. Acceptance Criteria

| AC ID | Description |
|-------|-------------|
| AC-001 | Shift summary loads with KPI cards, charts, and discrepancy feed |
| AC-002 | Date picker reloads report data for the selected period |
| AC-003 | Contractor donut chart segments match absolute cycle counts |
| AC-004 | PDF export respects selected columns and filter state |
| AC-005 | Compliance warning dispatch creates an audit trail entry |
