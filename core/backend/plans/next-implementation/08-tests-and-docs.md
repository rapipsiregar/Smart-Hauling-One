# Section 08 — Test Suite Consolidation & Documentation

**Goal:** the full suite is green, and the Chain-of-Truth documents reflect what actually shipped.
**Depends on:** [03](./03-edge-ingestion-api.md)–[07](./07-media-relay-infra.md).

---

## 8.1 [DONE] Confirm the full suite

```bash
uv run pytest tests/ -q
```

Expected new files by now (all written in their own sections):

| File | Section | Test cases covered |
| :--- | :--- | :--- |
| `tests/conftest.py` | 00 | shared fixtures |
| `tests/test_camera_attribution_by_id.py` | 01 | the attribution bug fix |
| `tests/test_edge_auth.py` | 02 | TC-010-04 |
| `tests/test_edge_crossings.py` | 03 | TC-010-01, -02, -03 |
| `tests/test_edge_heartbeat.py` | 03 | TC-010-05, -06 |
| `tests/test_edge_config_api.py` | 04 | TC-008-01, -04, -05, -06 |
| `tests/test_edge_config_roundtrip.py` | 04 | TC-008-02, -03 |
| `tests/test_device_status_sweep.py` | 05 | TC-010-07 |
| `tests/test_live_sessions.py` | 06 | TC-009-01 … -05 |

Compare against the Section 00 baseline. Any failure that is not in that baseline is yours.

**Not covered, deliberately:**
- **TC-009-06** (no detection overlay on the live stream) — a property of the edge's WHIP push, not
  of any backend endpoint. Verifiable only against a real device; belongs to Section 11.
- **TC-010-08** (outbox retry after network failure) — the induk cannot distinguish a retry from a
  first attempt; it only sees a repeated `Idempotency-Key`, which `test_edge_crossings.py` already
  covers. The retry *loop* is edge-side (Section 11) and is tested there.

---

## 8.2 [DONE] Update `docs/feature-list.md` §6

Flip these entries from `[PLANNED]` to `[DONE]` **in place** — do not renumber or reorder. The
section starts near line 1370.

| Entry | Flip when | Add to its description |
| :--- | :--- | :--- |
| 6.1 Edge Device Ingestion API | Section 03 done | Note that crossings land in `video_results` with `source='edge'`, de-duplicated by a `UNIQUE` index on `idempotency_key`. |
| 6.2 Edge Device Heartbeat & Health Tracking | Sections 03 + 05 done | Note the 30s lifespan-managed sweep and that `applied_config_version` is stored, not derived. |
| 6.3 Per-Device Settings API | Section 04 done | Note server-side range validation returns the field-specific 400 message. |
| 6.4 Live CCTV WebRTC Relay Orchestration | Sections 06 + 07 done | Note sessions are in-memory, threading-based, and that the relay ships as a `live-view` Compose profile. |

Leave **6.5, 6.6, 6.7 as `[PLANNED]`** — those are frontend pages (PAGE-008/PAGE-009) that live on
the `frontend` branch. Say so explicitly in your commit message so nobody reads the backend work as
"the settings page is done."

Also update the section's header note, which currently reads "None of the features in this section
are implemented":

```markdown
## 6. Edge Device System (`docs/edge-system/`)

The backend/API and edge-agent portions are implemented (6.1–6.4). The dashboard pages (6.5–6.7)
remain planned and live on the `frontend` branch. Full specification:
`docs/edge-system/PRD.md`, `SRS.md`, `API_CONTRACT.md`. Build plan:
`plans/next-implementation/`.
```

---

## 8.3 [DONE] Update `docs/test_execution_sheet.md`

Its header is explicit that `[✓]` means *actually executed*. Automated pytest runs satisfy that —
but only fill in rows whose test genuinely exists and passes.

For each of UC-008, UC-009, UC-010:
1. Replace the section's **Reason** line. It currently claims no code exists; that's no longer true.
   Example for UC-008:
   ```markdown
   ## UC-008: Configure Edge Device Settings — Executed (Automated)

   **Method:** `tests/test_edge_config_api.py`, `tests/test_edge_config_roundtrip.py`.
   The API surface is implemented; the dashboard page (PAGE-008) is not — rows here validate the
   backend contract, not the UI.
   ```
2. Fill each row: `Tester` = `pytest (automated)`, `Date` = today's date, `Status` = `[✓]`,
   `Actual Result` = a short factual note.
3. Rows with no automated equivalent stay `[—]` with an honest reason:
   - **TC-008-01** — the page itself doesn't exist; the backing `GET /api/cameras` call is covered.
     Mark `[—]` with "API covered; page is frontend-branch work."
   - **TC-009-01/-02** — "session orchestration covered; video playback needs a deployed relay."
   - **TC-009-06** — `[—]` "requires a real edge device pushing WHIP."
   - **TC-010-08** — `[—]` "edge-side retry loop; induk side covered by TC-010-02."
4. Update the **Summary** table's per-UC counts and the totals row to match.

Do not bulk find-and-replace `[—]` → `[✓]`. A sheet that overstates coverage is worse than one that
admits gaps.

---

## 8.4 [DONE] Update `docs/data_model.md`

Two edits:

1. **§3.12 Camera** — add the `applied_config_version` row to the attribute table (it's the one
   column this build added beyond SRS §9's proposed list; Section 01 explains why):
   ```markdown
   | applied_config_version | INTEGER | NOT NULL, DEFAULT 0 | Last `config_version` the device confirmed applying, reported verbatim at heartbeat. `0` = never confirmed. Stored rather than derived: once `config_version` advances again, a timestamp alone cannot say which version it referred to. |
   ```
2. **Remove the "not yet implemented" qualifiers.** Both the ERD note under §2 and the note under
   §3.12 say the edge fields are "planned, not yet implemented — this ERD reflects the planned
   schema." Replace with a statement that they are implemented, pointing at
   `plans/next-implementation/01-schema-foundations.md` for the migration.

Also correct the `Crossing.idempotency_key` row in §3.3: it is documented as `NOT NULL`, but the
implementation makes it **nullable** — every pre-existing batch row has no key, and SQLite's UNIQUE
index treats NULLs as distinct, which is what lets both sources share the table. Update the
constraint to `UNIQUE, NULLABLE (NULL for batch rows)` and keep the BR-010 reference.

---

## 8.5 [DONE] Update `docs/edge-system/` status headers

`PRD.md`, `SRS.md`, and `API_CONTRACT.md` all say **"Status: Draft v2 — implementation-detail
pass"**, and `API_CONTRACT.md` §0 states "None of this is implemented yet." Update each header to
reflect reality, e.g.:

```markdown
**Status:** Implemented (backend + edge agent) · dashboard pages pending on the `frontend` branch
```

and delete the "None of this is implemented yet" sentence from `API_CONTRACT.md` §0, keeping the
rest of that paragraph (the type-table-is-authoritative instruction) intact.

---

## 8.6 [DONE] Reconcile PRD open questions

`docs/edge-system/PRD.md` §8 lists three open questions. None were resolved by this build — they
need the hardware owner. Leave them open, but append a line to each noting the default is now
**live in code**, not just proposed:

- §8.1 local video retention → implemented as 7 days / 10% free disk in
  `edge/agent/video_retention.py`.
- §8.2 RTSP → assumed by `edge/agent/capture.py`.
- §8.3 outbox ceiling → implemented as 500 MB in `edge/agent/outbox.py`.

This matters: a "proposed default" nobody implemented is harmless, but one that is now running on
4 devices needs confirming before the fleet goes live.

---

## Acceptance for Section 08

- [ ] `uv run pytest tests/ -q` is green apart from the documented Section 00 baseline failures.
- [ ] `docs/feature-list.md` §6.1–6.4 read `[DONE]`; 6.5–6.7 still read `[PLANNED]`.
- [ ] `docs/test_execution_sheet.md` totals add up and no row claims coverage that doesn't exist.
- [ ] `docs/data_model.md` documents `applied_config_version` and the nullable `idempotency_key`.
- [ ] No document still asserts the edge system is unimplemented.
