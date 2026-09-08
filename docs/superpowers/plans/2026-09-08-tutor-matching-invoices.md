# Tutor Matching Slice 5: Invoices and Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give admins an Invoices screen (filters, WhatsApp text, PDF, payment status, manual invoices, delete with month re-open) and a real Tutor Matching dashboard.

**Architecture:** One new admin-only SECURITY DEFINER function, `tm_delete_invoice`, holds the only multi-row change; the invoice-number trigger gains an advisory lock. Marking paid, remarks, and manual invoices are single-row admin writes. Pure helpers in `src/lib/tm/` (`invoiceLines`, `invoices.ts`, `whatsapp.ts`, `dashboard.ts`) carry line items, filters, totals, the WhatsApp template, and dashboard figures with Vitest coverage. Two client-rendered pages (`/tm/invoices` with a `?invoice=<id>` detail view, and `/tm`) read under admin RLS; the PDF is a `@react-pdf/renderer` document derived from the Academy one and loaded on demand.

**Tech Stack:** Next.js 14.2 App Router (client components), Supabase JS with the generated `Database` type, shadcn/ui, `@react-pdf/renderer` 4 (already installed), Vitest, pgTAP, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-08-tutor-matching-invoices-design.md`. Data model: `docs/superpowers/specs/2026-09-04-tutor-matching-design.md` Section 3. Read the "Carry-forward from slice 4 execution" section at the end of `docs/superpowers/plans/2026-09-07-tutor-matching-approvals.md`.

## Global Constraints

- Next.js stays on 14.2.x. No new dependencies.
- The only multi-row change is `tm_delete_invoice`. The screen writes `tm_invoices` directly only for single-row changes: `parent_paid_at`, `tutor_paid_at`, `remarks`, and the manual insert. It never writes `tm_timesheet_entries` or `tm_submissions`.
- Function refusals use `ERRCODE '22023'`; missing rows `P0002`; non-admin `42501`. Messages, verbatim: "Invoice not found", "A paid invoice cannot be deleted". Lock order inside the function: submission, then entries.
- Rounding: rate lines come only from `invoiceLines` in `src/lib/tm/approvals.ts`, which reuses the integer-hundredths `lineCents`; nothing else re-derives a line total. `invoiceTotals` sums in integer cents.
- PostgREST returns `numeric` as strings: every `total_hours`, `invoice_amount`, `tutor_payout`, `profit`, `hours`, `parent_rate`, `tutor_rate` read passes through `toNumber()`.
- Filters live in the URL: keys `month` (`YYYY-MM` or `all`), `tutor`, `student`, `parent_paid`, `tutor_paid`, `source`; absent keys mean the default (current month, everything else any/all). The detail view is `?invoice=<id>` with the filter keys preserved.
- Copy, verbatim: nav "Invoices"; buttons "New manual invoice", "All months", "Back to invoices", "Save remarks", "Save", "Clear", "Delete"; menu items "Copy WhatsApp text", "Download PDF", "Mark parent paid" / "Edit parent paid date", "Mark tutor paid" / "Edit tutor paid date", "Delete"; empty states "No invoices match these filters.", "Nothing is waiting for approval.", "This invoice no longer exists"; toasts "WhatsApp text copied", "Could not copy", "Parent payment recorded", "Tutor payout recorded", "Parent payment cleared", "Tutor payout cleared", "Invoice deleted", "Could not delete", "Invoice {number} created.", "A manual invoice for this month already exists", "Remarks saved", "Invoice PDF downloaded", "Failed to generate PDF"; tiles "Pending approvals", "Invoiced", "Tutor payouts", "Profit", "Outstanding parent payments", "Outstanding tutor payouts"; card "Oldest pending submissions"; tooltip "Clear the paid dates first".
- WhatsApp text is exactly the template in the spec's Section 4, with the stated rules for null parent name, null hours, and no lines.
- PDF: navy `#2E3192` top bar, "EduOwl" over "Education Consultancy Pte. Ltd.", owl logo `/tm/logo.png`, QR from `tm_settings.qr_code_path`, the muted invoice number under the month line, tutor payout never shown. File name `{studentName} {Mon}'{yy} Invoice.pdf`.
- Commit messages end with:
  ```
  Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01TkFUEBg6S7PqW49ZKa3C6p
  ```
- Never start the dev server by hand; Playwright starts it through its config. Run Playwright, `next build`, and `supabase db reset` in the foreground. After any `db reset`, run `npm run seed:test-users` and `npm run import:master-list`.

## File Structure

| Path | Responsibility |
|---|---|
| `supabase/migrations/20260908100000_tm_invoices.sql` | `tm_delete_invoice`; advisory-locked `tm_set_invoice_number` |
| `supabase/tests/tm_invoices.test.sql` | pgTAP |
| `src/lib/supabase/types.ts` | Regenerated |
| `src/lib/tm/approvals.ts` (+ test, modify) | `RateLine`, `invoiceLines` |
| `src/lib/tm/invoices.ts` (+ test) | `INVOICE_SELECT`, `InvoiceRow`, `InvoiceEntry`, mappers, filter type and URL codec, `filterInvoices`, `invoiceTotals`, `manualLine`, `invoiceFileName` |
| `src/lib/tm/whatsapp.ts` (+ test) | `whatsappText` |
| `src/lib/tm/dashboard.ts` (+ test) | `PendingSubmission`, `mapPendingRow`, `monthFigures`, `outstanding`, `oldestPending` |
| `src/lib/workspace.ts` (+ test, modify) | Nav item |
| `src/components/tm/invoice-data.ts` | `loadInvoiceEntries`, `loadInvoiceContext` (settings + entries) |
| `src/components/tm/invoice-filters.tsx` | Filter bar |
| `src/components/tm/invoice-table.tsx` | List table with totals |
| `src/components/tm/invoice-actions.tsx` | `InvoiceMenu`, `InvoiceActionButtons`, `PaidDialog`, `DeleteDialog` |
| `src/components/tm/manual-invoice-form.tsx` | `ManualInvoiceDialog` |
| `src/components/tm/invoice-pdf.tsx` | `TmInvoicePDF` document |
| `src/components/tm/invoice-download.tsx` | `downloadInvoicePdf(row)` |
| `src/components/tm/invoice-detail.tsx` | Detail view |
| `src/app/(dashboard)/tm/invoices/page.tsx` | Loads rows, owns filter, dialogs, handlers; switches list/detail |
| `src/components/tm/dashboard-tiles.tsx`, `pending-list.tsx` | Dashboard pieces |
| `src/app/(dashboard)/tm/page.tsx` (modify) | Dashboard |
| `e2e/helpers/admin.ts` (modify), `e2e/tm-invoices.spec.ts` | Fixture and flow |

---

### Task 1: `tm_delete_invoice` and the advisory-locked invoice number

**Files:**
- Create: `supabase/tests/tm_invoices.test.sql`
- Create: `supabase/migrations/20260908100000_tm_invoices.sql`
- Regenerate: `src/lib/supabase/types.ts`

**Interfaces:**
- Consumes: `public.app_role()`, `tm_submit_month`, `tm_approve_submission`, the trigger `tm_set_invoice_number` from `supabase/migrations/20260904120000_tm_schema.sql` (lines 169-195).
- Produces: `tm_delete_invoice(p_invoice_id uuid) returns void`; generated `Functions.tm_delete_invoice`.

- [ ] **Step 1: Failing pgTAP test**

Create `supabase/tests/tm_invoices.test.sql`:

```sql
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(22);

-- Users: tutor A, admin (the signup trigger makes this email an admin)
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('a3000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'invoices.a@example.com', '', now(), '{}', '{"full_name":"Tutor A"}', now(), now()),
  ('a3000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ccchristabelle@gmail.com', '', now(), '{}', '{"full_name":"Admin"}', now(), now());
UPDATE profiles SET role = 'tutor' WHERE id = 'a3000000-0000-0000-0000-000000000001';
INSERT INTO tm_tutors (id, profile_id, name) VALUES ('b3000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 'Tutor A');
INSERT INTO tm_students (id, name) VALUES ('c3000000-0000-0000-0000-000000000001', 'Student');
INSERT INTO tm_assignments (id, code, tutor_id, student_id, subject, status) VALUES
  ('d3000000-0000-0000-0000-000000000001', 'IA01', 'b3000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000001', 'English', 'active'),
  ('d3000000-0000-0000-0000-000000000002', 'IA02', 'b3000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000001', 'Math', 'active');
INSERT INTO tm_rate_tiers (id, assignment_id, label, parent_rate, tutor_rate, sort_order) VALUES
  ('e3000000-0000-0000-0000-000000000001', 'd3000000-0000-0000-0000-000000000001', '1 to 1', 70, 50, 0);
INSERT INTO tm_timesheet_entries (id, assignment_id, tutor_id, date, hours, rate_tier_id, tier_label, parent_rate, tutor_rate) VALUES
  ('f3000000-0000-0000-0000-000000000001', 'd3000000-0000-0000-0000-000000000001', 'b3000000-0000-0000-0000-000000000001', date_trunc('month', current_date)::date, 1.5, 'e3000000-0000-0000-0000-000000000001', '1 to 1', 70, 50),
  ('f3000000-0000-0000-0000-000000000002', 'd3000000-0000-0000-0000-000000000001', 'b3000000-0000-0000-0000-000000000001', current_date, 2, 'e3000000-0000-0000-0000-000000000001', '1 to 1', 70, 50);

-- Tutor A submits, admin approves
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims = '{"sub":"a3000000-0000-0000-0000-000000000001","role":"authenticated"}';
CREATE TEMP TABLE sub AS SELECT tm_submit_month('d3000000-0000-0000-0000-000000000001', EXTRACT(YEAR FROM current_date)::int, EXTRACT(MONTH FROM current_date)::int) AS id;
SET LOCAL request.jwt.claims = '{"sub":"a3000000-0000-0000-0000-000000000009","role":"authenticated"}';
CREATE TEMP TABLE inv AS SELECT tm_approve_submission((SELECT id FROM sub)) AS id;
CREATE TEMP TABLE num AS SELECT invoice_number FROM tm_invoices WHERE id = (SELECT id FROM inv);

-- ---- Tutor cannot delete ----
SET LOCAL request.jwt.claims = '{"sub":"a3000000-0000-0000-0000-000000000001","role":"authenticated"}';
SELECT throws_ok($$ SELECT tm_delete_invoice((SELECT id FROM inv)) $$, '42501', NULL, 'a tutor cannot delete invoices');

-- ---- Admin refusals ----
SET LOCAL request.jwt.claims = '{"sub":"a3000000-0000-0000-0000-000000000009","role":"authenticated"}';
SELECT throws_ok($$ SELECT tm_delete_invoice('00000000-0000-0000-0000-000000000000') $$, 'P0002', NULL, 'unknown invoice');
UPDATE tm_invoices SET parent_paid_at = current_date WHERE id = (SELECT id FROM inv);
SELECT throws_ok($$ SELECT tm_delete_invoice((SELECT id FROM inv)) $$, '22023', NULL, 'parent-paid invoice cannot be deleted');
UPDATE tm_invoices SET parent_paid_at = NULL, tutor_paid_at = current_date WHERE id = (SELECT id FROM inv);
SELECT throws_ok($$ SELECT tm_delete_invoice((SELECT id FROM inv)) $$, '22023', NULL, 'tutor-paid invoice cannot be deleted');
UPDATE tm_invoices SET tutor_paid_at = NULL WHERE id = (SELECT id FROM inv);

-- ---- Delete a generated invoice re-opens the month ----
SELECT lives_ok($$ SELECT tm_delete_invoice((SELECT id FROM inv)) $$, 'unpaid generated invoice deleted');
SELECT is((SELECT count(*)::int FROM tm_invoices WHERE id = (SELECT id FROM inv)), 0, 'invoice row is gone');
SELECT is((SELECT count(*)::int FROM tm_timesheet_entries WHERE submission_id = (SELECT id FROM sub) AND status = 'submitted' AND invoice_id IS NULL), 2, 'entries are back to submitted with no invoice');
SELECT is((SELECT status FROM tm_submissions WHERE id = (SELECT id FROM sub)), 'submitted', 'submission is back to submitted');
SELECT is((SELECT reviewed_at IS NULL AND invoice_id IS NULL FROM tm_submissions WHERE id = (SELECT id FROM sub)), true, 'submission bookkeeping cleared');
SELECT lives_ok($$ SELECT tm_approve_submission((SELECT id FROM sub)) $$, 'the month can be approved again');
SELECT is((SELECT invoice_number FROM tm_invoices WHERE assignment_id = 'd3000000-0000-0000-0000-000000000001' AND source = 'generated'), (SELECT invoice_number FROM num), 'the freed invoice number is reused');
SELECT is((SELECT status FROM tm_submissions WHERE id = (SELECT id FROM sub)), 'approved', 'submission approved again');

-- ---- Manual invoices and numbering ----
CREATE TEMP TABLE man AS
  INSERT INTO tm_invoices (assignment_id, year, month, source, total_hours, invoice_amount, tutor_payout)
  VALUES ('d3000000-0000-0000-0000-000000000001', EXTRACT(YEAR FROM current_date)::int, EXTRACT(MONTH FROM current_date)::int, 'manual', NULL, 100, 60)
  RETURNING id, invoice_number;
SELECT matches((SELECT invoice_number FROM man), '-002$', 'a manual invoice takes the next number');
SELECT throws_ok($$ INSERT INTO tm_invoices (assignment_id, year, month, source, invoice_amount, tutor_payout)
  VALUES ('d3000000-0000-0000-0000-000000000001', EXTRACT(YEAR FROM current_date)::int, EXTRACT(MONTH FROM current_date)::int, 'manual', 1, 1) $$,
  '23505', NULL, 'a second manual invoice for the same month is refused');
SELECT lives_ok($$ SELECT tm_delete_invoice((SELECT id FROM man)) $$, 'manual invoice deleted');
SELECT is((SELECT count(*)::int FROM tm_invoices WHERE id = (SELECT id FROM man)), 0, 'manual row is gone');
SELECT is((SELECT count(*)::int FROM tm_invoices WHERE assignment_id = 'd3000000-0000-0000-0000-000000000001' AND source = 'generated'), 1, 'generated invoice untouched by the manual delete');
SELECT is((SELECT count(*)::int FROM tm_timesheet_entries WHERE submission_id = (SELECT id FROM sub) AND status = 'approved'), 2, 'entries untouched by the manual delete');

-- Gap filling: with -001 (generated) and -002 (manual) present, delete -001; the next insert on another assignment takes -001
INSERT INTO tm_invoices (assignment_id, year, month, source, invoice_amount, tutor_payout)
VALUES ('d3000000-0000-0000-0000-000000000001', EXTRACT(YEAR FROM current_date)::int, EXTRACT(MONTH FROM current_date)::int, 'manual', 100, 60);
SELECT lives_ok($$ SELECT tm_delete_invoice((SELECT id FROM tm_invoices WHERE assignment_id = 'd3000000-0000-0000-0000-000000000001' AND source = 'generated')) $$, 'generated invoice deleted again');
CREATE TEMP TABLE man2 AS
  INSERT INTO tm_invoices (assignment_id, year, month, source, invoice_amount, tutor_payout)
  VALUES ('d3000000-0000-0000-0000-000000000002', EXTRACT(YEAR FROM current_date)::int, EXTRACT(MONTH FROM current_date)::int, 'manual', 50, 30)
  RETURNING invoice_number;
SELECT is((SELECT invoice_number FROM man2), (SELECT invoice_number FROM num), 'the gap left by the deleted invoice is filled');
SELECT is((SELECT count(*)::int FROM tm_timesheet_entries WHERE submission_id = (SELECT id FROM sub) AND status = 'submitted'), 2, 'month re-opened once more');

-- ---- Anon cannot execute ----
SET LOCAL role anon;
SET LOCAL request.jwt.claims = '{"role":"anon"}';
SELECT throws_ok($$ SELECT tm_delete_invoice('00000000-0000-0000-0000-000000000000') $$, '42501', NULL, 'anon has no execute privilege');

SELECT * FROM finish();
ROLLBACK;
```

The file has 22 assertions (1 tutor, 3 admin refusals, 8 re-open, 6 manual, 3 gap, 1 anon). If pgTAP reports "planned 22 but ran N", you added or removed one: set `plan(N)`.

- [ ] **Step 2: Run to see it fail**

```bash
npx supabase db reset && npm run db:test 2>&1 | grep -A 6 "tm_invoices"
```

Expected: the first `throws_ok` fails with `42883` (function does not exist), not `42501`.

- [ ] **Step 3: The migration**

Create `supabase/migrations/20260908100000_tm_invoices.sql`:

```sql
-- ============================================
-- EduOwl Tutor Matching - invoices
-- tm_delete_invoice (admin only; re-opens the month for a generated invoice)
-- and an advisory lock on invoice numbering now that manual invoices add a second writer.
-- ============================================

-- Delete an unpaid invoice. For a generated invoice, its entries and submission go back to 'submitted'.
CREATE OR REPLACE FUNCTION public.tm_delete_invoice(p_invoice_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv public.tm_invoices%ROWTYPE;
  v_sub_id UUID;
BEGIN
  IF public.app_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only admins can delete invoices' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_inv FROM public.tm_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_inv.parent_paid_at IS NOT NULL OR v_inv.tutor_paid_at IS NOT NULL THEN
    RAISE EXCEPTION 'A paid invoice cannot be deleted' USING ERRCODE = '22023';
  END IF;

  IF v_inv.source = 'generated' THEN
    -- Lock order: submission first, then entries (same as every approvals function).
    SELECT id INTO v_sub_id FROM public.tm_submissions WHERE invoice_id = p_invoice_id FOR UPDATE;

    UPDATE public.tm_timesheet_entries
       SET status = 'submitted', invoice_id = NULL
     WHERE invoice_id = p_invoice_id;

    IF v_sub_id IS NOT NULL THEN
      UPDATE public.tm_submissions
         SET status = 'submitted', reviewed_at = NULL, invoice_id = NULL
       WHERE id = v_sub_id;
    END IF;
  END IF;

  DELETE FROM public.tm_invoices WHERE id = p_invoice_id;
END;
$$;

REVOKE ALL ON FUNCTION public.tm_delete_invoice(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.tm_delete_invoice(UUID) TO authenticated;

-- Invoice numbers: TM-YYYYMM-NNN, filling gaps left by deleted invoices.
-- Serialised per month with a transaction-scoped advisory lock so concurrent inserts cannot pick the same number.
CREATE OR REPLACE FUNCTION public.tm_set_invoice_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  year_month TEXT;
  seq_num INT;
BEGIN
  year_month := LPAD(NEW.year::TEXT, 4, '0') || LPAD(NEW.month::TEXT, 2, '0');
  PERFORM pg_advisory_xact_lock(hashtext('tm_invoices:' || year_month));
  SELECT COALESCE(
    (SELECT s FROM generate_series(1, 999) s
     WHERE s NOT IN (
       SELECT CAST(SUBSTRING(invoice_number FROM '[0-9]+$') AS INT)
       FROM public.tm_invoices
       WHERE invoice_number LIKE 'TM-' || year_month || '-%'
     )
     ORDER BY s LIMIT 1),
    1
  ) INTO seq_num;
  NEW.invoice_number := 'TM-' || year_month || '-' || LPAD(seq_num::TEXT, 3, '0');
  RETURN NEW;
END;
$$;
```

The trigger `tm_set_invoice_number` itself (BEFORE INSERT, WHEN invoice_number IS NULL) already exists and keeps pointing at the replaced function.

- [ ] **Step 4: Run the tests, regenerate types, reseed**

```bash
npx supabase db reset && npm run db:test 2>&1 | tail -8
npm run db:types && npx tsc --noEmit
npm run seed:test-users && npm run import:master-list
```

Expected: `tm_invoices.test.sql ... ok`, `Result: PASS`, 8 files; `types.ts` gains `tm_delete_invoice: { Args: { p_invoice_id: string }; Returns: undefined }`; tsc clean.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260908100000_tm_invoices.sql supabase/tests/tm_invoices.test.sql src/lib/supabase/types.ts
git commit -m "feat(db): tm_delete_invoice and advisory-locked invoice numbering

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01TkFUEBg6S7PqW49ZKa3C6p"
```

---

### Task 2: Invoice, WhatsApp, and dashboard helpers

**Files:**
- Modify: `src/lib/tm/approvals.ts` (append after `summariseEntries`), `src/lib/tm/approvals.test.ts` (append)
- Create: `src/lib/tm/invoices.ts`, `src/lib/tm/invoices.test.ts`
- Create: `src/lib/tm/whatsapp.ts`, `src/lib/tm/whatsapp.test.ts`
- Create: `src/lib/tm/dashboard.ts`, `src/lib/tm/dashboard.test.ts`

**Interfaces:**
- Consumes: `cents`, `ApprovalEntry` (approvals.ts); `Period`, `currentPeriod`, `parseMonthInput`, `toMonthInput`, `periodLabel` (periods.ts); `MONTH_NAMES`, `formatCurrency` (format.ts); `toNumber`, `TmInvoice`, `TmInvoiceSource` (types.ts).
- Produces (exact names later tasks import):
  - approvals.ts: `interface RateLine { tierLabel: string; rate: number; hours: number; total: number }`, `invoiceLines(entries: Pick<ApprovalEntry, "tier_label" | "parent_rate" | "hours">[]): RateLine[]`
  - invoices.ts: `INVOICE_SELECT`, `InvoiceRow`, `RawInvoiceRow`, `mapInvoiceRow`, `InvoiceEntry`, `RawInvoiceEntryRow`, `mapInvoiceEntry`, `PaidFilter`, `SourceFilter`, `InvoiceFilter`, `defaultFilter`, `filterFromParams`, `filterToParams`, `filterInvoices`, `InvoiceTotals`, `invoiceTotals`, `InvoiceLine`, `manualLine`, `invoiceFileName`
  - whatsapp.ts: `WhatsappInput`, `whatsappText`
  - dashboard.ts: `PendingSubmission`, `RawPendingRow`, `mapPendingRow`, `MonthFigures`, `monthFigures`, `Outstanding`, `outstanding`, `oldestPending`

- [ ] **Step 1: Failing tests**

Append to `src/lib/tm/approvals.test.ts` (add `invoiceLines` to the existing import from `./approvals`):

```ts
describe("invoiceLines", () => {
  it("makes one line per tier label and rate, in first-seen order, with summed hours", () => {
    const lines = invoiceLines([
      { tier_label: "1 to 1", parent_rate: 70, hours: 1.5 },
      { tier_label: "Group", parent_rate: 40, hours: 2 },
      { tier_label: "1 to 1", parent_rate: 70, hours: 1 },
    ])
    expect(lines).toEqual([
      { tierLabel: "1 to 1", rate: 70, hours: 2.5, total: 175 },
      { tierLabel: "Group", rate: 40, hours: 2, total: 80 },
    ])
  })
  it("rounds each line once, half away from zero, like tm_approve_submission", () => {
    const lines = invoiceLines([
      { tier_label: "A", parent_rate: 10.01, hours: 0.5 },
      { tier_label: "B", parent_rate: 10.01, hours: 0.5 },
    ])
    expect(lines.map((l) => l.total)).toEqual([5.01, 5.01])
  })
  it("is empty for no entries", () => {
    expect(invoiceLines([])).toEqual([])
  })
})
```

Create `src/lib/tm/invoices.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import {
  defaultFilter, filterFromParams, filterToParams, filterInvoices, invoiceTotals, manualLine, invoiceFileName,
  mapInvoiceRow, mapInvoiceEntry, type InvoiceRow,
} from "./invoices"

const NOW = new Date(2026, 8, 8)

function row(over: Partial<InvoiceRow>): InvoiceRow {
  return {
    id: "i", invoice_number: "TM-202609-001", assignment_id: "a", year: 2026, month: 9, source: "generated",
    total_hours: 3.5, invoice_amount: 245, tutor_payout: 175, profit: 70, parent_paid_at: null, tutor_paid_at: null, remarks: null,
    code: "AA01", subject: "English", studentName: "Sam", parentName: "Pat", parentPhone: null, address: null, tutorName: "Tina",
    ...over,
  }
}

describe("filter codec", () => {
  it("defaults to the current month and everything else any/all", () => {
    expect(defaultFilter(NOW)).toEqual({ month: { year: 2026, month: 9 }, tutorName: "all", studentName: "all", parentPaid: "any", tutorPaid: "any", source: "any" })
    expect(filterFromParams(new URLSearchParams(""), NOW)).toEqual(defaultFilter(NOW))
  })
  it("reads every key and ignores junk", () => {
    const f = filterFromParams(new URLSearchParams("month=all&tutor=Tina&student=Sam&parent_paid=unpaid&tutor_paid=paid&source=manual&invoice=x"), NOW)
    expect(f).toEqual({ month: "all", tutorName: "Tina", studentName: "Sam", parentPaid: "unpaid", tutorPaid: "paid", source: "manual" })
    expect(filterFromParams(new URLSearchParams("month=2026-13&parent_paid=maybe&source=x"), NOW)).toEqual(defaultFilter(NOW))
  })
  it("round-trips through params", () => {
    const f = { month: { year: 2026, month: 2 }, tutorName: "Tina", studentName: "all", parentPaid: "paid" as const, tutorPaid: "any" as const, source: "generated" as const }
    expect(filterToParams(f).toString()).toBe("month=2026-02&tutor=Tina&parent_paid=paid&source=generated")
    expect(filterFromParams(filterToParams(f), NOW)).toEqual(f)
    expect(filterToParams({ ...defaultFilter(NOW), month: "all" }).toString()).toBe("month=all")
  })
})

describe("filterInvoices", () => {
  const rows = [
    row({ id: "1" }),
    row({ id: "2", month: 8, tutorName: "Zed", parent_paid_at: "2026-09-01" }),
    row({ id: "3", studentName: "Ali", source: "manual", tutor_paid_at: "2026-09-02" }),
  ]
  const ids = (f: Parameters<typeof filterInvoices>[1]) => filterInvoices(rows, f).map((r) => r.id)
  it("filters by month or all months", () => {
    expect(ids(defaultFilter(NOW))).toEqual(["1", "3"])
    expect(ids({ ...defaultFilter(NOW), month: "all" })).toEqual(["1", "2", "3"])
  })
  it("filters by tutor, student, paid state, and source", () => {
    expect(ids({ ...defaultFilter(NOW), month: "all", tutorName: "Zed" })).toEqual(["2"])
    expect(ids({ ...defaultFilter(NOW), studentName: "Ali" })).toEqual(["3"])
    expect(ids({ ...defaultFilter(NOW), month: "all", parentPaid: "paid" })).toEqual(["2"])
    expect(ids({ ...defaultFilter(NOW), month: "all", parentPaid: "unpaid" })).toEqual(["1", "3"])
    expect(ids({ ...defaultFilter(NOW), tutorPaid: "paid" })).toEqual(["3"])
    expect(ids({ ...defaultFilter(NOW), source: "manual" })).toEqual(["3"])
  })
})

describe("invoiceTotals", () => {
  it("sums in cents", () => {
    expect(invoiceTotals([row({ invoice_amount: 0.1, tutor_payout: 0.2, profit: -0.1, total_hours: 1.5 }), row({ invoice_amount: 0.2, tutor_payout: 0.1, profit: 0.1, total_hours: null })]))
      .toEqual({ count: 2, hours: 1.5, amount: 0.3, payout: 0.3, profit: 0 })
    expect(invoiceTotals([])).toEqual({ count: 0, hours: 0, amount: 0, payout: 0, profit: 0 })
  })
})

describe("manualLine and invoiceFileName", () => {
  it("describes a manual invoice as one line", () => {
    expect(manualLine(row({ source: "manual", total_hours: null, invoice_amount: 100 }))).toEqual({ description: "Sam English", hours: null, rate: null, total: 100 })
  })
  it("names the PDF after the student and month", () => {
    expect(invoiceFileName(row({}))).toBe("Sam Sep'26 Invoice.pdf")
    expect(invoiceFileName(row({ year: 2027, month: 1 }))).toBe("Sam Jan'27 Invoice.pdf")
  })
})

describe("mappers", () => {
  it("maps a PostgREST invoice row with nested embeds and numeric strings", () => {
    const r = mapInvoiceRow({
      id: "i", invoice_number: "TM-202609-001", assignment_id: "a", year: 2026, month: 9, source: "generated",
      total_hours: "3.50", invoice_amount: "245.00", tutor_payout: "175.00", profit: "70.00", parent_paid_at: null, tutor_paid_at: "2026-09-02", remarks: null,
      tm_assignments: { code: "AA01", subject: "English", tm_students: { name: "Sam", parent_name: "Pat", parent_phone: "9", address: "1 Road" }, tm_tutors: { name: "Tina" } },
    })
    expect(r).toMatchObject({ total_hours: 3.5, invoice_amount: 245, tutor_payout: 175, profit: 70, code: "AA01", studentName: "Sam", parentName: "Pat", parentPhone: "9", address: "1 Road", tutorName: "Tina" })
    expect(mapInvoiceRow({ id: "i", invoice_number: null, assignment_id: "a", year: 2026, month: 9, source: "manual", total_hours: null, invoice_amount: "1", tutor_payout: "0", profit: "1", parent_paid_at: null, tutor_paid_at: null, remarks: "r", tm_assignments: null }))
      .toMatchObject({ total_hours: null, code: "", studentName: "", parentName: null, tutorName: "" })
  })
  it("maps an entry row", () => {
    expect(mapInvoiceEntry({ id: "e", date: "2026-09-04", start_time: "14:00:00", end_time: "15:30:00", hours: "1.50", tier_label: "1 to 1", parent_rate: "70.00", tutor_rate: "50.00", note: null }))
      .toEqual({ id: "e", date: "2026-09-04", start_time: "14:00", end_time: "15:30", hours: 1.5, tier_label: "1 to 1", parent_rate: 70, tutor_rate: 50, note: null })
  })
})
```

Create `src/lib/tm/whatsapp.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { whatsappText } from "./whatsapp"

describe("whatsappText", () => {
  it("renders the template with one rate line per tier", () => {
    const text = whatsappText({
      parentName: "Pat", studentName: "Sam", subject: "English", period: { year: 2026, month: 9 }, totalHours: 3.5,
      lines: [{ tierLabel: "1 to 1", rate: 70, hours: 2.5, total: 175 }, { tierLabel: "Group", rate: 40, hours: 1, total: 40 }],
      invoiceAmount: 215, paymentDetails: "PayNow UEN 202411710M",
    })
    expect(text).toBe([
      "Hi Pat, here's Sam's tuition invoice for September 2026:",
      "",
      "Subject: English",
      "Sessions: 3.50 hrs total",
      "Rate: $70.00/hr (1 to 1)",
      "Rate: $40.00/hr (Group)",
      "Amount due: $215.00",
      "",
      "Payment details: PayNow UEN 202411710M",
      "",
      "Thank you! — EduOwl Tutor Matching",
    ].join("\n"))
  })
  it("falls back to 'there' without a parent and omits hours and rates for a manual invoice", () => {
    const text = whatsappText({ parentName: null, studentName: "Sam", subject: "Math", period: { year: 2026, month: 1 }, totalHours: null, lines: [], invoiceAmount: 100, paymentDetails: "PayNow" })
    expect(text).toBe([
      "Hi there, here's Sam's tuition invoice for January 2026:",
      "",
      "Subject: Math",
      "Amount due: $100.00",
      "",
      "Payment details: PayNow",
      "",
      "Thank you! — EduOwl Tutor Matching",
    ].join("\n"))
  })
})
```

Create `src/lib/tm/dashboard.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { monthFigures, outstanding, oldestPending, mapPendingRow, type PendingSubmission } from "./dashboard"

const inv = (over: { year?: number; month?: number; invoice_amount?: number; tutor_payout?: number; profit?: number; parent_paid_at?: string | null; tutor_paid_at?: string | null }) => ({
  year: 2026, month: 9, invoice_amount: 100, tutor_payout: 60, profit: 40, parent_paid_at: null, tutor_paid_at: null, ...over,
})
const sub = (over: Partial<PendingSubmission>): PendingSubmission => ({
  id: "s", code: "AA01", subject: "English", studentName: "Sam", tutorName: "Tina", year: 2026, month: 9, submitted_at: "2026-09-05T00:00:00Z", ...over,
})

describe("monthFigures", () => {
  it("sums the picked month only and counts its pending submissions", () => {
    const f = monthFigures([inv({}), inv({ invoice_amount: 0.1, tutor_payout: 0.2, profit: -0.1 }), inv({ month: 8, invoice_amount: 999 })], [sub({}), sub({ id: "t", month: 8 })], { year: 2026, month: 9 })
    expect(f).toEqual({ pending: 1, invoiced: 100.1, payouts: 60.2, profit: 39.9 })
  })
})

describe("outstanding", () => {
  it("counts and sums unpaid invoices across all months", () => {
    const o = outstanding([inv({}), inv({ month: 8, parent_paid_at: "2026-09-01" }), inv({ month: 7, tutor_paid_at: "2026-09-01", invoice_amount: 50, tutor_payout: 30 })])
    expect(o).toEqual({ parentCount: 2, parentSum: 150, tutorCount: 2, tutorSum: 120 })
  })
})

describe("oldestPending", () => {
  it("orders by submitted_at ascending and caps", () => {
    const list = oldestPending([sub({ id: "c", submitted_at: "2026-09-03T00:00:00Z" }), sub({ id: "a", submitted_at: "2026-09-01T00:00:00Z" }), sub({ id: "b", submitted_at: "2026-09-02T00:00:00Z" })], 2)
    expect(list.map((s) => s.id)).toEqual(["a", "b"])
  })
})

describe("mapPendingRow", () => {
  it("maps embeds and tolerates nulls", () => {
    expect(mapPendingRow({ id: "s", year: 2026, month: 9, submitted_at: null, tm_assignments: { code: "AA01", subject: "English", tm_students: { name: "Sam" } }, tm_tutors: { name: "Tina" } }))
      .toEqual({ id: "s", code: "AA01", subject: "English", studentName: "Sam", tutorName: "Tina", year: 2026, month: 9, submitted_at: null })
    expect(mapPendingRow({ id: "s", year: 2026, month: 9, submitted_at: null, tm_assignments: null, tm_tutors: null })).toMatchObject({ code: "", studentName: "", tutorName: "" })
  })
})
```

- [ ] **Step 2: Run to see them fail**

```bash
npx vitest run src/lib/tm/approvals.test.ts src/lib/tm/invoices.test.ts src/lib/tm/whatsapp.test.ts src/lib/tm/dashboard.test.ts
```

Expected: FAIL (missing export `invoiceLines`; cannot resolve `./invoices`, `./whatsapp`, `./dashboard`).

- [ ] **Step 3: `invoiceLines`**

Append to `src/lib/tm/approvals.ts` after `summariseEntries`:

```ts
export interface RateLine {
  tierLabel: string
  rate: number
  hours: number
  total: number
}

/** One line per (tier label, parent rate) in first-seen order; each total rounded once, like tm_approve_submission. */
export function invoiceLines(entries: Pick<ApprovalEntry, "tier_label" | "parent_rate" | "hours">[]): RateLine[] {
  const lines = new Map<string, { tierLabel: string; rate: number; hourCents: number; tenThousandths: number }>()
  for (const e of entries) {
    const key = `${e.tier_label}|${e.parent_rate}`
    const line = lines.get(key) ?? { tierLabel: e.tier_label, rate: e.parent_rate, hourCents: 0, tenThousandths: 0 }
    line.hourCents += cents(e.hours)
    line.tenThousandths += cents(e.hours) * cents(e.parent_rate)
    lines.set(key, line)
  }
  return Array.from(lines.values()).map((l) => ({
    tierLabel: l.tierLabel,
    rate: l.rate,
    hours: l.hourCents / 100,
    total: Math.round(l.tenThousandths / 100) / 100,
  }))
}
```

- [ ] **Step 4: `invoices.ts`**

Create `src/lib/tm/invoices.ts`:

```ts
import { currentPeriod, parseMonthInput, toMonthInput, type Period } from "@/lib/tm/periods"
import { MONTH_NAMES } from "@/lib/format"
import { toNumber, type TmInvoice, type TmInvoiceSource } from "@/lib/tm/types"

/** Select string for tm_invoices with the names the list, detail, WhatsApp, PDF, and dashboard need. */
export const INVOICE_SELECT =
  "*, tm_assignments(code, subject, tm_students(name, parent_name, parent_phone, address), tm_tutors(name))"

export interface InvoiceRow extends TmInvoice {
  code: string
  subject: string
  studentName: string
  parentName: string | null
  parentPhone: string | null
  address: string | null
  tutorName: string
}

export interface RawInvoiceRow {
  id: string
  invoice_number: string | null
  assignment_id: string
  year: number
  month: number
  source: string
  total_hours: string | number | null
  invoice_amount: string | number | null
  tutor_payout: string | number | null
  profit: string | number | null
  parent_paid_at: string | null
  tutor_paid_at: string | null
  remarks: string | null
  tm_assignments: {
    code: string
    subject: string
    tm_students: { name: string; parent_name: string | null; parent_phone: string | null; address: string | null } | null
    tm_tutors: { name: string } | null
  } | null
}

export function mapInvoiceRow(r: RawInvoiceRow): InvoiceRow {
  return {
    id: r.id,
    invoice_number: r.invoice_number,
    assignment_id: r.assignment_id,
    year: r.year,
    month: r.month,
    source: r.source as TmInvoiceSource,
    total_hours: toNumber(r.total_hours),
    invoice_amount: toNumber(r.invoice_amount) ?? 0,
    tutor_payout: toNumber(r.tutor_payout) ?? 0,
    profit: toNumber(r.profit) ?? 0,
    parent_paid_at: r.parent_paid_at,
    tutor_paid_at: r.tutor_paid_at,
    remarks: r.remarks,
    code: r.tm_assignments?.code ?? "",
    subject: r.tm_assignments?.subject ?? "",
    studentName: r.tm_assignments?.tm_students?.name ?? "",
    parentName: r.tm_assignments?.tm_students?.parent_name ?? null,
    parentPhone: r.tm_assignments?.tm_students?.parent_phone ?? null,
    address: r.tm_assignments?.tm_students?.address ?? null,
    tutorName: r.tm_assignments?.tm_tutors?.name ?? "",
  }
}

export interface InvoiceEntry {
  id: string
  date: string
  start_time: string | null
  end_time: string | null
  hours: number
  tier_label: string
  parent_rate: number
  tutor_rate: number
  note: string | null
}

export interface RawInvoiceEntryRow {
  id: string
  date: string
  start_time: string | null
  end_time: string | null
  hours: string | number | null
  tier_label: string | null
  parent_rate: string | number | null
  tutor_rate: string | number | null
  note: string | null
}

export function mapInvoiceEntry(r: RawInvoiceEntryRow): InvoiceEntry {
  return {
    id: r.id,
    date: r.date,
    start_time: r.start_time ? r.start_time.slice(0, 5) : null,
    end_time: r.end_time ? r.end_time.slice(0, 5) : null,
    hours: toNumber(r.hours) ?? 0,
    tier_label: r.tier_label ?? "",
    parent_rate: toNumber(r.parent_rate) ?? 0,
    tutor_rate: toNumber(r.tutor_rate) ?? 0,
    note: r.note,
  }
}

// ---- Filters, carried in the URL ----

export type PaidFilter = "any" | "paid" | "unpaid"
export type SourceFilter = "any" | TmInvoiceSource

export interface InvoiceFilter {
  month: Period | "all"
  tutorName: string
  studentName: string
  parentPaid: PaidFilter
  tutorPaid: PaidFilter
  source: SourceFilter
}

export function defaultFilter(now: Date = new Date()): InvoiceFilter {
  return { month: currentPeriod(now), tutorName: "all", studentName: "all", parentPaid: "any", tutorPaid: "any", source: "any" }
}

function paidFilter(v: string | null): PaidFilter {
  return v === "paid" || v === "unpaid" ? v : "any"
}

export function filterFromParams(params: URLSearchParams, now: Date = new Date()): InvoiceFilter {
  const d = defaultFilter(now)
  const m = params.get("month")
  const month: Period | "all" = m === "all" ? "all" : m ? parseMonthInput(m) ?? d.month : d.month
  const src = params.get("source")
  return {
    month,
    tutorName: params.get("tutor") || "all",
    studentName: params.get("student") || "all",
    parentPaid: paidFilter(params.get("parent_paid")),
    tutorPaid: paidFilter(params.get("tutor_paid")),
    source: src === "generated" || src === "manual" ? src : "any",
  }
}

/** Only non-default keys are written, except month, which is always explicit. */
export function filterToParams(f: InvoiceFilter): URLSearchParams {
  const p = new URLSearchParams()
  p.set("month", f.month === "all" ? "all" : toMonthInput(f.month))
  if (f.tutorName !== "all") p.set("tutor", f.tutorName)
  if (f.studentName !== "all") p.set("student", f.studentName)
  if (f.parentPaid !== "any") p.set("parent_paid", f.parentPaid)
  if (f.tutorPaid !== "any") p.set("tutor_paid", f.tutorPaid)
  if (f.source !== "any") p.set("source", f.source)
  return p
}

function paidMatches(value: string | null, f: PaidFilter): boolean {
  return f === "any" || (f === "paid" ? value !== null : value === null)
}

export function filterInvoices(rows: InvoiceRow[], f: InvoiceFilter): InvoiceRow[] {
  return rows.filter((r) =>
    (f.month === "all" || (r.year === f.month.year && r.month === f.month.month)) &&
    (f.tutorName === "all" || r.tutorName === f.tutorName) &&
    (f.studentName === "all" || r.studentName === f.studentName) &&
    paidMatches(r.parent_paid_at, f.parentPaid) &&
    paidMatches(r.tutor_paid_at, f.tutorPaid) &&
    (f.source === "any" || r.source === f.source),
  )
}

// ---- Totals and lines ----

function cents(n: number): number {
  return Math.round(n * 100)
}

export interface InvoiceTotals {
  count: number
  hours: number
  amount: number
  payout: number
  profit: number
}

export function invoiceTotals(rows: InvoiceRow[]): InvoiceTotals {
  let hours = 0, amount = 0, payout = 0, profit = 0
  for (const r of rows) {
    hours += cents(r.total_hours ?? 0)
    amount += cents(r.invoice_amount)
    payout += cents(r.tutor_payout)
    profit += cents(r.profit)
  }
  return { count: rows.length, hours: hours / 100, amount: amount / 100, payout: payout / 100, profit: profit / 100 }
}

export interface InvoiceLine {
  description: string
  hours: number | null
  rate: number | null
  total: number
}

export function manualLine(row: InvoiceRow): InvoiceLine {
  return { description: `${row.studentName} ${row.subject}`.trim(), hours: row.total_hours, rate: null, total: row.invoice_amount }
}

export function invoiceFileName(row: InvoiceRow): string {
  return `${row.studentName} ${MONTH_NAMES[row.month - 1].slice(0, 3)}'${String(row.year).slice(-2)} Invoice.pdf`
}
```

- [ ] **Step 5: `whatsapp.ts`**

Create `src/lib/tm/whatsapp.ts`:

```ts
import { MONTH_NAMES, formatCurrency } from "@/lib/format"
import type { Period } from "@/lib/tm/periods"
import type { RateLine } from "@/lib/tm/approvals"

export interface WhatsappInput {
  parentName: string | null
  studentName: string
  subject: string
  period: Period
  totalHours: number | null
  lines: RateLine[]
  invoiceAmount: number
  paymentDetails: string
}

/** The parent-facing message from the spec, one Rate line per tier used. */
export function whatsappText(i: WhatsappInput): string {
  const out: string[] = [
    `Hi ${i.parentName || "there"}, here's ${i.studentName}'s tuition invoice for ${MONTH_NAMES[i.period.month - 1]} ${i.period.year}:`,
    "",
    `Subject: ${i.subject}`,
  ]
  if (i.totalHours !== null) out.push(`Sessions: ${i.totalHours.toFixed(2)} hrs total`)
  for (const l of i.lines) out.push(`Rate: ${formatCurrency(l.rate)}/hr (${l.tierLabel})`)
  out.push(`Amount due: ${formatCurrency(i.invoiceAmount)}`, "", `Payment details: ${i.paymentDetails}`, "", "Thank you! — EduOwl Tutor Matching")
  return out.join("\n")
}
```

- [ ] **Step 6: `dashboard.ts`**

Create `src/lib/tm/dashboard.ts`:

```ts
import type { Period } from "@/lib/tm/periods"

export interface PendingSubmission {
  id: string
  code: string
  subject: string
  studentName: string
  tutorName: string
  year: number
  month: number
  submitted_at: string | null
}

export interface RawPendingRow {
  id: string
  year: number
  month: number
  submitted_at: string | null
  tm_assignments: { code: string; subject: string; tm_students: { name: string } | null } | null
  tm_tutors: { name: string } | null
}

export function mapPendingRow(r: RawPendingRow): PendingSubmission {
  return {
    id: r.id,
    code: r.tm_assignments?.code ?? "",
    subject: r.tm_assignments?.subject ?? "",
    studentName: r.tm_assignments?.tm_students?.name ?? "",
    tutorName: r.tm_tutors?.name ?? "",
    year: r.year,
    month: r.month,
    submitted_at: r.submitted_at,
  }
}

type InvoiceMoney = { year: number; month: number; invoice_amount: number; tutor_payout: number; profit: number; parent_paid_at: string | null; tutor_paid_at: string | null }

function cents(n: number): number {
  return Math.round(n * 100)
}

export interface MonthFigures {
  pending: number
  invoiced: number
  payouts: number
  profit: number
}

export function monthFigures(invoices: InvoiceMoney[], submissions: { year: number; month: number }[], period: Period): MonthFigures {
  const inMonth = invoices.filter((i) => i.year === period.year && i.month === period.month)
  const sum = (pick: (i: InvoiceMoney) => number) => inMonth.reduce((s, i) => s + cents(pick(i)), 0) / 100
  return {
    pending: submissions.filter((s) => s.year === period.year && s.month === period.month).length,
    invoiced: sum((i) => i.invoice_amount),
    payouts: sum((i) => i.tutor_payout),
    profit: sum((i) => i.profit),
  }
}

export interface Outstanding {
  parentCount: number
  parentSum: number
  tutorCount: number
  tutorSum: number
}

export function outstanding(invoices: InvoiceMoney[]): Outstanding {
  const parent = invoices.filter((i) => i.parent_paid_at === null)
  const tutor = invoices.filter((i) => i.tutor_paid_at === null)
  return {
    parentCount: parent.length,
    parentSum: parent.reduce((s, i) => s + cents(i.invoice_amount), 0) / 100,
    tutorCount: tutor.length,
    tutorSum: tutor.reduce((s, i) => s + cents(i.tutor_payout), 0) / 100,
  }
}

export function oldestPending(subs: PendingSubmission[], limit = 5): PendingSubmission[] {
  return [...subs].sort((a, b) => (a.submitted_at ?? "").localeCompare(b.submitted_at ?? "")).slice(0, limit)
}
```

- [ ] **Step 7: Run the tests**

```bash
npx vitest run src/lib/tm && npx tsc --noEmit
```

Expected: all pass, tsc clean.

- [ ] **Step 8: Commit**

```bash
git add src/lib/tm/approvals.ts src/lib/tm/approvals.test.ts src/lib/tm/invoices.ts src/lib/tm/invoices.test.ts src/lib/tm/whatsapp.ts src/lib/tm/whatsapp.test.ts src/lib/tm/dashboard.ts src/lib/tm/dashboard.test.ts
git commit -m "feat(tm): invoice, WhatsApp, and dashboard helpers

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01TkFUEBg6S7PqW49ZKa3C6p"
```

---

### Task 3: Navigation

**Files:**
- Modify: `src/lib/workspace.test.ts` ("lists the tutor matching admin screens in order")
- Modify: `src/lib/workspace.ts` (`NAV_ITEMS.tm`)

**Interfaces:**
- Produces: nav item `{ label: "Invoices", href: "/tm/invoices" }` third in `NAV_ITEMS.tm`. The sidebar `ICONS` map already has `Invoices: FileText`; the header derives the page title from the nav label.

- [ ] **Step 1: Failing nav test**

In `src/lib/workspace.test.ts`, the expected array becomes:

```ts
    expect(NAV_ITEMS.tm.map((i) => [i.label, i.href])).toEqual([
      ["Dashboard", "/tm"],
      ["Pending Approvals", "/tm/approvals"],
      ["Invoices", "/tm/invoices"],
      ["Tutors", "/tm/tutors"],
      ["Students & Assignments", "/tm/students"],
      ["Master List", "/tm/master-list"],
      ["Settings", "/tm/settings"],
    ])
```

Run `npx vitest run src/lib/workspace.test.ts`. Expected: FAIL on that test.

- [ ] **Step 2: Add the item**

In `src/lib/workspace.ts`, insert after the Pending Approvals line:

```ts
    { label: "Invoices", href: "/tm/invoices" },
```

- [ ] **Step 3: Verify and commit**

```bash
npx vitest run src/lib/workspace.test.ts && npx tsc --noEmit
git add src/lib/workspace.ts src/lib/workspace.test.ts
git commit -m "feat(tm): Invoices nav item

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01TkFUEBg6S7PqW49ZKa3C6p"
```

---

### Task 4: Invoices list page with filters

**Files:**
- Create: `src/components/tm/invoice-filters.tsx`
- Create: `src/components/tm/invoice-table.tsx`
- Create: `src/app/(dashboard)/tm/invoices/page.tsx`

**Interfaces:**
- Consumes: Task 2 `invoices.ts` exports; `fetchAll` (`src/lib/supabase/fetch-all.ts`); `periodLabel`, `toMonthInput`, `parseMonthInput`, `currentPeriod`; `formatCurrency`; `formatHours` (`src/lib/portal/timesheet.ts`).
- Produces: `InvoiceFilters({ filter, onChange, tutorNames, studentNames })`; `InvoiceTable({ rows, detailHref, renderActions? })`. The page owns `rows`, `filter` (from the URL), `load()`, and two placeholders that Tasks 5 and 6 replace: the actions column and the detail branch.

- [ ] **Step 1: Filter bar**

Create `src/components/tm/invoice-filters.tsx`:

```tsx
"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { currentPeriod, parseMonthInput, toMonthInput } from "@/lib/tm/periods"
import type { InvoiceFilter, PaidFilter, SourceFilter } from "@/lib/tm/invoices"

interface Props {
  filter: InvoiceFilter
  onChange: (f: InvoiceFilter) => void
  tutorNames: string[]
  studentNames: string[]
}

export function InvoiceFilters({ filter, onChange, tutorNames, studentNames }: Props) {
  const allMonths = filter.month === "all"
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label htmlFor="inv-month">Month</Label>
        <div className="flex gap-2">
          <Input
            id="inv-month" type="month" className="w-[160px]"
            value={allMonths ? "" : toMonthInput(filter.month)}
            onChange={(e) => { const p = parseMonthInput(e.target.value); if (p) onChange({ ...filter, month: p }) }}
          />
          <Button
            type="button" variant={allMonths ? "default" : "outline"} aria-pressed={allMonths}
            onClick={() => onChange({ ...filter, month: allMonths ? currentPeriod() : "all" })}
          >
            All months
          </Button>
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="inv-tutor">Tutor</Label>
        <Select value={filter.tutorName} onValueChange={(v) => onChange({ ...filter, tutorName: v })}>
          <SelectTrigger id="inv-tutor" className="w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tutors</SelectItem>
            {tutorNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="inv-student">Student</Label>
        <Select value={filter.studentName} onValueChange={(v) => onChange({ ...filter, studentName: v })}>
          <SelectTrigger id="inv-student" className="w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All students</SelectItem>
            {studentNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="inv-parent-paid">Parent paid</Label>
        <Select value={filter.parentPaid} onValueChange={(v) => onChange({ ...filter, parentPaid: v as PaidFilter })}>
          <SelectTrigger id="inv-parent-paid" className="w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="unpaid">Unpaid</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="inv-tutor-paid">Tutor paid</Label>
        <Select value={filter.tutorPaid} onValueChange={(v) => onChange({ ...filter, tutorPaid: v as PaidFilter })}>
          <SelectTrigger id="inv-tutor-paid" className="w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="unpaid">Unpaid</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="inv-source">Source</Label>
        <Select value={filter.source} onValueChange={(v) => onChange({ ...filter, source: v as SourceFilter })}>
          <SelectTrigger id="inv-source" className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any</SelectItem>
            <SelectItem value="generated">Generated</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Table**

Create `src/components/tm/invoice-table.tsx`:

```tsx
"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatCurrency } from "@/lib/format"
import { periodLabel } from "@/lib/tm/periods"
import { formatHours } from "@/lib/portal/timesheet"
import { invoiceTotals, type InvoiceRow } from "@/lib/tm/invoices"

interface Props {
  rows: InvoiceRow[]
  detailHref: (id: string) => string
  renderActions?: (row: InvoiceRow) => ReactNode
}

export function paidLabel(value: string | null): string {
  return value ?? "Unpaid"
}

export function InvoiceTable({ rows, detailHref, renderActions }: Props) {
  if (rows.length === 0) {
    return <Card><CardContent className="py-6 text-sm text-muted-foreground">No invoices match these filters.</CardContent></Card>
  }
  const t = invoiceTotals(rows)
  return (
    <div className="overflow-x-auto rounded-md border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice</TableHead>
            <TableHead>Month</TableHead>
            <TableHead>Code</TableHead>
            <TableHead>Tutor</TableHead>
            <TableHead>Student</TableHead>
            <TableHead>Subject</TableHead>
            <TableHead className="text-right">Hours</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-right">Payout</TableHead>
            <TableHead className="text-right">Profit</TableHead>
            <TableHead>Parent paid</TableHead>
            <TableHead>Tutor paid</TableHead>
            <TableHead>Source</TableHead>
            {renderActions && <TableHead />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">
                <Link href={detailHref(r.id)} className="text-primary underline">{r.invoice_number ?? "(no number)"}</Link>
              </TableCell>
              <TableCell>{periodLabel({ year: r.year, month: r.month })}</TableCell>
              <TableCell>{r.code}</TableCell>
              <TableCell>{r.tutorName}</TableCell>
              <TableCell>{r.studentName}</TableCell>
              <TableCell>{r.subject}</TableCell>
              <TableCell className="text-right">{r.total_hours === null ? "" : formatHours(r.total_hours)}</TableCell>
              <TableCell className="text-right">{formatCurrency(r.invoice_amount)}</TableCell>
              <TableCell className="text-right">{formatCurrency(r.tutor_payout)}</TableCell>
              <TableCell className="text-right">{formatCurrency(r.profit)}</TableCell>
              <TableCell>{paidLabel(r.parent_paid_at)}</TableCell>
              <TableCell>{paidLabel(r.tutor_paid_at)}</TableCell>
              <TableCell><Badge variant={r.source === "generated" ? "secondary" : "outline"}>{r.source === "generated" ? "Generated" : "Manual"}</Badge></TableCell>
              {renderActions && <TableCell className="text-right">{renderActions(r)}</TableCell>}
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={6}>{t.count} invoice{t.count === 1 ? "" : "s"}</TableCell>
            <TableCell className="text-right">{formatHours(t.hours)}</TableCell>
            <TableCell className="text-right">{formatCurrency(t.amount)}</TableCell>
            <TableCell className="text-right">{formatCurrency(t.payout)}</TableCell>
            <TableCell className="text-right">{formatCurrency(t.profit)}</TableCell>
            <TableCell colSpan={renderActions ? 4 : 3} />
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  )
}
```

- [ ] **Step 3: Page**

Create `src/app/(dashboard)/tm/invoices/page.tsx`:

```tsx
"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { fetchAll } from "@/lib/supabase/fetch-all"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { InvoiceFilters } from "@/components/tm/invoice-filters"
import { InvoiceTable } from "@/components/tm/invoice-table"
import {
  INVOICE_SELECT, filterFromParams, filterInvoices, filterToParams, mapInvoiceRow,
  type InvoiceFilter, type InvoiceRow, type RawInvoiceRow,
} from "@/lib/tm/invoices"

function Invoices() {
  const params = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()
  const [rows, setRows] = useState<InvoiceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const filter = useMemo(() => filterFromParams(params), [params])
  const selectedId = params.get("invoice")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const res = await fetchAll(() =>
      supabase.from("tm_invoices").select(INVOICE_SELECT)
        .order("year", { ascending: false }).order("month", { ascending: false }).order("invoice_number"),
    )
    if (res.error) {
      setError(res.error.message)
      toast({ title: "Could not load invoices", description: res.error.message, variant: "destructive" })
      setLoading(false)
      return
    }
    setRows((res.data as unknown as RawInvoiceRow[]).map(mapInvoiceRow))
    setLoading(false)
  }, [toast])

  useEffect(() => { load() }, [load])

  const listHref = `/tm/invoices?${filterToParams(filter).toString()}`
  function setFilter(f: InvoiceFilter) {
    router.replace(`/tm/invoices?${filterToParams(f).toString()}`)
  }
  function detailHref(id: string) {
    const p = filterToParams(filter)
    p.set("invoice", id)
    return `/tm/invoices?${p.toString()}`
  }

  const visible = useMemo(() => filterInvoices(rows, filter), [rows, filter])
  const tutorNames = useMemo(() => Array.from(new Set(rows.map((r) => r.tutorName).filter(Boolean))).sort(), [rows])
  const studentNames = useMemo(() => Array.from(new Set(rows.map((r) => r.studentName).filter(Boolean))).sort(), [rows])

  if (loading) return <Skeleton className="h-96 w-full" />
  if (error) return <Card><CardContent className="py-6 text-sm text-destructive">{error}</CardContent></Card>

  if (selectedId) {
    const row = rows.find((r) => r.id === selectedId)
    if (!row) {
      return (
        <Card>
          <CardContent className="py-6 space-y-2 text-sm">
            <p>This invoice no longer exists</p>
            <Link href={listHref} className="text-primary underline">Back to invoices</Link>
          </CardContent>
        </Card>
      )
    }
    // Task 6 replaces this with <InvoiceDetail row={row} handlers={handlers} onChanged={load} backHref={listHref} />
    return <Card><CardContent className="py-6 text-sm">{row.invoice_number}</CardContent></Card>
  }

  return (
    <div className="space-y-4">
      <InvoiceFilters filter={filter} onChange={setFilter} tutorNames={tutorNames} studentNames={studentNames} />
      {/* Task 5 adds the "New manual invoice" button, the dialogs, and renderActions */}
      <InvoiceTable rows={visible} detailHref={detailHref} />
    </div>
  )
}

export default function InvoicesPage() {
  return (
    <Suspense>
      <Invoices />
    </Suspense>
  )
}
```

The one `as unknown as RawInvoiceRow[]` cast next to the mapper is the sanctioned handling of the embedded select; keep it there and nowhere else.

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit && npm test
```

Expected: clean; 118 plus the Task 2 tests pass. Do not start the dev server; Task 8's Playwright run covers the browser.

- [ ] **Step 5: Commit**

```bash
git add src/components/tm/invoice-filters.tsx src/components/tm/invoice-table.tsx "src/app/(dashboard)/tm/invoices/page.tsx"
git commit -m "feat(tm): invoices list with URL-backed filters

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01TkFUEBg6S7PqW49ZKa3C6p"
```

---

### Task 5: Row actions, paid and delete dialogs, WhatsApp copy, manual invoice

**Files:**
- Create: `src/components/tm/invoice-data.ts`
- Create: `src/components/tm/invoice-actions.tsx`
- Create: `src/components/tm/manual-invoice-form.tsx`
- Modify: `src/app/(dashboard)/tm/invoices/page.tsx`

**Interfaces:**
- Consumes: Task 2 helpers (`invoiceLines`, `whatsappText`, `InvoiceRow`, `InvoiceEntry`, `RawInvoiceEntryRow`, `mapInvoiceEntry`); RPC `tm_delete_invoice(p_invoice_id)`; `TmSettings` (`src/lib/tm/types.ts`); UI `dropdown-menu`, `dialog`, `tooltip`, `input`, `label`, `textarea`, `select`.
- Produces:
  - `invoice-data.ts`: `loadInvoiceEntries(row): Promise<InvoiceEntry[]>` (empty for manual), `loadInvoiceContext(row): Promise<{ settings: TmSettings; entries: InvoiceEntry[] }>`; both throw `Error(message)` on a query failure.
  - `invoice-actions.tsx`: `type PaidWhich = "parent" | "tutor"`, `interface InvoiceActionHandlers { onCopy(row); onDownload(row); onPaid(row, which); onDelete(row) }`, `InvoiceMenu({ row, handlers })`, `InvoiceActionButtons({ row, handlers })`, `PaidDialog({ target, onClose, onSaved })` with `target: { row: InvoiceRow; which: PaidWhich } | null`, `DeleteDialog({ target, onClose, onDeleted })` with `target: InvoiceRow | null`.
  - `manual-invoice-form.tsx`: `ManualInvoiceDialog({ open, onOpenChange, onCreated })`.
  - The page exposes `handlers: InvoiceActionHandlers` to Task 6; `onDownload` is a placeholder toast until Task 6.

- [ ] **Step 1: Data loaders**

Create `src/components/tm/invoice-data.ts`:

```ts
import { createClient } from "@/lib/supabase/client"
import type { TmSettings } from "@/lib/tm/types"
import { mapInvoiceEntry, type InvoiceEntry, type InvoiceRow, type RawInvoiceEntryRow } from "@/lib/tm/invoices"

/** Entries billed on a generated invoice, oldest first. Manual invoices have none. */
export async function loadInvoiceEntries(row: InvoiceRow): Promise<InvoiceEntry[]> {
  if (row.source !== "generated") return []
  const supabase = createClient()
  const { data, error } = await supabase
    .from("tm_timesheet_entries")
    .select("id, date, start_time, end_time, hours, tier_label, parent_rate, tutor_rate, note")
    .eq("invoice_id", row.id)
    .order("date")
    .order("start_time", { nullsFirst: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as RawInvoiceEntryRow[]).map(mapInvoiceEntry)
}

/** Everything WhatsApp text and the PDF need beyond the row itself. */
export async function loadInvoiceContext(row: InvoiceRow): Promise<{ settings: TmSettings; entries: InvoiceEntry[] }> {
  const supabase = createClient()
  const [settingsRes, entries] = await Promise.all([
    supabase.from("tm_settings").select("*").limit(1).maybeSingle(),
    loadInvoiceEntries(row),
  ])
  if (settingsRes.error) throw new Error(settingsRes.error.message)
  if (!settingsRes.data) throw new Error("Tutor Matching settings are missing")
  return { settings: settingsRes.data as TmSettings, entries }
}
```

- [ ] **Step 2: Actions, menu, and dialogs**

Create `src/components/tm/invoice-actions.tsx`:

```tsx
"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useToast } from "@/hooks/use-toast"
import { MoreHorizontal } from "lucide-react"
import { todayIso } from "@/lib/portal/sessions"
import { periodLabel } from "@/lib/tm/periods"
import type { InvoiceRow } from "@/lib/tm/invoices"

export type PaidWhich = "parent" | "tutor"

export interface InvoiceActionHandlers {
  onCopy: (row: InvoiceRow) => void
  onDownload: (row: InvoiceRow) => void
  onPaid: (row: InvoiceRow, which: PaidWhich) => void
  onDelete: (row: InvoiceRow) => void
}

function paidItemLabel(row: InvoiceRow, which: PaidWhich): string {
  const set = which === "parent" ? row.parent_paid_at : row.tutor_paid_at
  const noun = which === "parent" ? "parent" : "tutor"
  return set ? `Edit ${noun} paid date` : `Mark ${noun} paid`
}

function deleteBlocked(row: InvoiceRow): boolean {
  return row.parent_paid_at !== null || row.tutor_paid_at !== null
}

export function InvoiceMenu({ row, handlers }: { row: InvoiceRow; handlers: InvoiceActionHandlers }) {
  const blocked = deleteBlocked(row)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Actions for ${row.invoice_number ?? row.id}`}><MoreHorizontal className="h-4 w-4" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => handlers.onCopy(row)}>Copy WhatsApp text</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => handlers.onDownload(row)}>Download PDF</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => handlers.onPaid(row, "parent")}>{paidItemLabel(row, "parent")}</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => handlers.onPaid(row, "tutor")}>{paidItemLabel(row, "tutor")}</DropdownMenuItem>
        <DropdownMenuSeparator />
        {blocked ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div><DropdownMenuItem disabled aria-disabled="true">Delete</DropdownMenuItem></div>
              </TooltipTrigger>
              <TooltipContent>Clear the paid dates first</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <DropdownMenuItem className="text-destructive" onSelect={() => handlers.onDelete(row)}>Delete</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function InvoiceActionButtons({ row, handlers }: { row: InvoiceRow; handlers: InvoiceActionHandlers }) {
  const blocked = deleteBlocked(row)
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={() => handlers.onCopy(row)}>Copy WhatsApp text</Button>
      <Button variant="outline" size="sm" onClick={() => handlers.onDownload(row)}>Download PDF</Button>
      <Button variant="outline" size="sm" onClick={() => handlers.onPaid(row, "parent")}>{paidItemLabel(row, "parent")}</Button>
      <Button variant="outline" size="sm" onClick={() => handlers.onPaid(row, "tutor")}>{paidItemLabel(row, "tutor")}</Button>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span><Button variant="destructive" size="sm" disabled={blocked} onClick={() => handlers.onDelete(row)}>Delete</Button></span>
          </TooltipTrigger>
          {blocked && <TooltipContent>Clear the paid dates first</TooltipContent>}
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}

interface PaidDialogProps {
  target: { row: InvoiceRow; which: PaidWhich } | null
  onClose: () => void
  onSaved: () => void
}

export function PaidDialog({ target, onClose, onSaved }: PaidDialogProps) {
  const { toast } = useToast()
  const [date, setDate] = useState("")
  const [busy, setBusy] = useState(false)
  const current = target ? (target.which === "parent" ? target.row.parent_paid_at : target.row.tutor_paid_at) : null

  useEffect(() => { setDate(current ?? todayIso()) }, [target, current])

  async function save(value: string | null) {
    if (!target) return
    setBusy(true)
    const supabase = createClient()
    const column = target.which === "parent" ? "parent_paid_at" : "tutor_paid_at"
    const { error } = await supabase.from("tm_invoices").update({ [column]: value }).eq("id", target.row.id)
    setBusy(false)
    if (error) {
      toast({ title: "Could not save", description: error.message, variant: "destructive" })
      return
    }
    const noun = target.which === "parent" ? "Parent payment" : "Tutor payout"
    toast({ title: value ? `${noun} recorded` : `${noun} cleared` })
    onClose()
    onSaved()
  }

  return (
    <Dialog open={target !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{target?.which === "parent" ? "Parent payment" : "Tutor payout"}</DialogTitle>
          <DialogDescription>
            {target ? `${target.row.invoice_number ?? "Invoice"} · ${target.row.studentName} · ${periodLabel({ year: target.row.year, month: target.row.month })}` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="paid-date">Date paid</Label>
          <Input id="paid-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          {current && <Button variant="outline" onClick={() => save(null)} disabled={busy}>Clear</Button>}
          <Button onClick={() => save(date)} disabled={busy || !date}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface DeleteDialogProps {
  target: InvoiceRow | null
  onClose: () => void
  onDeleted: () => void
}

export function DeleteDialog({ target, onClose, onDeleted }: DeleteDialogProps) {
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)

  async function remove() {
    if (!target) return
    setBusy(true)
    const supabase = createClient()
    const { error } = await supabase.rpc("tm_delete_invoice", { p_invoice_id: target.id })
    setBusy(false)
    if (error) {
      toast({ title: "Could not delete", description: error.message, variant: "destructive" })
      return
    }
    toast({ title: "Invoice deleted" })
    onClose()
    onDeleted()
  }

  const month = target ? periodLabel({ year: target.year, month: target.month }) : ""
  return (
    <Dialog open={target !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete invoice {target?.invoice_number ?? ""}?</DialogTitle>
          <DialogDescription>
            {target?.source === "generated"
              ? `This re-opens ${month} for ${target.studentName} so it can be approved again.`
              : "This removes the manual invoice."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="destructive" onClick={remove} disabled={busy}>{busy ? "Deleting..." : "Delete"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 3: Manual invoice dialog**

Create `src/components/tm/manual-invoice-form.tsx`:

```tsx
"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { fetchAll } from "@/lib/supabase/fetch-all"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { currentPeriod, parseMonthInput, toMonthInput } from "@/lib/tm/periods"

interface AssignmentOption {
  id: string
  code: string
  subject: string
  status: string
  studentName: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}

export function ManualInvoiceDialog({ open, onOpenChange, onCreated }: Props) {
  const { toast } = useToast()
  const [assignments, setAssignments] = useState<AssignmentOption[]>([])
  const [assignmentId, setAssignmentId] = useState("")
  const [month, setMonth] = useState(toMonthInput(currentPeriod()))
  const [hours, setHours] = useState("")
  const [amount, setAmount] = useState("")
  const [payout, setPayout] = useState("")
  const [remarks, setRemarks] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setAssignmentId(""); setMonth(toMonthInput(currentPeriod())); setHours(""); setAmount(""); setPayout(""); setRemarks(""); setError("")
    const supabase = createClient()
    fetchAll(() => supabase.from("tm_assignments").select("id, code, subject, status, tm_students(name)").order("code")).then((res) => {
      if (res.error) {
        toast({ title: "Could not load assignments", description: res.error.message, variant: "destructive" })
        return
      }
      const rows = (res.data as unknown as { id: string; code: string; subject: string; status: string; tm_students: { name: string } | null }[])
        .map((r) => ({ id: r.id, code: r.code, subject: r.subject, status: r.status, studentName: r.tm_students?.name ?? "" }))
      rows.sort((a, b) => (a.status === "active" ? 0 : 1) - (b.status === "active" ? 0 : 1) || a.code.localeCompare(b.code))
      setAssignments(rows)
    })
  }, [open, toast])

  async function save() {
    setError("")
    const period = parseMonthInput(month)
    const amountN = Number(amount)
    const payoutN = Number(payout)
    const hoursN = hours.trim() === "" ? null : Number(hours)
    if (!assignmentId) { setError("Choose an assignment."); return }
    if (!period) { setError("Enter the month."); return }
    if (!Number.isFinite(amountN) || amountN <= 0) { setError("Invoice amount must be more than 0."); return }
    if (!Number.isFinite(payoutN) || payoutN < 0) { setError("Tutor payout must be 0 or more."); return }
    if (hoursN !== null && (!Number.isFinite(hoursN) || hoursN <= 0)) { setError("Hours must be more than 0, or blank."); return }

    setBusy(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from("tm_invoices")
      .insert({ assignment_id: assignmentId, year: period.year, month: period.month, source: "manual", total_hours: hoursN, invoice_amount: amountN, tutor_payout: payoutN, remarks: remarks.trim() || null })
      .select("invoice_number")
      .single()
    setBusy(false)
    if (error) {
      const message = error.code === "23505" ? "A manual invoice for this month already exists" : error.message
      toast({ title: "Could not create the invoice", description: message, variant: "destructive" })
      return
    }
    toast({ title: data.invoice_number ? `Invoice ${data.invoice_number} created.` : "Invoice created." })
    onOpenChange(false)
    onCreated()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New manual invoice</DialogTitle>
          <DialogDescription>For months without logged sessions, or adjustments. The number is assigned on save.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mi-assignment">Assignment</Label>
            <Select value={assignmentId} onValueChange={setAssignmentId}>
              <SelectTrigger id="mi-assignment"><SelectValue placeholder="Choose an assignment" /></SelectTrigger>
              <SelectContent>
                {assignments.map((a) => <SelectItem key={a.id} value={a.id}>{a.code} · {a.studentName} · {a.subject}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="mi-month">Month</Label>
            <Input id="mi-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="mi-hours">Hours</Label>
              <Input id="mi-hours" inputMode="decimal" placeholder="optional" value={hours} onChange={(e) => setHours(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mi-amount">Invoice amount</Label>
              <Input id="mi-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mi-payout">Tutor payout</Label>
              <Input id="mi-payout" inputMode="decimal" value={payout} onChange={(e) => setPayout(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="mi-remarks">Remarks</Label>
            <Textarea id="mi-remarks" rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Saving..." : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 4: Wire the page**

In `src/app/(dashboard)/tm/invoices/page.tsx`:

Add imports:

```tsx
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { invoiceLines } from "@/lib/tm/approvals"
import { whatsappText } from "@/lib/tm/whatsapp"
import { loadInvoiceContext } from "@/components/tm/invoice-data"
import { DeleteDialog, InvoiceMenu, PaidDialog, type InvoiceActionHandlers, type PaidWhich } from "@/components/tm/invoice-actions"
import { ManualInvoiceDialog } from "@/components/tm/manual-invoice-form"
```

Add state after `selectedId`:

```tsx
  const [paidTarget, setPaidTarget] = useState<{ row: InvoiceRow; which: PaidWhich } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<InvoiceRow | null>(null)
  const [manualOpen, setManualOpen] = useState(false)
```

Add handlers after `studentNames`:

```tsx
  async function copyWhatsapp(row: InvoiceRow) {
    try {
      const { settings, entries } = await loadInvoiceContext(row)
      const text = whatsappText({
        parentName: row.parentName, studentName: row.studentName, subject: row.subject,
        period: { year: row.year, month: row.month }, totalHours: row.total_hours,
        lines: invoiceLines(entries), invoiceAmount: row.invoice_amount, paymentDetails: settings.payment_details,
      })
      await navigator.clipboard.writeText(text)
      toast({ title: "WhatsApp text copied" })
    } catch (e) {
      toast({ title: "Could not copy", description: e instanceof Error ? e.message : String(e), variant: "destructive" })
    }
  }

  const handlers: InvoiceActionHandlers = {
    onCopy: copyWhatsapp,
    // Task 6 replaces this with the PDF download.
    onDownload: () => toast({ title: "Download PDF arrives in the next task" }),
    onPaid: (row, which) => setPaidTarget({ row, which }),
    onDelete: (row) => setDeleteTarget(row),
  }
```

Replace the list `return` with:

```tsx
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <InvoiceFilters filter={filter} onChange={setFilter} tutorNames={tutorNames} studentNames={studentNames} />
        <Button size="sm" onClick={() => setManualOpen(true)}><Plus className="mr-2 h-4 w-4" />New manual invoice</Button>
      </div>
      <InvoiceTable rows={visible} detailHref={detailHref} renderActions={(row) => <InvoiceMenu row={row} handlers={handlers} />} />
      <PaidDialog target={paidTarget} onClose={() => setPaidTarget(null)} onSaved={load} />
      <DeleteDialog target={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={load} />
      <ManualInvoiceDialog open={manualOpen} onOpenChange={setManualOpen} onCreated={load} />
    </div>
  )
```

- [ ] **Step 5: Verify and commit**

```bash
npx tsc --noEmit && npm test
git add src/components/tm/invoice-data.ts src/components/tm/invoice-actions.tsx src/components/tm/manual-invoice-form.tsx "src/app/(dashboard)/tm/invoices/page.tsx"
git commit -m "feat(tm): invoice actions, paid and delete dialogs, WhatsApp copy, manual invoices

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01TkFUEBg6S7PqW49ZKa3C6p"
```

---

### Task 6: PDF and detail view

**Files:**
- Create: `src/components/tm/invoice-pdf.tsx`
- Create: `src/components/tm/invoice-download.tsx`
- Create: `src/components/tm/invoice-detail.tsx`
- Modify: `src/app/(dashboard)/tm/invoices/page.tsx`

**Interfaces:**
- Consumes: `loadInvoiceContext`, `loadInvoiceEntries` (Task 5); `invoiceLines`, `RateLine`; `manualLine`, `invoiceFileName`, `InvoiceEntry`, `InvoiceLine`; `InvoiceActionButtons`, `InvoiceActionHandlers` (Task 5); `@react-pdf/renderer`.
- Produces: `TmInvoicePDF(props: TmInvoicePDFProps)`; `downloadInvoicePdf(row: InvoiceRow): Promise<void>` (throws on failure); `InvoiceDetail({ row, handlers, onChanged, backHref })`.

- [ ] **Step 1: The PDF document**

Create `src/components/tm/invoice-pdf.tsx`:

```tsx
"use client"

import { Document, Page, Text, View, StyleSheet, Font, Image } from "@react-pdf/renderer"
import { MONTH_NAMES } from "@/lib/format"
import type { Period } from "@/lib/tm/periods"
import type { InvoiceLine } from "@/lib/tm/invoices"

Font.register({
  family: "Assistant",
  fonts: [
    { src: "https://fonts.gstatic.com/s/assistant/v24/2sDPZGJYnIjSi6H75xkZZE1I0yCmYzzQtuZnEGE.ttf", fontWeight: 400 },
    { src: "https://fonts.gstatic.com/s/assistant/v24/2sDPZGJYnIjSi6H75xkZZE1I0yCmYzzQtgFgEGE.ttf", fontWeight: 700 },
  ],
})

const NAVY = "#2E3192"
const TEXT = "#1A1A1A"
const MUTED = "#6B6B6B"
const ROW_ALT = "#F2F2F2"
const RULE = "#D9D9D9"

export interface TmInvoicePDFProps {
  companyName: string
  legalName: string
  logoUrl?: string
  qrCodeUrl?: string
  invoiceNumber: string
  parentName: string | null
  address: string | null
  studentName: string
  period: Period
  lines: InvoiceLine[]
  subtotal: number
  paymentTerms: string
  paynowUen: string
}

const styles = StyleSheet.create({
  page: { paddingTop: 0, paddingHorizontal: 48, paddingBottom: 48, fontFamily: "Assistant", fontSize: 10, color: TEXT },
  topBar: { height: 10, backgroundColor: NAVY, marginHorizontal: -48, marginBottom: 28 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  companyName: { fontSize: 26, color: NAVY, fontWeight: 400 },
  legalName: { fontSize: 13, color: NAVY, marginTop: 2 },
  logo: { width: 150, height: 150, objectFit: "contain" },
  billTo: { marginBottom: 22 },
  billToLine: { flexDirection: "row", fontSize: 12, marginBottom: 4 },
  billToLabel: { fontWeight: 700 },
  billToIndent: { marginLeft: 76, fontSize: 11, marginBottom: 2 },
  billToMuted: { marginLeft: 76, fontSize: 9, color: MUTED },
  rule: { borderBottomWidth: 1, borderBottomColor: RULE, marginBottom: 14 },
  tableHeader: { flexDirection: "row", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: RULE, color: NAVY, fontWeight: 700, fontSize: 11 },
  tableRow: { flexDirection: "row", paddingVertical: 7, paddingHorizontal: 2, fontSize: 10 },
  tableRowAlt: { flexDirection: "row", paddingVertical: 7, paddingHorizontal: 2, fontSize: 10, backgroundColor: ROW_ALT },
  colDesc: { flex: 3 },
  colHours: { flex: 0.8, textAlign: "right" },
  colRate: { flex: 1.1, textAlign: "right" },
  colTotal: { flex: 1.1, textAlign: "right" },
  subtotalRow: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: RULE, paddingTop: 8, marginTop: 4 },
  paymentTitle: { color: NAVY, fontWeight: 700, fontSize: 10 },
  subtotalLabel: { color: NAVY, fontSize: 10, marginRight: 24 },
  subtotalValue: { fontWeight: 700, fontSize: 10, width: 70, textAlign: "right" },
  paymentBlock: { marginTop: 10, gap: 8, width: 300 },
  paymentMethod: { fontSize: 9 },
  paymentMethodName: { fontWeight: 700 },
  qrCode: { width: 110, height: 110, marginTop: 6 },
  grandTotal: { position: "absolute", right: 48, bottom: 140, fontSize: 24, fontWeight: 700, color: "#E0218A" },
})

function money(n: number): string {
  return `$${n.toFixed(2)}`
}

export function TmInvoicePDF(p: TmInvoicePDFProps) {
  const monthLabel = `${MONTH_NAMES[p.period.month - 1]} ${p.period.year}`
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.topBar} />

        <View style={styles.headerRow}>
          <View>
            <Text style={styles.companyName}>{p.companyName}</Text>
            <Text style={styles.legalName}>{p.legalName}</Text>
            <View style={{ marginTop: 22 }}>
              <View style={styles.billToLine}>
                <Text style={styles.billToLabel}>Invoice for:  </Text>
                <Text>{p.parentName || p.studentName}</Text>
              </View>
              {(p.address ?? "").split("\n").filter(Boolean).map((line, i) => (
                <Text key={i} style={styles.billToIndent}>{line}</Text>
              ))}
              <Text style={styles.billToIndent}>{p.studentName}, {monthLabel}</Text>
              <Text style={styles.billToMuted}>Invoice {p.invoiceNumber}</Text>
            </View>
          </View>
          {p.logoUrl && <Image src={p.logoUrl} style={styles.logo} />}
        </View>

        <View style={styles.rule} />

        <View style={styles.tableHeader}>
          <Text style={styles.colDesc}>Description</Text>
          <Text style={styles.colHours}>Hours</Text>
          <Text style={styles.colRate}>Hourly Rate</Text>
          <Text style={styles.colTotal}>Total price</Text>
        </View>
        {p.lines.map((line, i) => (
          <View key={i} style={i % 2 === 0 ? styles.tableRowAlt : styles.tableRow}>
            <Text style={styles.colDesc}>{line.description}</Text>
            <Text style={styles.colHours}>{line.hours === null ? "" : line.hours.toFixed(2).replace(/\.?0+$/, "")}</Text>
            <Text style={styles.colRate}>{line.rate === null ? "" : money(line.rate)}</Text>
            <Text style={styles.colTotal}>{money(line.total)}</Text>
          </View>
        ))}

        <View style={styles.subtotalRow}>
          <Text style={styles.paymentTitle}>Payment Methods:</Text>
          <View style={{ flexDirection: "row" }}>
            <Text style={styles.subtotalLabel}>Subtotal</Text>
            <Text style={styles.subtotalValue}>{money(p.subtotal)}</Text>
          </View>
        </View>

        <View style={styles.paymentBlock}>
          <Text style={styles.paymentMethod}>{p.paymentTerms}</Text>
          <View style={styles.paymentMethod}>
            <Text style={styles.paymentMethodName}>By PAYNOW:</Text>
            <Text style={styles.paymentMethodName}>UEN: {p.paynowUen}</Text>
          </View>
          {p.qrCodeUrl && (
            <View style={styles.paymentMethod}>
              <Text style={styles.paymentMethodName}>By QR:</Text>
              <Image src={p.qrCodeUrl} style={styles.qrCode} />
            </View>
          )}
        </View>

        <Text style={styles.grandTotal}>{money(p.subtotal)}</Text>
      </Page>
    </Document>
  )
}
```

- [ ] **Step 2: The download function**

Create `src/components/tm/invoice-download.tsx`:

```tsx
"use client"

import { pdf } from "@react-pdf/renderer"
import { invoiceLines } from "@/lib/tm/approvals"
import { invoiceFileName, manualLine, type InvoiceLine, type InvoiceRow } from "@/lib/tm/invoices"
import { loadInvoiceContext } from "./invoice-data"
import { TmInvoicePDF } from "./invoice-pdf"

async function toDataUri(path: string): Promise<string> {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`Could not load ${path}`)
  const blob = await res.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error(`Could not read ${path}`))
    reader.readAsDataURL(blob)
  })
}

/** Builds the PDF for one invoice and triggers the browser download. Throws on any failure. */
export async function downloadInvoicePdf(row: InvoiceRow): Promise<void> {
  const { settings, entries } = await loadInvoiceContext(row)
  const lines: InvoiceLine[] = row.source === "generated"
    ? invoiceLines(entries).map((l) => ({ description: `${row.studentName} ${row.subject} (${l.tierLabel})`, hours: l.hours, rate: l.rate, total: l.total }))
    : [manualLine(row)]
  const [logoUrl, qrCodeUrl] = await Promise.all([toDataUri("/tm/logo.png"), toDataUri(settings.qr_code_path)])

  const blob = await pdf(
    <TmInvoicePDF
      companyName={settings.company_name}
      legalName={settings.legal_name}
      logoUrl={logoUrl}
      qrCodeUrl={qrCodeUrl}
      invoiceNumber={row.invoice_number ?? ""}
      parentName={row.parentName}
      address={row.address}
      studentName={row.studentName}
      period={{ year: row.year, month: row.month }}
      lines={lines}
      subtotal={row.invoice_amount}
      paymentTerms={settings.payment_terms}
      paynowUen={settings.paynow_uen}
    />,
  ).toBlob()

  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = invoiceFileName(row)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 3: The detail view**

Create `src/components/tm/invoice-detail.tsx`:

```tsx
"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency } from "@/lib/format"
import { periodLabel } from "@/lib/tm/periods"
import { formatHours } from "@/lib/portal/timesheet"
import { invoiceLines } from "@/lib/tm/approvals"
import { manualLine, type InvoiceEntry, type InvoiceLine, type InvoiceRow } from "@/lib/tm/invoices"
import { loadInvoiceEntries } from "./invoice-data"
import { InvoiceActionButtons, type InvoiceActionHandlers } from "./invoice-actions"

interface Props {
  row: InvoiceRow
  handlers: InvoiceActionHandlers
  onChanged: () => void
  backHref: string
}

function entryAmount(e: InvoiceEntry): number {
  return invoiceLines([e])[0]?.total ?? 0
}

export function InvoiceDetail({ row, handlers, onChanged, backHref }: Props) {
  const { toast } = useToast()
  const [entries, setEntries] = useState<InvoiceEntry[] | null>(null)
  const [remarks, setRemarks] = useState(row.remarks ?? "")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    setEntries(null)
    loadInvoiceEntries(row)
      .then((list) => { if (active) setEntries(list) })
      .catch((e: Error) => {
        toast({ title: "Could not load sessions", description: e.message, variant: "destructive" })
        if (active) setEntries([])
      })
    return () => { active = false }
  }, [row, toast])

  useEffect(() => { setRemarks(row.remarks ?? "") }, [row])

  async function saveRemarks() {
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from("tm_invoices").update({ remarks: remarks.trim() || null }).eq("id", row.id)
    setSaving(false)
    if (error) {
      toast({ title: "Could not save remarks", description: error.message, variant: "destructive" })
      return
    }
    toast({ title: "Remarks saved" })
    onChanged()
  }

  const month = periodLabel({ year: row.year, month: row.month })
  const lines: InvoiceLine[] = row.source === "generated" && entries
    ? invoiceLines(entries).map((l) => ({ description: `${row.studentName} ${row.subject} (${l.tierLabel})`, hours: l.hours, rate: l.rate, total: l.total }))
    : row.source === "manual" ? [manualLine(row)] : []

  return (
    <div className="space-y-4">
      <Link href={backHref} className="text-sm text-primary underline">Back to invoices</Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            {row.invoice_number ?? "Invoice"}
            <Badge variant={row.source === "generated" ? "secondary" : "outline"}>{row.source === "generated" ? "Generated" : "Manual"}</Badge>
          </CardTitle>
          <CardDescription>
            {row.studentName}{row.parentName ? ` (parent: ${row.parentName})` : ""} · {row.code} · {row.subject} · {month} · {row.tutorName}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {row.source === "generated" && (
            entries === null ? <Skeleton className="h-32 w-full" /> : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead className="text-right">Parent rate</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>{e.date}</TableCell>
                        <TableCell>{e.start_time && e.end_time ? `${e.start_time} to ${e.end_time}` : ""}</TableCell>
                        <TableCell className="text-right">{formatHours(e.hours)}</TableCell>
                        <TableCell>{e.tier_label}</TableCell>
                        <TableCell className="text-right">{formatCurrency(e.parent_rate)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(entryAmount(e))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )
          )}

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((l, i) => (
                  <TableRow key={i}>
                    <TableCell>{l.description}</TableCell>
                    <TableCell className="text-right">{l.hours === null ? "" : formatHours(l.hours)}</TableCell>
                    <TableCell className="text-right">{l.rate === null ? "" : formatCurrency(l.rate)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(l.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <p className="text-sm font-medium" data-testid="invoice-total">Total {formatCurrency(row.invoice_amount)} · Tutor payout {formatCurrency(row.tutor_payout)} · Profit {formatCurrency(row.profit)}</p>

          <div className="space-y-2">
            <Label htmlFor="invoice-remarks">Remarks</Label>
            <Textarea id="invoice-remarks" rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            <Button size="sm" variant="outline" onClick={saveRemarks} disabled={saving}>{saving ? "Saving..." : "Save remarks"}</Button>
          </div>

          <InvoiceActionButtons row={row} handlers={handlers} />
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 4: Wire the page**

In `src/app/(dashboard)/tm/invoices/page.tsx`:

Add the import:

```tsx
import { InvoiceDetail } from "@/components/tm/invoice-detail"
```

Replace the `onDownload` placeholder in `handlers` with:

```tsx
    onDownload: async (row) => {
      try {
        const { downloadInvoicePdf } = await import("@/components/tm/invoice-download")
        await downloadInvoicePdf(row)
        toast({ title: "Invoice PDF downloaded" })
      } catch (e) {
        console.error("PDF generation error:", e)
        toast({ title: "Failed to generate PDF", description: e instanceof Error ? e.message : String(e), variant: "destructive" })
      }
    },
```

Replace the detail placeholder line and its comment with:

```tsx
    return (
      <>
        <InvoiceDetail row={row} handlers={handlers} onChanged={load} backHref={listHref} />
        <PaidDialog target={paidTarget} onClose={() => setPaidTarget(null)} onSaved={load} />
        <DeleteDialog target={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={() => { setDeleteTarget(null); router.push(listHref); load() }} />
      </>
    )
```

- [ ] **Step 5: Verify and commit**

```bash
npx tsc --noEmit && npm test && npm run build 2>&1 | grep -E "tm/invoices|error|Error" 
git add src/components/tm/invoice-pdf.tsx src/components/tm/invoice-download.tsx src/components/tm/invoice-detail.tsx "src/app/(dashboard)/tm/invoices/page.tsx"
git commit -m "feat(tm): invoice detail view and PDF download

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01TkFUEBg6S7PqW49ZKa3C6p"
```

Expected: build lists `/tm/invoices` with no errors (the dynamic `import()` keeps `@react-pdf/renderer` out of the initial chunk).

---

### Task 7: Dashboard

**Files:**
- Create: `src/components/tm/dashboard-tiles.tsx`
- Create: `src/components/tm/pending-list.tsx`
- Modify: `src/app/(dashboard)/tm/page.tsx` (replace the shell)

**Interfaces:**
- Consumes: Task 2 `dashboard.ts` and `invoices.ts` (`INVOICE_SELECT`, `mapInvoiceRow`); `fetchAll`; `periodLabel`, `toMonthInput`, `parseMonthInput`, `currentPeriod`; `formatCurrency`.
- Produces: `DashboardTiles({ figures, outstanding })`, `PendingList({ rows })`.

- [ ] **Step 1: Tiles**

Create `src/components/tm/dashboard-tiles.tsx`:

```tsx
"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/format"
import type { MonthFigures, Outstanding } from "@/lib/tm/dashboard"

interface Props {
  figures: MonthFigures
  outstanding: Outstanding
}

function Tile({ title, value, sub, href }: { title: string; value: string; sub?: string; href?: string }) {
  const body = (
    <Card className={href ? "hover:bg-primary/5 transition-colors" : ""}>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle></CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  )
  return href ? <Link href={href} aria-label={title}>{body}</Link> : body
}

export function DashboardTiles({ figures, outstanding }: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Tile title="Pending approvals" value={String(figures.pending)} href="/tm/approvals" />
      <Tile title="Invoiced" value={formatCurrency(figures.invoiced)} />
      <Tile title="Tutor payouts" value={formatCurrency(figures.payouts)} />
      <Tile title="Profit" value={formatCurrency(figures.profit)} />
      <Tile
        title="Outstanding parent payments"
        value={formatCurrency(outstanding.parentSum)}
        sub={`${outstanding.parentCount} invoice${outstanding.parentCount === 1 ? "" : "s"} · all months`}
        href="/tm/invoices?month=all&parent_paid=unpaid"
      />
      <Tile
        title="Outstanding tutor payouts"
        value={formatCurrency(outstanding.tutorSum)}
        sub={`${outstanding.tutorCount} invoice${outstanding.tutorCount === 1 ? "" : "s"} · all months`}
        href="/tm/invoices?month=all&tutor_paid=unpaid"
      />
    </div>
  )
}
```

- [ ] **Step 2: Pending list**

Create `src/components/tm/pending-list.tsx`:

```tsx
"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { periodLabel } from "@/lib/tm/periods"
import type { PendingSubmission } from "@/lib/tm/dashboard"

export function PendingList({ rows }: { rows: PendingSubmission[] }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Oldest pending submissions</CardTitle></CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing is waiting for approval.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tutor</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Month</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.tutorName}</TableCell>
                  <TableCell>{s.studentName}</TableCell>
                  <TableCell className="font-medium">{s.code}</TableCell>
                  <TableCell>{periodLabel({ year: s.year, month: s.month })}</TableCell>
                  <TableCell>{s.submitted_at ? s.submitted_at.slice(0, 10) : ""}</TableCell>
                  <TableCell className="text-right">
                    <Link href={`/tm/approvals?submission=${s.id}`} className="text-primary underline" aria-label={`Review ${s.code} ${periodLabel({ year: s.year, month: s.month })}`}>Review</Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: The page**

Replace `src/app/(dashboard)/tm/page.tsx` with:

```tsx
"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { fetchAll } from "@/lib/supabase/fetch-all"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { DashboardTiles } from "@/components/tm/dashboard-tiles"
import { PendingList } from "@/components/tm/pending-list"
import { currentPeriod, parseMonthInput, toMonthInput, type Period } from "@/lib/tm/periods"
import { INVOICE_SELECT, mapInvoiceRow, type InvoiceRow, type RawInvoiceRow } from "@/lib/tm/invoices"
import { mapPendingRow, monthFigures, oldestPending, outstanding, type PendingSubmission, type RawPendingRow } from "@/lib/tm/dashboard"

const PENDING_SELECT = "id, year, month, submitted_at, tm_assignments(code, subject, tm_students(name)), tm_tutors(name)"

export default function TutorMatchingDashboardPage() {
  const { toast } = useToast()
  const [period, setPeriod] = useState<Period>(() => currentPeriod())
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [pending, setPending] = useState<PendingSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const [invRes, subRes] = await Promise.all([
      fetchAll(() => supabase.from("tm_invoices").select(INVOICE_SELECT).order("id")),
      supabase.from("tm_submissions").select(PENDING_SELECT).eq("status", "submitted").order("submitted_at"),
    ])
    if (invRes.error || subRes.error) {
      const message = invRes.error?.message ?? subRes.error?.message ?? "Could not load the dashboard"
      setError(message)
      toast({ title: "Could not load the dashboard", description: message, variant: "destructive" })
      setLoading(false)
      return
    }
    setInvoices((invRes.data as unknown as RawInvoiceRow[]).map(mapInvoiceRow))
    setPending((subRes.data as unknown as RawPendingRow[]).map(mapPendingRow))
    setLoading(false)
  }, [toast])

  useEffect(() => { load() }, [load])

  const figures = useMemo(() => monthFigures(invoices, pending, period), [invoices, pending, period])
  const owed = useMemo(() => outstanding(invoices), [invoices])
  const oldest = useMemo(() => oldestPending(pending, 5), [pending])

  if (loading) return <Skeleton className="h-96 w-full" />
  if (error) return <Card><CardContent className="py-6 text-sm text-destructive">{error}</CardContent></Card>

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Label htmlFor="dash-month">Month</Label>
        <Input id="dash-month" type="month" className="w-[170px]" value={toMonthInput(period)} onChange={(e) => { const p = parseMonthInput(e.target.value); if (p) setPeriod(p) }} />
      </div>
      <DashboardTiles figures={figures} outstanding={owed} />
      <PendingList rows={oldest} />
    </div>
  )
}
```

- [ ] **Step 4: Verify and commit**

```bash
npx tsc --noEmit && npm test
git add src/components/tm/dashboard-tiles.tsx src/components/tm/pending-list.tsx "src/app/(dashboard)/tm/page.tsx"
git commit -m "feat(tm): dashboard tiles and oldest pending submissions

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01TkFUEBg6S7PqW49ZKa3C6p"
```

---

### Task 8: End-to-end flow, full verification, carry-forward

**Files:**
- Modify: `e2e/helpers/admin.ts` (append `createApprovedMonth`)
- Create: `e2e/tm-invoices.spec.ts`
- Modify: `docs/superpowers/plans/2026-09-08-tutor-matching-invoices.md` (append carry-forward)

**Interfaces:**
- Consumes: `signIn`, `users`; `createSubmittedMonth`, `deleteAssignmentData` (`e2e/helpers/admin.ts`). Selectors from Tasks 4 to 7: the invoice number link, the row actions button `Actions for {number}`, menu items, the paid dialog's "Date paid" and buttons, `data-testid="invoice-total"`, the dashboard tiles' aria-labels (their titles), the pending list's `Review {code} {month}` link.
- Produces: `createApprovedMonth(tutorName, studentName, code)` returning `{ tutorId, studentId, assignmentId, submissionId, invoiceId, invoiceNumber }`.

- [ ] **Step 1: Fixture**

Append to `e2e/helpers/admin.ts`:

```ts
/**
 * A submitted month that an admin has approved: a generated invoice (3.5 h, $245 / $175) with the
 * entries and submission marked approved, exactly as tm_approve_submission would leave them.
 */
export async function createApprovedMonth(tutorName: string, studentName: string, code: string) {
  const admin = adminClient()
  const ids = await createSubmittedMonth(tutorName, studentName, code)
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth() + 1
  const { data: invoice, error: iErr } = await admin
    .from("tm_invoices")
    .insert({ assignment_id: ids.assignmentId, year, month, source: "generated", total_hours: 3.5, invoice_amount: 245, tutor_payout: 175 })
    .select("id, invoice_number").single()
  if (iErr) throw iErr
  const { error: eErr } = await admin.from("tm_timesheet_entries").update({ status: "approved", invoice_id: invoice.id }).eq("submission_id", ids.submissionId)
  if (eErr) throw eErr
  const { error: sErr } = await admin.from("tm_submissions").update({ status: "approved", invoice_id: invoice.id, reviewed_at: new Date().toISOString() }).eq("id", ids.submissionId)
  if (sErr) throw sErr
  return { ...ids, invoiceId: invoice.id as string, invoiceNumber: invoice.invoice_number as string }
}
```

- [ ] **Step 2: The spec**

Create `e2e/tm-invoices.spec.ts`:

```ts
import { test, expect } from "@playwright/test"
import { signIn, users } from "./helpers/auth"
import { createApprovedMonth, deleteAssignmentData } from "./helpers/admin"

const stamp = Date.now().toString(36)
const student = `E2E Invoice Student ${stamp}`
const code = `EI${stamp.slice(-2).toUpperCase()}`
let invoiceNumber = ""

test.use({ permissions: ["clipboard-read", "clipboard-write"] })

test.describe.serial("tutor matching invoices", () => {
  test.beforeAll(async () => {
    const ids = await createApprovedMonth("E2E Tutor", student, code)
    invoiceNumber = ids.invoiceNumber
  })
  test.afterAll(async () => {
    await deleteAssignmentData(student)
  })
  test.beforeEach(async ({ context }) => signIn(context, users.admin.email, users.admin.password))

  test("lists the invoice and copies the WhatsApp text", async ({ page }) => {
    await page.goto("/tm/invoices")
    const row = page.getByRole("row", { name: new RegExp(code) })
    await expect(row).toContainText("$245.00")
    await expect(row).toContainText("Unpaid")
    await row.getByRole("button", { name: `Actions for ${invoiceNumber}` }).click()
    await page.getByRole("menuitem", { name: "Copy WhatsApp text" }).click()
    await expect(page.getByText("WhatsApp text copied", { exact: true }).first()).toBeVisible()
    const text = await page.evaluate(() => navigator.clipboard.readText())
    expect(text.startsWith(`Hi E2E Parent, here's ${student}'s tuition invoice for`)).toBe(true)
    expect(text).toContain("Rate: $70.00/hr (1 to 1)")
    expect(text).toContain("Amount due: $245.00")
  })

  test("marks the parent paid, blocks delete, then clears it", async ({ page }) => {
    await page.goto("/tm/invoices")
    const row = page.getByRole("row", { name: new RegExp(code) })
    await row.getByRole("button", { name: `Actions for ${invoiceNumber}` }).click()
    await page.getByRole("menuitem", { name: "Mark parent paid" }).click()
    await page.getByRole("dialog").getByRole("button", { name: "Save" }).click()
    await expect(page.getByText("Parent payment recorded", { exact: true }).first()).toBeVisible()
    await expect(row).toContainText(/\d{4}-\d{2}-\d{2}/)

    await row.getByRole("button", { name: `Actions for ${invoiceNumber}` }).click()
    await expect(page.getByRole("menuitem", { name: "Delete" })).toHaveAttribute("aria-disabled", "true")
    await page.getByRole("menuitem", { name: "Edit parent paid date" }).click()
    await page.getByRole("dialog").getByRole("button", { name: "Clear" }).click()
    await expect(page.getByText("Parent payment cleared", { exact: true }).first()).toBeVisible()
    await expect(row).toContainText("Unpaid")
  })

  test("downloads the PDF and shows the detail view", async ({ page }) => {
    await page.goto("/tm/invoices")
    const row = page.getByRole("row", { name: new RegExp(code) })
    await row.getByRole("button", { name: `Actions for ${invoiceNumber}` }).click()
    const download = page.waitForEvent("download")
    await page.getByRole("menuitem", { name: "Download PDF" }).click()
    expect((await download).suggestedFilename()).toMatch(/ Invoice\.pdf$/)
    await expect(page.getByText("Invoice PDF downloaded", { exact: true }).first()).toBeVisible()

    await row.getByRole("link", { name: invoiceNumber }).click()
    await expect(page).toHaveURL(/invoice=/)
    await expect(page.getByRole("row", { name: /E2E first session|1 to 1/ }).first()).toBeVisible()
    await expect(page.getByTestId("invoice-total")).toContainText("Total $245.00")
    await page.getByLabel("Remarks").fill("E2E remark")
    await page.getByRole("button", { name: "Save remarks" }).click()
    await expect(page.getByText("Remarks saved", { exact: true }).first()).toBeVisible()
  })

  test("deleting the generated invoice re-opens the month", async ({ page }) => {
    await page.goto("/tm/invoices")
    const row = page.getByRole("row", { name: new RegExp(code) })
    await row.getByRole("button", { name: `Actions for ${invoiceNumber}` }).click()
    await page.getByRole("menuitem", { name: "Delete" }).click()
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click()
    await expect(page.getByText("Invoice deleted", { exact: true }).first()).toBeVisible()
    await expect(page.getByRole("row", { name: new RegExp(code) })).toHaveCount(0)

    await page.goto("/tm/approvals")
    await expect(page.getByRole("row", { name: new RegExp(code) })).toContainText("3.50")
  })

  test("creates a manual invoice", async ({ page }) => {
    await page.goto("/tm/invoices")
    await page.getByRole("button", { name: "New manual invoice" }).click()
    await page.getByLabel("Assignment").click()
    await page.getByRole("option", { name: new RegExp(`^${code} `) }).click()
    await page.getByLabel("Invoice amount").fill("100")
    await page.getByLabel("Tutor payout").fill("60")
    await page.getByLabel("Remarks").fill("E2E manual")
    await page.getByRole("dialog").getByRole("button", { name: "Save" }).click()
    await expect(page.getByText(/^Invoice TM-\d{6}-\d{3} created\.$/).first()).toBeVisible()
    const row = page.getByRole("row", { name: new RegExp(code) })
    await expect(row).toContainText("$100.00")
    await expect(row).toContainText("Manual")
  })

  test("the dashboard shows the pending month and links to unpaid payouts", async ({ page }) => {
    await page.goto("/tm")
    const pendingRow = page.getByRole("row", { name: new RegExp(code) })
    await expect(pendingRow).toBeVisible()
    await pendingRow.getByRole("link", { name: new RegExp(`^Review ${code} `) }).click()
    await expect(page).toHaveURL(/\/tm\/approvals\?submission=/)
    await expect(page.getByText(student, { exact: false }).first()).toBeVisible()

    await page.goto("/tm")
    await page.getByRole("link", { name: "Outstanding tutor payouts" }).click()
    await expect(page).toHaveURL(/\/tm\/invoices\?month=all&tutor_paid=unpaid$/)
    await expect(page.getByRole("row", { name: new RegExp(code) })).toContainText("$60.00")
  })
})
```

The dashboard's outstanding sum also includes imported unpaid invoices, so the spec follows the tile's link and finds the fixture row rather than asserting the tile's figure.

- [ ] **Step 3: Run the spec**

```bash
npx playwright test e2e/tm-invoices.spec.ts --reporter=list
```

Expected: 6 passed. Selector mismatches may be fixed in the spec and noted; behaviour mismatches are bugs to fix in the component or function, extending the covering Vitest or pgTAP test first. The PDF step fetches the Assistant font from Google Fonts, so it needs network access.

- [ ] **Step 4: Full verification**

```bash
npx tsc --noEmit && npm test && npm run build
npx playwright test e2e/auth-routing.spec.ts e2e/smoke-test.spec.ts e2e/tm-admin.spec.ts e2e/tutor-portal.spec.ts e2e/tm-approvals.spec.ts e2e/tm-invoices.spec.ts --reporter=list
npx supabase db reset && npm run db:test
npm run seed:test-users && npm run import:master-list
```

Expected: unit tests green (19 files), build lists `/tm` and `/tm/invoices`, 57 e2e passed, pgTAP 8 files with every file `ok`. Report the real numbers.

- [ ] **Step 5: Carry-forward and commit**

Append a "Carry-forward from slice 5 execution" section to the end of this plan file, after "After this plan", with at least: `tm_delete_invoice` is the only way to unwind an approval and it leaves `submission_id` on the entries; the invoice-number advisory lock is keyed on the year-month string; the dashboard reads every invoice row and computes client-side, which is fine at hundreds of rows but should move to a view or RPC if the table grows past a few thousand; anything learned during verification.

```bash
git add -A
git commit -m "test(tm): invoices and dashboard end-to-end flow

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01TkFUEBg6S7PqW49ZKa3C6p"
```

---

## After this plan

Slice 5 completes the v1 build order from the main spec. Remaining items in the main spec's "Manual setup checklist" (Section 10) are deployment steps, not code: create the production Supabase project, configure Google OAuth, set Vercel environment variables, run the import once, and link the admin accounts.

## Carry-forward from slice 5 execution

- `tm_delete_invoice` is the only way to unwind an approval, and it leaves `submission_id` on the timesheet entries: deleting a generated invoice sets the entries' `status` back to `submitted` and clears `invoice_id`, but does not touch `submission_id`, so a re-approval of the same month reuses the same submission row rather than creating a new one. Anything that reports on submissions by id should expect a submission to outlive one or more invoice life cycles.
- The invoice-number advisory lock (`tm_set_invoice_number`, `supabase/migrations/20260908100000_tm_invoices.sql`) is keyed on the year-month string (`pg_advisory_xact_lock(hashtext('tm_invoices:' || year_month))` where `year_month` is `YYYYMM`), not on the assignment or tutor. Two invoices for different assignments in the same month serialize on the same lock; that's fine at current volume but is a contention point worth watching if invoice creation is ever bulk-scripted.
- The dashboard (`src/app/(dashboard)/tm/page.tsx`) reads every row of `tm_invoices` via `fetchAll` and computes `monthFigures`/`outstanding` client-side. That's fine at hundreds of rows (the imported master list is 70) but should move to a Postgres view or an RPC that aggregates server-side if the table grows past a few thousand rows, to avoid shipping the whole table to the browser on every dashboard load.
- Verification notes from this pass:
  - The brief's spec and fixture code worked exactly as written — all 6 `tm-invoices.spec.ts` tests passed on the first run, no selector or behavior fixes were needed.
  - `npx supabase db reset` drops all data including anything seeded by `import:master-list`; the dashboard's "Pending approvals" figure and the "Outstanding tutor payouts" tile depend on that imported data being present, so `seed:test-users` and `import:master-list` must run before any Playwright pass that touches `/tm` or `/tm/invoices`, exactly as the hard rules for this task state.
  - Because `playwright.config.ts` sets `fullyParallel: false` and `workers: 1`, e2e spec files run strictly in the order given on the command line with no cross-file data races; that's what let this task's fixtures (stamped student names, unique assignment codes) coexist safely with `tm-approvals.spec.ts` and the portal specs in the same run.
  - A follow-up manual re-run of `tm-invoices.spec.ts` against a freshly reset and reseeded database, plus a direct query against `tm_students`, `tm_assignments`, and `tm_invoices` for the fixture's naming patterns, confirmed `deleteAssignmentData`'s `afterAll` cleanup leaves zero rows behind.
