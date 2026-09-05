# Tutor Matching Slice 3: Tutor Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give tutors a phone-friendly portal to see their students, log sessions, review a month's timesheet, and submit it for approval, without ever seeing parent rates.

**Architecture:** Three client-rendered pages under the existing `/portal` layout share one data hook that resolves the signed-in tutor and their active assignments. Tutors read entries through a masking view and write drafts directly under RLS; the server snapshots rates from the chosen tier, a trigger refuses edits in a submitted month, and a SECURITY DEFINER function `tm_submit_month` locks a month atomically. Pure helpers under `src/lib/portal/` carry the validation, grouping, and totals with Vitest coverage. The slice opens by applying the generated `Database` type to both Supabase clients, as slice 2's review required.

**Tech Stack:** Next.js 14.2 App Router (client components), Supabase JS via `@supabase/ssr` with the generated `Database` type, shadcn/ui, Vitest, pgTAP, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-04-tutor-matching-design.md` — Sections 3 (`tm_` columns, RLS matrix), 4 (tutor portal), 7 (multi-row changes are Postgres functions). Also read the "Carry-forward" sections at the end of `docs/superpowers/plans/2026-09-04-tutor-matching-foundation.md` and `docs/superpowers/plans/2026-09-04-tutor-matching-admin-data-entry.md`.

## Global Constraints

- Next.js stays on 14.2.x. No new dependencies.
- Tutors never see parent rates. Tutor-facing reads of entries go only through `tm_timesheet_entries_tutor_view`; tier reads only through `tm_rate_tiers_tutor_view`. No tutor-facing component may query `tm_timesheet_entries` or `tm_rate_tiers` directly, and no policy or grant may widen tutor access.
- Tutor writes never send rates. Inserts and updates on `tm_timesheet_entries` send `rate_tier_id`; the trigger `tm_snapshot_entry_rates` fills `tier_label`, `parent_rate`, `tutor_rate`. `tier_label`, `parent_rate`, `tutor_rate` are NOT NULL, so tutor inserts must still include placeholder values (`tier_label: ""`, `parent_rate: 0`, `tutor_rate: 0`) that the trigger overwrites.
- Hours: send `hours: null` with both `start_time` and `end_time` and the trigger `tm_set_entry_hours` computes them; or send `hours` with both times null. An edit that changes the times must send `hours: null` to force recomputation.
- Editability follows submission status, not the calendar: entries with status `draft` or `returned` are editable; a month with a `submitted` or `approved` submission is locked for that assignment. A previous month that was never submitted stays editable and submittable.
- Submission is per assignment per month via `tm_submit_month(p_assignment_id, p_year, p_month)`; the UI never inserts into `tm_submissions` or changes entry statuses itself.
- Copy, verbatim: portal tabs "My Students", "Log a Session", "My Timesheet"; status banners "Submitted, waiting for approval", "Approved", "Returned: {reason}"; submit button "Submit for approval"; resubmit button "Resubmit".
- Dates are handled as `YYYY-MM-DD` strings in the browser's local time; times as `HH:MM`.
- Commit messages end with:
  ```
  Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01Nz2dMwYkjrRRcXcuVwSWs1
  ```
- Run long commands (Playwright, `next build`, `supabase db reset`) in the foreground. After any `db reset`, run `npm run seed:test-users` and `npm run import:master-list`.

## File Structure

| Path | Responsibility |
|---|---|
| `src/lib/supabase/client.ts`, `server.ts` (modify) | Pass `<Database>` to the client factories |
| `supabase/migrations/20260905110000_tm_save_assignment.sql` (modify) | `p_id` becomes an optional last parameter so the generated type is optional |
| `supabase/migrations/20260905120000_tm_portal.sql` | Entries masking view, locked-month guard trigger, `tm_submit_month` |
| `supabase/tests/tm_portal.test.sql` | pgTAP for the above |
| `src/lib/portal/sessions.ts` (+ `.test.ts`) | `computeHours`, `validateSession`, `todayIso`, `monthBounds` |
| `src/lib/portal/timesheet.ts` (+ `.test.ts`) | `PortalEntry`, grouping, totals, submission state, `canSubmit` |
| `src/components/portal/use-portal-context.ts` | Hook resolving the tutor, active assignments with students and tutor-side tiers |
| `src/components/portal/assignment-cards.tsx` | My Students cards |
| `src/components/portal/session-form.tsx` | Create/edit form for one session |
| `src/components/portal/timesheet-month.tsx` | One month's timesheet: sections per assignment, edit/delete/submit |
| `src/app/portal/page.tsx`, `log/page.tsx`, `timesheet/page.tsx` (modify) | Replace the shells |
| `e2e/helpers/admin.ts` (modify), `e2e/tutor-portal.spec.ts` | Fixtures and the tutor end-to-end flow |

---

### Task 1: Typed Supabase clients

**Files:**
- Modify: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/middleware.ts`, `src/app/auth/callback/route.ts`, `supabase/migrations/20260905110000_tm_save_assignment.sql`, `supabase/tests/tm_save_assignment.test.sql`, `src/app/(dashboard)/tm/students/page.tsx`, plus whatever `tsc` reports

**Interfaces:**
- Produces: every `createClient()` returns `SupabaseClient<Database>`; `supabase.rpc("tm_save_assignment", { p_assignment, p_tiers, p_id? })` with `p_id` optional. Later tasks rely on typed rows for `tm_timesheet_entries_tutor_view`, `tm_rate_tiers_tutor_view`, `tm_submissions`, and the `tm_submit_month` RPC (all regenerated in Task 2).

- [ ] **Step 1: Make `p_id` optional in the SQL function**

In `supabase/migrations/20260905110000_tm_save_assignment.sql`, change the signature so the optional parameter comes last:

```sql
CREATE OR REPLACE FUNCTION public.tm_save_assignment(p_assignment JSONB, p_tiers JSONB, p_id UUID DEFAULT NULL)
```

and update the two grant lines to `public.tm_save_assignment(JSONB, JSONB, UUID)`. In `supabase/tests/tm_save_assignment.test.sql`, change every positional call: `tm_save_assignment(NULL, '<assignment>', '<tiers>')` becomes `tm_save_assignment('<assignment>', '<tiers>')`, and the update call `tm_save_assignment('%s', '<assignment>', '<tiers>')` becomes `tm_save_assignment('<assignment>', '<tiers>', '%s')`.

Run `npx supabase db reset && npm run db:test`; expected: all files pass (74 assertions). Then `npm run db:types` and confirm `src/lib/supabase/types.ts` now shows `tm_save_assignment: { Args: { p_assignment: Json; p_id?: string; p_tiers: Json } ...`.

- [ ] **Step 2: Apply the generic**

`src/lib/supabase/client.ts`:

```ts
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

`src/lib/supabase/server.ts`: add `import type { Database } from './types'` and change `createServerClient(` to `createServerClient<Database>(`. Do the same in `src/middleware.ts` and `src/app/auth/callback/route.ts` (both call `createServerClient` directly; import the type from `@/lib/supabase/types`).

- [ ] **Step 3: Fix what the compiler reports**

Run `npx tsc --noEmit`. Fix each error with the narrowest change that keeps runtime behaviour identical. Expected categories:

- `src/app/(dashboard)/tm/students/page.tsx`: the RPC call becomes `supabase.rpc("tm_save_assignment", { p_assignment: payload, p_tiers: values.tiers, p_id: target.assignment?.id })` (omit `?? null`). If `values.tiers` is rejected as not assignable to `Json`, change `export interface RateTierValue` in `src/lib/tm/rate-tiers.ts` to `export type RateTierValue = { ... }` (type aliases satisfy index-signature checks; interfaces do not). Same for `payload` if needed.
- Calls of the form `toNumber(x as unknown as string)` where `x` is now typed `number`: simplify to `toNumber(x)`.
- Embedded-relation selects that were cast with `as unknown as SomeType[]` still compile; leave them.
- Academy screens that used `as any` still compile; leave them. If an Academy query errors on a column name, that is a real latent bug: fix the column name and list it in the report.

Do not add `// @ts-expect-error`. If an error cannot be resolved without changing behaviour, stop and report NEEDS_CONTEXT with the error text.

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit && npm test && npm run build
npx playwright test e2e/tm-admin.spec.ts --reporter=list
```

Expected: clean, 89 unit tests, build ok, 6 e2e passed (the assignment save still works through the reordered RPC).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: type the Supabase clients with the generated Database schema

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Nz2dMwYkjrRRcXcuVwSWs1"
```

---

### Task 2: Entries masking view, locked-month guard, and `tm_submit_month`

**Files:**
- Create: `supabase/migrations/20260905120000_tm_portal.sql`, `supabase/tests/tm_portal.test.sql`
- Modify: `src/lib/supabase/types.ts` (regenerated)

**Interfaces:**
- Produces: view `tm_timesheet_entries_tutor_view` (every `tm_timesheet_entries` column except `parent_rate`, filtered to the caller's tutor or admin); trigger `tm_guard_locked_month`; function `tm_submit_month(p_assignment_id uuid, p_year int, p_month int) returns uuid`. Tasks 4 to 6 read entries only via the view and submit only via the function.

- [ ] **Step 1: Failing pgTAP test**

Create `supabase/tests/tm_portal.test.sql`:

```sql
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(19);

-- Users: tutor A, tutor B, admin
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('a1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'portal.a@example.com', '', now(), '{}', '{"full_name":"Tutor A"}', now(), now()),
  ('a1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'portal.b@example.com', '', now(), '{}', '{"full_name":"Tutor B"}', now(), now()),
  ('a1000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ccchristabelle@gmail.com', '', now(), '{}', '{"full_name":"Admin"}', now(), now());
UPDATE profiles SET role = 'tutor' WHERE id IN ('a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002');
INSERT INTO tm_tutors (id, profile_id, name) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'Tutor A'),
  ('b1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002', 'Tutor B');
INSERT INTO tm_students (id, name) VALUES ('c1000000-0000-0000-0000-000000000001', 'Student');
INSERT INTO tm_assignments (id, code, tutor_id, student_id, subject, status) VALUES
  ('d1000000-0000-0000-0000-000000000001', 'PA01', 'b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'English', 'active'),
  ('d1000000-0000-0000-0000-000000000002', 'PB01', 'b1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001', 'Math', 'active');
INSERT INTO tm_rate_tiers (id, assignment_id, label, parent_rate, tutor_rate) VALUES
  ('e1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', '1 to 1', 70, 50),
  ('e1000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000002', '1 to 1', 80, 60);
-- Two drafts for A in the current month, one for B
INSERT INTO tm_timesheet_entries (id, assignment_id, tutor_id, date, hours, rate_tier_id, tier_label, parent_rate, tutor_rate) VALUES
  ('f1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', date_trunc('month', current_date)::date, 1.5, 'e1000000-0000-0000-0000-000000000001', '1 to 1', 70, 50),
  ('f1000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', current_date, 2, 'e1000000-0000-0000-0000-000000000001', '1 to 1', 70, 50),
  ('f1000000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000002', current_date, 1, 'e1000000-0000-0000-0000-000000000002', '1 to 1', 80, 60);

-- ---- View shape ----
SELECT has_view('public', 'tm_timesheet_entries_tutor_view', 'entries tutor view exists');
SELECT hasnt_column('public', 'tm_timesheet_entries_tutor_view', 'parent_rate', 'the view has no parent_rate');
SELECT has_column('public', 'tm_timesheet_entries_tutor_view', 'tutor_rate', 'the view keeps tutor_rate');

-- ---- Act as Tutor A ----
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims = '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}';
SELECT is((SELECT count(*)::int FROM tm_timesheet_entries_tutor_view), 2, 'tutor sees only own entries through the view');

-- Tutor B cannot submit A's assignment
SET LOCAL request.jwt.claims = '{"sub":"a1000000-0000-0000-0000-000000000002","role":"authenticated"}';
SELECT throws_ok($$ SELECT tm_submit_month('d1000000-0000-0000-0000-000000000001', EXTRACT(YEAR FROM current_date)::int, EXTRACT(MONTH FROM current_date)::int) $$,
  '42501', NULL, 'another tutor cannot submit this assignment');

-- Tutor A: nothing to submit for a month with no entries
SET LOCAL request.jwt.claims = '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}';
SELECT throws_ok($$ SELECT tm_submit_month('d1000000-0000-0000-0000-000000000001', 2000, 1) $$,
  '22023', NULL, 'submitting a month with no sessions is refused');

-- Tutor A submits the current month
CREATE TEMP TABLE sub AS SELECT tm_submit_month('d1000000-0000-0000-0000-000000000001', EXTRACT(YEAR FROM current_date)::int, EXTRACT(MONTH FROM current_date)::int) AS id;
SELECT is((SELECT status FROM tm_submissions WHERE id = (SELECT id FROM sub)), 'submitted', 'submission row created');
SELECT is((SELECT count(*)::int FROM tm_timesheet_entries_tutor_view WHERE status = 'submitted' AND submission_id = (SELECT id FROM sub)), 2, 'both drafts locked into the submission');
SELECT throws_ok($$ SELECT tm_submit_month('d1000000-0000-0000-0000-000000000001', EXTRACT(YEAR FROM current_date)::int, EXTRACT(MONTH FROM current_date)::int) $$,
  '22023', NULL, 'a second submission for the same month is refused');

-- Locked month: no new draft, no edit, no delete
SELECT throws_ok($$ INSERT INTO tm_timesheet_entries (assignment_id, tutor_id, date, hours, rate_tier_id, tier_label, parent_rate, tutor_rate)
  VALUES ('d1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', current_date, 1, 'e1000000-0000-0000-0000-000000000001', '', 0, 0) $$,
  '22023', NULL, 'cannot log a session in a submitted month');
UPDATE tm_timesheet_entries SET note = 'x' WHERE id = 'f1000000-0000-0000-0000-000000000001';
SELECT is((SELECT note FROM tm_timesheet_entries_tutor_view WHERE id = 'f1000000-0000-0000-0000-000000000001'), NULL, 'submitted entries are not editable (RLS filters the update)');
DELETE FROM tm_timesheet_entries WHERE id = 'f1000000-0000-0000-0000-000000000001';
SELECT is((SELECT count(*)::int FROM tm_timesheet_entries_tutor_view WHERE id = 'f1000000-0000-0000-0000-000000000001'), 1, 'submitted entries are not deletable');

-- Tutor B's month is untouched: B can still log
SET LOCAL request.jwt.claims = '{"sub":"a1000000-0000-0000-0000-000000000002","role":"authenticated"}';
SELECT lives_ok($$ INSERT INTO tm_timesheet_entries (assignment_id, tutor_id, date, hours, rate_tier_id, tier_label, parent_rate, tutor_rate)
  VALUES ('d1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000002', current_date, 1, 'e1000000-0000-0000-0000-000000000002', '', 0, 0) $$,
  'another tutor logs in the same month unaffected');
SELECT is((SELECT tutor_rate FROM tm_timesheet_entries_tutor_view WHERE assignment_id = 'd1000000-0000-0000-0000-000000000002' ORDER BY created_at DESC LIMIT 1), 60.00::numeric, 'placeholder rates were overwritten by the snapshot trigger');

-- ---- Admin returns the submission; Tutor A can edit and resubmit ----
RESET role;
RESET request.jwt.claims;
UPDATE tm_submissions SET status = 'returned', return_reason = 'Check the hours', reviewed_at = now() WHERE id = (SELECT id FROM sub);
UPDATE tm_timesheet_entries SET status = 'returned' WHERE submission_id = (SELECT id FROM sub);
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims = '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}';
UPDATE tm_timesheet_entries SET hours = 2.5 WHERE id = 'f1000000-0000-0000-0000-000000000002';
SELECT is((SELECT hours FROM tm_timesheet_entries_tutor_view WHERE id = 'f1000000-0000-0000-0000-000000000002'), 2.50::numeric, 'returned entries are editable again');
SELECT lives_ok($$ SELECT tm_submit_month('d1000000-0000-0000-0000-000000000001', EXTRACT(YEAR FROM current_date)::int, EXTRACT(MONTH FROM current_date)::int) $$, 'resubmission creates a new submission');
SELECT is((SELECT count(*)::int FROM tm_submissions WHERE assignment_id = 'd1000000-0000-0000-0000-000000000001'), 2, 'returned submission kept as history');
SELECT is((SELECT count(*)::int FROM tm_timesheet_entries_tutor_view WHERE assignment_id = 'd1000000-0000-0000-0000-000000000001' AND status = 'submitted'), 2, 'entries re-locked under the new submission');

-- ---- Anon sees nothing ----
SET LOCAL role anon;
SET LOCAL request.jwt.claims = '{"role":"anon"}';
SELECT throws_ok($$ SELECT count(*) FROM tm_timesheet_entries_tutor_view $$, '42501', NULL, 'anon has no privilege on the entries view');

SELECT * FROM finish();
ROLLBACK;
```

Run `npx supabase db reset && npm run db:test`; expected: `tm_portal.test.sql` fails at `has_view`.

- [ ] **Step 2: The migration**

Create `supabase/migrations/20260905120000_tm_portal.sql`:

```sql
-- ============================================
-- EduOwl Tutor Matching - tutor portal support
-- ============================================

-- Tutors read their entries through this view, which omits parent_rate.
-- Runs as owner (bypasses table RLS) and filters by caller itself.
CREATE VIEW tm_timesheet_entries_tutor_view AS
  SELECT e.id, e.assignment_id, e.tutor_id, e.date, e.start_time, e.end_time, e.hours,
         e.rate_tier_id, e.tier_label, e.tutor_rate, e.note, e.status,
         e.submission_id, e.invoice_id, e.created_at, e.updated_at
  FROM tm_timesheet_entries e
  WHERE e.tutor_id = public.current_tutor_id() OR public.is_admin();
GRANT SELECT ON tm_timesheet_entries_tutor_view TO authenticated;
REVOKE ALL ON tm_timesheet_entries_tutor_view FROM anon, public;
ALTER VIEW tm_timesheet_entries_tutor_view SET (security_barrier = true);

-- Non-admin callers cannot add, change, or delete draft/returned entries in a month
-- that has a live (submitted or approved) submission for that assignment.
-- Status transitions themselves are made by tm_submit_month and the approval functions.
CREATE OR REPLACE FUNCTION public.tm_guard_locked_month()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assignment UUID;
  v_date DATE;
BEGIN
  IF auth.uid() IS NULL OR public.app_role() = 'admin' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_assignment := OLD.assignment_id;
    v_date := OLD.date;
  ELSE
    IF NEW.status NOT IN ('draft', 'returned') THEN
      RETURN NEW;
    END IF;
    v_assignment := NEW.assignment_id;
    v_date := NEW.date;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.tm_submissions s
    WHERE s.assignment_id = v_assignment
      AND s.year = EXTRACT(YEAR FROM v_date)::int
      AND s.month = EXTRACT(MONTH FROM v_date)::int
      AND s.status IN ('submitted', 'approved')
  ) THEN
    RAISE EXCEPTION 'This month has already been submitted for approval' USING ERRCODE = '22023';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

CREATE TRIGGER tm_guard_locked_month
  BEFORE INSERT OR UPDATE OR DELETE ON tm_timesheet_entries
  FOR EACH ROW EXECUTE FUNCTION public.tm_guard_locked_month();

-- Submit one assignment's month: create the submission and lock its draft/returned entries.
CREATE OR REPLACE FUNCTION public.tm_submit_month(p_assignment_id UUID, p_year INT, p_month INT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tutor UUID;
  v_id UUID;
  v_count INT;
BEGIN
  SELECT tutor_id INTO v_tutor FROM public.tm_assignments WHERE id = p_assignment_id;
  IF v_tutor IS NULL THEN
    RAISE EXCEPTION 'Assignment not found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.is_admin() AND public.current_tutor_id() IS DISTINCT FROM v_tutor THEN
    RAISE EXCEPTION 'You can only submit your own assignments' USING ERRCODE = '42501';
  END IF;
  IF p_month < 1 OR p_month > 12 THEN
    RAISE EXCEPTION 'Invalid month' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.tm_submissions
    WHERE assignment_id = p_assignment_id AND year = p_year AND month = p_month AND status <> 'returned'
  ) THEN
    RAISE EXCEPTION 'This month has already been submitted for approval' USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.tm_timesheet_entries e
  WHERE e.assignment_id = p_assignment_id
    AND e.status IN ('draft', 'returned')
    AND EXTRACT(YEAR FROM e.date) = p_year AND EXTRACT(MONTH FROM e.date) = p_month;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'No sessions to submit for this month' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.tm_timesheet_entries e
    WHERE e.assignment_id = p_assignment_id
      AND e.status IN ('draft', 'returned')
      AND EXTRACT(YEAR FROM e.date) = p_year AND EXTRACT(MONTH FROM e.date) = p_month
      AND e.rate_tier_id IS NULL
  ) THEN
    RAISE EXCEPTION 'One or more sessions need a rate tier before submitting' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.tm_submissions (assignment_id, tutor_id, year, month, status)
  VALUES (p_assignment_id, v_tutor, p_year, p_month, 'submitted')
  RETURNING id INTO v_id;

  UPDATE public.tm_timesheet_entries e
     SET status = 'submitted', submission_id = v_id
   WHERE e.assignment_id = p_assignment_id
     AND e.status IN ('draft', 'returned')
     AND EXTRACT(YEAR FROM e.date) = p_year AND EXTRACT(MONTH FROM e.date) = p_month;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.tm_submit_month(UUID, INT, INT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.tm_submit_month(UUID, INT, INT) TO authenticated;
```

- [ ] **Step 3: Run the tests, regenerate types**

```bash
npx supabase db reset && npm run db:test
npm run db:types && npx tsc --noEmit
npm run seed:test-users && npm run import:master-list
```

Expected: six files pass (92 assertions); `types.ts` gains `tm_timesheet_entries_tutor_view` under Views and `tm_submit_month` under Functions; `tsc` clean.

If the `throws_ok` for the locked-month insert reports SQLSTATE `23502` instead of `22023`, the snapshot trigger fired before the guard (triggers fire in name order: `tm_guard_locked_month` < `tm_snapshot_entry_rates` < `tm_set_entry_hours`, so the guard should be first). Check the trigger names before changing anything.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260905120000_tm_portal.sql supabase/tests/tm_portal.test.sql src/lib/supabase/types.ts
git commit -m "feat(db): entries masking view, locked-month guard, tm_submit_month

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Nz2dMwYkjrRRcXcuVwSWs1"
```

---

### Task 3: Portal helpers (sessions and timesheet)

**Files:**
- Create: `src/lib/portal/sessions.ts`, `src/lib/portal/sessions.test.ts`, `src/lib/portal/timesheet.ts`, `src/lib/portal/timesheet.test.ts`

**Interfaces:**
- Produces (pure, used by Tasks 5 and 6):
  - `computeHours(start: string, end: string): number | null`
  - `todayIso(now?: Date): string`
  - `monthBounds(period: Period): { from: string; to: string }` (uses `Period` from `src/lib/tm/periods.ts`)
  - `SessionInput = { assignmentId: string; date: string; start: string; end: string; hours: string; rateTierId: string; note: string }`
  - `SessionPayload = { assignment_id: string; date: string; start_time: string | null; end_time: string | null; hours: number | null; rate_tier_id: string; note: string | null }`
  - `validateSession(input: SessionInput, today: string): { ok: true; payload: SessionPayload } | { ok: false; error: string }`
  - `PortalEntry`, `entryPayout(e)`, `groupByAssignment(entries)`, `sumEntries(entries)`, `SubmissionState`, `submissionState(sub)`, `isEditable(state)`, `canSubmit(entries, state)`, `formatHours(h)`

- [ ] **Step 1: Failing session tests**

Create `src/lib/portal/sessions.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { computeHours, todayIso, monthBounds, validateSession, type SessionInput } from "./sessions"

const base: SessionInput = {
  assignmentId: "a1", date: "2026-09-04", start: "14:00", end: "15:30", hours: "", rateTierId: "t1", note: "",
}
const TODAY = "2026-09-05"

describe("computeHours", () => {
  it("computes decimal hours from HH:MM times", () => {
    expect(computeHours("14:00", "15:30")).toBe(1.5)
    expect(computeHours("09:15", "10:00")).toBe(0.75)
  })
  it("returns null when the end is not after the start or a time is malformed", () => {
    expect(computeHours("15:00", "15:00")).toBeNull()
    expect(computeHours("15:00", "14:00")).toBeNull()
    expect(computeHours("abc", "14:00")).toBeNull()
  })
})

describe("todayIso and monthBounds", () => {
  it("formats the local date", () => {
    expect(todayIso(new Date(2026, 8, 5, 23, 30))).toBe("2026-09-05")
  })
  it("returns first and last day of the month", () => {
    expect(monthBounds({ year: 2026, month: 2 })).toEqual({ from: "2026-02-01", to: "2026-02-28" })
    expect(monthBounds({ year: 2024, month: 2 })).toEqual({ from: "2024-02-01", to: "2024-02-29" })
    expect(monthBounds({ year: 2026, month: 12 })).toEqual({ from: "2026-12-01", to: "2026-12-31" })
  })
})

describe("validateSession", () => {
  it("accepts start and end times and leaves hours for the server", () => {
    expect(validateSession(base, TODAY)).toEqual({
      ok: true,
      payload: { assignment_id: "a1", date: "2026-09-04", start_time: "14:00", end_time: "15:30", hours: null, rate_tier_id: "t1", note: null },
    })
  })
  it("accepts typed hours without times", () => {
    expect(validateSession({ ...base, start: "", end: "", hours: "1.25", note: " Revision " }, TODAY)).toEqual({
      ok: true,
      payload: { assignment_id: "a1", date: "2026-09-04", start_time: null, end_time: null, hours: 1.25, rate_tier_id: "t1", note: "Revision" },
    })
  })
  it("prefers times when both times and hours are given", () => {
    const r = validateSession({ ...base, hours: "9" }, TODAY)
    expect(r.ok && r.payload.hours).toBeNull()
  })
  it("rejects missing assignment, tier, or date", () => {
    expect(validateSession({ ...base, assignmentId: "" }, TODAY)).toEqual({ ok: false, error: "Choose a student." })
    expect(validateSession({ ...base, rateTierId: "" }, TODAY)).toEqual({ ok: false, error: "Choose a rate tier." })
    expect(validateSession({ ...base, date: "" }, TODAY)).toEqual({ ok: false, error: "Enter the session date." })
  })
  it("rejects future dates and today is allowed", () => {
    expect(validateSession({ ...base, date: "2026-09-06" }, TODAY)).toEqual({ ok: false, error: "The date cannot be in the future." })
    expect(validateSession({ ...base, date: TODAY }, TODAY).ok).toBe(true)
  })
  it("rejects a lone time, an end before the start, and non-positive hours", () => {
    expect(validateSession({ ...base, end: "" }, TODAY)).toEqual({ ok: false, error: "Enter both a start and an end time, or the number of hours." })
    expect(validateSession({ ...base, start: "16:00" }, TODAY)).toEqual({ ok: false, error: "The end time must be after the start time." })
    expect(validateSession({ ...base, start: "", end: "", hours: "0" }, TODAY)).toEqual({ ok: false, error: "Hours must be more than 0." })
    expect(validateSession({ ...base, start: "", end: "", hours: "x" }, TODAY)).toEqual({ ok: false, error: "Hours must be more than 0." })
  })
})
```

- [ ] **Step 2: Sessions implementation**

Create `src/lib/portal/sessions.ts`:

```ts
import type { Period } from "@/lib/tm/periods"

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/

function minutes(t: string): number | null {
  const m = t.match(TIME)
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null
}

/** "14:00","15:30" -> 1.5; null when malformed or end is not after start. */
export function computeHours(start: string, end: string): number | null {
  const s = minutes(start)
  const e = minutes(end)
  if (s === null || e === null || e <= s) return null
  return Math.round(((e - s) / 60) * 100) / 100
}

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

export function todayIso(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function monthBounds(period: Period): { from: string; to: string } {
  const last = new Date(period.year, period.month, 0).getDate()
  return { from: `${period.year}-${pad(period.month)}-01`, to: `${period.year}-${pad(period.month)}-${pad(last)}` }
}

export interface SessionInput {
  assignmentId: string
  date: string
  start: string
  end: string
  hours: string
  rateTierId: string
  note: string
}

export interface SessionPayload {
  assignment_id: string
  date: string
  start_time: string | null
  end_time: string | null
  hours: number | null
  rate_tier_id: string
  note: string | null
}

export type SessionValidation = { ok: true; payload: SessionPayload } | { ok: false; error: string }

export function validateSession(input: SessionInput, today: string): SessionValidation {
  if (!input.assignmentId) return { ok: false, error: "Choose a student." }
  if (!input.date) return { ok: false, error: "Enter the session date." }
  if (input.date > today) return { ok: false, error: "The date cannot be in the future." }
  if (!input.rateTierId) return { ok: false, error: "Choose a rate tier." }

  const start = input.start.trim()
  const end = input.end.trim()
  const note = input.note.trim() || null

  if (start || end) {
    if (!start || !end) return { ok: false, error: "Enter both a start and an end time, or the number of hours." }
    if (computeHours(start, end) === null) return { ok: false, error: "The end time must be after the start time." }
    return {
      ok: true,
      payload: { assignment_id: input.assignmentId, date: input.date, start_time: start, end_time: end, hours: null, rate_tier_id: input.rateTierId, note },
    }
  }

  const hours = Number(input.hours)
  if (!Number.isFinite(hours) || hours <= 0) return { ok: false, error: "Hours must be more than 0." }
  return {
    ok: true,
    payload: { assignment_id: input.assignmentId, date: input.date, start_time: null, end_time: null, hours: Math.round(hours * 100) / 100, rate_tier_id: input.rateTierId, note },
  }
}
```

Run `npx vitest run src/lib/portal/sessions.test.ts`; expected: pass.

- [ ] **Step 3: Failing timesheet tests**

Create `src/lib/portal/timesheet.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import {
  entryPayout, groupByAssignment, sumEntries, submissionState, isEditable, canSubmit, formatHours, type PortalEntry,
} from "./timesheet"

const e = (over: Partial<PortalEntry>): PortalEntry => ({
  id: "e", assignment_id: "a1", date: "2026-09-02", start_time: null, end_time: null, hours: 1, rate_tier_id: "t1",
  tier_label: "1 to 1", tutor_rate: 50, note: null, status: "draft", submission_id: null, ...over,
})

describe("entryPayout and sums", () => {
  it("multiplies hours by the tutor rate, rounded to cents", () => {
    expect(entryPayout(e({ hours: 1.5, tutor_rate: 50 }))).toBe(75)
    expect(entryPayout(e({ hours: 0.33, tutor_rate: 55 }))).toBe(18.15)
  })
  it("sums hours and payout", () => {
    expect(sumEntries([e({ hours: 1.5 }), e({ id: "f", hours: 2, tutor_rate: 60 })])).toEqual({ hours: 3.5, payout: 195 })
    expect(sumEntries([])).toEqual({ hours: 0, payout: 0 })
  })
})

describe("groupByAssignment", () => {
  it("groups by assignment and sorts each group by date then creation order", () => {
    const g = groupByAssignment([
      e({ id: "1", assignment_id: "a2", date: "2026-09-03" }),
      e({ id: "2", assignment_id: "a1", date: "2026-09-05" }),
      e({ id: "3", assignment_id: "a1", date: "2026-09-01" }),
    ])
    expect([...g.keys()]).toEqual(["a2", "a1"])
    expect(g.get("a1")!.map((x) => x.id)).toEqual(["3", "2"])
  })
})

describe("submissionState", () => {
  it("maps a submission row to a state", () => {
    expect(submissionState(null)).toEqual({ kind: "none" })
    expect(submissionState({ status: "submitted", return_reason: null })).toEqual({ kind: "submitted" })
    expect(submissionState({ status: "approved", return_reason: null })).toEqual({ kind: "approved" })
    expect(submissionState({ status: "returned", return_reason: "Check hours" })).toEqual({ kind: "returned", reason: "Check hours" })
  })
  it("only none and returned are editable", () => {
    expect(isEditable({ kind: "none" })).toBe(true)
    expect(isEditable({ kind: "returned", reason: null })).toBe(true)
    expect(isEditable({ kind: "submitted" })).toBe(false)
    expect(isEditable({ kind: "approved" })).toBe(false)
  })
})

describe("canSubmit", () => {
  it("needs at least one editable entry and a tier on every one", () => {
    expect(canSubmit([], { kind: "none" })).toEqual({ ok: false, reason: "Log at least one session first." })
    expect(canSubmit([e({})], { kind: "none" })).toEqual({ ok: true })
    expect(canSubmit([e({ rate_tier_id: null })], { kind: "none" })).toEqual({ ok: false, reason: "Choose a rate tier for every session first." })
    expect(canSubmit([e({ status: "submitted" })], { kind: "submitted" })).toEqual({ ok: false, reason: "This month has already been submitted." })
    expect(canSubmit([e({ status: "returned" })], { kind: "returned", reason: "x" })).toEqual({ ok: true })
  })
})

describe("formatHours", () => {
  it("shows two decimals", () => {
    expect(formatHours(1.5)).toBe("1.50")
    expect(formatHours(2)).toBe("2.00")
  })
})
```

- [ ] **Step 4: Timesheet implementation**

Create `src/lib/portal/timesheet.ts`:

```ts
export type EntryStatus = "draft" | "submitted" | "approved" | "returned"

export interface PortalEntry {
  id: string
  assignment_id: string
  date: string
  start_time: string | null
  end_time: string | null
  hours: number
  rate_tier_id: string | null
  tier_label: string
  tutor_rate: number
  note: string | null
  status: EntryStatus
  submission_id: string | null
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function entryPayout(e: PortalEntry): number {
  return round2(e.hours * e.tutor_rate)
}

export function sumEntries(entries: PortalEntry[]): { hours: number; payout: number } {
  return {
    hours: round2(entries.reduce((s, e) => s + e.hours, 0)),
    payout: round2(entries.reduce((s, e) => s + entryPayout(e), 0)),
  }
}

/** Groups in first-seen order; each group sorted by date, ties keep input order. */
export function groupByAssignment(entries: PortalEntry[]): Map<string, PortalEntry[]> {
  const groups = new Map<string, PortalEntry[]>()
  for (const e of entries) {
    const list = groups.get(e.assignment_id) ?? []
    list.push(e)
    groups.set(e.assignment_id, list)
  }
  for (const list of groups.values()) list.sort((a, b) => a.date.localeCompare(b.date))
  return groups
}

export type SubmissionState =
  | { kind: "none" }
  | { kind: "submitted" }
  | { kind: "approved" }
  | { kind: "returned"; reason: string | null }

export function submissionState(sub: { status: string; return_reason: string | null } | null): SubmissionState {
  if (!sub) return { kind: "none" }
  if (sub.status === "approved") return { kind: "approved" }
  if (sub.status === "returned") return { kind: "returned", reason: sub.return_reason }
  return { kind: "submitted" }
}

export function isEditable(state: SubmissionState): boolean {
  return state.kind === "none" || state.kind === "returned"
}

export function canSubmit(entries: PortalEntry[], state: SubmissionState): { ok: true } | { ok: false; reason: string } {
  if (!isEditable(state)) return { ok: false, reason: "This month has already been submitted." }
  const editable = entries.filter((e) => e.status === "draft" || e.status === "returned")
  if (editable.length === 0) return { ok: false, reason: "Log at least one session first." }
  if (editable.some((e) => !e.rate_tier_id)) return { ok: false, reason: "Choose a rate tier for every session first." }
  return { ok: true }
}

export function formatHours(h: number): string {
  return h.toFixed(2)
}
```

Run `npm test`; expected: all pass (15 files).

- [ ] **Step 5: Commit**

```bash
git add src/lib/portal
git commit -m "feat(portal): session validation and timesheet helpers

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Nz2dMwYkjrRRcXcuVwSWs1"
```

---

### Task 4: Portal context hook and My Students

**Files:**
- Create: `src/components/portal/use-portal-context.ts`, `src/components/portal/assignment-cards.tsx`
- Modify: `src/app/portal/page.tsx`

**Interfaces:**
- Consumes: typed client (Task 1), `tm_rate_tiers_tutor_view`.
- Produces:
  - `PortalTier = { id: string; assignment_id: string; label: string; tutor_rate: number; sort_order: number }`
  - `PortalAssignment = { id: string; code: string; subject: string; timeslot: string | null; studentName: string; tiers: PortalTier[] }`
  - `usePortalContext(): { loading: boolean; error: string | null; tutor: { id: string; name: string } | null; assignments: PortalAssignment[]; reload: () => void }`
  Tasks 5 and 6 consume the hook.

- [ ] **Step 1: The hook**

Create `src/components/portal/use-portal-context.ts`:

```ts
"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { toNumber } from "@/lib/tm/types"

export interface PortalTier {
  id: string
  assignment_id: string
  label: string
  tutor_rate: number
  sort_order: number
}

export interface PortalAssignment {
  id: string
  code: string
  subject: string
  timeslot: string | null
  studentName: string
  tiers: PortalTier[]
}

export interface PortalContext {
  loading: boolean
  error: string | null
  tutor: { id: string; name: string } | null
  assignments: PortalAssignment[]
  reload: () => void
}

export function usePortalContext(): PortalContext {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tutor, setTutor] = useState<{ id: string; name: string } | null>(null)
  const [assignments, setAssignments] = useState<PortalAssignment[]>([])
  const [tick, setTick] = useState(0)

  const reload = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        if (!cancelled) { setError("You are not signed in."); setLoading(false) }
        return
      }
      const { data: tutorRow, error: tutorError } = await supabase
        .from("tm_tutors").select("id, name").eq("profile_id", user.id).maybeSingle()
      if (tutorError || !tutorRow) {
        if (!cancelled) {
          setTutor(null)
          setAssignments([])
          setError(tutorError ? "Could not load your tutor profile." : "No tutor profile is linked to your account yet. Ask EduOwl to link it.")
          setLoading(false)
        }
        return
      }
      const { data: rows, error: aError } = await supabase
        .from("tm_assignments")
        .select("id, code, subject, timeslot, tm_students(name)")
        .eq("tutor_id", tutorRow.id)
        .eq("status", "active")
        .order("code")
      if (aError) {
        if (!cancelled) { setError("Could not load your students."); setLoading(false) }
        return
      }
      const ids = (rows ?? []).map((r) => r.id)
      const { data: tiers, error: tError } = ids.length
        ? await supabase.from("tm_rate_tiers_tutor_view").select("*").in("assignment_id", ids)
        : { data: [], error: null }
      if (tError) {
        if (!cancelled) { setError("Could not load your rates."); setLoading(false) }
        return
      }
      const tiersByAssignment = new Map<string, PortalTier[]>()
      for (const t of tiers ?? []) {
        if (!t.id || !t.assignment_id || !t.label) continue
        const list = tiersByAssignment.get(t.assignment_id) ?? []
        list.push({ id: t.id, assignment_id: t.assignment_id, label: t.label, tutor_rate: toNumber(t.tutor_rate) ?? 0, sort_order: t.sort_order ?? 0 })
        tiersByAssignment.set(t.assignment_id, list)
      }
      for (const list of tiersByAssignment.values()) list.sort((a, b) => a.sort_order - b.sort_order)
      if (!cancelled) {
        setTutor({ id: tutorRow.id, name: tutorRow.name })
        setAssignments((rows ?? []).map((r) => ({
          id: r.id,
          code: r.code,
          subject: r.subject,
          timeslot: r.timeslot,
          studentName: (r.tm_students as { name: string } | null)?.name ?? "",
          tiers: tiersByAssignment.get(r.id) ?? [],
        })))
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [tick])

  return { loading, error, tutor, assignments, reload }
}
```

View columns are nullable in the generated types (Postgres cannot prove view columns non-null), which is why the loop guards `t.id`, `t.assignment_id`, `t.label`. If `tsc` reports that `r.tm_students` is typed as an array, use `Array.isArray(r.tm_students) ? r.tm_students[0]?.name : r.tm_students?.name`.

- [ ] **Step 2: Cards and page**

Create `src/components/portal/assignment-cards.tsx`:

```tsx
"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus } from "lucide-react"
import { formatCurrency } from "@/lib/format"
import { usePortalContext } from "./use-portal-context"

export function AssignmentCards() {
  const { loading, error, assignments } = usePortalContext()

  if (loading) return <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-28 w-full" />)}</div>
  if (error) return <Card><CardContent className="py-6 text-sm text-destructive">{error}</CardContent></Card>
  if (assignments.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>My Students</CardTitle><CardDescription>You have no active students yet.</CardDescription></CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {assignments.map((a) => (
        <Card key={a.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{a.studentName}</CardTitle>
            <CardDescription>
              {a.subject}
              {a.timeslot ? ` · ${a.timeslot}` : ""}
              <span className="ml-2 font-mono text-xs">{a.code}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-3">
            <ul className="text-sm text-muted-foreground">
              {a.tiers.map((t) => (
                <li key={t.id}>{t.label}: {formatCurrency(t.tutor_rate)}/hr</li>
              ))}
              {a.tiers.length === 0 && <li>No rates set yet</li>}
            </ul>
            <Button asChild size="sm">
              <Link href={`/portal/log?assignment=${a.id}`}><Plus className="mr-1 h-4 w-4" />Log session</Link>
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
```

Replace `src/app/portal/page.tsx` with:

```tsx
import { AssignmentCards } from "@/components/portal/assignment-cards"

export default function MyStudentsPage() {
  return <AssignmentCards />
}
```

- [ ] **Step 3: Verify and commit**

`npx tsc --noEmit && npm run build`. Then `npx playwright test e2e/auth-routing.spec.ts --reporter=list` still passes (the tutor test asserts the portal loads and the "E2E Tutor" name in the header; the seeded tutor has no assignments so the empty-state card shows).

```bash
git add -A
git commit -m "feat(portal): tutor context hook and My Students cards

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Nz2dMwYkjrRRcXcuVwSWs1"
```

---

### Task 5: Session form and Log a Session

**Files:**
- Create: `src/components/portal/session-form.tsx`
- Modify: `src/app/portal/log/page.tsx`

**Interfaces:**
- Consumes: `usePortalContext`, `PortalAssignment` (Task 4); `validateSession`, `todayIso`, `SessionInput`, `SessionPayload` (Task 3).
- Produces: `<SessionForm assignments defaultAssignmentId initial lockAssignment onSubmit onCancel submitLabel isLoading />` where `initial?: Partial<SessionInput>` and `onSubmit(payload: SessionPayload): Promise<void>`. Task 6 reuses it for edits.

- [ ] **Step 1: The form**

Create `src/components/portal/session-form.tsx`:

```tsx
"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatCurrency } from "@/lib/format"
import { computeHours, todayIso, validateSession, type SessionInput, type SessionPayload } from "@/lib/portal/sessions"
import type { PortalAssignment } from "./use-portal-context"

interface SessionFormProps {
  assignments: PortalAssignment[]
  defaultAssignmentId?: string
  initial?: Partial<SessionInput>
  lockAssignment?: boolean
  onSubmit: (payload: SessionPayload) => Promise<void>
  onCancel?: () => void
  submitLabel?: string
  isLoading?: boolean
}

export function SessionForm({
  assignments, defaultAssignmentId, initial, lockAssignment = false, onSubmit, onCancel, submitLabel = "Save session", isLoading,
}: SessionFormProps) {
  const today = todayIso()
  const [assignmentId, setAssignmentId] = useState(initial?.assignmentId ?? defaultAssignmentId ?? (assignments.length === 1 ? assignments[0].id : ""))
  const [date, setDate] = useState(initial?.date ?? today)
  const [start, setStart] = useState(initial?.start ?? "")
  const [end, setEnd] = useState(initial?.end ?? "")
  const [hours, setHours] = useState(initial?.hours ?? "")
  const [rateTierId, setRateTierId] = useState(initial?.rateTierId ?? "")
  const [note, setNote] = useState(initial?.note ?? "")
  const [error, setError] = useState("")

  const assignment = useMemo(() => assignments.find((a) => a.id === assignmentId), [assignments, assignmentId])
  const tiers = assignment?.tiers ?? []
  const effectiveTier = rateTierId || (tiers.length === 1 ? tiers[0].id : "")
  const previewHours = start && end ? computeHours(start, end) : hours ? Number(hours) : null

  function chooseAssignment(id: string) {
    setAssignmentId(id)
    setRateTierId("")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    const result = validateSession({ assignmentId, date, start, end, hours, rateTierId: effectiveTier, note }, today)
    if (!result.ok) { setError(result.error); return }
    await onSubmit(result.payload)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="session-assignment">Student</Label>
        <Select value={assignmentId} onValueChange={chooseAssignment} disabled={lockAssignment}>
          <SelectTrigger id="session-assignment"><SelectValue placeholder="Choose a student" /></SelectTrigger>
          <SelectContent>
            {assignments.map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.studentName} · {a.subject}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="session-date">Date</Label>
        <Input id="session-date" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} required />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="session-start">Start time</Label>
          <Input id="session-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="session-end">End time</Label>
          <Input id="session-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="session-hours">Or hours</Label>
        <Input id="session-hours" inputMode="decimal" placeholder="e.g. 1.5" value={hours} onChange={(e) => setHours(e.target.value)} disabled={Boolean(start || end)} />
        {previewHours !== null && Number.isFinite(previewHours) && previewHours > 0 && (
          <p className="text-xs text-muted-foreground">{previewHours.toFixed(2)} hours</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="session-tier">Rate tier</Label>
        <Select value={effectiveTier} onValueChange={setRateTierId} disabled={tiers.length === 0}>
          <SelectTrigger id="session-tier"><SelectValue placeholder={tiers.length === 0 ? "No rates on this assignment" : "Choose a rate tier"} /></SelectTrigger>
          <SelectContent>
            {tiers.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.label} · {formatCurrency(t.tutor_rate)}/hr</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="session-note">Note</Label>
        <Textarea id="session-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional, e.g. Revised chapter 3" />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-2">
        {onCancel && <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>}
        <Button type="submit" disabled={isLoading}>{isLoading ? "Saving..." : submitLabel}</Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Log a Session page**

Replace `src/app/portal/log/page.tsx` with:

```tsx
"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { SessionForm } from "@/components/portal/session-form"
import { usePortalContext } from "@/components/portal/use-portal-context"
import type { SessionPayload } from "@/lib/portal/sessions"

function LogSession() {
  const { loading, error, tutor, assignments } = usePortalContext()
  const params = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)

  async function handleSubmit(payload: SessionPayload) {
    if (!tutor) return
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from("tm_timesheet_entries").insert({
      ...payload,
      tutor_id: tutor.id,
      status: "draft",
      // Placeholders: the tm_snapshot_entry_rates trigger overwrites these from the chosen tier.
      tier_label: "",
      parent_rate: 0,
      tutor_rate: 0,
    })
    setSaving(false)
    if (error) {
      toast({ title: "Could not save the session", description: error.message, variant: "destructive" })
      return
    }
    toast({ title: "Session logged" })
    router.push(`/portal/timesheet?month=${payload.date.slice(0, 7)}`)
  }

  if (loading) return <Skeleton className="h-96 w-full" />
  if (error) return <Card><CardContent className="py-6 text-sm text-destructive">{error}</CardContent></Card>

  return (
    <Card>
      <CardHeader>
        <CardTitle>Log a Session</CardTitle>
        <CardDescription>Record one tutoring session. It stays a draft until you submit the month.</CardDescription>
      </CardHeader>
      <CardContent>
        {assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground">You have no active students to log against.</p>
        ) : (
          <SessionForm
            assignments={assignments}
            defaultAssignmentId={params.get("assignment") ?? undefined}
            onSubmit={handleSubmit}
            isLoading={saving}
          />
        )}
      </CardContent>
    </Card>
  )
}

export default function LogSessionPage() {
  return (
    <Suspense>
      <LogSession />
    </Suspense>
  )
}
```

The insert's `hours: null` case relies on the trigger computing from times; the `date`, `start_time`, `end_time`, `rate_tier_id`, `note` keys come from the payload. If `tsc` rejects the insert because `hours` is typed non-nullable in the generated `Insert` type, it is not (the column is nullable), so re-run `npm run db:types`.

- [ ] **Step 3: Verify and commit**

`npx tsc --noEmit && npm test && npm run build`. Then `git add -A` and commit:

```bash
git commit -m "feat(portal): log a session

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Nz2dMwYkjrRRcXcuVwSWs1"
```

---

### Task 6: My Timesheet with edit, delete, and submit

**Files:**
- Create: `src/components/portal/timesheet-month.tsx`
- Modify: `src/app/portal/timesheet/page.tsx`

**Interfaces:**
- Consumes: `usePortalContext` (Task 4); `SessionForm` (Task 5); helpers from Task 3; `Period`, `currentPeriod`, `parseMonthInput`, `toMonthInput`, `periodLabel` from `src/lib/tm/periods.ts`; view `tm_timesheet_entries_tutor_view`, table `tm_submissions`, RPC `tm_submit_month` (Task 2).
- Produces: `<TimesheetMonth period onPeriodChange />`.

- [ ] **Step 1: The month component**

Create `src/components/portal/timesheet-month.tsx`:

```tsx
"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { Pencil, Trash2, Send } from "lucide-react"
import { formatCurrency } from "@/lib/format"
import { toNumber } from "@/lib/tm/types"
import { parseMonthInput, periodLabel, toMonthInput, type Period } from "@/lib/tm/periods"
import { monthBounds, type SessionPayload } from "@/lib/portal/sessions"
import {
  canSubmit, entryPayout, formatHours, groupByAssignment, isEditable, submissionState, sumEntries,
  type PortalEntry, type SubmissionState,
} from "@/lib/portal/timesheet"
import { SessionForm } from "./session-form"
import { usePortalContext, type PortalAssignment } from "./use-portal-context"

interface Props {
  period: Period
  onPeriodChange: (p: Period) => void
}

type Submission = { id: string; assignment_id: string; status: string; return_reason: string | null }

export function TimesheetMonth({ period, onPeriodChange }: Props) {
  const ctx = usePortalContext()
  const { toast } = useToast()
  const [entries, setEntries] = useState<PortalEntry[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<PortalEntry | null>(null)
  const [deleting, setDeleting] = useState<PortalEntry | null>(null)
  const [submitting, setSubmitting] = useState<PortalAssignment | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { from, to } = monthBounds(period)
    const [entriesRes, subsRes] = await Promise.all([
      supabase.from("tm_timesheet_entries_tutor_view").select("*").gte("date", from).lte("date", to).order("date"),
      supabase.from("tm_submissions").select("id, assignment_id, status, return_reason").eq("year", period.year).eq("month", period.month).order("created_at", { ascending: false }),
    ])
    if (entriesRes.error || subsRes.error) {
      toast({ title: "Error", description: "Could not load your timesheet", variant: "destructive" })
      setLoading(false)
      return
    }
    setEntries((entriesRes.data ?? []).flatMap((r) => (r.id && r.assignment_id && r.date && r.status ? [{
      id: r.id,
      assignment_id: r.assignment_id,
      date: r.date,
      start_time: r.start_time ? r.start_time.slice(0, 5) : null,
      end_time: r.end_time ? r.end_time.slice(0, 5) : null,
      hours: toNumber(r.hours) ?? 0,
      rate_tier_id: r.rate_tier_id,
      tier_label: r.tier_label ?? "",
      tutor_rate: toNumber(r.tutor_rate) ?? 0,
      note: r.note,
      status: r.status as PortalEntry["status"],
      submission_id: r.submission_id,
    }] : [])))
    setSubmissions(subsRes.data ?? [])
    setLoading(false)
  }, [period, toast])

  useEffect(() => { load() }, [load])

  const groups = useMemo(() => groupByAssignment(entries), [entries])

  // The live submission per assignment: the newest non-returned one, else the newest returned one.
  function stateFor(assignmentId: string): SubmissionState {
    const mine = submissions.filter((s) => s.assignment_id === assignmentId)
    const live = mine.find((s) => s.status !== "returned") ?? mine[0] ?? null
    return submissionState(live)
  }

  async function handleEdit(payload: SessionPayload) {
    if (!editing) return
    setBusy(true)
    const supabase = createClient()
    const { error } = await supabase
      .from("tm_timesheet_entries")
      .update({ date: payload.date, start_time: payload.start_time, end_time: payload.end_time, hours: payload.hours, rate_tier_id: payload.rate_tier_id, note: payload.note })
      .eq("id", editing.id)
    setBusy(false)
    if (error) {
      toast({ title: "Could not save", description: error.message, variant: "destructive" })
      return
    }
    setEditing(null)
    toast({ title: "Session updated" })
    load()
  }

  async function handleDelete() {
    if (!deleting) return
    setBusy(true)
    const supabase = createClient()
    const { error } = await supabase.from("tm_timesheet_entries").delete().eq("id", deleting.id)
    setBusy(false)
    if (error) {
      toast({ title: "Could not delete", description: error.message, variant: "destructive" })
      return
    }
    setDeleting(null)
    toast({ title: "Session deleted" })
    load()
  }

  async function handleSubmit() {
    if (!submitting) return
    setBusy(true)
    const supabase = createClient()
    const { error } = await supabase.rpc("tm_submit_month", { p_assignment_id: submitting.id, p_year: period.year, p_month: period.month })
    setBusy(false)
    if (error) {
      toast({ title: "Could not submit", description: error.message, variant: "destructive" })
      return
    }
    setSubmitting(null)
    toast({ title: "Submitted", description: `${periodLabel(period)} for ${submitting.studentName} is waiting for approval.` })
    load()
  }

  if (ctx.loading || loading) return <Skeleton className="h-96 w-full" />
  if (ctx.error) return <Card><CardContent className="py-6 text-sm text-destructive">{ctx.error}</CardContent></Card>

  // Show every active assignment, plus any assignment that has entries this month (e.g. now paused).
  const assignmentIds = Array.from(new Set([...ctx.assignments.map((a) => a.id), ...groups.keys()]))
  const byId = new Map(ctx.assignments.map((a) => [a.id, a]))

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="timesheet-month">Month</Label>
          <Input id="timesheet-month" type="month" className="w-[170px]" value={toMonthInput(period)} onChange={(e) => { const p = parseMonthInput(e.target.value); if (p) onPeriodChange(p) }} />
        </div>
      </div>

      {assignmentIds.length === 0 && (
        <Card><CardContent className="py-6 text-sm text-muted-foreground">No students and no sessions for {periodLabel(period)}.</CardContent></Card>
      )}

      {assignmentIds.map((id) => {
        const a = byId.get(id)
        const list = groups.get(id) ?? []
        const state = stateFor(id)
        const totals = sumEntries(list)
        const submitCheck = canSubmit(list, state)
        const editable = isEditable(state)
        const title = a ? `${a.studentName} · ${a.subject}` : list[0]?.tier_label ? "Assignment" : "Assignment"
        return (
          <Card key={id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{title}</CardTitle>
                  <CardDescription>{periodLabel(period)}</CardDescription>
                </div>
                <StatusBadge state={state} />
              </div>
              {state.kind === "returned" && (
                <p className="text-sm text-destructive">Returned: {state.reason || "no reason given"}</p>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {list.length === 0 ? (
                <p className="text-sm text-muted-foreground">No sessions logged.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Tier</TableHead>
                        <TableHead className="text-right">Hours</TableHead>
                        <TableHead className="text-right">Pay</TableHead>
                        <TableHead>Note</TableHead>
                        <TableHead className="w-[80px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {list.map((e) => {
                        const rowEditable = editable && (e.status === "draft" || e.status === "returned")
                        return (
                          <TableRow key={e.id}>
                            <TableCell className="whitespace-nowrap">{e.date}{e.start_time && e.end_time ? <span className="block text-xs text-muted-foreground">{e.start_time}–{e.end_time}</span> : null}</TableCell>
                            <TableCell>{e.rate_tier_id ? e.tier_label : <Badge variant="destructive">Choose a tier</Badge>}</TableCell>
                            <TableCell className="text-right">{formatHours(e.hours)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(entryPayout(e))}</TableCell>
                            <TableCell className="max-w-[160px] truncate" title={e.note ?? ""}>{e.note || "—"}</TableCell>
                            <TableCell>
                              {rowEditable && (
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="icon" aria-label={`Edit session on ${e.date}`} onClick={() => setEditing(e)}><Pencil className="h-4 w-4" /></Button>
                                  <Button variant="ghost" size="icon" aria-label={`Delete session on ${e.date}`} onClick={() => setDeleting(e)}><Trash2 className="h-4 w-4" /></Button>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
              <div className="flex items-center justify-between">
                <p className="text-sm"><span className="text-muted-foreground">Total:</span> {formatHours(totals.hours)} h · {formatCurrency(totals.payout)}</p>
                {a && editable && (
                  <Button size="sm" disabled={!submitCheck.ok} title={submitCheck.ok ? undefined : submitCheck.reason} onClick={() => setSubmitting(a)}>
                    <Send className="mr-2 h-4 w-4" />{state.kind === "returned" ? "Resubmit" : "Submit for approval"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit session</DialogTitle>
            <DialogDescription>Changing the times recalculates the hours.</DialogDescription>
          </DialogHeader>
          {editing && (
            <SessionForm
              key={editing.id}
              assignments={ctx.assignments}
              lockAssignment
              initial={{
                assignmentId: editing.assignment_id,
                date: editing.date,
                start: editing.start_time ?? "",
                end: editing.end_time ?? "",
                hours: editing.start_time ? "" : String(editing.hours),
                rateTierId: editing.rate_tier_id ?? "",
                note: editing.note ?? "",
              }}
              onSubmit={handleEdit}
              onCancel={() => setEditing(null)}
              submitLabel="Save changes"
              isLoading={busy}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete session</DialogTitle>
            <DialogDescription>Remove the session on {deleting?.date}? This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={busy}>{busy ? "Deleting..." : "Delete"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={submitting !== null} onOpenChange={(o) => !o && setSubmitting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit {periodLabel(period)}?</DialogTitle>
            <DialogDescription>
              {submitting ? `${submitting.studentName} · ${submitting.subject}. ` : ""}
              Your sessions for this month will be locked while EduOwl reviews them. If anything needs changing, they can send it back to you.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitting(null)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={busy}>{busy ? "Submitting..." : "Submit"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StatusBadge({ state }: { state: SubmissionState }) {
  if (state.kind === "submitted") return <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">Submitted, waiting for approval</Badge>
  if (state.kind === "approved") return <Badge className="bg-green-100 text-green-900 hover:bg-green-100">Approved</Badge>
  if (state.kind === "returned") return <Badge variant="destructive">Returned</Badge>
  return <Badge variant="outline">Not submitted</Badge>
}
```

Note on the edit: `SessionForm` produces `hours: null` whenever both times are set, which makes the trigger recompute hours; when the tutor types hours instead, both times are sent as null. That satisfies the carry-forward rule.

- [ ] **Step 2: Page**

Replace `src/app/portal/timesheet/page.tsx` with:

```tsx
"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { TimesheetMonth } from "@/components/portal/timesheet-month"
import { currentPeriod, parseMonthInput, toMonthInput, type Period } from "@/lib/tm/periods"

function Timesheet() {
  const params = useSearchParams()
  const router = useRouter()
  const [period, setPeriod] = useState<Period>(() => parseMonthInput(params.get("month") ?? "") ?? currentPeriod())

  function change(p: Period) {
    setPeriod(p)
    router.replace(`/portal/timesheet?month=${toMonthInput(p)}`)
  }

  return <TimesheetMonth period={period} onPeriodChange={change} />
}

export default function MyTimesheetPage() {
  return (
    <Suspense>
      <Timesheet />
    </Suspense>
  )
}
```

- [ ] **Step 3: Verify and commit**

`npx tsc --noEmit && npm test && npm run build`. Manual check (optional if the e2e in Task 7 is about to run): with the e2e tutor signed in via the helper flow, `/portal/timesheet` shows the month picker and either the empty state or the seeded data.

```bash
git add -A
git commit -m "feat(portal): monthly timesheet with edit, delete, and submit for approval

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Nz2dMwYkjrRRcXcuVwSWs1"
```

---

### Task 7: Tutor end-to-end flow and final verification

**Files:**
- Modify: `e2e/helpers/admin.ts`
- Create: `e2e/tutor-portal.spec.ts`

**Interfaces:**
- Consumes: `signIn`, `users` (`e2e/helpers/auth.ts`); `adminClient()`, `deleteStudentByName` (`e2e/helpers/admin.ts`). The seeded tutor user `tutor.e2e@example.com` is linked to the `tm_tutors` row named "E2E Tutor".
- Produces: `createAssignmentForTutor(tutorName, studentName, code)` and `deleteAssignmentData(studentName)` fixture helpers.

- [ ] **Step 1: Fixture helpers**

Append to `e2e/helpers/admin.ts`:

```ts
/** Creates a student, an active assignment for the named tutor, and one "1 to 1" tier (parent 70 / tutor 50). */
export async function createAssignmentForTutor(tutorName: string, studentName: string, code: string) {
  const admin = adminClient()
  const { data: tutor, error: tErr } = await admin.from("tm_tutors").select("id").eq("name", tutorName).maybeSingle()
  if (tErr || !tutor) throw new Error(`tutor ${tutorName} not found: ${tErr?.message ?? "no row"}`)
  const { data: student, error: sErr } = await admin.from("tm_students").insert({ name: studentName, parent_name: "E2E Parent" }).select("id").single()
  if (sErr) throw sErr
  const { data: assignment, error: aErr } = await admin
    .from("tm_assignments")
    .insert({ code, tutor_id: tutor.id, student_id: student.id, subject: "E2E Subject", status: "active" })
    .select("id").single()
  if (aErr) throw aErr
  const { error: rErr } = await admin.from("tm_rate_tiers").insert({ assignment_id: assignment.id, label: "1 to 1", parent_rate: 70, tutor_rate: 50, sort_order: 0 })
  if (rErr) throw rErr
  return { tutorId: tutor.id, studentId: student.id, assignmentId: assignment.id }
}

/** Removes submissions, entries, assignments, and the student created by createAssignmentForTutor. */
export async function deleteAssignmentData(studentName: string) {
  const admin = adminClient()
  const { data: students } = await admin.from("tm_students").select("id").eq("name", studentName)
  for (const s of students ?? []) {
    const { data: assignments } = await admin.from("tm_assignments").select("id").eq("student_id", s.id)
    for (const a of assignments ?? []) {
      await admin.from("tm_timesheet_entries").delete().eq("assignment_id", a.id)
      await admin.from("tm_submissions").delete().eq("assignment_id", a.id)
      await admin.from("tm_assignments").delete().eq("id", a.id)
    }
    await admin.from("tm_students").delete().eq("id", s.id)
  }
}
```

- [ ] **Step 2: The spec**

Create `e2e/tutor-portal.spec.ts`:

```ts
import { test, expect } from "@playwright/test"
import { signIn, users } from "./helpers/auth"
import { createAssignmentForTutor, deleteAssignmentData } from "./helpers/admin"

const stamp = Date.now().toString(36)
const student = `E2E Portal Student ${stamp}`
const code = `EP${stamp.slice(-2).toUpperCase()}`

test.describe.serial("tutor portal", () => {
  test.beforeAll(async () => {
    await createAssignmentForTutor("E2E Tutor", student, code)
  })
  test.afterAll(async () => {
    await deleteAssignmentData(student)
  })
  test.beforeEach(async ({ context }) => signIn(context, users.tutor.email, users.tutor.password))

  test("My Students shows the assignment with the tutor rate only", async ({ page }) => {
    await page.goto("/portal")
    const card = page.locator("div", { has: page.getByText(student, { exact: true }) }).last()
    await expect(page.getByText(student, { exact: true })).toBeVisible()
    await expect(page.getByText("1 to 1: $50.00/hr")).toBeVisible()
    await expect(page.getByText("$70")).toHaveCount(0)
    await expect(card).toBeVisible()
  })

  test("logs a session with start and end times", async ({ page }) => {
    await page.goto("/portal")
    await page.getByRole("link", { name: "Log session" }).first().click()
    await expect(page).toHaveURL(/\/portal\/log\?assignment=/)
    await page.getByLabel("Start time").fill("14:00")
    await page.getByLabel("End time").fill("15:30")
    await expect(page.getByText("1.50 hours")).toBeVisible()
    await page.getByLabel("Note").fill("E2E session")
    await page.getByRole("button", { name: "Save session" }).click()
    await expect(page.getByText("Session logged", { exact: true })).toBeVisible()
    await expect(page).toHaveURL(/\/portal\/timesheet\?month=\d{4}-\d{2}/)
    const row = page.getByRole("row", { name: /E2E session/ })
    await expect(row).toContainText("1.50")
    await expect(row).toContainText("$75.00")
    await expect(page.getByText(/Total:/)).toContainText("1.50 h · $75.00")
  })

  test("edits the session hours", async ({ page }) => {
    await page.goto("/portal/timesheet")
    await page.getByRole("button", { name: /^Edit session on / }).first().click()
    await page.getByLabel("Start time").fill("")
    await page.getByLabel("End time").fill("")
    await page.getByLabel("Or hours").fill("2")
    await page.getByRole("button", { name: "Save changes" }).click()
    await expect(page.getByText("Session updated", { exact: true })).toBeVisible()
    await expect(page.getByRole("row", { name: /E2E session/ })).toContainText("2.00")
  })

  test("submits the month and the month locks", async ({ page }) => {
    await page.goto("/portal/timesheet")
    await page.getByRole("button", { name: "Submit for approval" }).click()
    await page.getByRole("dialog").getByRole("button", { name: "Submit", exact: true }).click()
    await expect(page.getByText("Submitted, waiting for approval")).toBeVisible()
    await expect(page.getByRole("button", { name: /^Edit session on / })).toHaveCount(0)

    await page.goto("/portal/log")
    await page.getByLabel("Or hours").fill("1")
    await page.getByRole("button", { name: "Save session" }).click()
    await expect(page.getByText("This month has already been submitted for approval")).toBeVisible()
  })
})
```

If the `Student` select has more than one assignment for the seeded tutor (a previous failed run left one behind), the log test still works because the link from My Students preselects the assignment; the second "Save session" in the last test relies on the single-assignment auto-select, so clean leftovers with `deleteAssignmentData` for stale names if it fails on "Choose a student.".

- [ ] **Step 3: Run the spec**

```bash
npx playwright test e2e/tutor-portal.spec.ts --reporter=list
```

Expected: 4 passed. Selector mismatches may be fixed in the spec and noted; behaviour mismatches are bugs to report.

- [ ] **Step 4: Full verification**

```bash
npx tsc --noEmit && npm test && npm run build
npx playwright test e2e/auth-routing.spec.ts e2e/smoke-test.spec.ts e2e/tm-admin.spec.ts e2e/tutor-portal.spec.ts --reporter=list
npx supabase db reset && npm run db:test
npm run seed:test-users && npm run import:master-list
```

Expected: unit tests green (15 files), build lists the three portal routes, 46 e2e passed, pgTAP 6 files / 92 assertions.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test(portal): tutor end-to-end flow

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Nz2dMwYkjrRRcXcuVwSWs1"
```

---

## After this plan

Slice 4 (approvals) follows: the admin queue of `tm_submissions`, entry editing with `tm_entry_edits`, `tm_approve_submission` generating the invoice, and send-back. Its plan starts from the same SECURITY DEFINER pattern as `tm_submit_month`, and must reset entry statuses to `returned` (not `draft`) on send-back so `tm_submit_month` picks them up on resubmission.
