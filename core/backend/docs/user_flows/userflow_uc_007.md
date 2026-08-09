# User Flow Specification: UC-007 Configure System

**Version:** v1.0  
**Status:** Draft  
**Primary Actor:** Administrator  
**Page:** PAGE-007 (Admin Panel)  
**Related Requirements:** PRD Risk (Monsoon Power Outages), PRD Risk (Master Data Integration), PRD Network Architecture

---

## 1. Overview

Administrator configures system-wide settings: alert thresholds, user accounts, database management, and audit log inspection.

---

## 2. Trigger

- User clicks "Admin" gear icon in sidebar

---

## 3. Preconditions

| ID | Condition |
|----|-----------|
| PRE-001 | User authenticated with `admin` role |

---

## 4. Main Flow

| Step | Actor Action | System Response |
|------|-------------|-----------------|
| 1 | User navigates to `/admin` | System loads admin panel with sections: Alert Thresholds, Users, Audit Logs, Database |
| 2 | User views current alert thresholds | System displays: battery_low (30%), solar_low (5W), latency_high (400ms) |
| 3 | User adjusts battery_low to 20% and saves | System validates range (0–100%), persists to TelemetryThreshold table |
| 4 | | AuditLog entry: `threshold_updated - battery_low: 30 → 20` |
| 5 | User scrolls to Audit Logs section | System loads paginated, filterable audit log table |

---

## 5. Alternative Flows

### AF-001: Manage Users

| Step | Actor Action | System Response |
|------|-------------|-----------------|
| 1 | User clicks "Users" tab | System loads user list: username, full_name, role, last_login |
| 2 | User clicks "Add User" | System opens form: username, full_name, password, role |
| 3 | User fills form and saves | System creates user with hashed password |
| 4 | | Toast: "User [username] created" |

### AF-002: Database Backup

| Step | Actor Action | System Response |
|------|-------------|-----------------|
| 1 | User clicks "Backup Database" | System triggers export, prompts file download (`smart_gate_backup.json`) |
| 2 | User clicks "Restore" | System opens file picker for JSON backup upload |
| 3 | User selects file and confirms restore | System clears existing data, imports from backup |
| 4 | | Success toast with restored record counts |

### AF-003: Prune Old Crossings

| Step | Actor Action | System Response |
|------|-------------|-----------------|
| 1 | User navigates to Database section | System shows data usage stats: crossing count, evidence disk usage |
| 2 | User clicks "Prune Crossings" | System opens modal: "Delete crossings older than [90] days" |
| 3 | User sets retention to 60 days and confirms | System deletes old crossings + evidence files, aggregates stats |
| 4 | | Confirmation with deleted record count |

---

## 6. Postconditions

| ID | Condition |
|----|-----------|
| POST-001 | Any threshold changes active immediately for telemetry checks |
| POST-002 | User account changes effective immediately |
| POST-003 | Database operations logged in AuditLog |

---

## 7. Business Rules

| ID | Rule |
|----|------|
| BR-001 | Only `admin` role can access `/admin` — supervisor role redirected |
| BR-002 | Threshold values must pass range validation before saving |
| BR-003 | Database restore is all-or-nothing: clears state before import |

---

## 8. Acceptance Criteria

| AC ID | Description |
|-------|-------------|
| AC-001 | Admin panel sections are organized as tabs or sections on one page |
| AC-002 | Alert threshold changes persist and take effect immediately |
| AC-003 | User creation validates unique username |
| AC-004 | Database backup downloads a valid JSON file |
| AC-005 | Database restore validates file format before clearing data |
| AC-006 | Audit logs are paginated and filterable by action type and date range |
