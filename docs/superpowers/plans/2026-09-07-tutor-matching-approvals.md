# Tutor Matching Slice 4: Approvals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins review submitted months, correct sessions with an audit trail, approve a month to generate its invoice, or send it back with a reason for the tutor to fix and resubmit.

**Architecture:** Three admin-only SECURITY DEFINER functions (`tm_edit_entry`, `tm_approve_submission`, `tm_return_submission`) hold every state change, following `tm_submit_month`. One client-rendered admin page at `/tm/approvals` reads submissions with their entries under admin RLS, shows a queue grouped by tutor plus a returned section, and switches to a review panel when `?submission=<id>` is present. Pure helpers in `src/lib/tm/approvals.ts` do the summing, grouping, and mapping with Vitest coverage. The admin edit dialog reuses the tutor portal's `SessionForm`.

**Tech Stack:** Next.js 14.2 App Router (client components), Supabase JS via `@supabase/ssr` with the generated `Database` type, shadcn/ui, Vitest, pgTAP, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-07-tutor-matching-approvals-design.md`. Data model and RLS: `docs/superpowers/specs/2026-09-04-tutor-matching-design.md` Section 3. Also read the "Carry-forward" sections at the end of `docs/superpowers/plans/2026-09-04-tutor-matching-foundation.md`, `docs/superpowers/plans/2026-09-04-tutor-matching-admin-data-entry.md`, and `docs/superpowers/plans/2026-09-05-tutor-matching-tutor-portal.md` (the last one has none yet; if a section was added since, honour it).

## Global Constraints

- Next.js stays on 14.2.x. No new dependencies.
- Every state change goes through the three functions. The screen never updates `tm_timesheet_entries`, `tm_submissions`, `tm_entry_edits`, or `tm_invoices` directly.
- Function refusals use `ERRCODE '22023'`; missing rows use `P0002`; non-admin callers get `42501`. Messages, verbatim: "Session not found", "Only sessions waiting for approval can be edited here", "Enter the session date", "Choose a rate tier", "rate tier does not belong to this assignment" (`23503`), "Hours must be more than 0", "Submission not found", "This submission is not waiting for approval", "No sessions to approve", "An invoice already exists for this month", "Give the tutor a reason".
- Rounding: invoice amount and tutor payout are summed per rate line (distinct tier label and rate), each line rounded to two decimals, then added. The TypeScript helper works in integer hundredths so it matches Postgres `ROUND(..., 2)` exactly.
- Admin-side removal or addition of entries does not exist. The path is Send back.
- Copy, verbatim: nav item "Pending Approvals"; card "Returned, awaiting resubmission"; empty state "Nothing is waiting for approval."; buttons "Review", "Send back", "Approve", "Save changes", "Back to queue"; badge "Edited"; toasts "Session updated", "Sent back to {tutor}", "Approved" with description "Invoice {number} created."; stale notice "This submission is no longer waiting for approval".
- PostgREST returns `numeric` as strings: every `hours`, `parent_rate`, `tutor_rate`, `invoice_amount`, `tutor_payout` read passes through `toNumber()` from `src/lib/tm/types.ts`.
- Times are `HH:MM` strings in the browser (PostgREST returns `HH:MM:SS`; slice to 5 chars on read). Dates are `YYYY-MM-DD`.
- Commit messages end with:
  ```
  Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01TkFUEBg6S7PqW49ZKa3C6p
  ```
- Run long commands (Playwright, `next build`, `supabase db reset`) in the foreground. After any `db reset`, run `npm run seed:test-users` and `npm run import:master-list`. The pgTAP admin fixture relies on the signup trigger giving `ccchristabelle@gmail.com` the `admin` role, as `tm_portal.test.sql` does.

## File Structure

| Path | Responsibility |
|---|---|
| `supabase/migrations/20260907100000_tm_approvals.sql` | `tm_edit_entry`, `tm_approve_submission`, `tm_return_submission` |
| `supabase/tests/tm_approvals.test.sql` | pgTAP for the three functions |
| `src/lib/supabase/types.ts` | Regenerated after the migration |
| `src/lib/tm/approvals.ts` (+ `.test.ts`) | Row types, raw-row mappers, `summariseEntries`, `groupByTutor`, `outstandingReturns`, `describeEdit`, `entryToSessionInput`, `patchFromPayload`, `sortEntries` |
| `src/lib/workspace.ts` (+ test), `src/components/layout/sidebar.tsx` (modify) | Nav item and icon |
| `src/app/(dashboard)/tm/approvals/page.tsx` | Loads queue and returned data, switches between queue and review by search param |
| `src/components/tm/approval-queue.tsx` | Queue cards grouped by tutor, returned section |
| `src/components/tm/entry-edits-popover.tsx` | "Edited" badge with history popover |
| `src/components/tm/submission-review.tsx` | Review panel: entry table, edit dialog, send back and approve dialogs |
| `e2e/helpers/admin.ts` (modify), `e2e/tm-approvals.spec.ts` | Fixture and the admin flow |

---

### Task 1: The three functions with pgTAP

**Files:**
- Create: `supabase/tests/tm_approvals.test.sql`
- Create: `supabase/migrations/20260907100000_tm_approvals.sql`
- Regenerate: `src/lib/supabase/types.ts`

**Interfaces:**
- Consumes: `public.app_role()`, `public.current_tutor_id()`, `tm_submit_month`, triggers `tm_set_entry_hours`, `tm_guard_locked_month` (admin bypass), `tm_snapshot_entry_rates` (admin bypass), `tm_set_invoice_number`.
- Produces: `tm_edit_entry(p_entry_id uuid, p_patch jsonb) returns uuid`, `tm_approve_submission(p_submission_id uuid) returns uuid` (the invoice id), `tm_return_submission(p_submission_id uuid, p_reason text) returns void`. Generated `Database["public"]["Functions"]` entries for all three.

- [ ] **Step 1: Failing pgTAP test**

Create `supabase/tests/tm_approvals.test.sql`:

```sql
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(43);

-- Users: tutor A, tutor B, admin (the signup trigger makes this email an admin)
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('a2000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'approvals.a@example.com', '', now(), '{}', '{"full_name":"Tutor A"}', now(), now()),
  ('a2000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'approvals.b@example.com', '', now(), '{}', '{"full_name":"Tutor B"}', now(), now()),
  ('a2000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ccchristabelle@gmail.com', '', now(), '{}', '{"full_name":"Admin"}', now(), now());
UPDATE profiles SET role = 'tutor' WHERE id IN ('a2000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000002');
INSERT INTO tm_tutors (id, profile_id, name) VALUES
  ('b2000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 'Tutor A'),
  ('b2000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000002', 'Tutor B');
INSERT INTO tm_students (id, name) VALUES ('c2000000-0000-0000-0000-000000000001', 'Student');
INSERT INTO tm_assignments (id, code, tutor_id, student_id, subject, status) VALUES
  ('d2000000-0000-0000-0000-000000000001', 'AA01', 'b2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 'English', 'active'),
  ('d2000000-0000-0000-0000-000000000002', 'AB01', 'b2000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000001', 'Math', 'active');
INSERT INTO tm_rate_tiers (id, assignment_id, label, parent_rate, tutor_rate, sort_order) VALUES
  ('e2000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000001', '1 to 1', 70, 50, 0),
  ('e2000000-0000-0000-0000-000000000002', 'd2000000-0000-0000-0000-000000000001', 'Group', 40, 30, 1),
  ('e2000000-0000-0000-0000-000000000003', 'd2000000-0000-0000-0000-000000000002', '1 to 1', 80, 60, 0);
-- Two drafts for A in the current month (both "1 to 1"), plus one old draft that is never submitted
INSERT INTO tm_timesheet_entries (id, assignment_id, tutor_id, date, hours, rate_tier_id, tier_label, parent_rate, tutor_rate, note) VALUES
  ('f2000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000001', date_trunc('month', current_date)::date, 1.5, 'e2000000-0000-0000-0000-000000000001', '1 to 1', 70, 50, 'first'),
  ('f2000000-0000-0000-0000-000000000002', 'd2000000-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000001', current_date, 2, 'e2000000-0000-0000-0000-000000000001', '1 to 1', 70, 50, NULL),
  ('f2000000-0000-0000-0000-000000000003', 'd2000000-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000001', '2000-01-15', 1, 'e2000000-0000-0000-0000-000000000001', '1 to 1', 70, 50, 'old draft');

-- Tutor A submits the current month
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims = '{"sub":"a2000000-0000-0000-0000-000000000001","role":"authenticated"}';
CREATE TEMP TABLE sub AS SELECT tm_submit_month('d2000000-0000-0000-0000-000000000001', EXTRACT(YEAR FROM current_date)::int, EXTRACT(MONTH FROM current_date)::int) AS id;

-- ---- Tutors cannot call any of the three ----
SELECT throws_ok($$ SELECT tm_edit_entry('f2000000-0000-0000-0000-000000000001', '{"date":"2026-01-01","hours":1,"rate_tier_id":"e2000000-0000-0000-0000-000000000001"}') $$,
  '42501', NULL, 'a tutor cannot edit through tm_edit_entry');
SELECT throws_ok($$ SELECT tm_approve_submission((SELECT id FROM sub)) $$, '42501', NULL, 'a tutor cannot approve');
SELECT throws_ok($$ SELECT tm_return_submission((SELECT id FROM sub), 'no') $$, '42501', NULL, 'a tutor cannot send back');

-- ---- Admin edits ----
SET LOCAL request.jwt.claims = '{"sub":"a2000000-0000-0000-0000-000000000009","role":"authenticated"}';
SELECT throws_ok($$ SELECT tm_edit_entry('f2000000-0000-0000-0000-000000000003', '{"date":"2000-01-15","hours":1,"rate_tier_id":"e2000000-0000-0000-0000-000000000001"}') $$,
  '22023', NULL, 'a draft entry cannot be edited here');
SELECT throws_ok($$ SELECT tm_edit_entry('00000000-0000-0000-0000-000000000000', '{"date":"2000-01-15","hours":1,"rate_tier_id":"e2000000-0000-0000-0000-000000000001"}') $$,
  'P0002', NULL, 'unknown entry');
SELECT throws_ok($$ SELECT tm_edit_entry('f2000000-0000-0000-0000-000000000001', '{"date":"2026-01-01","hours":1}') $$,
  '22023', NULL, 'a tier is required');
SELECT throws_ok($$ SELECT tm_edit_entry('f2000000-0000-0000-0000-000000000001', '{"date":"2026-01-01","hours":1,"rate_tier_id":"e2000000-0000-0000-0000-000000000003"}') $$,
  '23503', NULL, 'the tier must belong to the entry''s assignment');
SELECT throws_ok($$ SELECT tm_edit_entry('f2000000-0000-0000-0000-000000000001', '{"date":"2026-01-01","hours":0,"rate_tier_id":"e2000000-0000-0000-0000-000000000001"}') $$,
  '22023', NULL, 'hours must be positive');

-- An unchanged patch writes no audit row
SELECT lives_ok(format($q$ SELECT tm_edit_entry('f2000000-0000-0000-0000-000000000001', '{"date":"%s","hours":1.5,"rate_tier_id":"e2000000-0000-0000-0000-000000000001","note":"first"}') $q$, date_trunc('month', current_date)::date),
  'an unchanged patch is accepted');
SELECT is((SELECT count(*)::int FROM tm_entry_edits WHERE entry_id = 'f2000000-0000-0000-0000-000000000001'), 0, 'no audit row for an unchanged patch');

-- Changing the tier writes one audit row and re-snapshots the rates
SELECT lives_ok(format($q$ SELECT tm_edit_entry('f2000000-0000-0000-0000-000000000001', '{"date":"%s","hours":1.5,"rate_tier_id":"e2000000-0000-0000-0000-000000000002","note":"first"}') $q$, date_trunc('month', current_date)::date),
  'tier change accepted');
SELECT is((SELECT count(*)::int FROM tm_entry_edits WHERE entry_id = 'f2000000-0000-0000-0000-000000000001'), 1, 'one audit row after the tier change');
SELECT is((SELECT previous->>'tier_label' FROM tm_entry_edits WHERE entry_id = 'f2000000-0000-0000-0000-000000000001'), '1 to 1', 'audit row holds the previous tier label');
SELECT is((SELECT (previous->>'hours')::numeric FROM tm_entry_edits WHERE entry_id = 'f2000000-0000-0000-0000-000000000001'), 1.50::numeric, 'audit row holds the previous hours');
SELECT is((SELECT edited_by FROM tm_entry_edits WHERE entry_id = 'f2000000-0000-0000-0000-000000000001'), 'a2000000-0000-0000-0000-000000000009'::uuid, 'audit row records the admin');
SELECT is((SELECT tier_label FROM tm_timesheet_entries WHERE id = 'f2000000-0000-0000-0000-000000000001'), 'Group', 'entry took the new tier label');
SELECT is((SELECT parent_rate FROM tm_timesheet_entries WHERE id = 'f2000000-0000-0000-0000-000000000001'), 40::numeric, 'entry took the new parent rate');
SELECT is((SELECT tutor_rate FROM tm_timesheet_entries WHERE id = 'f2000000-0000-0000-0000-000000000001'), 30::numeric, 'entry took the new tutor rate');
SELECT is((SELECT status FROM tm_timesheet_entries WHERE id = 'f2000000-0000-0000-0000-000000000001'), 'submitted', 'status is untouched by an edit');

-- Times with null hours: the hours trigger recomputes
SELECT lives_ok(format($q$ SELECT tm_edit_entry('f2000000-0000-0000-0000-000000000002', '{"date":"%s","start_time":"14:00","end_time":"16:30","hours":null,"rate_tier_id":"e2000000-0000-0000-0000-000000000001","note":null}') $q$, current_date),
  'edit with times accepted');
SELECT is((SELECT hours FROM tm_timesheet_entries WHERE id = 'f2000000-0000-0000-0000-000000000002'), 2.50::numeric, 'hours recomputed from the new times');
SELECT is((SELECT count(*)::int FROM tm_entry_edits WHERE entry_id = 'f2000000-0000-0000-0000-000000000002'), 1, 'one audit row for the time change');

-- ---- Send back ----
SELECT throws_ok($$ SELECT tm_return_submission((SELECT id FROM sub), '   ') $$, '22023', NULL, 'a reason is required');
SELECT lives_ok($$ SELECT tm_return_submission((SELECT id FROM sub), '  Check the hours ') $$, 'send back accepted');
SELECT is((SELECT status FROM tm_submissions WHERE id = (SELECT id FROM sub)), 'returned', 'submission is returned');
SELECT is((SELECT return_reason FROM tm_submissions WHERE id = (SELECT id FROM sub)), 'Check the hours', 'reason is trimmed and stored');
SELECT isnt((SELECT reviewed_at FROM tm_submissions WHERE id = (SELECT id FROM sub)), NULL, 'reviewed_at is stamped on return');
SELECT is((SELECT count(*)::int FROM tm_timesheet_entries WHERE submission_id = (SELECT id FROM sub) AND status = 'returned'), 2, 'both entries are returned');
SELECT throws_ok($$ SELECT tm_return_submission((SELECT id FROM sub), 'again') $$, '22023', NULL, 'cannot send back twice');

-- ---- Tutor A fixes and resubmits ----
SET LOCAL request.jwt.claims = '{"sub":"a2000000-0000-0000-0000-000000000001","role":"authenticated"}';
UPDATE tm_timesheet_entries SET hours = 1 WHERE id = 'f2000000-0000-0000-0000-000000000001';
SELECT is((SELECT hours FROM tm_timesheet_entries_tutor_view WHERE id = 'f2000000-0000-0000-0000-000000000001'), 1.00::numeric, 'tutor can edit a returned entry');
CREATE TEMP TABLE sub2 AS SELECT tm_submit_month('d2000000-0000-0000-0000-000000000001', EXTRACT(YEAR FROM current_date)::int, EXTRACT(MONTH FROM current_date)::int) AS id;
SELECT is((SELECT count(*)::int FROM tm_timesheet_entries_tutor_view WHERE submission_id = (SELECT id FROM sub2) AND status = 'submitted'), 2, 'resubmission picks up both entries');

-- ---- Approve ----
SET LOCAL request.jwt.claims = '{"sub":"a2000000-0000-0000-0000-000000000009","role":"authenticated"}';
SELECT throws_ok($$ SELECT tm_approve_submission((SELECT id FROM sub)) $$, '22023', NULL, 'a returned submission cannot be approved');
SELECT throws_ok($$ SELECT tm_approve_submission('00000000-0000-0000-0000-000000000000') $$, 'P0002', NULL, 'unknown submission');
CREATE TEMP TABLE inv AS SELECT tm_approve_submission((SELECT id FROM sub2)) AS id;
SELECT matches((SELECT invoice_number FROM tm_invoices WHERE id = (SELECT id FROM inv)), '^TM-' || to_char(current_date, 'YYYYMM') || '-[0-9]{3}$', 'invoice numbered for the month');
SELECT is((SELECT source FROM tm_invoices WHERE id = (SELECT id FROM inv)), 'generated', 'invoice is generated');
-- e1: Group 1.0h (40/30); e2: 1 to 1 2.5h (70/50)
SELECT is((SELECT total_hours FROM tm_invoices WHERE id = (SELECT id FROM inv)), 3.50::numeric, 'total hours summed');
SELECT is((SELECT invoice_amount FROM tm_invoices WHERE id = (SELECT id FROM inv)), 215.00::numeric, 'invoice amount is 1.0x40 + 2.5x70');
SELECT is((SELECT tutor_payout FROM tm_invoices WHERE id = (SELECT id FROM inv)), 155.00::numeric, 'tutor payout is 1.0x30 + 2.5x50');
SELECT is((SELECT count(*)::int FROM tm_timesheet_entries WHERE submission_id = (SELECT id FROM sub2) AND status = 'approved' AND invoice_id = (SELECT id FROM inv)), 2, 'entries approved with the invoice id');
SELECT is((SELECT status FROM tm_submissions WHERE id = (SELECT id FROM sub2)), 'approved', 'submission approved');
SELECT is((SELECT invoice_id FROM tm_submissions WHERE id = (SELECT id FROM sub2)), (SELECT id FROM inv), 'submission points at the invoice');
SELECT throws_ok($$ SELECT tm_approve_submission((SELECT id FROM sub2)) $$, '22023', NULL, 'cannot approve twice');
SELECT throws_ok(format($q$ SELECT tm_edit_entry('f2000000-0000-0000-0000-000000000001', '{"date":"%s","hours":1,"rate_tier_id":"e2000000-0000-0000-0000-000000000002"}') $q$, date_trunc('month', current_date)::date),
  '22023', NULL, 'approved entries cannot be edited');

SELECT * FROM finish();
ROLLBACK;
```

The file has 43 assertions (3 tutor refusals, 5 edit refusals, 2 unchanged, 9 tier change, 3 times, 7 send back, 2 tutor fix, 12 approve). If pgTAP reports "planned 43 but ran N", you added or removed an assertion: set `plan(N)`.

- [ ] **Step 2: Run the test to see it fail**

```bash
npx supabase db reset && npm run db:test 2>&1 | grep -A 5 "tm_approvals"
```

Expected: failures on the first `throws_ok` because `tm_edit_entry` does not exist (the error is a `42883` undefined function, not `42501`).

- [ ] **Step 3: The migration**

Create `supabase/migrations/20260907100000_tm_approvals.sql`:

```sql
-- ============================================
-- EduOwl Tutor Matching - approvals
-- Admin-only functions: edit a submitted session (with audit row),
-- approve a submission (generates the invoice), send a submission back.
-- ============================================

-- Edit one submitted session. p_patch: {date, start_time, end_time, hours, rate_tier_id, note}.
-- Writes a tm_entry_edits row with the previous values first, in the same transaction.
CREATE OR REPLACE FUNCTION public.tm_edit_entry(p_entry_id UUID, p_patch JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry public.tm_timesheet_entries%ROWTYPE;
  v_tier public.tm_rate_tiers%ROWTYPE;
  v_date DATE;
  v_start TIME;
  v_end TIME;
  v_hours NUMERIC;
  v_effective NUMERIC;
  v_tier_id UUID;
  v_note TEXT;
  v_tier_changed BOOLEAN;
BEGIN
  IF public.app_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only admins can edit submitted sessions' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_entry FROM public.tm_timesheet_entries WHERE id = p_entry_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_entry.status <> 'submitted' THEN
    RAISE EXCEPTION 'Only sessions waiting for approval can be edited here' USING ERRCODE = '22023';
  END IF;

  v_date := (p_patch->>'date')::date;
  v_start := (p_patch->>'start_time')::time;
  v_end := (p_patch->>'end_time')::time;
  v_hours := ROUND((p_patch->>'hours')::numeric, 2);
  v_tier_id := (p_patch->>'rate_tier_id')::uuid;
  v_note := NULLIF(btrim(COALESCE(p_patch->>'note', '')), '');

  IF v_date IS NULL THEN
    RAISE EXCEPTION 'Enter the session date' USING ERRCODE = '22023';
  END IF;
  IF v_tier_id IS NULL THEN
    RAISE EXCEPTION 'Choose a rate tier' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_tier FROM public.tm_rate_tiers WHERE id = v_tier_id;
  IF NOT FOUND OR v_tier.assignment_id <> v_entry.assignment_id THEN
    RAISE EXCEPTION 'rate tier does not belong to this assignment' USING ERRCODE = '23503';
  END IF;

  -- Effective hours: typed hours, else derived from both times (same rule as tm_set_entry_hours).
  IF v_hours IS NULL AND v_start IS NOT NULL AND v_end IS NOT NULL THEN
    v_effective := ROUND(EXTRACT(EPOCH FROM (v_end - v_start)) / 3600.0, 2);
  ELSE
    v_effective := v_hours;
  END IF;
  IF v_effective IS NULL OR v_effective <= 0 THEN
    RAISE EXCEPTION 'Hours must be more than 0' USING ERRCODE = '22023';
  END IF;

  v_tier_changed := v_tier_id IS DISTINCT FROM v_entry.rate_tier_id;

  IF v_date = v_entry.date
     AND v_start IS NOT DISTINCT FROM v_entry.start_time
     AND v_end IS NOT DISTINCT FROM v_entry.end_time
     AND v_effective = v_entry.hours
     AND NOT v_tier_changed
     AND v_note IS NOT DISTINCT FROM v_entry.note THEN
    RETURN v_entry.id;
  END IF;

  INSERT INTO public.tm_entry_edits (entry_id, edited_by, previous)
  VALUES (
    v_entry.id,
    auth.uid(),
    jsonb_build_object(
      'date', v_entry.date,
      'start_time', v_entry.start_time,
      'end_time', v_entry.end_time,
      'hours', v_entry.hours,
      'tier_label', v_entry.tier_label,
      'note', v_entry.note
    )
  );

  -- hours is NULL when both times are given, so tm_set_entry_hours recomputes it.
  UPDATE public.tm_timesheet_entries SET
    date = v_date,
    start_time = v_start,
    end_time = v_end,
    hours = v_hours,
    rate_tier_id = v_tier_id,
    note = v_note,
    tier_label = CASE WHEN v_tier_changed THEN v_tier.label ELSE tier_label END,
    parent_rate = CASE WHEN v_tier_changed THEN v_tier.parent_rate ELSE parent_rate END,
    tutor_rate = CASE WHEN v_tier_changed THEN v_tier.tutor_rate ELSE tutor_rate END
  WHERE id = v_entry.id;

  RETURN v_entry.id;
END;
$$;

REVOKE ALL ON FUNCTION public.tm_edit_entry(UUID, JSONB) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.tm_edit_entry(UUID, JSONB) TO authenticated;

-- Approve a submission: generate its invoice and lock the entries. Returns the invoice id.
CREATE OR REPLACE FUNCTION public.tm_approve_submission(p_submission_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub public.tm_submissions%ROWTYPE;
  v_count INT;
  v_hours NUMERIC;
  v_amount NUMERIC;
  v_payout NUMERIC;
  v_invoice UUID;
BEGIN
  IF public.app_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only admins can approve submissions' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_sub FROM public.tm_submissions WHERE id = p_submission_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_sub.status <> 'submitted' THEN
    RAISE EXCEPTION 'This submission is not waiting for approval' USING ERRCODE = '22023';
  END IF;

  SELECT count(*), COALESCE(sum(hours), 0) INTO v_count, v_hours
  FROM public.tm_timesheet_entries
  WHERE submission_id = p_submission_id AND status = 'submitted';
  IF v_count = 0 THEN
    RAISE EXCEPTION 'No sessions to approve' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.tm_invoices
    WHERE assignment_id = v_sub.assignment_id AND year = v_sub.year AND month = v_sub.month AND source = 'generated'
  ) THEN
    RAISE EXCEPTION 'An invoice already exists for this month' USING ERRCODE = '22023';
  END IF;

  -- One line per (tier label, rate), each rounded to cents, then summed.
  SELECT COALESCE(sum(line), 0) INTO v_amount FROM (
    SELECT ROUND(sum(hours * parent_rate), 2) AS line
    FROM public.tm_timesheet_entries
    WHERE submission_id = p_submission_id AND status = 'submitted'
    GROUP BY tier_label, parent_rate
  ) lines;
  SELECT COALESCE(sum(line), 0) INTO v_payout FROM (
    SELECT ROUND(sum(hours * tutor_rate), 2) AS line
    FROM public.tm_timesheet_entries
    WHERE submission_id = p_submission_id AND status = 'submitted'
    GROUP BY tier_label, tutor_rate
  ) lines;

  INSERT INTO public.tm_invoices (assignment_id, year, month, source, total_hours, invoice_amount, tutor_payout)
  VALUES (v_sub.assignment_id, v_sub.year, v_sub.month, 'generated', v_hours, v_amount, v_payout)
  RETURNING id INTO v_invoice;

  UPDATE public.tm_timesheet_entries
     SET status = 'approved', invoice_id = v_invoice
   WHERE submission_id = p_submission_id AND status = 'submitted';

  UPDATE public.tm_submissions
     SET status = 'approved', reviewed_at = now(), invoice_id = v_invoice
   WHERE id = p_submission_id;

  RETURN v_invoice;
END;
$$;

REVOKE ALL ON FUNCTION public.tm_approve_submission(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.tm_approve_submission(UUID) TO authenticated;

-- Send a submission back to the tutor with a reason. Entries become editable again.
CREATE OR REPLACE FUNCTION public.tm_return_submission(p_submission_id UUID, p_reason TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub public.tm_submissions%ROWTYPE;
  v_reason TEXT;
BEGIN
  IF public.app_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only admins can send submissions back' USING ERRCODE = '42501';
  END IF;
  v_reason := NULLIF(btrim(COALESCE(p_reason, '')), '');
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'Give the tutor a reason' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_sub FROM public.tm_submissions WHERE id = p_submission_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_sub.status <> 'submitted' THEN
    RAISE EXCEPTION 'This submission is not waiting for approval' USING ERRCODE = '22023';
  END IF;

  -- submission_id is kept for history; tm_submit_month overwrites it on resubmission.
  UPDATE public.tm_timesheet_entries
     SET status = 'returned'
   WHERE submission_id = p_submission_id AND status = 'submitted';

  UPDATE public.tm_submissions
     SET status = 'returned', return_reason = v_reason, reviewed_at = now()
   WHERE id = p_submission_id;
END;
$$;

REVOKE ALL ON FUNCTION public.tm_return_submission(UUID, TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.tm_return_submission(UUID, TEXT) TO authenticated;
```

- [ ] **Step 4: Run the tests, fix the plan count, regenerate types**

```bash
npx supabase db reset && npm run db:test 2>&1 | tail -8
```

Expected: `tm_approvals.test.sql ... ok` and `Result: PASS`. Then:

```bash
npm run db:types && npx tsc --noEmit && git diff --stat src/lib/supabase/types.ts
npm run seed:test-users && npm run import:master-list
```

Expected: `types.ts` gains `tm_edit_entry`, `tm_approve_submission`, `tm_return_submission` under `Functions`; tsc clean.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260907100000_tm_approvals.sql supabase/tests/tm_approvals.test.sql src/lib/supabase/types.ts
git commit -m "feat(db): tm_edit_entry, tm_approve_submission, tm_return_submission

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01TkFUEBg6S7PqW49ZKa3C6p"
```

---

### Task 2: Approval helpers

**Files:**
- Create: `src/lib/tm/approvals.test.ts`
- Create: `src/lib/tm/approvals.ts`

**Interfaces:**
- Consumes: `SessionInput`, `SessionPayload` from `src/lib/portal/sessions.ts`; `toNumber` from `src/lib/tm/types.ts`.
- Produces (all exported from `src/lib/tm/approvals.ts`):
  - `interface EditPrevious { date?: string | null; start_time?: string | null; end_time?: string | null; hours?: number | string | null; tier_label?: string | null; note?: string | null }`
  - `interface EntryEdit { id: string; edited_at: string; previous: EditPrevious }`
  - `interface ApprovalEntry { id; assignment_id; date; start_time: string | null; end_time: string | null; hours: number; rate_tier_id: string | null; tier_label: string; parent_rate: number; tutor_rate: number; note: string | null; status: string; edits: EntryEdit[] }`
  - `interface QueueSubmission { id; assignment_id; code; subject; studentName; tutorName; year; month; submitted_at: string | null; entries: ApprovalEntry[] }`
  - `interface ReturnedSubmission { id; assignment_id; code; subject; studentName; tutorName; year; month; reviewed_at: string | null; return_reason: string | null }`
  - `interface Summary { sessions: number; hours: number; amount: number; payout: number; profit: number }`
  - `type EntryPatch = { date: string; start_time: string | null; end_time: string | null; hours: number | null; rate_tier_id: string; note: string | null }` (a type alias so it is assignable to the generated `Json` argument type)
  - `interface RawEntryRow`, `interface RawQueueRow`, `interface RawReturnedRow` (the PostgREST shapes), `mapEntryRow(row): ApprovalEntry`, `mapQueueRow(row): QueueSubmission`, `mapReturnedRow(row): ReturnedSubmission`
  - `summariseEntries(entries: ApprovalEntry[]): Summary`, `entryAmount(e): number`, `groupByTutor(subs): [string, QueueSubmission[]][]`, `outstandingReturns(returned, live: { assignment_id; year; month }[]): ReturnedSubmission[]`, `describeEdit(previous: EditPrevious): string[]`, `entryToSessionInput(e): SessionInput`, `patchFromPayload(p: SessionPayload): EntryPatch`, `sortEntries(entries): ApprovalEntry[]`

- [ ] **Step 1: Failing tests**

Create `src/lib/tm/approvals.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import {
  summariseEntries, entryAmount, groupByTutor, outstandingReturns, describeEdit, entryToSessionInput, patchFromPayload,
  sortEntries, mapQueueRow, mapReturnedRow, type ApprovalEntry, type QueueSubmission, type ReturnedSubmission,
} from "./approvals"

function entry(over: Partial<ApprovalEntry>): ApprovalEntry {
  return {
    id: "e", assignment_id: "a", date: "2026-09-04", start_time: null, end_time: null, hours: 1,
    rate_tier_id: "t", tier_label: "1 to 1", parent_rate: 70, tutor_rate: 50, note: null, status: "submitted", edits: [],
    ...over,
  }
}
function sub(over: Partial<QueueSubmission>): QueueSubmission {
  return { id: "s", assignment_id: "a", code: "AA01", subject: "English", studentName: "Sam", tutorName: "Tina", year: 2026, month: 9, submitted_at: "2026-09-05T00:00:00Z", entries: [], ...over }
}

describe("summariseEntries", () => {
  it("sums hours, amount, payout, and profit", () => {
    const s = summariseEntries([entry({ hours: 1.5 }), entry({ hours: 2, tier_label: "Group", parent_rate: 40, tutor_rate: 30 })])
    expect(s).toEqual({ sessions: 2, hours: 3.5, amount: 185, payout: 135, profit: 50 })
  })
  it("rounds per rate line, not per entry or per total", () => {
    // 0.5 x 10.01 = 5.005 per line -> 5.01 each -> 10.02 (total-first rounding would give 10.01)
    const s = summariseEntries([
      entry({ hours: 0.5, tier_label: "A", parent_rate: 10.01, tutor_rate: 10.01 }),
      entry({ hours: 0.5, tier_label: "B", parent_rate: 10.01, tutor_rate: 10.01 }),
    ])
    expect(s.amount).toBe(10.02)
    expect(s.payout).toBe(10.02)
    // Same label and rate: one line -> 1.0 x 10.01 = 10.01
    const one = summariseEntries([entry({ hours: 0.5, parent_rate: 10.01 }), entry({ hours: 0.5, parent_rate: 10.01 })])
    expect(one.amount).toBe(10.01)
  })
  it("is zero for no entries", () => {
    expect(summariseEntries([])).toEqual({ sessions: 0, hours: 0, amount: 0, payout: 0, profit: 0 })
  })
})

describe("entryAmount", () => {
  it("is hours times parent rate to cents", () => {
    expect(entryAmount(entry({ hours: 1.5, parent_rate: 70 }))).toBe(105)
    expect(entryAmount(entry({ hours: 0.5, parent_rate: 10.01 }))).toBe(5.01)
  })
})

describe("groupByTutor", () => {
  it("groups by tutor name in name order, submissions by submitted_at", () => {
    const groups = groupByTutor([
      sub({ id: "1", tutorName: "Zed", submitted_at: "2026-09-02T00:00:00Z" }),
      sub({ id: "2", tutorName: "Amy", submitted_at: "2026-09-03T00:00:00Z" }),
      sub({ id: "3", tutorName: "Zed", submitted_at: "2026-09-01T00:00:00Z" }),
    ])
    expect(groups.map(([name, list]) => [name, list.map((s) => s.id)])).toEqual([["Amy", ["2"]], ["Zed", ["3", "1"]]])
  })
})

describe("outstandingReturns", () => {
  const r = (id: string, month: number): ReturnedSubmission => ({
    id, assignment_id: "a", code: "AA01", subject: "English", studentName: "Sam", tutorName: "Tina", year: 2026, month, reviewed_at: null, return_reason: "x",
  })
  it("drops returned months that have a later live submission", () => {
    const out = outstandingReturns([r("aug", 8), r("sep", 9)], [{ assignment_id: "a", year: 2026, month: 9 }])
    expect(out.map((s) => s.id)).toEqual(["aug"])
  })
  it("ignores live rows for other assignments", () => {
    const out = outstandingReturns([r("sep", 9)], [{ assignment_id: "b", year: 2026, month: 9 }])
    expect(out.map((s) => s.id)).toEqual(["sep"])
  })
})

describe("describeEdit", () => {
  it("lists every previous value, with none for nulls", () => {
    expect(describeEdit({ date: "2026-09-04", start_time: "14:00:00", end_time: "15:30:00", hours: "1.50", tier_label: "1 to 1", note: null })).toEqual([
      "Date: 2026-09-04", "Time: 14:00 to 15:30", "Hours: 1.50", "Tier: 1 to 1", "Note: none",
    ])
    expect(describeEdit({ date: "2026-09-04", hours: 2, tier_label: "Group", note: "Revision" })).toEqual([
      "Date: 2026-09-04", "Time: none", "Hours: 2.00", "Tier: Group", "Note: Revision",
    ])
  })
})

describe("entryToSessionInput and patchFromPayload", () => {
  it("round-trips an entry through the form shapes", () => {
    const e = entry({ id: "e1", assignment_id: "a1", start_time: "14:00", end_time: "15:30", hours: 1.5, rate_tier_id: "t1", note: "Revision" })
    expect(entryToSessionInput(e)).toEqual({ assignmentId: "a1", date: "2026-09-04", start: "14:00", end: "15:30", hours: "1.5", rateTierId: "t1", note: "Revision" })
    expect(entryToSessionInput(entry({ rate_tier_id: null, note: null }))).toMatchObject({ rateTierId: "", note: "", start: "", end: "", hours: "1" })
    expect(patchFromPayload({ assignment_id: "a1", date: "2026-09-04", start_time: "14:00", end_time: "15:30", hours: null, rate_tier_id: "t1", note: "Revision" })).toEqual({
      date: "2026-09-04", start_time: "14:00", end_time: "15:30", hours: null, rate_tier_id: "t1", note: "Revision",
    })
  })
})

describe("sortEntries", () => {
  it("orders by date then start time, nulls last", () => {
    const list = [
      entry({ id: "c", date: "2026-09-05" }),
      entry({ id: "b", date: "2026-09-04", start_time: "16:00" }),
      entry({ id: "a", date: "2026-09-04", start_time: "09:00" }),
      entry({ id: "d", date: "2026-09-04" }),
    ]
    expect(sortEntries(list).map((e) => e.id)).toEqual(["a", "b", "d", "c"])
  })
})

describe("mappers", () => {
  it("maps a PostgREST queue row, coercing numerics and keeping only submitted entries", () => {
    const s = mapQueueRow({
      id: "s1", assignment_id: "a1", year: 2026, month: 9, submitted_at: "2026-09-05T00:00:00Z",
      tm_assignments: { code: "AA01", subject: "English", tm_students: { name: "Sam" } },
      tm_tutors: { name: "Tina" },
      tm_timesheet_entries: [
        { id: "e1", assignment_id: "a1", date: "2026-09-04", start_time: "14:00:00", end_time: "15:30:00", hours: "1.50", rate_tier_id: "t1", tier_label: "1 to 1", parent_rate: "70.00", tutor_rate: "50.00", note: null, status: "submitted",
          tm_entry_edits: [{ id: "x1", edited_at: "2026-09-06T00:00:00Z", previous: { hours: 1 } }] },
        { id: "e0", assignment_id: "a1", date: "2026-08-04", start_time: null, end_time: null, hours: "1.00", rate_tier_id: "t1", tier_label: "1 to 1", parent_rate: "70.00", tutor_rate: "50.00", note: null, status: "returned", tm_entry_edits: [] },
      ],
    })
    expect(s).toMatchObject({ code: "AA01", subject: "English", studentName: "Sam", tutorName: "Tina" })
    expect(s.entries).toHaveLength(1)
    expect(s.entries[0]).toMatchObject({ id: "e1", start_time: "14:00", end_time: "15:30", hours: 1.5, parent_rate: 70, tutor_rate: 50 })
    expect(s.entries[0].edits[0]).toEqual({ id: "x1", edited_at: "2026-09-06T00:00:00Z", previous: { hours: 1 } })
  })
  it("maps a returned row and tolerates missing embeds", () => {
    expect(mapReturnedRow({ id: "s2", assignment_id: "a1", year: 2026, month: 8, reviewed_at: null, return_reason: "Check", tm_assignments: null, tm_tutors: null })).toEqual({
      id: "s2", assignment_id: "a1", code: "", subject: "", studentName: "", tutorName: "", year: 2026, month: 8, reviewed_at: null, return_reason: "Check",
    })
  })
})
```

- [ ] **Step 2: Run to see them fail**

```bash
npx vitest run src/lib/tm/approvals.test.ts
```

Expected: FAIL, cannot resolve `./approvals`.

- [ ] **Step 3: Implementation**

Create `src/lib/tm/approvals.ts`:

```ts
import type { SessionInput, SessionPayload } from "@/lib/portal/sessions"
import { toNumber } from "@/lib/tm/types"

export interface EditPrevious {
  date?: string | null
  start_time?: string | null
  end_time?: string | null
  hours?: number | string | null
  tier_label?: string | null
  note?: string | null
}

export interface EntryEdit {
  id: string
  edited_at: string
  previous: EditPrevious
}

export interface ApprovalEntry {
  id: string
  assignment_id: string
  date: string
  start_time: string | null
  end_time: string | null
  hours: number
  rate_tier_id: string | null
  tier_label: string
  parent_rate: number
  tutor_rate: number
  note: string | null
  status: string
  edits: EntryEdit[]
}

export interface QueueSubmission {
  id: string
  assignment_id: string
  code: string
  subject: string
  studentName: string
  tutorName: string
  year: number
  month: number
  submitted_at: string | null
  entries: ApprovalEntry[]
}

export interface ReturnedSubmission {
  id: string
  assignment_id: string
  code: string
  subject: string
  studentName: string
  tutorName: string
  year: number
  month: number
  reviewed_at: string | null
  return_reason: string | null
}

export interface Summary {
  sessions: number
  hours: number
  amount: number
  payout: number
  profit: number
}

// A type alias, not an interface: it must be assignable to the generated `Json` type of the p_patch argument.
export type EntryPatch = {
  date: string
  start_time: string | null
  end_time: string | null
  hours: number | null
  rate_tier_id: string
  note: string | null
}

// ---- PostgREST shapes ----

interface RawEmbeds {
  tm_assignments: { code: string; subject: string; tm_students: { name: string } | null } | null
  tm_tutors: { name: string } | null
}

export interface RawEntryRow {
  id: string
  assignment_id: string
  date: string
  start_time: string | null
  end_time: string | null
  hours: string | number | null
  rate_tier_id: string | null
  tier_label: string | null
  parent_rate: string | number | null
  tutor_rate: string | number | null
  note: string | null
  status: string
  tm_entry_edits: { id: string; edited_at: string; previous: unknown }[] | null
}

export interface RawQueueRow extends RawEmbeds {
  id: string
  assignment_id: string
  year: number
  month: number
  submitted_at: string | null
  tm_timesheet_entries: RawEntryRow[] | null
}

export interface RawReturnedRow extends RawEmbeds {
  id: string
  assignment_id: string
  year: number
  month: number
  reviewed_at: string | null
  return_reason: string | null
}

function hhmm(t: string | null): string | null {
  return t ? t.slice(0, 5) : null
}

function names(row: RawEmbeds) {
  return {
    code: row.tm_assignments?.code ?? "",
    subject: row.tm_assignments?.subject ?? "",
    studentName: row.tm_assignments?.tm_students?.name ?? "",
    tutorName: row.tm_tutors?.name ?? "",
  }
}

export function mapEntryRow(r: RawEntryRow): ApprovalEntry {
  return {
    id: r.id,
    assignment_id: r.assignment_id,
    date: r.date,
    start_time: hhmm(r.start_time),
    end_time: hhmm(r.end_time),
    hours: toNumber(r.hours) ?? 0,
    rate_tier_id: r.rate_tier_id,
    tier_label: r.tier_label ?? "",
    parent_rate: toNumber(r.parent_rate) ?? 0,
    tutor_rate: toNumber(r.tutor_rate) ?? 0,
    note: r.note,
    status: r.status,
    edits: (r.tm_entry_edits ?? []).map((e) => ({ id: e.id, edited_at: e.edited_at, previous: (e.previous ?? {}) as EditPrevious })),
  }
}

/** Only entries still `submitted` belong to the live submission; older returned ones may still point at it. */
export function mapQueueRow(row: RawQueueRow): QueueSubmission {
  return {
    id: row.id,
    assignment_id: row.assignment_id,
    ...names(row),
    year: row.year,
    month: row.month,
    submitted_at: row.submitted_at,
    entries: sortEntries((row.tm_timesheet_entries ?? []).filter((e) => e.status === "submitted").map(mapEntryRow)),
  }
}

export function mapReturnedRow(row: RawReturnedRow): ReturnedSubmission {
  return {
    id: row.id,
    assignment_id: row.assignment_id,
    ...names(row),
    year: row.year,
    month: row.month,
    reviewed_at: row.reviewed_at,
    return_reason: row.return_reason,
  }
}

// ---- Money, in integer hundredths so 2dp x 2dp products are exact and match Postgres ROUND(.., 2) ----

function cents(n: number): number {
  return Math.round(n * 100)
}

/** Sum of hours x rate over the entries, as a cent count, rounded once (half away from zero). */
function lineCents(entries: ApprovalEntry[], rate: (e: ApprovalEntry) => number): number {
  const tenThousandths = entries.reduce((s, e) => s + cents(e.hours) * cents(rate(e)), 0)
  return Math.round(tenThousandths / 100)
}

function sumLines(entries: ApprovalEntry[], rate: (e: ApprovalEntry) => number): number {
  const lines = new Map<string, ApprovalEntry[]>()
  for (const e of entries) {
    const key = `${e.tier_label}|${rate(e)}`
    const list = lines.get(key) ?? []
    list.push(e)
    lines.set(key, list)
  }
  let total = 0
  for (const list of lines.values()) total += lineCents(list, rate)
  return total / 100
}

export function entryAmount(e: ApprovalEntry): number {
  return lineCents([e], (x) => x.parent_rate) / 100
}

export function summariseEntries(entries: ApprovalEntry[]): Summary {
  const hours = entries.reduce((s, e) => s + cents(e.hours), 0) / 100
  const amount = sumLines(entries, (e) => e.parent_rate)
  const payout = sumLines(entries, (e) => e.tutor_rate)
  return { sessions: entries.length, hours, amount, payout, profit: (cents(amount) - cents(payout)) / 100 }
}

// ---- Grouping and filtering ----

export function groupByTutor(subs: QueueSubmission[]): [string, QueueSubmission[]][] {
  const groups = new Map<string, QueueSubmission[]>()
  for (const s of subs) {
    const list = groups.get(s.tutorName) ?? []
    list.push(s)
    groups.set(s.tutorName, list)
  }
  const bySubmitted = (a: QueueSubmission, b: QueueSubmission) => (a.submitted_at ?? "").localeCompare(b.submitted_at ?? "")
  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, list]) => [name, [...list].sort(bySubmitted)])
}

export function outstandingReturns(
  returned: ReturnedSubmission[],
  live: { assignment_id: string; year: number; month: number }[],
): ReturnedSubmission[] {
  const keys = new Set(live.map((l) => `${l.assignment_id}|${l.year}|${l.month}`))
  return returned.filter((r) => !keys.has(`${r.assignment_id}|${r.year}|${r.month}`))
}

export function sortEntries(entries: ApprovalEntry[]): ApprovalEntry[] {
  return [...entries].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    if (a.start_time === b.start_time) return 0
    if (a.start_time === null) return 1
    if (b.start_time === null) return -1
    return a.start_time.localeCompare(b.start_time)
  })
}

// ---- Edit trail and form shapes ----

export function describeEdit(previous: EditPrevious): string[] {
  const start = hhmm(previous.start_time ?? null)
  const end = hhmm(previous.end_time ?? null)
  const hours = toNumber(previous.hours ?? null)
  return [
    `Date: ${previous.date ?? "none"}`,
    `Time: ${start && end ? `${start} to ${end}` : "none"}`,
    `Hours: ${hours === null ? "none" : hours.toFixed(2)}`,
    `Tier: ${previous.tier_label || "none"}`,
    `Note: ${previous.note || "none"}`,
  ]
}

export function entryToSessionInput(e: ApprovalEntry): SessionInput {
  return {
    assignmentId: e.assignment_id,
    date: e.date,
    start: e.start_time ?? "",
    end: e.end_time ?? "",
    hours: String(e.hours),
    rateTierId: e.rate_tier_id ?? "",
    note: e.note ?? "",
  }
}

export function patchFromPayload(p: SessionPayload): EntryPatch {
  return { date: p.date, start_time: p.start_time, end_time: p.end_time, hours: p.hours, rate_tier_id: p.rate_tier_id, note: p.note }
}
```

- [ ] **Step 4: Run the tests**

```bash
npx vitest run src/lib/tm/approvals.test.ts && npx tsc --noEmit
```

Expected: all pass, tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tm/approvals.ts src/lib/tm/approvals.test.ts
git commit -m "feat(tm): approval helpers (summing, grouping, edit trail, mappers)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01TkFUEBg6S7PqW49ZKa3C6p"
```

---

### Task 3: Navigation

**Files:**
- Modify: `src/lib/workspace.test.ts` (the "lists the tutor matching admin screens in order" test)
- Modify: `src/lib/workspace.ts` (`NAV_ITEMS.tm`)
- Modify: `src/components/layout/sidebar.tsx` (`ICONS`)

**Interfaces:**
- Produces: nav item `{ label: "Pending Approvals", href: "/tm/approvals" }` second in `NAV_ITEMS.tm`. The header derives the page title from it, so the page needs no heading of its own.

- [ ] **Step 1: Failing nav test**

In `src/lib/workspace.test.ts`, replace the expected array in "lists the tutor matching admin screens in order" with:

```ts
    expect(NAV_ITEMS.tm.map((i) => [i.label, i.href])).toEqual([
      ["Dashboard", "/tm"],
      ["Pending Approvals", "/tm/approvals"],
      ["Tutors", "/tm/tutors"],
      ["Students & Assignments", "/tm/students"],
      ["Master List", "/tm/master-list"],
      ["Settings", "/tm/settings"],
    ])
```

Run `npx vitest run src/lib/workspace.test.ts`. Expected: FAIL on that test.

- [ ] **Step 2: Add the item and icon**

In `src/lib/workspace.ts`, `NAV_ITEMS.tm` becomes:

```ts
  tm: [
    { label: "Dashboard", href: "/tm" },
    { label: "Pending Approvals", href: "/tm/approvals" },
    { label: "Tutors", href: "/tm/tutors" },
    { label: "Students & Assignments", href: "/tm/students" },
    { label: "Master List", href: "/tm/master-list" },
    { label: "Settings", href: "/tm/settings" },
  ],
```

In `src/components/layout/sidebar.tsx`, add to `ICONS` (ClipboardCheck is already imported):

```ts
  "Pending Approvals": ClipboardCheck,
```

- [ ] **Step 3: Verify and commit**

```bash
npx vitest run src/lib/workspace.test.ts && npx tsc --noEmit
git add src/lib/workspace.ts src/lib/workspace.test.ts src/components/layout/sidebar.tsx
git commit -m "feat(tm): Pending Approvals nav item

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01TkFUEBg6S7PqW49ZKa3C6p"
```

---

### Task 4: Queue page and returned section

**Files:**
- Create: `src/components/tm/approval-queue.tsx`
- Create: `src/app/(dashboard)/tm/approvals/page.tsx`

**Interfaces:**
- Consumes: Task 2 helpers and types; `periodLabel` from `src/lib/tm/periods.ts`; `formatCurrency` from `src/lib/format.ts`; `formatHours` from `src/lib/portal/timesheet.ts`.
- Produces: `ApprovalQueue({ queue, returned, onReview })`; the page holds `queue: QueueSubmission[]` and `returned: ReturnedSubmission[]` state, exposes `load()` to reload both, and renders `SubmissionReview` (Task 5) when `?submission=` is present. Until Task 5 exists, the page renders a placeholder for the review branch; Task 5 replaces it.

- [ ] **Step 1: The queue component**

Create `src/components/tm/approval-queue.tsx`:

```tsx
"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatCurrency } from "@/lib/format"
import { periodLabel } from "@/lib/tm/periods"
import { formatHours } from "@/lib/portal/timesheet"
import { groupByTutor, summariseEntries, type QueueSubmission, type ReturnedSubmission } from "@/lib/tm/approvals"

interface Props {
  queue: QueueSubmission[]
  returned: ReturnedSubmission[]
  onReview: (id: string) => void
}

function shortDate(iso: string | null): string {
  return iso ? iso.slice(0, 10) : ""
}

export function ApprovalQueue({ queue, returned, onReview }: Props) {
  const groups = groupByTutor(queue)

  return (
    <div className="space-y-6">
      {groups.length === 0 && (
        <Card><CardContent className="py-6 text-sm text-muted-foreground">Nothing is waiting for approval.</CardContent></Card>
      )}

      {groups.map(([tutorName, subs]) => (
        <Card key={tutorName}>
          <CardHeader><CardTitle className="text-base">{tutorName}</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Sessions</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                  <TableHead className="text-right">Invoice</TableHead>
                  <TableHead className="text-right">Payout</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {subs.map((s) => {
                  const t = summariseEntries(s.entries)
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.code}</TableCell>
                      <TableCell>{s.studentName}</TableCell>
                      <TableCell>{s.subject}</TableCell>
                      <TableCell>{periodLabel({ year: s.year, month: s.month })}</TableCell>
                      <TableCell className="text-right">{t.sessions}</TableCell>
                      <TableCell className="text-right">{formatHours(t.hours)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(t.amount)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(t.payout)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(t.profit)}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" aria-label={`Review ${s.code} ${periodLabel({ year: s.year, month: s.month })}`} onClick={() => onReview(s.id)}>Review</Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      {returned.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Returned, awaiting resubmission</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tutor</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Month</TableHead>
                  <TableHead>Returned</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {returned.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.tutorName}</TableCell>
                    <TableCell>{r.studentName}</TableCell>
                    <TableCell className="font-medium">{r.code}</TableCell>
                    <TableCell>{periodLabel({ year: r.year, month: r.month })}</TableCell>
                    <TableCell>{shortDate(r.reviewed_at)}</TableCell>
                    <TableCell className="max-w-md whitespace-pre-wrap">{r.return_reason}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
```

- [ ] **Step 2: The page**

Create `src/app/(dashboard)/tm/approvals/page.tsx`:

```tsx
"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { ApprovalQueue } from "@/components/tm/approval-queue"
import {
  mapQueueRow, mapReturnedRow, outstandingReturns,
  type QueueSubmission, type RawQueueRow, type RawReturnedRow, type ReturnedSubmission,
} from "@/lib/tm/approvals"

const QUEUE_SELECT =
  "id, assignment_id, year, month, submitted_at, " +
  "tm_assignments(code, subject, tm_students(name)), tm_tutors(name), " +
  "tm_timesheet_entries!submission_id(id, assignment_id, date, start_time, end_time, hours, rate_tier_id, tier_label, parent_rate, tutor_rate, note, status, tm_entry_edits(id, edited_at, previous))"

const RETURNED_SELECT =
  "id, assignment_id, year, month, reviewed_at, return_reason, tm_assignments(code, subject, tm_students(name)), tm_tutors(name)"

function Approvals() {
  const params = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()
  const [queue, setQueue] = useState<QueueSubmission[]>([])
  const [returned, setReturned] = useState<ReturnedSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const selectedId = params.get("submission")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const [queueRes, returnedRes] = await Promise.all([
      supabase.from("tm_submissions").select(QUEUE_SELECT).eq("status", "submitted").order("submitted_at"),
      supabase.from("tm_submissions").select(RETURNED_SELECT).eq("status", "returned").order("reviewed_at", { ascending: false }),
    ])
    if (queueRes.error || returnedRes.error) {
      const message = queueRes.error?.message ?? returnedRes.error?.message ?? "Could not load approvals"
      setError(message)
      toast({ title: "Could not load approvals", description: message, variant: "destructive" })
      setLoading(false)
      return
    }
    const queueRows = (queueRes.data as unknown as RawQueueRow[]).map(mapQueueRow)
    const returnedRows = (returnedRes.data as unknown as RawReturnedRow[]).map(mapReturnedRow)

    let live: { assignment_id: string; year: number; month: number }[] = []
    const assignmentIds = Array.from(new Set(returnedRows.map((r) => r.assignment_id)))
    if (assignmentIds.length > 0) {
      const { data } = await supabase
        .from("tm_submissions")
        .select("assignment_id, year, month")
        .neq("status", "returned")
        .in("assignment_id", assignmentIds)
      live = data ?? []
    }
    setQueue(queueRows)
    setReturned(outstandingReturns(returnedRows, live))
    setLoading(false)
  }, [toast])

  useEffect(() => { load() }, [load])

  if (loading) return <Skeleton className="h-96 w-full" />
  if (error) return <Card><CardContent className="py-6 text-sm text-destructive">{error}</CardContent></Card>

  if (selectedId) {
    const submission = queue.find((s) => s.id === selectedId)
    if (!submission) {
      return (
        <Card>
          <CardContent className="py-6 space-y-2 text-sm">
            <p>This submission is no longer waiting for approval</p>
            <Link href="/tm/approvals" className="text-primary underline">Back to queue</Link>
          </CardContent>
        </Card>
      )
    }
    // Task 5 replaces this with <SubmissionReview submission={submission} onChanged={load} onDone={() => router.push("/tm/approvals")} />
    return <Card><CardContent className="py-6 text-sm">{submission.code}</CardContent></Card>
  }

  return <ApprovalQueue queue={queue} returned={returned} onReview={(id) => router.push(`/tm/approvals?submission=${id}`)} />
}

export default function ApprovalsPage() {
  return (
    <Suspense>
      <Approvals />
    </Suspense>
  )
}
```

The single `as unknown as` cast on each response is deliberate: the generated types for a nested embed with a foreign-key hint are wide, and `RawQueueRow` documents the shape the mapper expects. Keep the cast next to the mapper call and nowhere else.

- [ ] **Step 3: Verify in the browser**

```bash
npx tsc --noEmit
```

Then with `npm run dev` running, sign in as an admin and open `http://localhost:3000/tm/approvals`. With no submitted months, the page shows "Nothing is waiting for approval." and the sidebar highlights "Pending Approvals". To see a row, in the tutor portal (signed in as the seeded tutor) log a session and submit the month, then reload the admin page: one card under "E2E Tutor" with hours and money; Review navigates to `?submission=<id>` and shows the code placeholder. Send it back from psql to see the returned section:

```bash
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "update tm_timesheet_entries set status='returned' where status='submitted'; update tm_submissions set status='returned', return_reason='Manual check', reviewed_at=now() where status='submitted';"
```

Expected: the card "Returned, awaiting resubmission" lists the month with reason "Manual check". Resubmit from the portal and it disappears from that card and reappears in the queue.

- [ ] **Step 4: Commit**

```bash
git add src/components/tm/approval-queue.tsx "src/app/(dashboard)/tm/approvals/page.tsx"
git commit -m "feat(tm): Pending Approvals queue and returned section

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01TkFUEBg6S7PqW49ZKa3C6p"
```

---

### Task 5: Submission review with edit, send back, and approve

**Files:**
- Create: `src/components/tm/entry-edits-popover.tsx`
- Create: `src/components/tm/submission-review.tsx`
- Modify: `src/app/(dashboard)/tm/approvals/page.tsx` (replace the Task 4 placeholder)

**Interfaces:**
- Consumes: Task 2 helpers; `SessionForm` from `src/components/portal/session-form.tsx` (props `assignments: PortalAssignment[]`, `initial`, `lockAssignment`, `onSubmit(payload)`, `onCancel`, `submitLabel`, `isLoading`); `PortalAssignment` and `PortalTier` from `src/components/portal/use-portal-context.ts`; RPCs `tm_edit_entry`, `tm_return_submission`, `tm_approve_submission`.
- Produces: `EntryEditsBadge({ edits })`; `SubmissionReview({ submission, onChanged, onDone })` where `onChanged` reloads the page data after an edit and `onDone` navigates back to the queue after send back or approve (the page reloads on the next mount via its own effect, so call `onChanged()` then `onDone()`).

- [ ] **Step 1: The edits badge**

Create `src/components/tm/entry-edits-popover.tsx`:

```tsx
"use client"

import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { describeEdit, type EntryEdit } from "@/lib/tm/approvals"

function when(iso: string): string {
  return iso.replace("T", " ").slice(0, 16)
}

export function EntryEditsBadge({ edits }: { edits: EntryEdit[] }) {
  if (edits.length === 0) return null
  const newestFirst = [...edits].sort((a, b) => b.edited_at.localeCompare(a.edited_at))
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label={`Show ${edits.length} previous ${edits.length === 1 ? "version" : "versions"}`}>
          <Badge variant="secondary">Edited</Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3 text-sm">
        {newestFirst.map((e) => (
          <div key={e.id} className="space-y-1">
            <p className="text-xs text-muted-foreground">Before the edit at {when(e.edited_at)}</p>
            <ul className="space-y-0.5">
              {describeEdit(e.previous).map((line) => <li key={line}>{line}</li>)}
            </ul>
          </div>
        ))}
      </PopoverContent>
    </Popover>
  )
}
```

- [ ] **Step 2: The review panel**

Create `src/components/tm/submission-review.tsx`:

```tsx
"use client"

import { useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { Pencil } from "lucide-react"
import { formatCurrency } from "@/lib/format"
import { toNumber } from "@/lib/tm/types"
import { periodLabel } from "@/lib/tm/periods"
import { formatHours } from "@/lib/portal/timesheet"
import type { SessionPayload } from "@/lib/portal/sessions"
import { SessionForm } from "@/components/portal/session-form"
import type { PortalAssignment } from "@/components/portal/use-portal-context"
import {
  entryAmount, entryToSessionInput, patchFromPayload, summariseEntries, type ApprovalEntry, type QueueSubmission,
} from "@/lib/tm/approvals"
import { EntryEditsBadge } from "./entry-edits-popover"

interface Props {
  submission: QueueSubmission
  onChanged: () => void
  onDone: () => void
}

export function SubmissionReview({ submission, onChanged, onDone }: Props) {
  const { toast } = useToast()
  const [editing, setEditing] = useState<ApprovalEntry | null>(null)
  const [formAssignment, setFormAssignment] = useState<PortalAssignment | null>(null)
  const [returning, setReturning] = useState(false)
  const [reason, setReason] = useState("")
  const [approving, setApproving] = useState(false)
  const [busy, setBusy] = useState(false)

  const month = periodLabel({ year: submission.year, month: submission.month })
  const totals = summariseEntries(submission.entries)

  async function openEdit(entry: ApprovalEntry) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("tm_rate_tiers")
      .select("id, assignment_id, label, tutor_rate, sort_order")
      .eq("assignment_id", submission.assignment_id)
      .order("sort_order")
    if (error) {
      toast({ title: "Could not load rate tiers", description: error.message, variant: "destructive" })
      return
    }
    setFormAssignment({
      id: submission.assignment_id,
      code: submission.code,
      subject: submission.subject,
      timeslot: null,
      studentName: submission.studentName,
      tiers: (data ?? []).map((t) => ({ id: t.id, assignment_id: t.assignment_id, label: t.label, tutor_rate: toNumber(t.tutor_rate) ?? 0, sort_order: t.sort_order ?? 0 })),
    })
    setEditing(entry)
  }

  async function handleEdit(payload: SessionPayload) {
    if (!editing) return
    setBusy(true)
    const supabase = createClient()
    const { error } = await supabase.rpc("tm_edit_entry", { p_entry_id: editing.id, p_patch: patchFromPayload(payload) })
    setBusy(false)
    if (error) {
      toast({ title: "Could not update the session", description: error.message, variant: "destructive" })
      return
    }
    setEditing(null)
    toast({ title: "Session updated" })
    onChanged()
  }

  async function handleReturn() {
    setBusy(true)
    const supabase = createClient()
    const { error } = await supabase.rpc("tm_return_submission", { p_submission_id: submission.id, p_reason: reason })
    setBusy(false)
    if (error) {
      toast({ title: "Could not send back", description: error.message, variant: "destructive" })
      return
    }
    setReturning(false)
    toast({ title: `Sent back to ${submission.tutorName}` })
    onChanged()
    onDone()
  }

  async function handleApprove() {
    setBusy(true)
    const supabase = createClient()
    const { data: invoiceId, error } = await supabase.rpc("tm_approve_submission", { p_submission_id: submission.id })
    if (error || !invoiceId) {
      setBusy(false)
      toast({ title: "Could not approve", description: error?.message ?? "No invoice was returned", variant: "destructive" })
      return
    }
    const { data: invoice } = await supabase.from("tm_invoices").select("invoice_number").eq("id", invoiceId).maybeSingle()
    setBusy(false)
    setApproving(false)
    toast({ title: "Approved", description: invoice?.invoice_number ? `Invoice ${invoice.invoice_number} created.` : "Invoice created." })
    onChanged()
    onDone()
  }

  return (
    <div className="space-y-4">
      <Link href="/tm/approvals" className="text-sm text-primary underline">Back to queue</Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{submission.studentName} · {submission.subject} · {month}</CardTitle>
          <CardDescription>
            {submission.tutorName} · {submission.code}
            {submission.submitted_at ? ` · submitted ${submission.submitted_at.slice(0, 10)}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead className="text-right">Parent rate</TableHead>
                  <TableHead className="text-right">Tutor rate</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {submission.entries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{e.date}</TableCell>
                    <TableCell>{e.start_time && e.end_time ? `${e.start_time} to ${e.end_time}` : ""}</TableCell>
                    <TableCell className="text-right">{formatHours(e.hours)}</TableCell>
                    <TableCell>{e.tier_label}</TableCell>
                    <TableCell className="text-right">{formatCurrency(e.parent_rate)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(e.tutor_rate)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(entryAmount(e))}</TableCell>
                    <TableCell className="max-w-xs">
                      <div className="flex items-center gap-2">
                        <EntryEditsBadge edits={e.edits} />
                        <span className="truncate">{e.note}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" aria-label={`Edit session on ${e.date}`} onClick={() => openEdit(e)}><Pencil className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <p className="text-sm font-medium" data-testid="review-totals">
            {totals.sessions} sessions · {formatHours(totals.hours)} h · Invoice {formatCurrency(totals.amount)} · Payout {formatCurrency(totals.payout)} · Profit {formatCurrency(totals.profit)}
          </p>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setReason(""); setReturning(true) }}>Send back</Button>
            <Button onClick={() => setApproving(true)}>Approve</Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit session</DialogTitle>
            <DialogDescription>The previous values are kept in the edit history.</DialogDescription>
          </DialogHeader>
          {editing && formAssignment && (
            <SessionForm
              key={editing.id}
              assignments={[formAssignment]}
              initial={entryToSessionInput(editing)}
              lockAssignment
              onSubmit={handleEdit}
              onCancel={() => setEditing(null)}
              submitLabel="Save changes"
              isLoading={busy}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={returning} onOpenChange={(o) => !o && setReturning(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send back to {submission.tutorName}</DialogTitle>
            <DialogDescription>The tutor sees this reason in their timesheet and can edit and resubmit the month.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="return-reason">Reason</Label>
            <Textarea id="return-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} required />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturning(false)} disabled={busy}>Cancel</Button>
            <Button onClick={handleReturn} disabled={busy || reason.trim() === ""}>Send back</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={approving} onOpenChange={(o) => !o && setApproving(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve {submission.studentName}, {month}</DialogTitle>
            <DialogDescription>
              {totals.sessions} sessions, {formatHours(totals.hours)} hours. Invoice {formatCurrency(totals.amount)}, tutor payout {formatCurrency(totals.payout)}, profit {formatCurrency(totals.profit)}. An invoice is created and the month is locked.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproving(false)} disabled={busy}>Cancel</Button>
            <Button onClick={handleApprove} disabled={busy}>{busy ? "Approving..." : "Approve"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

Note: the `SessionForm` tier select shows the tutor rate, which is fine for an admin. The form's `date` input has `max={today}`, matching the table constraint.

- [ ] **Step 3: Wire the page**

In `src/app/(dashboard)/tm/approvals/page.tsx`, add the import:

```tsx
import { SubmissionReview } from "@/components/tm/submission-review"
```

and replace the placeholder line and its comment inside `if (selectedId) { ... }` with:

```tsx
    return <SubmissionReview submission={submission} onChanged={load} onDone={() => router.push("/tm/approvals")} />
```

- [ ] **Step 4: Verify in the browser**

```bash
npx tsc --noEmit
```

With a submitted month from the seeded tutor (log and submit in the portal), as admin open the queue, click Review:

- The table shows each session with amount = hours x parent rate; totals line matches the queue row.
- Edit a session: change "Or hours", Save changes, toast "Session updated", the row updates, and an "Edited" badge appears; clicking it lists the previous hours.
- Send back with a blank reason: the button is disabled. With a reason: toast "Sent back to E2E Tutor", back on the queue, the month is under "Returned, awaiting resubmission". In the portal the timesheet shows "Returned: {reason}" and Resubmit works.
- Approve: the confirm dialog shows the totals; Approve gives toast "Approved" with "Invoice TM-...-NNN created.", back on the empty queue.

- [ ] **Step 5: Commit**

```bash
git add src/components/tm/entry-edits-popover.tsx src/components/tm/submission-review.tsx "src/app/(dashboard)/tm/approvals/page.tsx"
git commit -m "feat(tm): submission review with edit trail, send back, and approve

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01TkFUEBg6S7PqW49ZKa3C6p"
```

---

### Task 6: End-to-end flow and final verification

**Files:**
- Modify: `e2e/helpers/admin.ts` (`deleteAssignmentData`, new `createSubmittedMonth`)
- Create: `e2e/tm-approvals.spec.ts`

**Interfaces:**
- Consumes: `signIn`, `users` from `e2e/helpers/auth.ts`; `createAssignmentForTutor`, `deleteAssignmentData` from `e2e/helpers/admin.ts`.
- Produces: `createSubmittedMonth(tutorName, studentName, code)` returning `{ tutorId, studentId, assignmentId, submissionId }`; `findGeneratedInvoice(assignmentId)` returning the invoice row or null.

- [ ] **Step 1: Fixture helpers**

In `e2e/helpers/admin.ts`, replace `deleteAssignmentData` with this version (invoices first, since both `invoice_id` foreign keys are `ON DELETE SET NULL`; edits cascade with entries):

```ts
/** Removes invoices, entries (edits cascade), submissions, assignments, and the student created by the fixtures. */
export async function deleteAssignmentData(studentName: string) {
  const admin = adminClient()
  const { data: students } = await admin.from("tm_students").select("id").eq("name", studentName)
  for (const s of students ?? []) {
    const { data: assignments } = await admin.from("tm_assignments").select("id").eq("student_id", s.id)
    for (const a of assignments ?? []) {
      await admin.from("tm_invoices").delete().eq("assignment_id", a.id)
      await admin.from("tm_timesheet_entries").delete().eq("assignment_id", a.id)
      await admin.from("tm_submissions").delete().eq("assignment_id", a.id)
      await admin.from("tm_assignments").delete().eq("id", a.id)
    }
    await admin.from("tm_students").delete().eq("id", s.id)
  }
}
```

Append:

```ts
/**
 * An assignment with two submitted sessions in the current month (1.5 h and 2 h at the "1 to 1" tier),
 * locked under one submission, exactly as tm_submit_month would leave them.
 */
export async function createSubmittedMonth(tutorName: string, studentName: string, code: string) {
  const admin = adminClient()
  const ids = await createAssignmentForTutor(tutorName, studentName, code)
  const { data: tier, error: tierErr } = await admin.from("tm_rate_tiers").select("id").eq("assignment_id", ids.assignmentId).single()
  if (tierErr) throw tierErr
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const first = `${year}-${String(month).padStart(2, "0")}-01`
  const today = `${year}-${String(month).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`

  const { data: submission, error: sErr } = await admin
    .from("tm_submissions")
    .insert({ assignment_id: ids.assignmentId, tutor_id: ids.tutorId, year, month, status: "submitted" })
    .select("id").single()
  if (sErr) throw sErr

  const base = { assignment_id: ids.assignmentId, tutor_id: ids.tutorId, rate_tier_id: tier.id, tier_label: "1 to 1", parent_rate: 70, tutor_rate: 50, status: "submitted", submission_id: submission.id }
  const { error: eErr } = await admin.from("tm_timesheet_entries").insert([
    { ...base, date: first, hours: 1.5, note: "E2E first session" },
    { ...base, date: today, hours: 2, note: "E2E second session" },
  ])
  if (eErr) throw eErr
  return { ...ids, submissionId: submission.id as string }
}

export async function findGeneratedInvoice(assignmentId: string) {
  const { data } = await adminClient()
    .from("tm_invoices")
    .select("invoice_number, invoice_amount, tutor_payout, total_hours")
    .eq("assignment_id", assignmentId)
    .eq("source", "generated")
    .maybeSingle()
  return data
}
```

- [ ] **Step 2: The spec**

Create `e2e/tm-approvals.spec.ts`:

```ts
import { test, expect } from "@playwright/test"
import { signIn, users } from "./helpers/auth"
import { createSubmittedMonth, deleteAssignmentData, findGeneratedInvoice } from "./helpers/admin"

const stamp = Date.now().toString(36)
const student = `E2E Approval Student ${stamp}`
const code = `EA${stamp.slice(-2).toUpperCase()}`
let assignmentId = ""

test.describe.serial("tutor matching approvals", () => {
  test.beforeAll(async () => {
    const ids = await createSubmittedMonth("E2E Tutor", student, code)
    assignmentId = ids.assignmentId
  })
  test.afterAll(async () => {
    await deleteAssignmentData(student)
  })

  test("the queue lists the submitted month with its totals", async ({ context, page }) => {
    await signIn(context, users.admin.email, users.admin.password)
    await page.goto("/tm/approvals")
    const row = page.getByRole("row", { name: new RegExp(code) })
    await expect(row).toBeVisible()
    // 1.5 h + 2 h at $70 / $50
    await expect(row).toContainText("3.50")
    await expect(row).toContainText("$245.00")
    await expect(row).toContainText("$175.00")
    await expect(row).toContainText("$70.00")
  })

  test("review shows the sessions and an edit leaves a trail", async ({ context, page }) => {
    await signIn(context, users.admin.email, users.admin.password)
    await page.goto("/tm/approvals")
    await page.getByRole("button", { name: new RegExp(`^Review ${code} `) }).click()
    await expect(page).toHaveURL(/\/tm\/approvals\?submission=/)
    await expect(page.getByRole("row", { name: /E2E first session/ })).toContainText("$105.00")

    await page.getByRole("button", { name: /^Edit session on / }).first().click()
    await page.getByLabel("Or hours").fill("1")
    await page.getByRole("button", { name: "Save changes" }).click()
    await expect(page.getByText("Session updated", { exact: true }).first()).toBeVisible()
    const edited = page.getByRole("row", { name: /E2E first session/ })
    await expect(edited).toContainText("1.00")
    await expect(edited).toContainText("Edited")
    await edited.getByRole("button", { name: /previous version/ }).click()
    await expect(page.getByText("Hours: 1.50")).toBeVisible()
    await expect(page.getByTestId("review-totals")).toContainText("3.00 h")
  })

  test("send back returns the month to the tutor", async ({ context, page }) => {
    await signIn(context, users.admin.email, users.admin.password)
    await page.goto("/tm/approvals")
    await page.getByRole("button", { name: new RegExp(`^Review ${code} `) }).click()
    await page.getByRole("button", { name: "Send back" }).click()
    const dialog = page.getByRole("dialog")
    await expect(dialog.getByRole("button", { name: "Send back" })).toBeDisabled()
    await dialog.getByLabel("Reason").fill("E2E please check the second session")
    await dialog.getByRole("button", { name: "Send back" }).click()
    await expect(page.getByText("Sent back to E2E Tutor", { exact: true }).first()).toBeVisible()
    await expect(page).toHaveURL(/\/tm\/approvals$/)
    await expect(page.getByText("Returned, awaiting resubmission")).toBeVisible()
    await expect(page.getByRole("row", { name: new RegExp(code) })).toContainText("E2E please check the second session")
  })

  test("the tutor sees the reason and resubmits", async ({ context, page }) => {
    await signIn(context, users.tutor.email, users.tutor.password)
    await page.goto("/portal/timesheet")
    await expect(page.getByText("Returned: E2E please check the second session").first()).toBeVisible()
    await page.getByRole("button", { name: "Resubmit" }).click()
    await page.getByRole("dialog").getByRole("button", { name: "Submit", exact: true }).click()
    await expect(page.getByText("Submitted, waiting for approval").first()).toBeVisible()
  })

  test("approve creates the invoice", async ({ context, page }) => {
    await signIn(context, users.admin.email, users.admin.password)
    await page.goto("/tm/approvals")
    await expect(page.getByText("Returned, awaiting resubmission")).toHaveCount(0)
    await page.getByRole("button", { name: new RegExp(`^Review ${code} `) }).click()
    await page.getByRole("button", { name: "Approve" }).click()
    await page.getByRole("dialog").getByRole("button", { name: "Approve" }).click()
    await expect(page.getByText(/^Invoice TM-\d{6}-\d{3} created\.$/).first()).toBeVisible()
    await expect(page).toHaveURL(/\/tm\/approvals$/)
    await expect(page.getByText("Nothing is waiting for approval.")).toBeVisible()

    const invoice = await findGeneratedInvoice(assignmentId)
    expect(invoice).not.toBeNull()
    // 1.0 h + 2 h at $70 / $50 after the edit
    expect(Number(invoice!.total_hours)).toBe(3)
    expect(Number(invoice!.invoice_amount)).toBe(210)
    expect(Number(invoice!.tutor_payout)).toBe(150)
  })
})
```

The Resubmit dialog's confirm button label comes from the tutor portal (`timesheet-month.tsx`); if it is not "Submit", read the label there and adjust the selector.

- [ ] **Step 3: Run the spec**

```bash
npx playwright test e2e/tm-approvals.spec.ts --reporter=list
```

Expected: 5 passed. Selector mismatches may be fixed in the spec and noted; behaviour mismatches are bugs to fix in the component or function, with the pgTAP or Vitest test extended first.

- [ ] **Step 4: Full verification**

```bash
npx tsc --noEmit && npm test && npm run build
npx playwright test e2e/auth-routing.spec.ts e2e/smoke-test.spec.ts e2e/tm-admin.spec.ts e2e/tutor-portal.spec.ts e2e/tm-approvals.spec.ts --reporter=list
npx supabase db reset && npm run db:test
npm run seed:test-users && npm run import:master-list
```

Expected: unit tests green (16 files), build lists `/tm/approvals`, 51 e2e passed, pgTAP 7 files with every file `ok`.

- [ ] **Step 5: Commit and record carry-forward notes**

Append a "Carry-forward from slice 4 execution" section to the end of this plan file with anything the next slice must know (at minimum: the rounding rule lives in both `tm_approve_submission` and `summariseEntries` and must stay identical; the returned section derives from two queries and a helper, not a view; deleting a generated invoice in slice 5 must set its entries and submission back to `submitted` and clear `invoice_id`, and `tm_approve_submission` refuses while a generated invoice for the month exists).

```bash
git add -A
git commit -m "test(tm): approvals end-to-end flow

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01TkFUEBg6S7PqW49ZKa3C6p"
```

---

## After this plan

Slice 5 (invoices and dashboard): the invoice list with filters and payment status, WhatsApp text, PDF, manual invoices, deleting a generated invoice (a Postgres function that removes the invoice and sets its entries and submission back to `submitted`), and the dashboard tiles with links into `/tm/approvals?submission=<id>`.

---

## Carry-forward from slice 4 execution

- **Rounding rule lives in two places and must stay identical.** `tm_approve_submission` (`supabase/migrations/20260907100000_tm_approvals.sql`) groups entries by `(tier_label, parent_rate)` / `(tier_label, tutor_rate)`, rounds each line's `sum(hours * rate)` to cents, then sums the rounded lines to get `invoice_amount` / `tutor_payout`. `summariseEntries` in `src/lib/tm/approvals.ts` mirrors this: `entryAmount`/`entryPayout` round each entry to a cent count via `Math.round(n * 100)`, then the totals are summed as integer cents and divided back down (see `Math.round(tenThousandths / 100)` at line ~185). Slice 5's invoice list and any recomputation must reuse one of these two implementations rather than re-deriving a third rounding path, or generated totals will drift from what the queue/review UI showed the admin before approval.
- **The "Returned, awaiting resubmission" section is not a view.** It is built client-side in `src/app/(dashboard)/tm/approvals/page.tsx`: one query for `tm_submissions` with `status = 'returned'`, a second query for any non-returned submission on the same `(assignment_id, year, month)`, and the `outstandingReturns` helper in `src/lib/tm/approvals.ts` that filters out returned rows which already have a live (resubmitted) successor. Any new surface that needs "what's still waiting on the tutor" (e.g. a dashboard tile) should reuse `outstandingReturns` rather than querying `tm_submissions.status = 'returned'` directly, or it will show stale returns the tutor already resubmitted.
- **Deleting a generated invoice must roll the month back to `submitted`.** Slice 5's delete-invoice function needs to: delete the `tm_invoices` row, set every `tm_timesheet_entries` row with that `invoice_id` back to `status = 'submitted'` and clear `invoice_id`, and set the originating `tm_submissions` row back to `status = 'submitted'` (clearing `reviewed_at`/approval bookkeeping as appropriate). `tm_approve_submission` already refuses to approve a month while a `source = 'generated'` invoice exists for that `(assignment_id, year, month)` (see the `WHERE ... AND source = 'generated'` guard at line 148 of the approvals migration), so the delete function is the only way to unwind an approval and re-open the month — get its rollback exactly right or a month can get stuck approved-but-invoiceless.
- **Verification observations from this task:** the Task 5 selectors (aria-labels `Review {code} {month}`, `Edit session on {date}`, `Show N previous version(s)`; `data-testid="review-totals"`; dialog confirm buttons sharing their trigger's label; the tutor portal's `Submit` confirm button) all worked exactly as documented — no spec fixes were needed, and `e2e/tm-approvals.spec.ts` passed 5/5 on the first run. Full verification (`tsc`, 118 Vitest tests across 16 files, `next build` listing `/tm/approvals`, 51/51 Playwright tests across five spec files, and 7/7 pgTAP files totalling 138 tests) also passed clean on the first attempt, so slice 4's approvals flow (queue, review, edit trail, send back, resubmit, approve, invoice generation) is fully verified end-to-end with no known defects.
