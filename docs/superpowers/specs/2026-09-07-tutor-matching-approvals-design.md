# Tutor Matching Slice 4: Approvals - Design

Refines Section 5 "Pending Approvals" of `2026-09-04-tutor-matching-design.md` into a buildable slice. That document remains the source for the data model (Section 3), RLS matrix, and the overall build order. Where this document is more specific, it wins.

## 1. Summary

Admins review the months tutors have submitted, correct individual sessions with an audit trail, and either approve a month, which generates its invoice, or send it back with a reason for the tutor to fix and resubmit. All state changes are Postgres functions; the screen only reads rows and calls functions.

### Decisions made during brainstorming

| Topic | Decision |
|---|---|
| Removing a wrong entry from a submitted month | Not possible from the admin side. The admin sends the month back with a reason; the tutor deletes the entry and resubmits. The edit trail stays complete. |
| Queue scope | The live queue (status `submitted`) plus a read-only section of months sent back and not yet resubmitted. Approved months belong to the Invoices screen in slice 5. |
| Write path | Three SECURITY DEFINER functions (`tm_edit_entry`, `tm_approve_submission`, `tm_return_submission`). The entry edit is atomic with its audit row, which Section 7 of the main spec requires. |
| Review presentation | Same page with a `?submission=<id>` search param, not a dialog, so the slice 5 dashboard can link to a submission. |
| Admin edit form | Reuses the tutor portal's `SessionForm` with the assignment locked, so admin edits get the same validation as tutor entries. |
| Rounding | Invoice amounts are summed per rate line (distinct tier label and parent rate) and each line is rounded to two decimals before the lines are added. The screen's summary helper uses the same rule, so the queue, the approve confirmation, and the stored invoice agree, and the slice 5 PDF lines add up to the total. |

## 2. Database

One migration, `supabase/migrations/20260907100000_tm_approvals.sql`. No new tables, columns, policies, or grants on tables. Types are regenerated with `npm run db:types` afterwards.

Every function below is `LANGUAGE plpgsql SECURITY DEFINER SET search_path = public`, begins with `IF public.app_role() <> 'admin' THEN RAISE ... ERRCODE '42501'`, and ends with `REVOKE ALL ... FROM public, anon; GRANT EXECUTE ... TO authenticated`. Refusals use `ERRCODE '22023'` with the exact messages below; a missing row uses `P0002`.

### `tm_edit_entry(p_entry_id uuid, p_patch jsonb) RETURNS uuid`

`p_patch` carries the full set of editable fields, the same six the tutor form sends: `date`, `start_time`, `end_time`, `hours`, `rate_tier_id`, `note`. Keys absent from the patch are treated as null.

1. `SELECT ... FOR UPDATE` the entry's submission first, then the entry, so locks are taken in the same order as `tm_approve_submission` (submission, then entries) and the two cannot deadlock. Missing entry: `P0002` "Session not found".
2. Status must be `submitted`: otherwise "Only sessions waiting for approval can be edited here".
3. `date` is required: "Enter the session date". The date's year and month must match the entry's submission: otherwise "The date must stay in the submitted month".
4. `rate_tier_id` is required: "Choose a rate tier". The tier must belong to the entry's assignment: `23503` "rate tier does not belong to this assignment".
5. Work out the effective hours: the patch's `hours` when given, else the rounded difference between the two times (the same rule as `tm_set_entry_hours`). If `date`, `start_time`, `end_time`, effective hours, `rate_tier_id`, and `note` all equal the current row, return the entry id without writing anything.
6. Insert `tm_entry_edits (entry_id, edited_by, previous)` with `edited_by = auth.uid()` and `previous = jsonb_build_object('date', ..., 'start_time', ..., 'end_time', ..., 'hours', ..., 'tier_label', ..., 'note', ...)` from the current row.
7. Update the entry. When `rate_tier_id` changed, set `tier_label`, `parent_rate`, `tutor_rate` from the tier (the snapshot trigger skips admins). Set `hours` to the patch value, which is null when both times are given so the existing `tm_set_entry_hours` trigger recomputes it. `status` and `submission_id` are untouched.
8. Return the entry id.

The `tm_guard_locked_month` trigger already lets admins through, and `tm_touch_updated_at` stamps the row.

### `tm_approve_submission(p_submission_id uuid) RETURNS uuid`

1. `FOR UPDATE` the submission. Missing: `P0002` "Submission not found".
2. Status must be `submitted`: otherwise "This submission is not waiting for approval".
3. Entries are those with `submission_id = p_submission_id AND status = 'submitted'`. Zero entries: "No sessions to approve".
4. A `tm_invoices` row with the same `assignment_id`, `year`, `month` and `source = 'generated'` already existing: "An invoice already exists for this month".
5. Compute, from the entries:
   - `total_hours = sum(hours)`
   - `invoice_amount = sum over (tier_label, parent_rate) of round(sum(hours * parent_rate), 2)`
   - `tutor_payout = sum over (tier_label, tutor_rate) of round(sum(hours * tutor_rate), 2)`
6. Insert `tm_invoices (assignment_id, year, month, source, total_hours, invoice_amount, tutor_payout)` with `source = 'generated'`; the existing trigger assigns `invoice_number`.
7. Update the entries: `status = 'approved'`, `invoice_id`.
8. Update the submission: `status = 'approved'`, `reviewed_at = now()`, `invoice_id`.
9. Return the invoice id.

### `tm_return_submission(p_submission_id uuid, p_reason text) RETURNS void`

1. `btrim(p_reason)` must be non-empty: "Give the tutor a reason".
2. `FOR UPDATE` the submission. Missing: `P0002`. Status must be `submitted`: "This submission is not waiting for approval".
3. Update entries with `submission_id = p_submission_id AND status = 'submitted'` to `status = 'returned'`. `submission_id` is kept for history; `tm_submit_month` overwrites it on resubmission.
4. Update the submission: `status = 'returned'`, `return_reason = btrim(p_reason)`, `reviewed_at = now()`.

No tutor-side change is needed. The portal already shows "Returned: {reason}", treats `returned` entries as editable, and its Resubmit button calls `tm_submit_month`, which selects `draft` and `returned` entries and inserts a new submission (the partial unique index ignores returned rows).

## 3. Reads

The page is a client component using the browser Supabase client under the admin RLS policies. Numeric columns pass through `toNumber()`.

**Queue query.** `tm_submissions` where `status = 'submitted'`, ordered by `submitted_at`, selecting `id, assignment_id, year, month, submitted_at`, embedding `tm_assignments(code, subject, tm_students(name))`, `tm_tutors(name)`, and `tm_timesheet_entries!submission_id(id, date, start_time, end_time, hours, rate_tier_id, tier_label, parent_rate, tutor_rate, note, status, tm_entry_edits(id, edited_at, previous))`. The embedded entries are filtered client-side to `status = 'submitted'` (entries of an earlier returned submission may still point at it until resubmitted; they are excluded by status).

**Returned query.** Two queries: `tm_submissions` where `status = 'returned'` with the same embeds minus entries, ordered by `reviewed_at desc`; and `tm_submissions` where `status <> 'returned'` and `assignment_id` in the returned rows' assignment ids, selecting `assignment_id, year, month`. A returned row is outstanding when no live row shares its assignment, year, and month.

**Review.** The selected submission comes from the queue data already loaded; the page does not refetch. After any write the page reloads both queries. If the search param names a submission that is no longer in the queue (approved or returned meanwhile), the page shows a "This submission is no longer waiting for approval" notice with a link back to the queue.

**Rate tiers for the edit form.** Loaded on demand when the edit dialog opens: `tm_rate_tiers` for the entry's assignment, mapped to the portal's `PortalAssignment` shape (the admin can see every column; the shape only needs `id`, `label`, `tutor_rate`, `sort_order`).

## 4. Pure helpers, `src/lib/tm/approvals.ts`

- `ApprovalEntry`: the entry row above with numbers coerced, plus `edits: EntryEdit[]`.
- `QueueSubmission`: id, assignment id, code, subject, student name, tutor name, year, month, submitted at, entries.
- `summariseEntries(entries)` returns `{ sessions, hours, amount, payout, profit }` using the per-line rounding rule from Section 2.
- `groupByTutor(submissions)` returns `[tutorName, QueueSubmission[]][]` sorted by tutor name, submissions by submitted at.
- `outstandingReturns(returned, live)` filters returned submissions to those with no live row for the same assignment, year, and month.
- `describeEdit(previous)` turns the `previous` jsonb into display lines, e.g. `Date: 2026-09-04`, `Time: 14:00 to 15:30`, `Hours: 1.50`, `Tier: 1 to 1`, `Note: ...`; absent or null values are shown as "none".
- `entryToSessionInput(entry)` maps an entry to the portal `SessionInput` for the form's `initial` prop.
- `patchFromPayload(payload)` maps the form's `SessionPayload` to the `p_patch` object (drops `assignment_id`).

## 5. Screen

### Navigation

`NAV_ITEMS.tm` gains `{ label: "Pending Approvals", href: "/tm/approvals" }` immediately after Dashboard. The sidebar icon map adds `"Pending Approvals": ClipboardCheck`.

### `/tm/approvals` (queue)

- Heading "Pending Approvals".
- Loading: skeletons. Load error: toast plus an inline message. Empty queue: a card saying "Nothing is waiting for approval."
- One card per tutor, title is the tutor name. Table columns: Code, Student, Subject, Month, Sessions, Hours, Invoice, Payout, Profit, and a "Review" button that navigates to `?submission=<id>`.
- Below, card "Returned, awaiting resubmission" with columns Tutor, Student, Code, Month, Returned (date), Reason. Hidden when empty.

### `/tm/approvals?submission=<id>` (review)

- "Back to queue" link at the top.
- Header card: tutor, student, code, subject, month label, submitted at.
- Entry table sorted by date then start time: Date, Time (start to end, or blank), Hours, Tier, Parent rate, Tutor rate, Amount (hours x parent rate), Note, and an actions cell with a pencil button labelled `Edit session on {date}`. An entry with edits shows an "Edited" badge before the note; clicking it opens a popover listing each edit, newest first, with its time and the lines from `describeEdit`.
- Totals row: sessions, hours, invoice amount, tutor payout, profit from `summariseEntries`.
- Footer buttons: "Send back" (outline) and "Approve" (primary).

### Dialogs

- **Edit**: title "Edit session", body is `SessionForm` with `lockAssignment`, `initial` from `entryToSessionInput`, submit label "Save changes". On submit, call `tm_edit_entry` with `patchFromPayload`. Success toast "Session updated"; failure toast "Could not update the session" with the error message. Reloads on success.
- **Send back**: title "Send back to {tutor}", a required textarea labelled "Reason", buttons Cancel and "Send back". Calls `tm_return_submission`. Success toast "Sent back to {tutor}", then navigates to the queue.
- **Approve**: title "Approve {student}, {month label}", body repeats the totals, buttons Cancel and "Approve". Calls `tm_approve_submission`, then reads `invoice_number` for the returned id. Success toast "Approved" with description "Invoice {number} created.", then navigates to the queue. Failure toast "Could not approve" with the error message.

Copy that must appear verbatim: "Pending Approvals", "Returned, awaiting resubmission", "Nothing is waiting for approval.", "Send back", "Approve", "Edited", "Session updated", "Sent back to {tutor}", "Invoice {number} created."

## 6. Error handling

- Function refusals arrive as PostgREST errors; the message is shown in a destructive toast unchanged.
- A stale review (submission left the queue in another tab) shows the notice from Section 3 instead of the panel.
- The edit form's own validation runs before any call, as in the portal.

## 7. Testing

**pgTAP, `supabase/tests/tm_approvals.test.sql`**, fixtures in the style of `tm_portal.test.sql` (tutor A, tutor B, admin, one assignment with two tiers, entries submitted via `tm_submit_month` as tutor A):

- As tutor A, each of the three functions raises `42501`.
- As admin, `tm_edit_entry` on a draft entry raises `22023`; without a tier raises `22023`; with an unchanged patch writes no `tm_entry_edits` row; with a changed tier writes one row whose `previous` holds the old date, hours, and tier label, and the entry's `tier_label`, `parent_rate`, `tutor_rate` match the new tier; with times and null hours the entry's hours are recomputed.
- `tm_return_submission` with a blank reason raises `22023`; with a reason sets the submission and both entries to `returned` with the reason and `reviewed_at`; a second call raises `22023`.
- As tutor A, after the return, an entry update succeeds and `tm_submit_month` creates a second submission that picks up both entries.
- As admin, `tm_approve_submission` on the returned (first) submission raises `22023`; on the live submission creates an invoice numbered `TM-<yyyymm>-001` with `source = 'generated'`, `total_hours`, `invoice_amount`, and `tutor_payout` equal to hand-computed values across the two tiers, sets both entries and the submission to `approved` with that `invoice_id` and a `reviewed_at`; a second call raises `22023`.
- `tm_edit_entry` on an approved entry raises `22023`.

**Vitest, `src/lib/tm/approvals.test.ts`**: `summariseEntries` across two tiers with a rounding case where per-line rounding differs from total rounding; `groupByTutor` ordering; `outstandingReturns` with one resubmitted and one outstanding month; `describeEdit` with nulls; `entryToSessionInput` and `patchFromPayload` round trip. `src/lib/workspace.test.ts` asserts the new nav item and its position.

**Playwright, `e2e/tm-approvals.spec.ts`**, serial. A fixture `createSubmittedMonth(tutorName, studentName, code)` in `e2e/helpers/admin.ts` builds on `createAssignmentForTutor`: inserts two entries in the current month with distinct notes, inserts the `tm_submissions` row, and updates the entries to `submitted` with that `submission_id`, all with the service-role client. `deleteAssignmentData` gains invoice cleanup: invoices for the assignment are deleted first (both `invoice_id` FKs are `ON DELETE SET NULL`), then entries (edits cascade), submissions, the assignment, and the student.

1. Admin: the queue lists the row under "E2E Tutor" with the expected hours and invoice amount.
2. Admin: Review, edit the first entry's hours, see "Session updated" and the "Edited" badge, open it and see the previous hours.
3. Admin: Send back with a reason, see "Sent back to E2E Tutor", the queue is empty, and the returned section shows the reason.
4. Tutor: `/portal/timesheet` shows "Returned:" with the reason; Resubmit, see the "Submitted, waiting for approval" banner.
5. Admin: Review, Approve, see "Invoice TM-" in the toast; the service-role client finds one generated invoice for the assignment with the expected amount.

## 8. Out of scope

Deleting or adding entries from the admin side, viewing approved months here (Invoices, slice 5), the dashboard tiles and links (slice 5), and any notification to the tutor beyond the portal banner.
