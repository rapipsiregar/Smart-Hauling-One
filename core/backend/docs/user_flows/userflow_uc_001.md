# User Flow Specification: UC-001 User Login

**Version:** v1.0  
**Status:** Draft  
**Primary Actor:** Supervisor  
**Page:** PAGE-001 (Login)  
**Related Requirements:** PRD Epic 4 (Secure web-based monitoring)

---

## 1. Overview

Supervisor authenticates to access the Smart Gate dashboard. First-time or session-expired users are presented with a login form.

---

## 2. Trigger

User navigates to `/` or `/login` without an active session.

---

## 3. Preconditions

| ID | Condition |
|----|-----------|
| PRE-001 | User has a registered account in the system |
| PRE-002 | System is reachable via browser |

---

## 4. Main Flow

| Step | Actor Action | System Response |
|------|-------------|-----------------|
| 1 | User opens Smart Gate URL in browser | System detects no active session, redirects to `/login` |
| 2 | | System displays centered login card with username, password fields, and "Sign In" button |
| 3 | User enters username and password | System validates inputs are non-empty |
| 4 | User clicks "Sign In" | System sends POST to `/api/v1/auth/login` |
| 5 | | System verifies credentials against database |
| 6 | | On success: creates session, redirects to `/dashboard` |
| 7 | User sees main dashboard with live feed | System establishes WebSocket connection |

---

## 5. Alternative Flows

### AF-001: Invalid Credentials

| Step | Actor Action | System Response |
|------|-------------|-----------------|
| 1 | User clicks "Sign In" with wrong credentials | System returns 401 |
| 2 | | System displays inline error: "Invalid username or password" |
| 3 | User re-enters correct credentials | Flow returns to Main Flow step 6 |

### AF-002: Session Still Active

| Step | Actor Action | System Response |
|------|-------------|-----------------|
| 1 | User navigates to `/login` while authenticated | System detects valid session |
| 2 | | System redirects to `/dashboard` immediately |

---

## 6. Postconditions

| ID | Condition |
|----|-----------|
| POST-001 | User has active session token |
| POST-002 | WebSocket connection established |
| POST-003 | Sidebar navigation becomes visible |

---

## 7. Business Rules

| ID | Rule |
|----|------|
| BR-001 | Session expires after 24 hours of inactivity |
| BR-002 | Max 5 failed login attempts per minute per IP |
| BR-003 | Passwords hashed with bcrypt (salt rounds ≥ 12) |

---

## 8. Acceptance Criteria

| AC ID | Description |
|-------|-------------|
| AC-001 | Login page is centered, minimal, no sidebar |
| AC-002 | Invalid credentials show inline error without page reload |
| AC-003 | Successful login redirects to `/dashboard` |
| AC-004 | Active session auto-redirects away from `/login` |
| AC-005 | Logout (from user menu) destroys session and redirects to `/login` |
