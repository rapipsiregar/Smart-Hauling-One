# User Flow Specification: UC-005 Manage Fleet Registry

**Version:** v1.0  
**Status:** Draft  
**Primary Actor:** Administrator  
**Page:** PAGE-005 (Fleet Master)  
**Related Requirements:** PRD Phase 1 (Fleet Master Database Setup), PRD Risk (Master Data Integration)

---

## 1. Overview

Administrator views, registers, edits, and manages the master OHT fleet registry. This registry serves as the verification baseline for OCR matching.

---

## 2. Trigger

- User clicks "Fleet" in sidebar navigation

---

## 3. Preconditions

| ID | Condition |
|----|-----------|
| PRE-001 | User authenticated with admin or supervisor role |

---

## 4. Main Flow

| Step | Actor Action | System Response |
|------|-------------|-----------------|
| 1 | User navigates to `/fleet` | System loads sortable table of all registered trucks |
| 2 | | Table columns: Hull ID, Contractor, Model, Year, Status, Last Crossing |
| 3 | User types in search bar | System filters table rows in real-time by hull ID or contractor |
| 4 | User toggles a status switch on a row | System sends PUT to update truck status (active/inactive) |
| 5 | | Table row updates visually without page reload |

---

## 5. Alternative Flows

### AF-001: Add Single Truck

| Step | Actor Action | System Response |
|------|-------------|-----------------|
| 1 | User clicks "Add Truck" button | System opens modal form with fields: Hull ID, Contractor, Model, Year |
| 2 | User fills form and clicks "Save" | System validates: hull_id unique, all required fields filled |
| 3 | | System creates Truck record, closes modal, refreshes table |
| 4 | | Toast notification: "Truck DT-XXX registered successfully" |

### AF-002: Bulk Import CSV

| Step | Actor Action | System Response |
|------|-------------|-----------------|
| 1 | User clicks "Import CSV" | System opens file picker dialog |
| 2 | User selects CSV file with columns: hull_id, contractor, model, year | System validates headers and rows |
| 3 | | If validation passes: imports all rows, shows success count |
| 4 | | If validation fails: shows error report with row-by-row issues |

### AF-003: Edit Existing Truck

| Step | Actor Action | System Response |
|------|-------------|-----------------|
| 1 | User clicks edit icon on a table row | System opens pre-filled modal with truck data |
| 2 | User modifies fields and clicks "Save" | System validates and updates record |
| 3 | | Toast notification confirms update |

---

## 6. Postconditions

| ID | Condition |
|----|-----------|
| POST-001 | Fleet table reflects latest changes |
| POST-002 | New or updated trucks are available for OCR matching immediately |

---

## 7. Business Rules

| ID | Rule |
|----|------|
| BR-001 | Hull ID must be unique across the fleet registry |
| BR-002 | Hull ID format: alphanumeric, uppercase, hyphen allowed (e.g. `DT-118`) |
| BR-003 | Deleting a truck is soft — status = `retired`, record preserved for audit |
| BR-004 | CSV import validates all rows before inserting any (all-or-nothing) |

---

## 8. Acceptance Criteria

| AC ID | Description |
|-------|-------------|
| AC-001 | Fleet table is sortable by any column |
| AC-002 | Search filters table in real-time |
| AC-003 | Status toggle updates backend without page reload |
| AC-004 | Add Truck modal validates hull_id uniqueness on submit |
| AC-005 | CSV import shows detailed error report on validation failure |
| AC-006 | Edit truck pre-fills existing values in the form |
