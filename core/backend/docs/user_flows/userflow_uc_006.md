# User Flow Specification: UC-006 Monitor Telemetry Status

**Version:** v1.0  
**Status:** Draft  
**Primary Actor:** IT Administrator  
**Page:** PAGE-006 (Skid Telemetry)  
**Related Requirements:** PRD Epic 2 (Rugged Infrastructure), PRD Epic 3 (Hybrid Telemetry), PRD Risk (Monsoon Power Outages)

---

## 1. Overview

IT Administrator monitors the health and status of remote mobile skidding towers — battery levels, solar output, network latency — and investigates anomalies via trend charts.

---

## 2. Trigger

- User clicks "Telemetry" in sidebar navigation

---

## 3. Preconditions

| ID | Condition |
|----|-----------|
| PRE-001 | User authenticated |
| PRE-002 | Skid towers are deployed and reporting telemetry data |

---

## 4. Main Flow

| Step | Actor Action | System Response |
|------|-------------|-----------------|
| 1 | User navigates to `/telemetry` | System loads tower cards for all deployed skids |
| 2 | | Each card shows: tower name, battery %, solar W, latency ms, status indicator |
| 3 | | Status indicator color: green (normal), yellow (warning), red (offline) |
| 4 | | Sparkline mini-charts show recent battery + solar trend for each tower |
| 5 | User observes Tower-Gamma has amber battery status (28%) | Card border glows amber, warning icon visible |
| 6 | User clicks Tower-Gamma card | System opens trend modal with 6-hour battery + solar line charts |
| 7 | User selects "24H" time range | System reloads chart data for 24-hour window |

---

## 5. Alternative Flows

### AF-001: Simulate Anomaly (Testing)

| Step | Actor Action | System Response |
|------|-------------|-----------------|
| 1 | User expands "Simulation Toolbar" at page bottom | System shows controls: tower selector, parameter override inputs |
| 2 | User selects Tower-Alpha, sets battery to 15% | System applies override to live telemetry data |
| 3 | | Tower card turns amber, alert triggers generate in the background |
| 4 | User clicks "Reset All" | System clears all active overrides, restores natural telemetry |

### AF-002: Configure Alert Thresholds

| Step | Actor Action | System Response |
|------|-------------|-----------------|
| 1 | User clicks gear icon on telemetry page | System navigates to `/admin` or opens inline threshold editor |
| 2 | User adjusts battery_low threshold from 30% to 20% | System saves via PUT /api/admin/alert-thresholds |
| 3 | | AuditLog records the threshold change |

---

## 6. Postconditions

| ID | Condition |
|----|-----------|
| POST-001 | Telemetry data continues auto-refreshing at poll interval |
| POST-002 | Any alert threshold changes are persisted and active |

---

## 7. Business Rules

| ID | Rule |
|----|------|
| BR-001 | Telemetry polled on backend every 30 seconds, cached in ring buffer |
| BR-002 | 3 consecutive readings beyond threshold → auto-trigger alert dispatch |
| BR-003 | Tower offline if no telemetry received for > 5 minutes |
| BR-004 | Trend history retained for 7 days, pruned automatically |

---

## 8. Acceptance Criteria

| AC ID | Description |
|-------|-------------|
| AC-001 | Tower cards display live battery, solar, and latency values |
| AC-002 | Status color reflects real-time health (green/amber/red) |
| AC-003 | Clicking a tower opens trend charts for 6H/24H/7D intervals |
| AC-004 | Simulation toolbar overrides are visually reflected and resettable |
| AC-005 | Sparkline mini-charts render inline on each tower card |
