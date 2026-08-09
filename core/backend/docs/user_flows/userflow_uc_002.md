# User Flow Specification: UC-002 View Live Crossing Feed

**Version:** v1.0  
**Status:** Draft  
**Primary Actor:** Supervisor  
**Page:** PAGE-002 (Dashboard / Live Feed)  
**Related Requirements:** PRD Epic 4 (Live Terminal Feed), PRD UX Workflow Diagram

---

## 1. Overview

Supervisor monitors real-time OHT crossings as they are detected by edge towers. The feed auto-updates via WebSocket with new cards appearing at the top.

---

## 2. Trigger

- Successful login redirects to `/dashboard`
- Supervisor clicks "Dashboard" in sidebar

---

## 3. Preconditions

| ID | Condition |
|----|-----------|
| PRE-001 | User authenticated |
| PRE-002 | WebSocket connection established |
| PRE-003 | At least one skid tower actively detecting crossings (or simulated data) |

---

## 4. Main Flow

| Step | Actor Action | System Response |
|------|-------------|-----------------|
| 1 | User lands on `/dashboard` | System loads KPI cards (total crossings, active fleet, warnings) |
| 2 | | System populates live feed with recent crossings, newest first |
| 3 | | System opens WebSocket for real-time updates |
| 4 | A new crossing is detected by edge tower | System prepends a new crossing card with slide-in animation |
| 5 | | KPI counters animate to update totals |
| 6 | | Confidence badge color reflects OCR quality |
| 7 | User scrolls through feed list | Feed is virtualized / paginated for performance |
| 8 | User activates a quick-filter tag ("Low Conf") | System hides all cards with confidence ≥ 85%, shows only risky ones |
| 9 | User types hull ID in search box | System filters feed in real-time, highlights matching characters |

---

## 5. Alternative Flows

### AF-001: WebSocket Disconnected

| Step | Actor Action | System Response |
|------|-------------|-----------------|
| 1 | Network interruption occurs | Header WS indicator turns yellow (reconnecting) |
| 2 | | System displays banner: "Live updates paused. Reconnecting..." |
| 3 | | System attempts auto-reconnect every 3 seconds |
| 4 | Connection restored | WS indicator turns green, backlog of missed crossings loaded |

### AF-002: No Crossings Yet

| Step | Actor Action | System Response |
|------|-------------|-----------------|
| 1 | User opens dashboard with zero crossings | System displays empty state: truck icon + "No crossings detected" message |
| 2 | | System shows telemetry panel to verify towers are online |

---

## 6. Postconditions

| ID | Condition |
|----|-----------|
| POST-001 | Feed continues to update in real-time |
| POST-002 | Active filters persist across new WebSocket events |

---

## 7. Business Rules

| ID | Rule |
|----|------|
| BR-001 | Feed displays max 50 cards initially, loads more on scroll |
| BR-002 | Duplicate crossings (is_duplicate = 1) hidden by default, visible via filter toggle |
| BR-003 | Confidence badge thresholds: ≥ 95% green, 85–94% amber, < 85% red |

---

## 8. Acceptance Criteria

| AC ID | Description |
|-------|-------------|
| AC-001 | New crossing cards appear within 5 seconds of edge detection |
| AC-002 | KPI counters update without page refresh |
| AC-003 | Quick-filter tags filter cards in real-time |
| AC-004 | Search highlights matching characters in hull ID |
| AC-005 | WS disconnection shows visual indicator and auto-reconnects |
| AC-006 | Empty state renders helpful guidance instead of blank page |
