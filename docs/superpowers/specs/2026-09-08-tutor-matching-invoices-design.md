# Tutor Matching Slice 5: Invoices and Dashboard - Design

Refines Section 5 "Invoices", "WhatsApp text", "PDF", and "Dashboard" of `2026-09-04-tutor-matching-design.md` into a buildable slice. That document remains the source for the data model (Section 3) and RLS matrix. Where this document is more specific, it wins. It builds on slice 4 (`2026-09-07-tutor-matching-approvals-design.md`) and honours the "Carry-forward from slice 4 execution" section of `docs/superpowers/plans/2026-09-07-tutor-matching-approvals.md`.

## 1. Summary

Admins see every invoice, filter it, copy a WhatsApp message for the parent, download a PDF, record parent and tutor payments, add manual invoices, and delete unpaid invoices (which, for a generated invoice, re-opens the month for approval). The Tutor Matching dashboard replaces its shell with month tiles, two all-time outstanding tiles, and the oldest pending submissions.

### Decisions made during brainstorming

| Topic | Decision |
|---|---|
| Outstanding tiles | Count and sum every unpaid invoice regardless of month. The month picker scopes only pending approvals, invoiced, payouts, and profit. Each outstanding tile links to the Invoices screen filtered to all months and unpaid. |
| Write path | One new function, `tm_delete_invoice`, for the only multi-row change. Marking paid, saving remarks, and creating a manual invoice are single-row admin writes. |
| Invoice numbering | `tm_set_invoice_number` takes a transaction-scoped advisory lock keyed on the year-month before it picks the next free number, since manual invoices add a second writer. |
| Line items | `invoiceLines(entries)` in `src/lib/tm/approvals.ts` is the single source of rate lines; WhatsApp and PDF both consume it, so no third rounding path exists. |
| PDF deviation from the template | The invoice number is shown in small muted text under the month line, because the number is how a payment is reconciled. Everything else follows the Mr Eric template. |
| Detail view | Same page with `?invoice=<id>`, linkable. |
| Filters in the URL | The list's filters are search params so the dashboard can deep-link. |
| Unmarking paid | Allowed: the paid dialog has a Clear button. |
| Branch | `feat/tutor-matching-invoices`, stacked on `feat/tutor-matching-approvals` while that PR is open. |

## 2. Database

One migration, `supabase/migrations/20260908100000_tm_invoices.sql`. No new tables, columns, or policies. Types regenerated with `npm run db:types`.

### `tm_delete_invoice(p_invoice_id uuid) RETURNS void`

`LANGUAGE plpgsql SECURITY DEFINER SET search_path = public`; admin check first (`42501`); `REVOKE ALL ... FROM public, anon; GRANT EXECUTE ... TO authenticated`. Refusals are `22023` with the verbatim messages below; a missing row is `P0002`.

1. `SELECT ... FOR UPDATE` the invoice. Missing: `P0002` "Invoice not found".
2. If `parent_paid_at` or `tutor_paid_at` is not null: "A paid invoice cannot be deleted".
3. If `source = 'generated'`:
   - Lock the originating submission: `SELECT ... FROM tm_submissions WHERE invoice_id = p_invoice_id FOR UPDATE` (lock order is submission then entries, as in every slice 4 function). There may be none for legacy data; that is not an error.
   - `UPDATE tm_timesheet_entries SET status = 'submitted', invoice_id = NULL WHERE invoice_id = p_invoice_id`.
   - If a submission was found: `UPDATE tm_submissions SET status = 'submitted', reviewed_at = NULL, invoice_id = NULL WHERE id = <that id>`.
4. `DELETE FROM tm_invoices WHERE id = p_invoice_id`.

After a delete, `tm_approve_submission` succeeds again for that month and the freed invoice number is reused by the gap-filling trigger.

### `tm_set_invoice_number` (replaced)

Same body as slice 1 with one line added before the sequence lookup:

```sql
PERFORM pg_advisory_xact_lock(hashtext('tm_invoices:' || year_month));
```

### Direct writes (admin RLS, single row)

- Mark paid: `UPDATE tm_invoices SET parent_paid_at = <date or null>` or `tutor_paid_at` by id.
- Remarks: `UPDATE tm_invoices SET remarks = <text or null>` by id.
- Manual invoice: `INSERT INTO tm_invoices (assignment_id, year, month, source, total_hours, invoice_amount, tutor_payout, remarks)` with `source = 'manual'`; the trigger assigns the number. A `23505` unique violation is shown as "A manual invoice for this month already exists".

## 3. Reads

All pages are client components on the admin browser client; numerics pass through `toNumber()`; lists that can exceed 1000 rows use `fetchAll()`.

**Invoice rows.** `tm_invoices` selecting `*` and embedding `tm_assignments(code, subject, tm_students(name, parent_name, parent_phone, address), tm_tutors(name))`, ordered by `year desc, month desc, invoice_number`. Mapped once (one documented `as unknown as` cast next to the mapper) to `InvoiceRow`.

**Detail entries** (generated only, loaded when the detail opens): `tm_timesheet_entries` where `invoice_id = <id>` selecting `id, date, start_time, end_time, hours, tier_label, parent_rate, tutor_rate, note`, ordered by date then start time.

**PDF and WhatsApp inputs:** the invoice row (already loaded), its entries (as above; none for manual), and the single `tm_settings` row.

**Dashboard:** `tm_submissions` where `status = 'submitted'` with `tm_assignments(code, subject, tm_students(name)), tm_tutors(name)` ordered by `submitted_at`; every `tm_invoices` row (year, month, invoice_amount, tutor_payout, profit, parent_paid_at, tutor_paid_at) via `fetchAll`.

## 4. Pure helpers

### `src/lib/tm/approvals.ts` (extend)

- `interface RateLine { tierLabel: string; rate: number; hours: number; total: number }`
- `invoiceLines(entries: Pick<ApprovalEntry, "tier_label" | "parent_rate" | "hours">[]): RateLine[]`: one line per distinct `(tier_label, parent_rate)`, in first-seen order, hours summed, total from the existing integer-hundredths `lineCents`. The sum of `total` over the lines equals `tm_approve_submission`'s `invoice_amount`.

### `src/lib/tm/invoices.ts`

- `interface InvoiceRow extends TmInvoice { code; subject; studentName; parentName: string | null; parentPhone: string | null; address: string | null; tutorName }`
- `RawInvoiceRow`, `mapInvoiceRow(row)`.
- `type PaidFilter = "any" | "paid" | "unpaid"`; `type SourceFilter = "any" | "generated" | "manual"`
- `interface InvoiceFilter { month: Period | "all"; tutorName: string | "all"; studentName: string | "all"; parentPaid: PaidFilter; tutorPaid: PaidFilter; source: SourceFilter }`
- `defaultFilter(now?)`: current month, everything else "any"/"all".
- `filterFromParams(params: URLSearchParams, now?)` and `filterToParams(f)`: keys `month` (`YYYY-MM` or `all`), `tutor`, `student`, `parent_paid`, `tutor_paid`, `source`; absent keys mean default. Round-trip exact.
- `filterInvoices(rows, f)`.
- `invoiceTotals(rows)`: `{ count, hours, amount, payout, profit }` summed in integer cents.
- `manualLine(row)`: `{ description: "{studentName} {subject}", hours: total_hours, rate: null, total: invoice_amount }`.
- `invoiceFileName(row)`: `{studentName} {Mon}'{yy} Invoice.pdf` (e.g. `Sam Sep'26 Invoice.pdf`).

### `src/lib/tm/whatsapp.ts`

`whatsappText(input: { parentName: string | null; studentName: string; subject: string; period: Period; totalHours: number | null; lines: RateLine[]; invoiceAmount: number; paymentDetails: string }): string` producing exactly:

```
Hi {parent_name}, here's {student_name}'s tuition invoice for {Month Year}:

Subject: {subject}
Sessions: {total_hours} hrs total
Rate: ${parent_rate}/hr ({tier_label})
Amount due: ${invoice_amount}

Payment details: {payment_details}

Thank you! — EduOwl Tutor Matching
```

Rules: `{parent_name}` falls back to "there" when null; `{Month Year}` is the full month name (`MONTH_NAMES` from `src/lib/format.ts`) and year; hours print with two decimals; one Rate line per element of `lines`, in order; the Sessions line is omitted when `totalHours` is null; when `lines` is empty no Rate line is printed; money uses `formatCurrency`.

### `src/lib/tm/dashboard.ts`

- `monthFigures(invoices: InvoiceRow[], submissions: PendingSubmission[], period)`: `{ pending, invoiced, payouts, profit }` for rows whose year and month match.
- `outstanding(invoices)`: `{ parentCount, parentSum, tutorCount, tutorSum }` over rows with the respective paid date null, all months.
- `oldestPending(submissions, limit = 5)`: sorted by `submitted_at` ascending, capped.

## 5. Screens

### Navigation

`NAV_ITEMS.tm` gains `{ label: "Invoices", href: "/tm/invoices" }` immediately after Pending Timesheets. The sidebar icon map already has `Invoices: FileText`.

### `/tm/invoices` (list)

- Filter bar: month input plus an "All months" toggle button (pressed state when `month = "all"`), Tutor select, Student select (options from the loaded rows), Parent paid select (Any, Paid, Unpaid), Tutor paid select, Source select (Any, Generated, Manual). Changing a filter replaces the URL search params; loading reads them.
- "New manual invoice" button top right.
- Table columns: Invoice, Month, Code, Tutor, Student, Subject, Hours, Amount, Payout, Profit, Parent paid, Tutor paid, Source, actions. Paid cells show the date or "Unpaid". Footer totals row for the filtered set. Empty state "No invoices match these filters."
- Clicking the invoice number navigates to `?invoice=<id>` with the current filter params preserved.
- Actions menu (dropdown) per row: "Copy WhatsApp text", "Download PDF", "Mark parent paid" (or "Edit parent paid date" when set), "Mark tutor paid" (or "Edit tutor paid date"), "Delete" (disabled when either paid date is set, with tooltip "Clear the paid dates first").

### Paid dialog

Title "Parent payment" or "Tutor payout"; a date input defaulting to today (or the current value); buttons Cancel, "Clear" (only when a value exists), "Save". Toasts: "Parent payment recorded", "Tutor payout recorded", "Parent payment cleared", "Tutor payout cleared".

### Delete dialog

Title "Delete invoice {number}?". Body for generated: "This re-opens {Month Year} for {student} so it can be approved again." For manual: "This removes the manual invoice." Buttons Cancel, "Delete". Success toast "Invoice deleted". Failure toast "Could not delete" with the message.

### Manual invoice dialog

Title "New manual invoice". Fields: Assignment (select, "{code} · {student} · {subject}", active assignments first then the rest), Month (month input, default current), Hours (optional, decimal), Invoice amount (required, > 0), Tutor payout (required, >= 0), Remarks. Save inserts; success toast "Invoice {number} created." (number read back from the insert's returned row); unique violation toast "A manual invoice for this month already exists".

### `?invoice=<id>` (detail)

- "Back to invoices" link preserving the filter params.
- Header card: invoice number, student, parent, code, subject, month, source badge, tutor.
- Generated: table of entries (Date, Time, Hours, Tier, Parent rate, Amount), then a "Lines" table from `invoiceLines` (Description "{student} {subject} ({tier})", Hours, Rate, Total), then the total. Manual: the single `manualLine` row and the total.
- Remarks textarea with "Save remarks" button; toast "Remarks saved".
- Action buttons: same five as the row menu.
- Unknown id: "This invoice no longer exists" with the back link.

### Copy WhatsApp text

`navigator.clipboard.writeText(whatsappText(...))`; toast "WhatsApp text copied". Failure toast "Could not copy".

### PDF

`src/components/tm/invoice-pdf.tsx` exports `TmInvoicePDF(props)` with props `{ legalName, companyName, logoUrl, qrCodeUrl, parentName, address, studentName, period, invoiceNumber, lines: { description; hours: number | null; rate: number | null; total: number }[], subtotal, paymentTerms, paynowUen }`. Layout, matching the Mr Eric template: navy (`#2E3192`) top bar; "EduOwl" large in navy with "Education Consultancy Pte. Ltd." beneath; owl logo top right; "Invoice for: {parent or student}" with the address lines beneath; "{student}, {Month Year}" and the muted invoice number; table Description, Hours, Hourly Rate, Total price; "Payment Methods:" with the terms text, "By PAYNOW:" then "UEN: {uen}", "By QR:" with the QR image; Subtotal right of the payment title; large total bottom right. Fonts as the Academy component (Assistant). Tutor payout never appears.

`src/components/tm/invoice-download.tsx` exports `downloadInvoicePdf(row)`, which loads `tm_settings`, the entries (generated only), converts `/tm/logo.png` and the settings `qr_code_path` to data URIs, renders with `pdf(...).toBlob()`, and downloads as `invoiceFileName(row)`. Loaded with a dynamic `import()` inside the download handler, not `next/dynamic`. Toasts "Invoice PDF downloaded" / "Failed to generate PDF".

### `/tm` (dashboard)

- Month input (default current).
- Six tiles in a responsive grid: "Pending timesheets" (count, links to `/tm/approvals`), "Invoiced", "Tutor payouts", "Profit", "Outstanding parent payments" ("{count} invoices · {sum}", links to `/tm/invoices?month=all&parent_paid=unpaid`), "Outstanding tutor payouts" (links to `/tm/invoices?month=all&tutor_paid=unpaid`). Tile values use `formatCurrency`.
- Card "Oldest pending submissions": up to five rows with Tutor, Student, Code, Month, Submitted (date), and a "Review" link to `/tm/approvals?submission=<id>`. Empty state "Nothing is waiting for approval."

Copy that must appear verbatim: "Invoices", "New manual invoice", "All months", "No invoices match these filters.", "Copy WhatsApp text", "Download PDF", "Mark parent paid", "Mark tutor paid", "Delete", "WhatsApp text copied", "Parent payment recorded", "Tutor payout recorded", "Invoice deleted", "Invoice {number} created.", "Remarks saved", "Back to invoices", "Pending timesheets", "Outstanding parent payments", "Outstanding tutor payouts", "Oldest pending submissions".

## 6. Error handling

- Function and PostgREST errors surface unchanged in destructive toasts, except `23505` on the manual insert, which is translated as above.
- Delete on a paid invoice cannot be reached from the UI (disabled), and the function refuses it anyway.
- PDF image fetch failures fall through to the "Failed to generate PDF" toast.

## 7. Testing

**pgTAP, `supabase/tests/tm_invoices.test.sql`**, fixtures in the slice 4 style (tutor A, admin, one assignment with one tier, two entries submitted via `tm_submit_month`, approved via `tm_approve_submission`):

- As tutor A, `tm_delete_invoice` raises `42501`.
- As admin: unknown id raises `P0002`; after setting `parent_paid_at`, delete raises `22023`; after clearing it and setting `tutor_paid_at`, delete raises `22023`; after clearing both, delete succeeds: the invoice row is gone, both entries are `submitted` with null `invoice_id`, the submission is `submitted` with null `reviewed_at` and `invoice_id`; `tm_approve_submission` succeeds again and the new invoice number equals the deleted one.
- A manual invoice inserted for the same assignment and month gets the next number (`-002`); deleting it removes only that row and leaves the generated invoice untouched.
- Numbering: with `-001` present, inserting a manual row gives `-002`; after deleting `-001` (unpaid, generated: goes through the function), a further manual insert gives `-001`.

**Vitest**: `invoiceLines` (two tiers, first-seen order, the 0.5 x 10.01 rounding case); `whatsappText` for a two-tier generated invoice and a manual invoice with null hours; `filterInvoices` for each filter and "all months"; `filterFromParams`/`filterToParams` round trip and defaults; `invoiceTotals`; `manualLine`; `invoiceFileName`; `monthFigures`, `outstanding`, `oldestPending`; nav order.

**Playwright, `e2e/tm-invoices.spec.ts`**, serial. A fixture `createApprovedMonth(tutorName, studentName, code)` in `e2e/helpers/admin.ts` builds on `createSubmittedMonth` and mimics an approval with the service-role client: inserts a `generated` invoice (total 3.5 h, amount 245, payout 175), sets the entries to `approved` with the invoice id, sets the submission to `approved` with the invoice id and `reviewed_at`. The browser context is created with `clipboard-read` and `clipboard-write` permissions.

1. Admin: `/tm/invoices` lists the invoice with `$245.00`; "Copy WhatsApp text" shows the toast and `navigator.clipboard.readText()` starts with "Hi E2E Parent, here's {student}'s tuition invoice for".
2. Mark parent paid: the row shows today's date and the Delete item is disabled. Clear it: the row shows "Unpaid".
3. Download PDF: the download's suggested filename matches `/ Invoice\.pdf$/`.
4. Delete: toast "Invoice deleted"; `/tm/approvals` lists the month again under "E2E Tutor".
5. New manual invoice for the same assignment and month with amount 100 and payout 60: toast "Invoice TM-" and the row appears with source Manual.
6. Dashboard: "Oldest pending submissions" lists the code and its Review link opens the review panel; the "Outstanding tutor payouts" tile is visible and its link opens `/tm/invoices?month=all&tutor_paid=unpaid`, where the manual invoice row shows `$60.00`. (The tile's sum also includes imported unpaid invoices, so the spec does not assert its exact figure.)

Cleanup: `deleteAssignmentData` (already deletes invoices first).

## 8. Out of scope

Automatic sending of WhatsApp or email, payment reconciliation, deposit offsetting, editing a generated invoice's amounts (delete and re-approve instead), and tutor-visible payout status.
