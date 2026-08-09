# User Flow Specification: UC-003 Audit & Verify Crossing

**Version:** v1.0  
**Status:** Draft  
**Primary Actor:** Supervisor  
**Page:** PAGE-003 (Crossing Detail)  
**Related Requirements:** PRD Epic 4 (Visual Audit Section), PRD UX Workflow

---

## 1. Overview

Supervisor inspects a specific crossing in detail, reviewing visual proof images, and optionally verifying or correcting the detected hull ID.

---

## 2. Trigger

- User clicks a crossing card in the Dashboard live feed (PAGE-002)
- User navigates directly to `/crossing/[id]`

---

## 3. Preconditions

| ID | Condition |
|----|-----------|
| PRE-001 | Crossing exists in database with associated evidence images |
| PRE-002 | User has supervisor or admin role |

---

## 4. Main Flow

| Step | Actor Action | System Response |
|------|-------------|-----------------|
| 1 | User clicks crossing card in feed | System navigates to `/crossing/[id]` |
| 2 | | System loads split-pane view: left = crop image, right = context image |
| 3 | | System displays metadata panel: hull ID, confidence %, timestamp, lane, direction, TMV frame count |
| 4 | User inspects crop image to verify hull ID matches the photo | Images are zoomable on hover/click |
| 5 | User clicks "Verify" button (checkmark) | System updates crossing status to `verified`, confidence to 100% |
| 6 | | System broadcasts update via WebSocket to all dashboards |
| 7 | | Metadata panel shows green "Verified" badge |
| 8 | | AuditLog entry created |

---

## 5. Alternative Flows

### AF-001: Correct Hull ID

| Step | Actor Action | System Response |
|------|-------------|-----------------|
| 1 | User identifies OCR misread in crop image | |
| 2 | User clicks "Correct Hull ID" button | System opens correction modal with text input and autocomplete dropdown |
| 3 | User types corrected hull ID | System filters registered trucks in dropdown |
| 4 | User selects correct truck and submits | System updates crossing hull_id, truck_id, sets status to `corrected` |
| 5 | | System creates Correction record + AuditLog entry |
| 6 | | WebSocket broadcast sent to all dashboards |

### AF-002: Reprocess OCR

| Step | Actor Action | System Response |
|------|-------------|-----------------|
| 1 | User notices crop is misaligned | |
| 2 | User clicks "Reprocess OCR" | System opens drag-to-crop editor on context image |
| 3 | User selects refined bounding box region | System sends POST to `/api/crossings/{id}/reprocess-ocr` |
| 4 | | Backend re-runs OCR on the selected crop region |
| 5 | | System updates crossing with new OCR result + confidence |

### AF-003: Evidence Images Missing

| Step | Actor Action | System Response |
|------|-------------|-----------------|
| 1 | User opens crossing detail | System detects missing image files on disk |
| 2 | | System shows placeholder: "[Image not available]" with red border |
| 3 | | System logs integrity issue in AuditLog |

---

## 6. Postconditions

| ID | Condition |
|----|-----------|
| POST-001 | Crossing status reflects user action (verified / corrected) |
| POST-002 | All connected dashboards see the updated status |
| POST-003 | Audit trail recorded for compliance |

---

## 7. Business Rules

| ID | Rule |
|----|------|
| BR-001 | Correction requires supervisor writes a reason |
| BR-002 | Original hull_id preserved in Correction record for audit |
| BR-003 | Only verified or corrected crossings count toward completed ritase stats |

---

## 8. Acceptance Criteria

| AC ID | Description |
|-------|-------------|
| AC-001 | Split pane shows both crop and context images side by side |
| AC-002 | Clicking "Verify" instantly updates crossing status without page reload |
| AC-003 | Correction modal includes autocomplete dropdown from fleet registry |
| AC-004 | Missing images show distinguishable placeholder, not broken icon |
| AC-005 | Every correction creates an auditable log entry |
