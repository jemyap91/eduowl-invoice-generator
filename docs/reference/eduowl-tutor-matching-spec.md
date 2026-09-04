# EduOwl Tutor Matching — Timesheet & Invoicing Module
**Build spec for the developer**

---

## 1. Context

EduOwl Education Consultancy Group has two business lines in 2026:

1. **EduOwl English Academy** — one physical classroom. Interface/features should be ~95% the same as the existing Pegasus Learning Academy app (rebranded to EduOwl).
2. **EduOwl Tutor Matching** — no classroom. Tutors are matched to students and go to their homes. Currently run entirely on a Google Sheet (tutor, student, parent, subject, hourly rates, monthly timesheet links, invoice amounts, tutor pay, margin).

This spec covers **only the Tutor Matching module** — a new feature that replaces the manual Google Sheet workflow with an in-app timesheet → approval → invoice pipeline.

---

## 2. Recommended architecture

Don't clone the Pegasus schema for this. Build one app with a **workspace switcher** at the top level:

- `EduOwl English Academy` — reuse Pegasus's existing screens/schema (Dashboard, Schedule, Attendance, Students & Parents, Tutors, Invoices, Settings), rebranded.
- `EduOwl Tutor Matching` — entirely new module described below.

**Shared:** authentication/user accounts.
**Independent per workspace:** database tables, navigation, and screens. Don't try to force classroom/attendance tables to also represent tutor-matching assignments — they're different shapes of data (fixed weekly slot vs. ad hoc logged sessions, single rate vs. multiple rate tiers).

This also means the tutor-login + timesheet-approval + auto-invoice engine you're building now is reusable later if Academy tutors ever want to self-log hours too.

---

## 3. Roles & access

- **Admin (you):** full access to everything in Tutor Matching — assignments, rates, approvals, invoices, payment status.
- **Tutor:** logs in, sees only their own assigned students, can add/edit their own timesheet entries until submitted, cannot see other tutors' rates or students.

---

## 4. Data model

### Tutors
`name, phone number, login credentials, status (active/inactive)`

### Students / Parents
`student name, parent name, parent phone/contact, contact preference (e.g. WeChat)`

### Assignments (Tutor ↔ Student ↔ Subject)
This is the core reusable "contract" between a tutor and a student for a subject.

- `tutor_id, student_id, subject`
- `rate_tiers[]` — a list, not a single rate, e.g.:
  - `{ label: "1:1 face-to-face", parent_rate: 120, tutor_rate: 50 }`
  - `{ label: "Group", parent_rate: 80, tutor_rate: 50 }`
  - `{ label: "Zoom", parent_rate: 50, tutor_rate: 40 }`
- `payment_arrangement`: `"agency invoices parent"` | `"tutor collects directly"`
- `deposit_on_file` (optional, informational — see open questions)
- `status`: active / paused / ended
- `remarks` (free text, e.g. "Contact via WeChat")

### Timesheet entries
Logged by the tutor, one per session.

- `assignment_id, tutor_id, date, start_time, end_time` (or manual hours override)
- `rate_tier_used` (dropdown from the assignment's rate tiers)
- `covering_tutor_id` (nullable — for relief sessions, e.g. "Relief for Zijie")
- `note` (free text)
- `status`: `draft` → `submitted` → `approved` (or sent back for changes)
- `edit_log` — if admin changes an entry, keep a record of the original for transparency

### Monthly invoice
Auto-generated from all `approved` entries for one assignment within a calendar month.

- `invoice_number, period (e.g. "Aug 2026"), line_items[]` (from entries)
- `invoice_amount` = Σ (hours × parent_rate per entry)
- `tutor_payout_amount` = Σ (hours × tutor_rate per entry)
- `diff` = `invoice_amount − tutor_payout_amount` (agency margin)
- `parent_payment_status`: unpaid / paid, `paid_date`
- `tutor_payout_status`: unpaid / paid, `paid_date`
- generated WhatsApp text (see §7) and optional PDF (reuse/adapt the Pegasus invoice template, EduOwl branding)

---

## 5. Screens

### Tutor portal (new)
- **Login**
- **My Students** — active assignments
- **Log a Session** — date, start/end time or hours, rate tier dropdown, note
- **My Timesheet (this month)** — editable table of draft entries + **"Submit for Approval"** button that locks the month's entries
- *(Nice-to-have)* history of past submissions and payout status

### Admin — Tutor Matching workspace
- **Dashboard** — pending approvals count, this month's total invoiced / total tutor payouts / total margin, outstanding parent payments, outstanding tutor payouts
- **Pending Approvals** — queue grouped by tutor/assignment, view & edit entries, Approve or Send back
- **Invoices** — list, filter by status, "Copy WhatsApp message" + "Download PDF", mark Parent Paid / mark Tutor Paid
- **Tutors** — manage profiles, phone numbers, send login invite
- **Students & Assignments** — manage assignments and rate tiers, remarks
- **Settings** — rate tier templates, branding

---

## 6. End-to-end workflow

1. Admin creates an Assignment once (tutor + student + subject + rate tiers).
2. Tutor logs sessions as they happen through the month (or in one batch at month-end — both should work).
3. At month-end, tutor taps **Submit for Approval** — locks their entries and notifies admin.
4. Admin reviews the queue, edits hours/notes if there's a discrepancy (edit is logged), then **Approves**.
5. Approval auto-generates the invoice for that assignment/month: invoice amount, tutor payout, diff.
6. Admin opens the invoice, taps **Copy WhatsApp text** (or downloads PDF), sends to parent manually.
7. Admin checks the bank account, marks the invoice **Paid** once confirmed.
8. Admin pays the tutor by bank transfer, marks **Tutor Paid**.
9. Dashboard totals update automatically.

---

## 7. Suggested WhatsApp message format

```
Hi [Parent Name], here's [Student Name]'s tuition invoice for [Month Year]:

Subject: [Subject]
Sessions: [X hrs total]
Rate: $[rate]/hr ([tier label])
Amount due: $[invoice_amount]

Payment details: [bank/PayNow info]

Thank you! — EduOwl Tutor Matching
```

Generated from the invoice record, one tap to copy.

---

## 8. Edge cases to design for (from your current sheet)

- **Group / 1:1 / Zoom rate differences** → handled by `rate_tiers[]` on the assignment, chosen per entry — not a single flat rate.
- **Relief tutor covering a session** (e.g. "Relief for Zijie") → `covering_tutor_id` on the entry. The assignment's rates don't change; flag as an **open question** whether the relief tutor's payout should route through their own account or the original tutor's.
- **Months with no sessions** → if a tutor submits nothing for an assignment that month, no invoice is generated (avoid blank $0 invoices).
- **"Tutor collects payment directly"** arrangements → system still logs the tutor payout for your records, but flag as an **open question** whether an invoice should still be generated for reference or skipped entirely.
- **Deposits** (e.g. "$960 deposit") → track as informational on the assignment for now; flag as an **open question** whether it should auto-offset the next invoice or just stay a note.
- **Running balance adjustments** (e.g. "Owe ZB $330") → free-text remarks field on the assignment/invoice; no structured logic needed for v1.

---

## 9. Explicit non-goals for v1

- No automatic WhatsApp sending — copy/paste is intentional (matches current manual-send preference).
- No payment gateway / online collection.
- No automatic bank reconciliation.

---

## 10. Suggested build order

1. **M1:** Data model + admin can manually create assignments & rate tiers
2. **M2:** Tutor login + session logging + submit-for-approval
3. **M3:** Admin approval queue + auto invoice generation
4. **M4:** WhatsApp text/PDF export + payment status tracking + dashboard summary

---

## 11. Open questions to settle before/while building

1. Does a deposit on file auto-offset the next invoice, or is it purely informational?
2. For "tutor collects directly" arrangements, should the system still generate a reference invoice, or skip invoicing entirely?
3. For relief-covered sessions, does the payout go to the relief tutor or the original assigned tutor?
