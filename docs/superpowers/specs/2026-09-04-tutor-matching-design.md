# EduOwl Tutor Matching Module - Design

**Date:** 2026-09-04
**Status:** Approved in brainstorming, pending user review of this document
**Source spec:** `docs/reference/eduowl-tutor-matching-spec.md` (product brief), `docs/reference/Tutor Matching (Invoicing) - Demo New MasterList.csv` (current Google Sheet export)
**Brand collateral:** `docs/reference/tutor_matching_logo.pdf` and `tutor_matching_logo_dark.jpg` (cartoon owl), `docs/reference/Tutor Matching (Invoicing) - Mr Eric Invoice CAA 9.9_tutor_matching.pdf` (invoice template to match), `docs/reference/color_palette_eduowl.jpg` and `Yang Xin_July_eduowl.pdf` (Academy brand, for the later rebrand)

## 1. Summary

Add a second workspace, **EduOwl Tutor Matching**, to the existing Pegasus Learning Academy app. It replaces a Google Sheet with an in-app pipeline: admin creates tutor/student assignments with rate tiers, tutors log sessions and submit a monthly timesheet, admin approves, an invoice is generated automatically, and payment status is tracked for both the parent and the tutor.

The existing Academy screens keep their features but are rebranded from Pegasus Learning Academy to **EduOwl English Academy**, and get a workspace switcher in front of them.

### Decisions made during brainstorming

| Topic | Decision |
|---|---|
| Sign-in | Google OAuth via Supabase Auth, for admins and tutors. Email/password form and demo bypass removed. |
| Admins | Two, seeded by email: `zijieynwa@gmail.com` and `ccchristabelle@gmail.com`. An admin can also be linked to a tutor profile and use the tutor portal. |
| Tutor onboarding | Open signup. New Google accounts land as `pending`; admin approves from a pending list and links them to a tutor profile. |
| Academy rebrand | In scope. Academy screens keep their features, lose all Pegasus branding, and take the EduOwl English Academy logo, palette, and invoice template. No feature changes to the Academy. |
| Deposits | Informational: amount and collected status on the assignment. Never offsets an invoice. |
| Tutor collects directly | Does not exist. Every invoice is agency-billed. No payment arrangement field. |
| Relief tutors | Modelled as a separate assignment for the same student and subject, with its own rate tiers. No covering-tutor field. |
| Table placement | Same `public` schema, all new tables prefixed `tm_`. Deployed to a **new** Supabase project. |
| Access control | Row Level Security on all `tm_` tables plus a `profiles` table holding role. Academy tables get an admin-only policy. |
| Invoice granularity | One invoice per assignment per calendar month. |
| Sheet import | One-off script imports tutors, students, assignments, rate tiers, and monthly history as manual invoices. |
| Hosting | Next.js on Vercel, database and auth on Supabase. |

## 2. Auth, roles, and routing

### Sign-in

- `/login` shows a single "Continue with Google" button.
- Supabase handles the OAuth round trip and returns to `/auth/callback`, a route handler that calls `exchangeCodeForSession` and redirects by role.
- `src/app/api/demo-login/route.ts` and the keyboard bypass on the login page are deleted.

### Profiles and roles

New table `profiles`:

| column | type | notes |
|---|---|---|
| id | uuid PK | equals `auth.users.id` |
| email | text | copied from auth on signup |
| full_name | text | from Google metadata |
| role | text | `pending`, `tutor`, `admin` |
| created_at | timestamptz | |

- A trigger on `auth.users` insert creates the profile with `role = 'pending'`, except when the email is in the `admin_emails` table, which gets `admin`.
- `admin_emails` is seeded in a migration with `zijieynwa@gmail.com` and `ccchristabelle@gmail.com`. Adding an admin later is a one-row insert.
- `tm_tutors.profile_id` links a tutor to a profile. Approving a pending user sets `role = 'tutor'` and either creates a `tm_tutors` row or links an existing unlinked one.
- An admin can also be linked to a `tm_tutors` row (Zijie tutors as well as administers). The Tutors screen offers "Link my account" on any unlinked tutor. Admins with a linked tutor row see a "Tutor portal" entry in the workspace switcher.
- A SQL helper `app_role()` (security definer, reads `profiles.role` for `auth.uid()`) is used by every RLS policy.

### Routing by role (middleware)

The existing middleware keeps its session check and adds one profile lookup:

| role | allowed | everything else redirects to |
|---|---|---|
| no session | `/login`, `/auth/callback` | `/login` |
| pending | `/pending` | `/pending` |
| tutor | `/portal/*` | `/portal` |
| admin | all routes, including `/portal/*` when linked to a tutor | `/` or `/tm` per workspace cookie |

`/pending` shows "Thanks for signing up. EduOwl will approve your account shortly." with a sign-out button.

### Workspace switcher (admin)

- Dropdown at the top of the sidebar with two entries: **EduOwl English Academy** (existing routes, rebranded, features unchanged) and **Tutor Matching** (`/tm/*`). A third entry, **Tutor portal**, appears for admins linked to a tutor row.
- Selected workspace is stored in a cookie `workspace=academy|tm`. Landing on `/` with `workspace=tm` redirects to `/tm`.
- Sidebar nav items are chosen by workspace. Tutor Matching items: Dashboard `/tm`, Pending Approvals `/tm/approvals`, Invoices `/tm/invoices`, Tutors `/tm/tutors`, Students & Assignments `/tm/students`, Master List `/tm/master-list`, Settings `/tm/settings`.
- Header page titles extend to the new routes.

### Tutor portal layout

- Route group `src/app/portal/*` with its own layout: top bar (cartoon owl logo, "EduOwl Tutor Matching", tutor name, sign out) and three tabs: My Students `/portal`, Log a Session `/portal/log`, My Timesheet `/portal/timesheet`.
- No sidebar. Mobile-first; tutors use it on phones.

## 3. Data model

All tables in `public`, RLS enabled, `created_at timestamptz default now()` on each. Money columns are `numeric(10,2)`, hours are `numeric(5,2)`. Currency is SGD and not stored.

### `tm_tutors`

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| profile_id | uuid FK profiles, nullable, unique | null until the tutor signs in and is linked |
| name | text not null | |
| phone | text | |
| status | text | `active`, `inactive` |

### `tm_students`

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| name | text not null | e.g. "Janice & Jeanie" is allowed, matches the sheet |
| parent_name | text | |
| parent_phone | text | |
| contact_preference | text | free text, e.g. "WeChat" |
| address | text | |
| remarks | text | |

### `tm_assignments`

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| code | text not null unique | sheet "No", e.g. `JAJE01` |
| tutor_id | uuid FK tm_tutors not null | |
| student_id | uuid FK tm_students not null | |
| subject | text not null | free text, autocomplete from distinct existing values |
| timeslot | text | free text, e.g. "Sat 2-4pm" |
| status | text not null | `active`, `paused`, `stopping`, `stopped`, `moved_to_academy` |
| deposit_amount | numeric | nullable |
| deposit_status | text | `none`, `not_collected`, `collected` |
| curriculum_briefed | boolean default false | |
| group_chat_created | boolean default false | |
| post_trial_checkin_done | boolean default false | |
| monthly_est_profit | numeric | manual estimate |
| additional_materials | text | |
| remarks | text | e.g. "Contact via WeChat", "Owe ZB $330" |

A relief tutor is another `tm_assignments` row on the same student and subject.

### `tm_rate_tiers`

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| assignment_id | uuid FK tm_assignments on delete cascade | |
| label | text not null | "1 to 1", "Group", "Zoom" |
| parent_rate | numeric not null | per hour |
| tutor_rate | numeric not null | per hour |
| sort_order | int default 0 | |

Unique on `(assignment_id, label)`. A view `tm_rate_tiers_tutor_view` exposes `id, assignment_id, label, tutor_rate, sort_order` only; the tutor portal reads tiers through this view so parent rates are never sent to tutors.

### `tm_timesheet_entries`

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| assignment_id | uuid FK tm_assignments not null | |
| tutor_id | uuid FK tm_tutors not null | denormalised for RLS |
| date | date not null | |
| start_time | time | nullable |
| end_time | time | nullable |
| hours | numeric not null | computed from times on save, or typed directly |
| rate_tier_id | uuid FK tm_rate_tiers | nullable if the tier is later deleted |
| tier_label | text not null | snapshot |
| parent_rate | numeric not null | snapshot at log time |
| tutor_rate | numeric not null | snapshot at log time |
| note | text | |
| status | text not null | `draft`, `submitted`, `approved`, `returned` |
| submission_id | uuid FK tm_submissions | set on submit |
| invoice_id | uuid FK tm_invoices | set on approve |
| updated_at | timestamptz | |

Constraints: `hours > 0`, `date <= current_date`. A trigger fills `hours` from `start_time`/`end_time` when both are present and `hours` is null.

### `tm_submissions`

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| assignment_id | uuid FK not null | |
| tutor_id | uuid FK not null | |
| year | int not null | |
| month | int not null, 1-12 | |
| status | text not null | `submitted`, `approved`, `returned` |
| submitted_at | timestamptz | |
| reviewed_at | timestamptz | |
| return_reason | text | |
| invoice_id | uuid FK tm_invoices | set on approve |

Unique on `(assignment_id, year, month)` where `status <> 'returned'`. A returned submission stays as history; resubmitting creates a new row.

### `tm_entry_edits`

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| entry_id | uuid FK tm_timesheet_entries on delete cascade | |
| edited_by | uuid FK profiles | |
| edited_at | timestamptz | |
| previous | jsonb not null | `{date, start_time, end_time, hours, tier_label, note}` before the edit |

Written by the admin edit action whenever a non-draft entry is changed.

### `tm_invoices`

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| invoice_number | text unique | `TM-YYYYMM-NNN`, trigger fills gaps like the Academy trigger |
| assignment_id | uuid FK not null | |
| year | int not null | |
| month | int not null | |
| source | text not null | `generated`, `manual` (manual covers imports and adjustments) |
| total_hours | numeric | |
| invoice_amount | numeric not null | sum of hours x parent_rate |
| tutor_payout | numeric not null | sum of hours x tutor_rate |
| profit | numeric generated always as (invoice_amount - tutor_payout) stored | |
| parent_paid_at | date | null means unpaid |
| tutor_paid_at | date | null means unpaid |
| remarks | text | |

Unique on `(assignment_id, year, month, source)` so a generated invoice and a manual adjustment can coexist for the same month. Line items for generated invoices are the entries with `invoice_id` set; manual invoices have no entries.

### `tm_settings`

Single row, seeded from the invoice template:

| column | seed value |
|---|---|
| company_name | `EduOwl` |
| legal_name | `Education Consultancy Pte. Ltd.` |
| payment_terms | `Payment to be made addressed to EDUOWL EDUCATION CONSULTANCY PTE. LTD. within 7 days of invoice` |
| paynow_uen | `202411710M` |
| qr_code_path | `/tm/paynow-qr.png` |
| payment_details | `PayNow UEN 202411710M` (used in the WhatsApp text) |
| default_rate_tiers | `[]`, jsonb array of `{label, parent_rate, tutor_rate}` used to prefill new assignments |

### Row Level Security

Helper: `app_role()` returns the caller's `profiles.role` or `'anon'`.

| table | admin | tutor | pending |
|---|---|---|---|
| profiles | all | select own row | select own row |
| tm_tutors | all | select where `profile_id = auth.uid()` | none |
| tm_students | all | select where the student has an active assignment with this tutor | none |
| tm_assignments | all | select where `tutor_id` is this tutor | none |
| tm_rate_tiers | all | none directly; via `tm_rate_tiers_tutor_view` for own assignments | none |
| tm_timesheet_entries | all | select own; insert own on own active assignment with status `draft`; update/delete own where status in (`draft`, `returned`) | none |
| tm_submissions | all | select own; insert own | none |
| tm_entry_edits | all | none | none |
| tm_invoices | all | none | none |
| tm_settings | all | none | none |
| Academy tables | all | none | none |

"This tutor" means `tm_tutors.id` where `profile_id = auth.uid()`, wrapped in a `current_tutor_id()` helper.

## 4. Tutor portal

### My Students (`/portal`)

Cards for each `active` assignment: student name, subject, timeslot, own rate tiers (label and tutor rate), "Log session" button. Paused, stopping, stopped, and moved assignments are hidden.

### Log a Session (`/portal/log`)

Form fields: assignment (select), date (default today, max today), start time and end time, or hours typed directly, rate tier (preselected when the assignment has one tier), note. Saving inserts a `draft` entry with the rates snapshotted from the tier. Blocked if a submission already exists for that assignment and month with status `submitted` or `approved`.

### My Timesheet (`/portal/timesheet`)

- Month picker, default current month.
- One section per assignment with entries for the month: date, tier, hours, tutor payout for the line, note. Draft and returned entries have edit and delete.
- Section footer: total hours, total payout, and a status: none (button "Submit for approval"), "Submitted, waiting for approval" (amber), "Approved" (green), "Returned: reason" (red, entries editable, button "Resubmit").
- Submit creates the `tm_submissions` row and sets every draft or returned entry for that assignment and month to `submitted` with `submission_id`. Done in one SQL function `tm_submit_month(assignment_id, year, month)` so it cannot half-complete.
- Past months are read-only with their status.

No notifications in v1. The admin dashboard pending count is the signal.

## 5. Admin workspace

### Dashboard (`/tm`)

Month picker. Six tiles: pending approvals count, total invoiced, total tutor payouts, total profit, outstanding parent payments (count and sum), outstanding tutor payouts (count and sum). Below, the five oldest pending submissions with links into the queue.

### Pending Approvals (`/tm/approvals`)

- Queue of submissions with status `submitted`, grouped by tutor. Each shows code, student, subject, month, entry count, hours, invoice amount, tutor payout, profit.
- Opening one shows an editable entry table. Any change to date, times, hours, tier, or note calls a server action that writes a `tm_entry_edits` row first, then updates the entry. Edited rows show an "Edited" badge with a popover of the previous values.
- **Approve** calls `tm_approve_submission(submission_id)`: refuses if zero entries; inserts the invoice with sums from the entries; sets entries and submission to `approved` with `invoice_id`.
- **Send back** requires a reason; sets submission and entries to `returned`.

### Invoices (`/tm/invoices`)

- Filters: month, tutor, student, parent paid, tutor paid, source.
- Row actions: Copy WhatsApp text, Download PDF, Mark parent paid, Mark tutor paid. Marking paid records today's date, editable in a small dialog.
- Detail view: line items (entries) or the manual amount, remarks field.
- "New manual invoice" button: assignment, month, hours, invoice amount, tutor payout, remarks.
- Delete allowed only when both paid dates are null; for generated invoices it sets the entries and submission back to `submitted`.

### WhatsApp text

```
Hi {parent_name}, here's {student_name}'s tuition invoice for {Month Year}:

Subject: {subject}
Sessions: {total_hours} hrs total
Rate: ${parent_rate}/hr ({tier_label})        <- one line per tier used
Amount due: ${invoice_amount}

Payment details: {tm_settings.payment_details}

Thank you! — EduOwl Tutor Matching
```

Built in `src/lib/tm/whatsapp.ts`, copied with the Clipboard API.

### PDF

A new `src/components/tm/invoice-pdf.tsx`, built from the existing Academy PDF component but matching the Mr Eric template in `docs/reference`:

- Navy top bar (`#2E3192`), "EduOwl" large with "Education Consultancy Pte. Ltd." beneath, cartoon owl logo top right (`public/tm/logo.png`, converted from `tutor_matching_logo.pdf`).
- "Invoice for: {parent_name}" with the student's address beneath, then "{student_name}, {Month Year}".
- Table: Description, Hours, Hourly Rate, Total price. One line per rate tier used, described as "{student_name} {subject} ({tier_label})". Manual invoices show a single line with the amount.
- Payment Methods block: payment terms text, "By PAYNOW: UEN {paynow_uen}", "By QR:" with the QR image from `qr_code_path`.
- Subtotal and a large total in the bottom right.
- Tutor payout never appears.

### Tutors (`/tm/tutors`)

- **Pending signups** section: profiles with `role = 'pending'`, each with "Link to existing tutor" (select an unlinked tutor), "Create new tutor" (name prefilled from Google), and "Reject" (deletes the auth user via a server action using the service role key).
- Tutor list: name, phone, status, linked email, active assignment count. Edit dialog for name, phone, status.

### Students & Assignments (`/tm/students`)

Student list, each expandable to its assignments. Student form: all `tm_students` columns. Assignment form: all `tm_assignments` columns plus a rate tier editor (add/remove rows), prefilled from `tm_settings.default_rate_tiers`.

### Master List (`/tm/master-list`)

Two tabs, both sortable, filterable, with CSV export.

**Assignments tab.** One row per assignment: Code, Tutor, Tutor phone, Student, Parent, Subject, Address, Timeslot, Deposit (amount and status), Parent rates, Tutor rates, Briefed, Group chat, Trial check-in, Est. profit, Status, Remarks, Additional materials, then for the selected month: Invoice amount, Tutor pay, Profit, Parent paid, Tutor paid. Filters: status, tutor, month.

**Monthly History tab.** One row per invoice: Month, Code, Tutor, Student, Subject, Hours, Invoice amount, Tutor pay, Profit, Parent paid (date), Tutor paid (date), Source. Filters: month range, tutor, student. Totals row at the bottom for the filtered set.

### Settings (`/tm/settings`)

Every `tm_settings` column: company name, legal name, payment terms, PayNow UEN, payment details text, default rate tier template. The QR image is a static file in `public/tm/`, replaced by redeploying.

### Branding

Two brands share one component set. The workspace sets a `data-workspace` attribute on the layout root, and `globals.css` overrides the `--primary` and `--ring` tokens per workspace, so buttons, active nav, and badges recolour without touching components.

| | EduOwl English Academy | Tutor Matching |
|---|---|---|
| Logo | Green owl wordmark with Chinese subtitle, `public/academy/logo.png`, extracted from `Yang Xin_July_eduowl.pdf` (image plus its alpha mask) | Cartoon owl, `public/tm/logo.png`, converted from `tutor_matching_logo.pdf` |
| Primary | `#1FAB89`, HSL `165 69% 40%` | Navy `#2E3192`, HSL `239 52% 38%` |
| Text | `#000000` on white | `#000000` on white |
| Invoice header | "EduOwl" over "English Academy", green top bar | "EduOwl" over "Education Consultancy Pte. Ltd.", navy top bar |
| Payment block | "By PAYNOW: 97205889" from the Academy payment methods table | Terms text, UEN, QR image |

## 5a. Academy rebrand (Pegasus removal)

Every Pegasus reference goes. Feature behaviour is unchanged.

- **App shell:** `layout.tsx` title becomes "EduOwl". Sidebar and login page show `public/academy/logo.png`. `globals.css` default `--primary` becomes the EduOwl green. The Assistant font stays.
- **Assets:** delete `public/pegasus_icon.png`, `public/pegasus_icon.webp`, `public/pegasus_qrcode.png`, `public/pegasus_qrcode.jpg`. Academy invoices no longer embed a QR code unless one is added to `public/academy/` later; the download button skips the QR when the file is absent.
- **Academy invoice PDF:** `invoice-pdf.tsx` restyled to the `Yang Xin_July_eduowl.pdf` template: green top bar, "EduOwl / English Academy" header left, logo right, "Invoice for: {parent}", student name and month beneath, the same Description/Hours/Hourly Rate/Total price table, Payment Methods listing the configured payment methods, large total bottom right.
- **Seed data:** the `academy_info` seed row becomes "EduOwl English Academy"; placeholders in the settings form updated. A migration updates the existing row too, for any project that already ran the first migration.
- **Repo:** `package.json` name becomes `eduowl`, README retitled, `scripts/generate-user-guide.tsx` retitled and pointed at the new logo, Playwright smoke test asserts on "EduOwl". `docs/reference/pegasus_learning_academy_design.jpeg`, the Pegasus user guide PDF, and the Ms Selena sample invoice are deleted from the repo.
- **Design doc:** the 2026-03 Pegasus design doc under `docs/plans` stays as history; its brand palette section is no longer authoritative, this document is.

## 6. Sheet import

`scripts/import-master-list.ts`, run once with the service role key against the new project. Idempotent on `code`.

- Rows with a `No` value become assignments. Tutors are deduplicated by name, students by `Student` plus `Parent's Name`.
- Rate cells are parsed: `70/hr` becomes one tier labelled "1 to 1"; multi-line cells like `Group: 80/hr\n1 to 1: 120/hr` become one tier per line. If the tutor rate cell has fewer tiers than the parent cell, the single tutor rate applies to every tier.
- `Deposit`: `N/A` or blank gives `none`. A dollar amount gives `deposit_amount` with `deposit_status = 'collected'`, because the sheet marks collection with bold formatting that the CSV loses. Review by hand after import.
- Monthly columns are read in triplets under the two header rows. A numeric `Invoice Amt` creates a manual invoice with `invoice_amount`, `tutor_payout`, and `total_hours` null. Cells like `No session`, `#REF!`, `Remainder`, or blank create nothing. Currency prefixes `$` and `S$` and thousands separators are stripped.
- The duplicate code `R01` (Madeline/Ray and Shashank/Rayyan) is renamed `RY01` for the second row; the script logs it.
- The Madeline/Ray row, marked "Tutor collects payment herself", imports with status `stopped` and the note in remarks.
- Every imported assignment gets status `active` except the Madeline/Ray row above, because the sheet marks Continue/Pause/Stopped with colours that the CSV loses. Review statuses by hand after import.

## 7. Error handling

- Every multi-row state change (submit, approve, send back, delete generated invoice) is a Postgres function, so partial updates cannot happen.
- Server actions return `{ error: string }` rather than throwing; screens show a toast, matching the existing app.
- RLS denials surface as empty results or insert errors; the portal shows "This session can't be changed anymore" when an update affects zero rows.
- Invoice number collisions are prevented by the unique constraint and the gap-filling trigger.

## 8. Testing

- **Unit (Vitest, new):** hours from times, invoice totals, WhatsApp text builder, rate cell parser and month triplet parser for the import.
- **RLS (SQL, run with `supabase test db` against local Supabase):** as tutor A, cannot select tutor B's entries, assignments, or any invoice; can insert a draft on own assignment; cannot update a submitted entry; cannot read `tm_rate_tiers.parent_rate`.
- **E2E (Playwright, existing):** admin creates an assignment; tutor logs two sessions and submits; admin approves and sees an invoice; WhatsApp text matches expected output.

## 9. Build order

1. **Foundation:** baseline commit, Academy rebrand (Section 5a), Google sign-in, profiles and roles, middleware, workspace switcher, all `tm_` migrations with RLS, import script.
2. **Admin data entry:** Tutors with pending signups, Students & Assignments, Settings, Master List.
3. **Tutor portal:** My Students, Log a Session, My Timesheet with submit.
4. **Approvals:** queue, entry editing with audit log, approve and send back, invoice generation.
5. **Invoices and dashboard:** invoice list and detail, WhatsApp text, PDF, payment status, manual invoices, dashboard tiles.

Each slice is deployable on its own.

## 10. Manual setup checklist

1. Create the new Supabase project; run `supabase link` and `supabase db push` to apply all migrations.
2. In Google Cloud Console, create an OAuth 2.0 client (Web application). Authorised redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`.
3. In Supabase Dashboard, Authentication, Providers, enable Google and paste the client ID and secret.
4. In Supabase Dashboard, Authentication, URL Configuration, add the Vercel production URL and `https://*-<team>.vercel.app/**` to Redirect URLs, plus `http://localhost:3000/**`.
5. In Vercel, set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` (server-only, used by the reject-signup action and the import script).
6. Supply the PayNow QR image as `public/tm/paynow-qr.png`. The one in the Mr Eric template PDF is extracted during implementation if the tooling allows; otherwise export it from the original invoice document.
7. Run `npm run import:master-list` once.
8. Sign in with each admin Google account once, then link Zijie's account to the imported "Zijie" tutor row from the Tutors screen.

## 11. Out of scope for v1

- Automatic WhatsApp or email sending.
- Payment gateway or bank reconciliation.
- Deposit offsetting.
- Tutor-visible payout status.
