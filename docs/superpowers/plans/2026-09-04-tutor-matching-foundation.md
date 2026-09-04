# Tutor Matching Slice 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand the app to EduOwl, replace password login with Google sign-in and role-based routing, add the workspace switcher, create the complete Tutor Matching schema with Row Level Security, and import the master list spreadsheet.

**Architecture:** One Next.js 14 App Router app on Vercel, one Supabase project. Auth users get a `profiles` row with a role (`pending`, `tutor`, `admin`) created by a database trigger; the middleware reads that role and confines each role to its routes. New Tutor Matching tables are prefixed `tm_` in the `public` schema and protected by RLS policies that call two SQL helpers, `app_role()` and `current_tutor_id()`. Screens for the new module arrive in later slices; this slice ships routing shells only.

**Tech Stack:** Next.js 14.2 (App Router, client components querying Supabase directly), Supabase (Postgres 17, Auth with Google provider, `@supabase/ssr` 0.9), Tailwind + shadcn/ui, `@react-pdf/renderer` 4, Playwright 1.58 (existing), Vitest and `tsx` (added in Task 1), pgTAP via `supabase test db`.

**Spec:** `docs/superpowers/specs/2026-09-04-tutor-matching-design.md`. Read Sections 2, 3, 5a, 6, and 10 before starting.

## Global Constraints

- Node 22 or newer (the machine has 26). Next.js stays at `14.2.15`; do not upgrade.
- All new Tutor Matching tables, views, and functions are prefixed `tm_` and live in `public`.
- The RLS helper is named `app_role()`. Never name it `current_role` (reserved in Postgres).
- Admin emails are exactly `zijieynwa@gmail.com` and `ccchristabelle@gmail.com`, stored in the `admin_emails` table.
- Brand names, used verbatim: "EduOwl" (app title), "EduOwl English Academy" (Academy workspace), "Tutor Matching" (new workspace), "EduOwl Tutor Matching" (portal top bar).
- Colours: Academy primary `#1FAB89` = HSL `165 69% 40%`; Tutor Matching primary `#2E3192` = HSL `238 52% 38%`.
- No email or WhatsApp sending anywhere.
- Every commit message ends with the two attribution lines shown in Task 1 Step 6.
- Money columns are `numeric(10,2)`, hours `numeric(5,2)`.
- Local development runs against `npx supabase start` (Docker is installed). Every SQL change is a new file in `supabase/migrations/` named `YYYYMMDDHHMMSS_<name>.sql`, applied with `npx supabase db reset`.
- Never commit `.env.local`. It is gitignored.

## File Structure

Created in this slice:

| Path | Responsibility |
|---|---|
| `vitest.config.ts` | Unit test runner config, node environment |
| `.env.example` | Documents the env vars every developer needs |
| `public/academy/logo.png` | EduOwl English Academy wordmark, extracted from the July invoice PDF |
| `public/tm/logo.png` | Cartoon owl, extracted from the Mr Eric invoice PDF |
| `public/tm/paynow-qr.png` | PayNow QR, extracted from the Mr Eric invoice PDF |
| `scripts/preview-invoice-pdf.tsx` | Renders the Academy invoice PDF with sample data for visual checking |
| `supabase/migrations/20260904100000_eduowl_rebrand.sql` | Renames the seeded academy_info row |
| `supabase/migrations/20260904110000_profiles_and_roles.sql` | `admin_emails`, `profiles`, signup trigger, `app_role()`, admin-only RLS on Academy tables |
| `supabase/migrations/20260904120000_tm_schema.sql` | All `tm_` tables, views, triggers, settings seed |
| `supabase/migrations/20260904130000_tm_rls.sql` | `current_tutor_id()` and every `tm_` RLS policy |
| `supabase/tests/profiles.test.sql` | pgTAP: signup trigger and `app_role()` |
| `supabase/tests/tm_schema.test.sql` | pgTAP: tables, triggers, invoice numbering |
| `supabase/tests/tm_rls.test.sql` | pgTAP: tutor isolation |
| `src/app/auth/callback/route.ts` | Exchanges the OAuth code for a session, redirects by role |
| `src/app/pending/page.tsx` | Holding page for unapproved signups |
| `src/lib/auth/routing.ts` | Pure function deciding redirects from role, path, and workspace cookie |
| `src/lib/auth/routing.test.ts` | Unit tests for the above |
| `src/lib/workspace.ts` | Workspace type, cookie name, nav items, page titles |
| `src/lib/workspace.test.ts` | Unit tests for the above |
| `src/components/layout/workspace-switcher.tsx` | Sidebar dropdown between workspaces |
| `src/app/(dashboard)/tm/page.tsx` | Tutor Matching dashboard shell (filled in slice 5) |
| `src/app/portal/layout.tsx` | Tutor portal shell: top bar and tabs |
| `src/app/portal/page.tsx` | My Students shell (filled in slice 3) |
| `src/lib/tm/import/csv.ts` | Minimal RFC-4180 CSV parser (quoted fields with newlines) |
| `src/lib/tm/import/money.ts` | `parseMoney` |
| `src/lib/tm/import/rates.ts` | `parseRateCell`, `buildRateTiers` |
| `src/lib/tm/import/months.ts` | `parseMonthHeaders` |
| `src/lib/tm/import/master-list.ts` | `parseMasterList` turning CSV text into typed records plus warnings |
| `src/lib/tm/import/*.test.ts` | Unit tests for each of the above |
| `scripts/import-master-list.ts` | Loads parsed records into Supabase with the service role key, idempotent |
| `scripts/seed-test-users.ts` | Creates a local admin and tutor auth user for e2e tests |
| `e2e/helpers/auth.ts` | Signs a Playwright context in by password grant and cookie injection |
| `e2e/auth-routing.spec.ts` | Role routing end to end |

Modified: `package.json`, `README.md`, `.gitignore`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/login/page.tsx`, `src/app/(dashboard)/layout.tsx`, `src/components/layout/sidebar.tsx`, `src/components/layout/header.tsx`, `src/components/invoices/invoice-pdf.tsx`, `src/components/invoices/download-invoice-button.tsx`, `src/components/settings/academy-info-settings.tsx`, `scripts/generate-user-guide.tsx`, `e2e/smoke-test.spec.ts`, `middleware.ts`, `supabase/config.toml`.

Deleted: `public/pegasus_icon.png`, `public/pegasus_icon.webp`, `public/pegasus_qrcode.png`, `public/pegasus_qrcode.jpg`, `src/app/api/demo-login/route.ts`, `docs/reference/pegasus_learning_academy_design.jpeg`, `docs/reference/Pegasus Learning Academy - User Guide.pdf`, `docs/reference/Ms Selena ( Student David) Jan'26 Invoice.pdf`.

---

### Task 1: Test tooling and local environment

**Files:**
- Create: `vitest.config.ts`, `.env.example`
- Modify: `package.json` (scripts, devDependencies, name), `.gitignore`

**Interfaces:**
- Produces: `npm test` (Vitest, `*.test.ts` under `src`), `npm run test:e2e` (Playwright), `npm run db:start`, `npm run db:reset`, `npm run db:test`.

- [ ] **Step 1: Install dev dependencies**

```bash
npm install -D vitest tsx
```

- [ ] **Step 2: Add the Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
})
```

- [ ] **Step 3: Update package.json name and scripts**

Change `"name": "pegasus-learning-academy"` to `"name": "eduowl"` and replace the `scripts` block with:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:e2e": "playwright test",
  "db:start": "supabase start",
  "db:stop": "supabase stop",
  "db:reset": "supabase db reset",
  "db:test": "supabase test db",
  "db:types": "supabase gen types typescript --local > src/lib/supabase/types.ts",
  "seed:test-users": "node --env-file=.env.local --import tsx scripts/seed-test-users.ts",
  "import:master-list": "node --env-file=.env.local --import tsx scripts/import-master-list.ts"
}
```

- [ ] **Step 4: Write `.env.example`**

```bash
# Supabase project (local values shown; get remote values from the Supabase dashboard)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=replace-with-anon-key-from-supabase-start
# Server-only. Used by scripts/import-master-list.ts, scripts/seed-test-users.ts, and the reject-signup action.
SUPABASE_SERVICE_ROLE_KEY=replace-with-service-role-key-from-supabase-start

# Google OAuth client (Google Cloud Console > APIs & Services > Credentials)
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=
SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=

# Local e2e test users (created by npm run seed:test-users)
E2E_ADMIN_EMAIL=zijieynwa@gmail.com
E2E_ADMIN_PASSWORD=e2e-admin-password
E2E_TUTOR_EMAIL=tutor.e2e@example.com
E2E_TUTOR_PASSWORD=e2e-tutor-password
E2E_PENDING_EMAIL=pending.e2e@example.com
E2E_PENDING_PASSWORD=e2e-pending-password
```

- [ ] **Step 5: Add Playwright output folders to `.gitignore`**

Append to `.gitignore`:

```
playwright-report
screenshots/*.png
```

- [ ] **Step 6: Start local Supabase and create `.env.local`**

```bash
npx supabase start
```

Copy the printed `API URL`, `anon key`, and `service_role key` into a new `.env.local` using the keys from `.env.example`. Leave the Google values blank for now.

Verify: `npm test` prints "No test files found" and exits 0. `npx supabase status` shows the API running on 54321.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts .env.example .gitignore
git commit -m "chore: add vitest, tsx, db scripts, and env example

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Nz2dMwYkjrRRcXcuVwSWs1"
```

---

### Task 2: Brand assets

**Files:**
- Create: `public/academy/logo.png`, `public/tm/logo.png`, `public/tm/paynow-qr.png`
- Delete: the four `public/pegasus_*` files and the three Pegasus files in `docs/reference`

**Interfaces:**
- Produces: the three public image paths, referenced by later tasks exactly as `/academy/logo.png`, `/tm/logo.png`, `/tm/paynow-qr.png`.

- [ ] **Step 1: Extract the images with pdfimages (poppler, already installed)**

```bash
mkdir -p public/academy public/tm /tmp/eduowl-extract
pdfimages -png "docs/reference/Yang Xin_July_eduowl.pdf" /tmp/eduowl-extract/academy
pdfimages -png "docs/reference/Tutor Matching (Invoicing) - Mr Eric Invoice CAA 9.9_tutor_matching.pdf" /tmp/eduowl-extract/tm
cp /tmp/eduowl-extract/academy-000.png public/academy/logo.png
cp /tmp/eduowl-extract/tm-000.png public/tm/logo.png
cp /tmp/eduowl-extract/tm-001.png public/tm/paynow-qr.png
```

Expected: `academy-000.png` is 961x541 (green owl wordmark on white), `tm-000.png` is 1024x1024 (cartoon owl on white), `tm-001.png` is 604x584 (QR). Check with `sips -g pixelWidth -g pixelHeight public/academy/logo.png public/tm/logo.png public/tm/paynow-qr.png`.

- [ ] **Step 2: Open each PNG and confirm it is the right image**

Use the Read tool on each of the three files. The academy logo must show "EduOwl English Academy" with the Chinese subtitle; the tm logo must show the cartoon owl with "EDU OWL"; the QR must be a clean square code.

- [ ] **Step 3: Delete Pegasus assets and reference files**

```bash
git rm public/pegasus_icon.png public/pegasus_icon.webp public/pegasus_qrcode.png public/pegasus_qrcode.jpg
git rm "docs/reference/pegasus_learning_academy_design.jpeg" "docs/reference/Pegasus Learning Academy - User Guide.pdf" "docs/reference/Ms Selena ( Student David) Jan'26 Invoice.pdf"
```

- [ ] **Step 4: Commit**

```bash
git add public/academy public/tm
git commit -m "chore: add EduOwl brand assets, remove Pegasus assets

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Nz2dMwYkjrRRcXcuVwSWs1"
```

---

### Task 3: Rebrand the app shell

**Files:**
- Modify: `src/app/layout.tsx:5-8`, `src/app/globals.css:15-41,51-71`, `src/components/layout/sidebar.tsx:44-52`, `src/app/login/page.tsx:73-88`, `src/components/settings/academy-info-settings.tsx:116,146`, `README.md:1-5`, `scripts/generate-user-guide.tsx:14-20,167,176,286`, `e2e/smoke-test.spec.ts:11-14`
- Create: `supabase/migrations/20260904100000_eduowl_rebrand.sql`

**Interfaces:**
- Produces: CSS custom property overrides under `[data-workspace="tm"]` that Task 8 relies on.

- [ ] **Step 1: Retitle the root layout**

In `src/app/layout.tsx` replace the metadata block with:

```ts
export const metadata: Metadata = {
  title: "EduOwl",
  description: "EduOwl English Academy and Tutor Matching management",
};
```

- [ ] **Step 2: Swap the palette in `globals.css`**

In `src/app/globals.css`, inside `:root`, change these lines (leave everything else):

```css
    --primary: 165 69% 40%;
    --secondary: 165 50% 88%;
    --muted: 165 20% 95%;
    --accent: 165 45% 85%;
    --border: 165 25% 86%;
    --input: 165 25% 86%;
    --ring: 165 69% 40%;
    --chart-1: 165 69% 40%;
    --chart-2: 165 50% 70%;
    --chart-3: 165 45% 85%;
    --sidebar-primary: 165 69% 40%;
    --sidebar-accent: 165 45% 85%;
    --sidebar-border: 165 25% 86%;
    --sidebar-ring: 165 69% 40%;
```

Inside `.dark`, change every `176 33% 50%` to `165 69% 45%`, every `157 30% 25%` to `165 30% 22%`, every `187 30% 25%` to `165 30% 22%`.

Then add a new block after the `.dark` block, still inside the first `@layer base`:

```css
  [data-workspace="tm"] {
    --primary: 238 52% 38%;
    --ring: 238 52% 38%;
    --secondary: 238 40% 90%;
    --accent: 238 35% 88%;
    --muted: 238 20% 96%;
    --border: 238 20% 88%;
    --input: 238 20% 88%;
    --chart-1: 238 52% 38%;
    --sidebar-primary: 238 52% 38%;
    --sidebar-accent: 238 35% 88%;
    --sidebar-ring: 238 52% 38%;
  }
```

- [ ] **Step 3: Sidebar logo**

In `src/components/layout/sidebar.tsx` replace the `<Image ... />` in the logo area with:

```tsx
        <Image
          src="/academy/logo.png"
          alt="EduOwl English Academy"
          width={collapsed ? 44 : 200}
          height={collapsed ? 25 : 113}
          priority
        />
```

Also change the two gradient classes `to-[hsl(176,20%,98%)]` (in `Sidebar` and `MobileSidebar`) to `to-[hsl(165,20%,98%)]`.

- [ ] **Step 4: Login page logo and name (the form itself is replaced in Task 6)**

In `src/app/login/page.tsx` replace the `<Image ... />` and the title:

```tsx
            <Image
              src="/academy/logo.png"
              alt="EduOwl"
              width={200}
              height={113}
              priority
            />
```

and

```tsx
            <CardTitle className="text-xl">EduOwl</CardTitle>
```

- [ ] **Step 5: Settings placeholders, README, user guide script, smoke test**

`src/components/settings/academy-info-settings.tsx`: change `placeholder="e.g. Pegasus Learning Academy"` to `placeholder="e.g. EduOwl English Academy"` and `placeholder="e.g. info@pegasus.sg"` to `placeholder="e.g. hello@eduowl.sg"`.

`README.md`: replace the first two lines with:

```markdown
# EduOwl

Management platform for EduOwl English Academy (classroom scheduling, attendance, invoicing) and EduOwl Tutor Matching (home tutoring timesheets, approvals, invoicing).
```

`scripts/generate-user-guide.tsx`: change `const TEAL = '#54ABA7'` to `const TEAL = '#1FAB89'`, `'pegasus_icon.png'` to `'academy/logo.png'`, the footer text to `EduOwl English Academy — User Guide — Page {page}`, the cover title to `EDUOWL ENGLISH ACADEMY`, and the output filename to `'EduOwl English Academy - User Guide.pdf'`.

`e2e/smoke-test.spec.ts` lines 11 and 14:

```ts
    await expect(page).toHaveTitle(/EduOwl|Next/)
```

```ts
    await expect(page.getByAltText('EduOwl English Academy').first()).toBeVisible()
```

- [ ] **Step 6: Migration for the seeded academy name**

Create `supabase/migrations/20260904100000_eduowl_rebrand.sql`:

```sql
-- Rebrand: the seeded academy_info row was 'Pegasus Learning Academy'
UPDATE academy_info SET name = 'EduOwl English Academy' WHERE name = 'Pegasus Learning Academy';
ALTER TABLE academy_info ALTER COLUMN name SET DEFAULT 'EduOwl English Academy';
```

- [ ] **Step 7: Verify no Pegasus references remain**

```bash
grep -rin pegasus src scripts e2e README.md package.json supabase/migrations/20260904100000_eduowl_rebrand.sql
```

Expected: only the `WHERE name = 'Pegasus Learning Academy'` line in the new migration and the historical `INSERT INTO academy_info` line in the initial migration. Nothing under `src`, `scripts`, `e2e`, `README.md`, `package.json`.

```bash
npx supabase db reset && npm run build
```

Expected: reset succeeds, build succeeds.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: rebrand app shell from Pegasus to EduOwl

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Nz2dMwYkjrRRcXcuVwSWs1"
```

---

### Task 4: Academy invoice PDF restyle

**Files:**
- Modify: `src/components/invoices/invoice-pdf.tsx` (full rewrite), `src/components/invoices/download-invoice-button.tsx:86-110`
- Create: `scripts/preview-invoice-pdf.tsx`

**Interfaces:**
- Produces: `InvoicePDF` component with the props interface below. `download-invoice-button.tsx` is its only consumer. The Tutor Matching PDF in slice 5 copies this file rather than sharing it.

- [ ] **Step 1: Rewrite `invoice-pdf.tsx`**

Replace the whole file with:

```tsx
"use client"

import { Document, Page, Text, View, StyleSheet, Font, Image } from '@react-pdf/renderer'

Font.register({
  family: 'Assistant',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/assistant/v24/2sDPZGJYnIjSi6H75xkZZE1I0yCmYzzQtuZnEGE.ttf', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/assistant/v24/2sDPZGJYnIjSi6H75xkZZE1I0yCmYzzQtgFgEGE.ttf', fontWeight: 700 },
  ]
})

const GREEN = '#1FAB89'
const TEXT = '#1A1A1A'
const MUTED = '#6B6B6B'
const ROW_ALT = '#F2F2F2'
const RULE = '#D9D9D9'

export interface InvoicePDFProps {
  academyName: string          // "EduOwl"
  academySubtitle: string      // "English Academy"
  academyAddress?: string | null
  academyPhone?: string | null
  academyEmail?: string | null
  logoUrl?: string
  qrCodeUrl?: string
  invoiceRef: string
  invoiceDate: string
  dueDate: string
  studentName: string
  parentName?: string | null
  parentEmail?: string | null
  parentPhone?: string | null
  month: number
  year: number
  items: {
    description: string
    hours: number | null
    hourlyRate: number | null
    total: number
    isAdhoc: boolean
    datesAttended?: string
  }[]
  subtotal: number
  paymentMethods: { name: string; details: string }[]
}

const styles = StyleSheet.create({
  page: { paddingTop: 0, paddingHorizontal: 48, paddingBottom: 48, fontFamily: 'Assistant', fontSize: 10, color: TEXT },
  topBar: { height: 8, backgroundColor: GREEN, marginHorizontal: -48, marginBottom: 28 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  academyName: { fontSize: 26, color: GREEN, fontWeight: 400 },
  academySubtitle: { fontSize: 13, color: GREEN, marginTop: 2 },
  academyDetail: { fontSize: 8, color: MUTED, marginTop: 2 },
  logo: { width: 170, height: 96, objectFit: 'contain' },
  billTo: { marginBottom: 26 },
  billToLine: { flexDirection: 'row', fontSize: 12, marginBottom: 4 },
  billToLabel: { fontWeight: 700 },
  billToIndent: { marginLeft: 76, fontSize: 11, marginBottom: 2 },
  billToMuted: { marginLeft: 76, fontSize: 9, color: MUTED },
  invoiceMeta: { fontSize: 8, color: MUTED, marginTop: 6 },
  rule: { borderBottomWidth: 1, borderBottomColor: RULE, marginBottom: 14 },
  tableHeader: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: RULE, color: GREEN, fontWeight: 700, fontSize: 11 },
  tableRow: { flexDirection: 'row', paddingVertical: 7, paddingHorizontal: 2, fontSize: 10 },
  tableRowAlt: { flexDirection: 'row', paddingVertical: 7, paddingHorizontal: 2, fontSize: 10, backgroundColor: ROW_ALT },
  colDesc: { flex: 3 },
  colHours: { flex: 0.8, textAlign: 'right' },
  colRate: { flex: 1.1, textAlign: 'right' },
  colTotal: { flex: 1.1, textAlign: 'right' },
  datesAttended: { fontSize: 7, color: MUTED, marginTop: 2 },
  discountText: { color: '#DC2626' },
  subtotalRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: RULE, paddingTop: 8, marginTop: 4 },
  paymentTitle: { color: GREEN, fontWeight: 700, fontSize: 10 },
  subtotalLabel: { color: GREEN, fontSize: 10, marginRight: 24 },
  subtotalValue: { fontWeight: 700, fontSize: 10, width: 70, textAlign: 'right' },
  paymentBlock: { marginTop: 16, gap: 8 },
  paymentMethod: { fontSize: 9 },
  paymentMethodName: { fontWeight: 700 },
  qrCode: { width: 96, height: 96, marginTop: 6 },
  grandTotal: { position: 'absolute', right: 48, bottom: 120, fontSize: 24, fontWeight: 700 },
})

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

function formatCurrency(amount: number): string {
  if (amount < 0) return `-$${Math.abs(amount).toFixed(2)}`
  return `$${amount.toFixed(2)}`
}

export function InvoicePDF({
  academyName, academySubtitle, academyAddress, academyPhone, academyEmail,
  logoUrl, qrCodeUrl, invoiceRef, invoiceDate, dueDate,
  studentName, parentName, parentEmail, parentPhone,
  month, year, items, subtotal, paymentMethods,
}: InvoicePDFProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.topBar} />

        <View style={styles.headerRow}>
          <View>
            <Text style={styles.academyName}>{academyName}</Text>
            <Text style={styles.academySubtitle}>{academySubtitle}</Text>
            {academyAddress && <Text style={styles.academyDetail}>{academyAddress}</Text>}
            {academyPhone && <Text style={styles.academyDetail}>{academyPhone}</Text>}
            {academyEmail && <Text style={styles.academyDetail}>{academyEmail}</Text>}
          </View>
          {logoUrl && <Image src={logoUrl} style={styles.logo} />}
        </View>

        <View style={styles.billTo}>
          <View style={styles.billToLine}>
            <Text style={styles.billToLabel}>Invoice for:  </Text>
            <Text>{parentName || studentName}</Text>
          </View>
          {parentName && <Text style={styles.billToIndent}>{studentName}</Text>}
          <Text style={styles.billToMuted}>{monthNames[month - 1]} {year}</Text>
          {parentPhone && <Text style={styles.billToMuted}>{parentPhone}</Text>}
          {parentEmail && <Text style={styles.billToMuted}>{parentEmail}</Text>}
          <Text style={styles.invoiceMeta}>Invoice {invoiceRef}  ·  Issued {invoiceDate}  ·  Due {dueDate}</Text>
        </View>

        <View style={styles.rule} />

        <View style={styles.tableHeader}>
          <Text style={styles.colDesc}>Description</Text>
          <Text style={styles.colHours}>Hours</Text>
          <Text style={styles.colRate}>Hourly Rate</Text>
          <Text style={styles.colTotal}>Total price</Text>
        </View>
        {items.map((item, i) => {
          const isDiscount = item.total < 0
          return (
            <View key={i} style={i % 2 === 0 ? styles.tableRowAlt : styles.tableRow}>
              <View style={styles.colDesc}>
                <Text style={isDiscount ? styles.discountText : {}}>{item.description}</Text>
                {item.datesAttended && <Text style={styles.datesAttended}>Dates: {item.datesAttended}</Text>}
              </View>
              <Text style={styles.colHours}>{item.hours ? item.hours.toString() : ''}</Text>
              <Text style={styles.colRate}>{item.hourlyRate ? formatCurrency(item.hourlyRate) : ''}</Text>
              <Text style={[styles.colTotal, isDiscount ? styles.discountText : {}]}>{formatCurrency(item.total)}</Text>
            </View>
          )
        })}

        <View style={styles.subtotalRow}>
          <Text style={styles.paymentTitle}>Payment Methods:</Text>
          <View style={{ flexDirection: 'row' }}>
            <Text style={styles.subtotalLabel}>Subtotal</Text>
            <Text style={styles.subtotalValue}>{formatCurrency(subtotal)}</Text>
          </View>
        </View>

        <View style={styles.paymentBlock}>
          {paymentMethods.map((pm, i) => (
            <View key={i} style={styles.paymentMethod}>
              <Text style={styles.paymentMethodName}>By {pm.name.toUpperCase()}:</Text>
              <Text>{pm.details}</Text>
            </View>
          ))}
          {qrCodeUrl && (
            <View style={styles.paymentMethod}>
              <Text style={styles.paymentMethodName}>By QR:</Text>
              <Image src={qrCodeUrl} style={styles.qrCode} />
            </View>
          )}
        </View>

        <Text style={styles.grandTotal}>{formatCurrency(subtotal)}</Text>
      </Page>
    </Document>
  )
}
```

- [ ] **Step 2: Update the download button**

In `src/components/invoices/download-invoice-button.tsx`, replace the two-image fetch and the `<InvoicePDF ...>` props:

```tsx
      const logoUrl = await toDataUri('/academy/logo.png')

      const blob = await pdf(
        <InvoicePDF
          academyName="EduOwl"
          academySubtitle={academy?.name?.replace(/^EduOwl\s*/i, '') || 'English Academy'}
          academyAddress={academy?.address}
          academyPhone={academy?.phone}
          academyEmail={academy?.email}
          logoUrl={logoUrl}
          invoiceRef={invoiceRef}
          invoiceDate={invoiceDate}
          dueDate={dueDate}
          studentName={student?.name || studentName}
          parentName={parent?.name || ""}
          parentEmail={parent?.email}
          parentPhone={parent?.phone}
          month={month}
          year={year}
          items={items.map(item => ({
            description: item.description,
            hours: item.hours ? parseFloat(item.hours) : null,
            hourlyRate: item.hourly_rate ? parseFloat(item.hourly_rate) : null,
            total: parseFloat(item.total),
            isAdhoc: item.is_adhoc,
            datesAttended: item.dates_attended || undefined,
          }))}
          subtotal={subtotal}
          paymentMethods={paymentMethods}
        />
      ).toBlob()
```

Delete the `qrCodeUrl` variable and the `Promise.all` that fetched two images. Keep `toDataUri`.

- [ ] **Step 3: Preview script**

Create `scripts/preview-invoice-pdf.tsx`:

```tsx
import React from 'react'
import path from 'path'
import { renderToFile } from '@react-pdf/renderer'
import { InvoicePDF } from '../src/components/invoices/invoice-pdf'

const root = path.resolve(__dirname, '..')
const out = path.join(root, 'tmp', 'academy-invoice-preview.pdf')

async function main() {
  await renderToFile(
    <InvoicePDF
      academyName="EduOwl"
      academySubtitle="English Academy"
      logoUrl={path.join(root, 'public', 'academy', 'logo.png')}
      invoiceRef="INV-202607-001"
      invoiceDate="1 August 2026"
      dueDate="6 August 2026"
      studentName="Yang Xin"
      parentName="Ms Judy"
      month={7}
      year={2026}
      items={[
        { description: 'English 1-1 lesson with Mr Zi', hours: 4, hourlyRate: 120, total: 480, isAdhoc: false, datesAttended: '3, 10, 17, 24 Jul' },
        { description: 'G2 English TYS', hours: null, hourlyRate: null, total: 7.9, isAdhoc: true },
      ]}
      subtotal={487.9}
      paymentMethods={[{ name: 'PayNow', details: '97205889' }]}
    />,
    out,
  )
  console.log(`Wrote ${out}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
```

Add `tmp` to `.gitignore`.

- [ ] **Step 4: Render and inspect**

```bash
mkdir -p tmp && npx tsx scripts/preview-invoice-pdf.tsx
```

Open `tmp/academy-invoice-preview.pdf` with the Read tool. It must show: green top bar, "EduOwl / English Academy" top left in green, the owl wordmark top right, "Invoice for: Ms Judy" with "Yang Xin" and "July 2026" beneath, a two-row table with green column headings, "Payment Methods:" with "By PAYNOW:" and the number, "Subtotal $487.90", and a large "$487.90" bottom right. Compare against `docs/reference/Yang Xin_July_eduowl.pdf`.

- [ ] **Step 5: Type-check and commit**

```bash
npx tsc --noEmit
git add -A
git commit -m "feat: restyle Academy invoice PDF to the EduOwl template

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Nz2dMwYkjrRRcXcuVwSWs1"
```

---

### Task 5: Profiles, roles, and admin-only access to Academy tables

**Files:**
- Create: `supabase/migrations/20260904110000_profiles_and_roles.sql`, `supabase/tests/profiles.test.sql`

**Interfaces:**
- Produces: table `profiles(id, email, full_name, role, created_at)`, table `admin_emails(email)`, SQL function `app_role() returns text` (`'anon' | 'pending' | 'tutor' | 'admin'`), trigger `on_auth_user_created`. Tasks 7 to 10 depend on all of these.

- [ ] **Step 1: Write the pgTAP test first**

Create `supabase/tests/profiles.test.sql`:

```sql
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(8);

-- Two signups: one admin email, one unknown email. Inserting into auth.users fires the trigger.
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ZijieYnwa@gmail.com', '', now(), '{"provider":"google"}', '{"full_name":"Zijie"}', now(), now()),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'someone@gmail.com', '', now(), '{"provider":"google"}', '{"name":"Some One"}', now(), now());

SELECT is((SELECT role FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000001'), 'admin', 'admin email (any case) gets admin role');
SELECT is((SELECT email FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000001'), 'zijieynwa@gmail.com', 'email stored lower-cased');
SELECT is((SELECT role FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000002'), 'pending', 'unknown email gets pending role');
SELECT is((SELECT full_name FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000002'), 'Some One', 'full_name falls back to the name claim');

-- Seed one academy row as postgres so we can test visibility
INSERT INTO public.students (id, name) VALUES ('00000000-0000-0000-0000-00000000aaaa', 'Visible Student');

-- Act as the pending user
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
SELECT is(public.app_role(), 'pending', 'app_role() reads the caller''s profile');
SELECT is((SELECT count(*)::int FROM public.profiles), 1, 'pending user sees only their own profile');
SELECT is((SELECT count(*)::int FROM public.students), 0, 'pending user cannot read academy tables');

-- Act as the admin
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
SELECT is((SELECT count(*)::int FROM public.students), 1, 'admin reads academy tables');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
npx supabase db reset && npm run db:test
```

Expected: failures mentioning `relation "public.profiles" does not exist`.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260904110000_profiles_and_roles.sql`:

```sql
-- ============================================
-- Profiles, roles, and admin-only access to the Academy tables
-- ============================================

CREATE TABLE admin_emails (
  email TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now()
);
INSERT INTO admin_emails (email) VALUES ('zijieynwa@gmail.com'), ('ccchristabelle@gmail.com');

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'pending' CHECK (role IN ('pending', 'tutor', 'admin')),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_profiles_role ON profiles(role);

-- Create a profile for every new auth user. Admin emails get 'admin', everyone else 'pending'.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    lower(NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    CASE
      WHEN EXISTS (SELECT 1 FROM public.admin_emails a WHERE lower(a.email) = lower(NEW.email)) THEN 'admin'
      ELSE 'pending'
    END
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- The role of the calling user, for RLS policies. SECURITY DEFINER so it can read
-- profiles without triggering the profiles RLS (which would recurse).
CREATE OR REPLACE FUNCTION public.app_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()), 'anon');
$$;

-- RLS: profiles and admin_emails
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_select ON profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.app_role() = 'admin');
CREATE POLICY profiles_admin_update ON profiles FOR UPDATE TO authenticated
  USING (public.app_role() = 'admin') WITH CHECK (public.app_role() = 'admin');
CREATE POLICY profiles_admin_delete ON profiles FOR DELETE TO authenticated
  USING (public.app_role() = 'admin');

ALTER TABLE admin_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_emails_admin_all ON admin_emails FOR ALL TO authenticated
  USING (public.app_role() = 'admin') WITH CHECK (public.app_role() = 'admin');

-- RLS: every existing Academy table becomes admin-only
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'subjects', 'streams', 'classrooms', 'class_types',
    'tutors', 'students', 'parents', 'parent_students',
    'class_series', 'class_sessions', 'session_students',
    'invoices', 'invoice_items', 'payment_methods', 'academy_info',
    'tutor_subjects', 'tutor_streams', 'student_subjects', 'subject_streams'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY admin_all ON public.%I FOR ALL TO authenticated USING (public.app_role() = ''admin'') WITH CHECK (public.app_role() = ''admin'')',
      t
    );
  END LOOP;
END $$;
```

- [ ] **Step 4: Run the tests**

```bash
npx supabase db reset && npm run db:test
```

Expected: `profiles.test.sql .. ok`, 8 tests passed.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260904110000_profiles_and_roles.sql supabase/tests/profiles.test.sql
git commit -m "feat(db): profiles with roles, signup trigger, admin-only RLS on academy tables

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Nz2dMwYkjrRRcXcuVwSWs1"
```

---

### Task 6: Route resolver (pure) and workspace constants

**Files:**
- Create: `src/lib/auth/routing.ts`, `src/lib/auth/routing.test.ts`, `src/lib/workspace.ts`

**Interfaces:**
- Produces:
  - `type Role = "anon" | "pending" | "tutor" | "admin"`
  - `homeFor(role: Role, workspace?: Workspace): string`
  - `resolveRedirect(role: Role, pathname: string, workspace?: Workspace): string | null` (null means "let the request through")
  - `WORKSPACE_COOKIE = "workspace"`, `type Workspace = "academy" | "tm"` from `src/lib/workspace.ts` (Task 8 extends this file).

- [ ] **Step 1: Write the failing tests**

Create `src/lib/auth/routing.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { resolveRedirect, homeFor } from "./routing"

describe("homeFor", () => {
  it("sends admin to the academy dashboard by default", () => {
    expect(homeFor("admin")).toBe("/")
  })
  it("sends admin to /tm when the workspace cookie is tm", () => {
    expect(homeFor("admin", "tm")).toBe("/tm")
  })
  it("sends tutor to the portal", () => {
    expect(homeFor("tutor")).toBe("/portal")
  })
  it("sends pending to the holding page", () => {
    expect(homeFor("pending")).toBe("/pending")
  })
  it("sends anonymous to login", () => {
    expect(homeFor("anon")).toBe("/login")
  })
})

describe("resolveRedirect: anonymous", () => {
  it("allows /login and /auth/callback", () => {
    expect(resolveRedirect("anon", "/login")).toBeNull()
    expect(resolveRedirect("anon", "/auth/callback")).toBeNull()
  })
  it("redirects everything else to /login", () => {
    expect(resolveRedirect("anon", "/")).toBe("/login")
    expect(resolveRedirect("anon", "/portal")).toBe("/login")
    expect(resolveRedirect("anon", "/tm/invoices")).toBe("/login")
  })
})

describe("resolveRedirect: pending", () => {
  it("allows only /pending", () => {
    expect(resolveRedirect("pending", "/pending")).toBeNull()
    expect(resolveRedirect("pending", "/")).toBe("/pending")
    expect(resolveRedirect("pending", "/portal")).toBe("/pending")
    expect(resolveRedirect("pending", "/login")).toBe("/pending")
  })
})

describe("resolveRedirect: tutor", () => {
  it("allows the portal and its sub-routes", () => {
    expect(resolveRedirect("tutor", "/portal")).toBeNull()
    expect(resolveRedirect("tutor", "/portal/timesheet")).toBeNull()
  })
  it("redirects everything else to /portal", () => {
    expect(resolveRedirect("tutor", "/")).toBe("/portal")
    expect(resolveRedirect("tutor", "/tm")).toBe("/portal")
    expect(resolveRedirect("tutor", "/login")).toBe("/portal")
    expect(resolveRedirect("tutor", "/pending")).toBe("/portal")
    expect(resolveRedirect("tutor", "/portalx")).toBe("/portal")
  })
})

describe("resolveRedirect: admin", () => {
  it("allows admin routes and the portal", () => {
    expect(resolveRedirect("admin", "/")).toBeNull()
    expect(resolveRedirect("admin", "/invoices")).toBeNull()
    expect(resolveRedirect("admin", "/tm/approvals")).toBeNull()
    expect(resolveRedirect("admin", "/portal")).toBeNull()
  })
  it("bounces admin off login and pending to their home", () => {
    expect(resolveRedirect("admin", "/login")).toBe("/")
    expect(resolveRedirect("admin", "/login", "tm")).toBe("/tm")
    expect(resolveRedirect("admin", "/pending")).toBe("/")
  })
  it("sends / to /tm when the workspace cookie is tm", () => {
    expect(resolveRedirect("admin", "/", "tm")).toBe("/tm")
    expect(resolveRedirect("admin", "/", "academy")).toBeNull()
    expect(resolveRedirect("admin", "/schedule", "tm")).toBeNull()
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm test
```

Expected: FAIL, cannot resolve `./routing`.

- [ ] **Step 3: Implement**

Create `src/lib/workspace.ts`:

```ts
export const WORKSPACE_COOKIE = "workspace"
export type Workspace = "academy" | "tm"

export function isWorkspace(value: unknown): value is Workspace {
  return value === "academy" || value === "tm"
}
```

Create `src/lib/auth/routing.ts`:

```ts
import type { Workspace } from "@/lib/workspace"

export type Role = "anon" | "pending" | "tutor" | "admin"

const PUBLIC_PATHS = ["/login", "/auth/callback"]

function under(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + "/")
}

export function homeFor(role: Role, workspace?: Workspace): string {
  switch (role) {
    case "admin":
      return workspace === "tm" ? "/tm" : "/"
    case "tutor":
      return "/portal"
    case "pending":
      return "/pending"
    default:
      return "/login"
  }
}

/**
 * Decide where a request should go. Returns a pathname to redirect to,
 * or null to let the request through.
 */
export function resolveRedirect(role: Role, pathname: string, workspace?: Workspace): string | null {
  const isPublic = PUBLIC_PATHS.some((p) => under(pathname, p))

  if (role === "anon") return isPublic ? null : "/login"

  const home = homeFor(role, workspace)
  if (isPublic) return home

  if (role === "pending") return pathname === "/pending" ? null : "/pending"

  if (role === "tutor") return under(pathname, "/portal") ? null : "/portal"

  // admin
  if (pathname === "/pending") return home
  if (pathname === "/" && workspace === "tm") return "/tm"
  return null
}
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: all routing tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth src/lib/workspace.ts
git commit -m "feat(auth): pure route resolver by role and workspace

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Nz2dMwYkjrRRcXcuVwSWs1"
```

---

### Task 7: Google sign-in, callback, pending page, middleware

**Files:**
- Modify: `src/app/login/page.tsx` (full rewrite), `middleware.ts:37-54`, `supabase/config.toml` (add Google provider block)
- Create: `src/app/auth/callback/route.ts`, `src/app/pending/page.tsx`, `src/components/auth/sign-out-button.tsx`
- Delete: `src/app/api/demo-login/route.ts`

**Interfaces:**
- Consumes: `resolveRedirect`, `homeFor`, `Role` from Task 6; `WORKSPACE_COOKIE`, `isWorkspace` from `src/lib/workspace.ts`; `profiles` from Task 5.
- Produces: `<SignOutButton />` client component used by the pending page, and by the portal layout in Task 8.

- [ ] **Step 1: Delete the demo login**

```bash
git rm -r src/app/api/demo-login
```

- [ ] **Step 2: Rewrite the login page**

Replace `src/app/login/page.tsx` with:

```tsx
"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import Image from "next/image"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

function GoogleMark() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5c-.3 1.5-1.1 2.8-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1C3.3 21.3 7.3 24 12 24z" />
      <path fill="#FBBC05" d="M5.3 14.3c-.5-1.5-.5-3.1 0-4.6V6.6H1.3c-1.7 3.4-1.7 7.4 0 10.8l4-3.1z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4C17.9 1.2 15.2 0 12 0 7.3 0 3.3 2.7 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" />
    </svg>
  )
}

function LoginForm() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const params = useSearchParams()
  const callbackError = params.get("error")

  async function signInWithGoogle() {
    setLoading(true)
    setError("")
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <Image src="/academy/logo.png" alt="EduOwl" width={200} height={113} priority />
          </div>
          <div>
            <CardTitle className="text-xl">EduOwl</CardTitle>
            <CardDescription>Sign in with your Google account</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={signInWithGoogle} className="w-full gap-2" disabled={loading} variant="outline">
            <GoogleMark />
            {loading ? "Redirecting..." : "Continue with Google"}
          </Button>
          {(error || callbackError) && (
            <p className="text-sm text-destructive text-center">
              {error || "Sign-in did not complete. Please try again."}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// useSearchParams needs a Suspense boundary in Next 14 for static rendering.
export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
```

The import line at the top of the file must be `import { Suspense, useState } from "react"`.

- [ ] **Step 3: Sign-out button and pending page**

Create `src/components/auth/sign-out-button.tsx`:

```tsx
"use client"

import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

export function SignOutButton({ label = "Sign out" }: { label?: string }) {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-2">
      <LogOut className="h-4 w-4" />
      {label}
    </Button>
  )
}
```

Create `src/app/pending/page.tsx`:

```tsx
import Image from "next/image"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SignOutButton } from "@/components/auth/sign-out-button"

export default function PendingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-sm text-center">
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            <Image src="/tm/logo.png" alt="EduOwl" width={96} height={96} priority />
          </div>
          <div>
            <CardTitle className="text-xl">Thanks for signing up</CardTitle>
            <CardDescription className="mt-2">
              EduOwl will approve your account shortly. Once approved, sign in again to reach your tutor portal.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <SignOutButton />
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 4: OAuth callback route**

Create `src/app/auth/callback/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server"
import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { homeFor, type Role } from "@/lib/auth/routing"
import { WORKSPACE_COOKIE, isWorkspace } from "@/lib/workspace"

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  if (!code) return NextResponse.redirect(`${origin}/login?error=missing_code`)

  const pendingCookies: { name: string; value: string; options: CookieOptions }[] = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          pendingCookies.push(...cookiesToSet)
        },
      },
    }
  )

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error || !data.user) return NextResponse.redirect(`${origin}/login?error=auth`)

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle()
  const role = (profile?.role as Role | undefined) ?? "pending"

  const cookieWorkspace = request.cookies.get(WORKSPACE_COOKIE)?.value
  const workspace = isWorkspace(cookieWorkspace) ? cookieWorkspace : undefined

  const response = NextResponse.redirect(`${origin}${homeFor(role, workspace)}`)
  pendingCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
  return response
}
```

- [ ] **Step 5: Middleware**

In `middleware.ts`, replace the imports and everything from `const { data: { user } } = ...` down to the end of the function with:

```ts
import { createServerClient } from "@supabase/ssr"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { resolveRedirect, type Role } from "@/lib/auth/routing"
import { WORKSPACE_COOKIE, isWorkspace } from "@/lib/workspace"
```

```ts
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let role: Role = "anon"
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()
    role = (profile?.role as Role | undefined) ?? "pending"
  }

  const cookieWorkspace = request.cookies.get(WORKSPACE_COOKIE)?.value
  const workspace = isWorkspace(cookieWorkspace) ? cookieWorkspace : undefined

  const target = resolveRedirect(role, pathname, workspace)
  if (target) {
    const url = request.nextUrl.clone()
    url.pathname = target
    url.search = ""
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
```

Remove the now-unused `isLoginPage` constant.

- [ ] **Step 6: Enable Google in local Supabase config**

Append to `supabase/config.toml`:

```toml
[auth.external.google]
enabled = true
client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"
secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)"
# Overrides the default auth redirectUrl.
redirect_uri = ""
url = ""
skip_nonce_check = false
```

Also change `project_id` near the top of `supabase/config.toml` to `"eduowl"` (this renames the local Docker containers to `supabase_*_eduowl`). Then add to `README.md` under Setup:

```markdown
Local Supabase reads the Google OAuth env vars from your shell when it starts:

    set -a; source .env.local; set +a
    npx supabase start

Leave the two Google values empty in `.env.local` if you only need the e2e test users (see `npm run seed:test-users`).
```

- [ ] **Step 7: Verify**

```bash
set -a; source .env.local; set +a
npx supabase stop && npx supabase start
npx tsc --noEmit && npm run build
```

Then `npm run dev`, open `http://localhost:3000/`: it must redirect to `/login` and show "Continue with Google". `curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/demo-login` must print `404`. If Google credentials are configured, click the button and confirm you land on `/pending` (unknown email) or `/` (admin email).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(auth): Google sign-in, OAuth callback, pending page, role-aware middleware

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Nz2dMwYkjrRRcXcuVwSWs1"
```

---

### Task 8: Workspace switcher, Tutor Matching shell, tutor portal shell

**Files:**
- Modify: `src/lib/workspace.ts`, `src/components/layout/sidebar.tsx`, `src/components/layout/header.tsx`, `src/app/(dashboard)/layout.tsx`
- Create: `src/lib/workspace.test.ts`, `src/components/layout/workspace-switcher.tsx`, `src/app/(dashboard)/tm/page.tsx`, `src/app/portal/layout.tsx`, `src/app/portal/page.tsx`, `src/app/portal/log/page.tsx`, `src/app/portal/timesheet/page.tsx`, `src/components/portal/portal-tabs.tsx`

**Interfaces:**
- Consumes: `SignOutButton` (Task 7), `[data-workspace="tm"]` CSS overrides (Task 3), `profiles` (Task 5).
- Produces: `WORKSPACES`, `workspaceFromPathname(pathname)`, `NAV_ITEMS`, `pageTitle(pathname)` in `src/lib/workspace.ts`. Later slices add nav items by editing `NAV_ITEMS` only.

- [ ] **Step 1: Failing tests for workspace helpers**

Create `src/lib/workspace.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { workspaceFromPathname, pageTitle, NAV_ITEMS, WORKSPACES } from "./workspace"

describe("workspaceFromPathname", () => {
  it("treats /tm and /tm/* as the tutor matching workspace", () => {
    expect(workspaceFromPathname("/tm")).toBe("tm")
    expect(workspaceFromPathname("/tm/invoices")).toBe("tm")
  })
  it("treats everything else as the academy", () => {
    expect(workspaceFromPathname("/")).toBe("academy")
    expect(workspaceFromPathname("/invoices")).toBe("academy")
    expect(workspaceFromPathname("/tmx")).toBe("academy")
  })
})

describe("pageTitle", () => {
  it("knows academy pages", () => {
    expect(pageTitle("/")).toBe("Dashboard")
    expect(pageTitle("/students")).toBe("Students & Parents")
  })
  it("knows tutor matching pages", () => {
    expect(pageTitle("/tm")).toBe("Dashboard")
  })
  it("falls back to the workspace label", () => {
    expect(pageTitle("/tm/whatever")).toBe("Tutor Matching")
    expect(pageTitle("/whatever")).toBe("EduOwl English Academy")
  })
})

describe("NAV_ITEMS", () => {
  it("has a dashboard entry at each workspace home", () => {
    for (const ws of WORKSPACES) {
      expect(NAV_ITEMS[ws.id][0]).toMatchObject({ label: "Dashboard", href: ws.home })
    }
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm test
```

Expected: FAIL, `workspaceFromPathname` is not exported.

- [ ] **Step 3: Extend `src/lib/workspace.ts`**

Replace the file with:

```ts
export const WORKSPACE_COOKIE = "workspace"
export type Workspace = "academy" | "tm"

export function isWorkspace(value: unknown): value is Workspace {
  return value === "academy" || value === "tm"
}

export interface WorkspaceInfo {
  id: Workspace
  label: string
  home: string
  logo: string
  logoWidth: number
  logoHeight: number
}

export const WORKSPACES: WorkspaceInfo[] = [
  { id: "academy", label: "EduOwl English Academy", home: "/", logo: "/academy/logo.png", logoWidth: 200, logoHeight: 113 },
  { id: "tm", label: "Tutor Matching", home: "/tm", logo: "/tm/logo.png", logoWidth: 110, logoHeight: 110 },
]

export function workspaceInfo(id: Workspace): WorkspaceInfo {
  return WORKSPACES.find((w) => w.id === id)!
}

export function workspaceFromPathname(pathname: string): Workspace {
  return pathname === "/tm" || pathname.startsWith("/tm/") ? "tm" : "academy"
}

export interface NavItem {
  label: string
  href: string
}

export const NAV_ITEMS: Record<Workspace, NavItem[]> = {
  academy: [
    { label: "Dashboard", href: "/" },
    { label: "Schedule", href: "/schedule" },
    { label: "Attendance", href: "/attendance" },
    { label: "Students & Parents", href: "/students" },
    { label: "Tutors", href: "/tutors" },
    { label: "Invoices", href: "/invoices" },
    { label: "Settings", href: "/settings" },
  ],
  tm: [
    { label: "Dashboard", href: "/tm" },
  ],
}

export function isNavActive(href: string, pathname: string): boolean {
  if (href === "/" || href === "/tm") return pathname === href
  return pathname === href || pathname.startsWith(href + "/")
}

export function pageTitle(pathname: string): string {
  const ws = workspaceFromPathname(pathname)
  const match = NAV_ITEMS[ws].find((item) => item.href === pathname)
  return match?.label ?? workspaceInfo(ws).label
}

/** Sets the workspace cookie for a year. Client-side only. */
export function rememberWorkspace(id: Workspace) {
  document.cookie = `${WORKSPACE_COOKIE}=${id}; path=/; max-age=31536000; SameSite=Lax`
}
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: all pass.

- [ ] **Step 5: Workspace switcher component**

Create `src/components/layout/workspace-switcher.tsx`:

```tsx
"use client"

import { useRouter } from "next/navigation"
import { ChevronsUpDown, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { WORKSPACES, rememberWorkspace, type Workspace } from "@/lib/workspace"

export function WorkspaceSwitcher({ current, collapsed }: { current: Workspace; collapsed?: boolean }) {
  const router = useRouter()
  const active = WORKSPACES.find((w) => w.id === current)!

  function switchTo(id: Workspace) {
    if (id === current) return
    rememberWorkspace(id)
    router.push(WORKSPACES.find((w) => w.id === id)!.home)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Switch workspace"
        className={cn(
          "flex w-full items-center justify-between rounded-lg border bg-white text-sm font-medium transition-colors hover:bg-muted",
          collapsed ? "justify-center px-2 py-2" : "px-3 py-2"
        )}
      >
        {!collapsed && <span className="truncate">{active.label}</span>}
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {WORKSPACES.map((w) => (
          <DropdownMenuItem key={w.id} onSelect={() => switchTo(w.id)} className="flex items-center justify-between">
            {w.label}
            {w.id === current && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

- [ ] **Step 6: Sidebar uses the workspace**

In `src/components/layout/sidebar.tsx`:

Replace the `navItems` constant and its icon imports with an icon map and the shared nav list:

```tsx
import {
  LayoutDashboard, Calendar, ClipboardCheck, GraduationCap, Users, FileText, Settings,
  ChevronsLeft, ChevronsRight, type LucideIcon,
} from "lucide-react"
import { NAV_ITEMS, WORKSPACES, workspaceFromPathname, isNavActive } from "@/lib/workspace"
import { WorkspaceSwitcher } from "./workspace-switcher"

const ICONS: Record<string, LucideIcon> = {
  Dashboard: LayoutDashboard,
  Schedule: Calendar,
  Attendance: ClipboardCheck,
  "Students & Parents": GraduationCap,
  Tutors: Users,
  Invoices: FileText,
  Settings: Settings,
}
```

Inside `SidebarContent`, after `const pathname = usePathname()`, add:

```tsx
  const workspace = workspaceFromPathname(pathname)
  const info = WORKSPACES.find((w) => w.id === workspace)!
  const navItems = NAV_ITEMS[workspace]
```

Replace the logo `<Image>` with:

```tsx
        <Image
          src={info.logo}
          alt={info.label}
          width={collapsed ? 44 : info.logoWidth}
          height={collapsed ? 44 : info.logoHeight}
          priority
        />
        <div className="w-full pt-2">
          <WorkspaceSwitcher current={workspace} collapsed={collapsed} />
        </div>
```

In the nav loop replace `const isActive = ...` with:

```tsx
            const isActive = isNavActive(item.href, pathname)
            const Icon = ICONS[item.label] ?? LayoutDashboard
```

and replace `<item.icon className="h-5 w-5 shrink-0" />` with `<Icon className="h-5 w-5 shrink-0" />`.

- [ ] **Step 7: Header title and dashboard layout attribute**

`src/components/layout/header.tsx`: delete the `pageTitles` constant, import `pageTitle` from `@/lib/workspace`, and set `const title = pageTitle(pathname)`.

`src/app/(dashboard)/layout.tsx`: import `usePathname` and `workspaceFromPathname`, and change the root element to:

```tsx
  const pathname = usePathname()
  const workspace = workspaceFromPathname(pathname)

  return (
    <div className="flex h-screen" data-workspace={workspace}>
```

- [ ] **Step 8: Tutor Matching dashboard shell**

Create `src/app/(dashboard)/tm/page.tsx`:

```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function TutorMatchingDashboardPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Tutor Matching</CardTitle>
          <CardDescription>
            Home tutoring timesheets, approvals, and invoicing.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Assignments, tutors, and the master list are the next slice. Approvals, invoices, and this dashboard follow.
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 9: Tutor portal shell**

Create `src/components/portal/portal-tabs.tsx`:

```tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const TABS = [
  { label: "My Students", href: "/portal" },
  { label: "Log a Session", href: "/portal/log" },
  { label: "My Timesheet", href: "/portal/timesheet" },
]

export function PortalTabs() {
  const pathname = usePathname()
  return (
    <nav className="bg-white border-b">
      <ul className="flex max-w-3xl mx-auto">
        {TABS.map((tab) => {
          const active = tab.href === "/portal" ? pathname === "/portal" : pathname.startsWith(tab.href)
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                className={cn(
                  "block text-center text-sm py-3 border-b-2 transition-colors",
                  active ? "border-primary text-primary font-semibold" : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
```

Create `src/app/portal/layout.tsx`:

```tsx
import Image from "next/image"
import { createClient } from "@/lib/supabase/server"
import { PortalTabs } from "@/components/portal/portal-tabs"
import { SignOutButton } from "@/components/auth/sign-out-button"

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = user
    ? await supabase.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle()
    : { data: null }

  return (
    <div data-workspace="tm" className="min-h-screen flex flex-col bg-gray-50">
      <header className="h-14 shrink-0 flex items-center justify-between px-4 bg-white border-b">
        <div className="flex items-center gap-2">
          <Image src="/tm/logo.png" alt="EduOwl Tutor Matching" width={36} height={36} />
          <span className="font-semibold">EduOwl Tutor Matching</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-sm text-muted-foreground">
            {profile?.full_name || profile?.email}
          </span>
          <SignOutButton label="" />
        </div>
      </header>
      <PortalTabs />
      <main className="flex-1 w-full max-w-3xl mx-auto p-4">{children}</main>
    </div>
  )
}
```

Create the three shell pages. `src/app/portal/page.tsx`:

```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function MyStudentsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>My Students</CardTitle>
        <CardDescription>Your active assignments will appear here.</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">Nothing to show yet.</CardContent>
    </Card>
  )
}
```

`src/app/portal/log/page.tsx`:

```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function LogSessionPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Log a Session</CardTitle>
        <CardDescription>Record a tutoring session against one of your assignments.</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">Nothing to show yet.</CardContent>
    </Card>
  )
}
```

`src/app/portal/timesheet/page.tsx`:

```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function MyTimesheetPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>My Timesheet</CardTitle>
        <CardDescription>Review and submit this month&apos;s sessions.</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">Nothing to show yet.</CardContent>
    </Card>
  )
}
```

- [ ] **Step 10: Verify**

```bash
npx tsc --noEmit && npm test && npm run build
```

Then with `npm run dev` and a signed-in admin (use the Google flow if configured, otherwise finish Task 13 first and come back): the sidebar shows the Academy logo and a workspace dropdown; choosing "Tutor Matching" navigates to `/tm`, the logo becomes the cartoon owl, and buttons turn navy. Reloading `/` now lands on `/tm`. Switch back and reload: `/` stays on the Academy dashboard.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: workspace switcher, tutor matching shell, tutor portal shell

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Nz2dMwYkjrRRcXcuVwSWs1"
```

---

### Task 9: Tutor Matching schema

**Files:**
- Create: `supabase/migrations/20260904120000_tm_schema.sql`, `supabase/tests/tm_schema.test.sql`

**Interfaces:**
- Produces: tables `tm_tutors`, `tm_students`, `tm_assignments`, `tm_rate_tiers`, `tm_submissions`, `tm_timesheet_entries`, `tm_entry_edits`, `tm_invoices`, `tm_settings`; triggers `tm_set_entry_hours`, `tm_set_invoice_number`, `tm_touch_updated_at`. Column names exactly as in spec Section 3. Task 10 adds RLS; Task 12 inserts into `tm_tutors`, `tm_students`, `tm_assignments`, `tm_rate_tiers`, `tm_invoices`.

- [ ] **Step 1: Write the failing pgTAP test**

Create `supabase/tests/tm_schema.test.sql`:

```sql
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(15);

SELECT has_table('public', 'tm_tutors', 'tm_tutors exists');
SELECT has_table('public', 'tm_students', 'tm_students exists');
SELECT has_table('public', 'tm_assignments', 'tm_assignments exists');
SELECT has_table('public', 'tm_rate_tiers', 'tm_rate_tiers exists');
SELECT has_table('public', 'tm_submissions', 'tm_submissions exists');
SELECT has_table('public', 'tm_timesheet_entries', 'tm_timesheet_entries exists');
SELECT has_table('public', 'tm_entry_edits', 'tm_entry_edits exists');
SELECT has_table('public', 'tm_invoices', 'tm_invoices exists');
SELECT has_table('public', 'tm_settings', 'tm_settings exists');
SELECT is((SELECT count(*)::int FROM tm_settings), 1, 'tm_settings is seeded with one row');

-- Fixture: tutor, student, assignment, tier
INSERT INTO tm_tutors (id, name) VALUES ('10000000-0000-0000-0000-000000000001', 'Guan Wen');
INSERT INTO tm_students (id, name, parent_name) VALUES ('20000000-0000-0000-0000-000000000001', 'Janice', 'Debbie');
INSERT INTO tm_assignments (id, code, tutor_id, student_id, subject)
  VALUES ('30000000-0000-0000-0000-000000000001', 'JAJE01', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Sec 2 English');
INSERT INTO tm_rate_tiers (id, assignment_id, label, parent_rate, tutor_rate)
  VALUES ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '1 to 1', 70, 50);

-- Hours are derived from start/end when not supplied
INSERT INTO tm_timesheet_entries (assignment_id, tutor_id, date, start_time, end_time, rate_tier_id, tier_label, parent_rate, tutor_rate)
  VALUES ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', current_date, '14:00', '15:30', '40000000-0000-0000-0000-000000000001', '1 to 1', 70, 50);
SELECT is((SELECT hours FROM tm_timesheet_entries LIMIT 1), 1.50::numeric, 'hours computed from start and end time');

-- Future-dated entries are rejected
SELECT throws_ok(
  $$ INSERT INTO tm_timesheet_entries (assignment_id, tutor_id, date, hours, tier_label, parent_rate, tutor_rate)
     VALUES ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', current_date + 1, 1, '1 to 1', 70, 50) $$,
  '23514', NULL, 'future date violates check constraint');

-- Invoice numbers: TM-YYYYMM-NNN, gap filling, profit generated
INSERT INTO tm_invoices (id, assignment_id, year, month, source, invoice_amount, tutor_payout)
  VALUES ('50000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 2026, 8, 'manual', 700, 500);
INSERT INTO tm_invoices (id, assignment_id, year, month, source, invoice_amount, tutor_payout)
  VALUES ('50000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 2026, 8, 'generated', 100, 80);
SELECT is((SELECT invoice_number FROM tm_invoices WHERE id = '50000000-0000-0000-0000-000000000002'), 'TM-202608-002', 'second invoice in a month gets 002');
DELETE FROM tm_invoices WHERE id = '50000000-0000-0000-0000-000000000001';
INSERT INTO tm_invoices (id, assignment_id, year, month, source, invoice_amount, tutor_payout)
  VALUES ('50000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', 2026, 8, 'manual', 700, 500);
SELECT is((SELECT invoice_number FROM tm_invoices WHERE id = '50000000-0000-0000-0000-000000000003'), 'TM-202608-001', 'deleted number is reused');
SELECT is((SELECT profit FROM tm_invoices WHERE id = '50000000-0000-0000-0000-000000000003'), 200.00::numeric, 'profit is invoice_amount minus tutor_payout');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx supabase db reset && npm run db:test
```

Expected: `tm_schema.test.sql` fails on `has_table`.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260904120000_tm_schema.sql`:

```sql
-- ============================================
-- EduOwl Tutor Matching - schema
-- ============================================

CREATE TABLE tm_tutors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID UNIQUE REFERENCES profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE tm_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  parent_name TEXT,
  parent_phone TEXT,
  contact_preference TEXT,
  address TEXT,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE tm_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  tutor_id UUID NOT NULL REFERENCES tm_tutors(id),
  student_id UUID NOT NULL REFERENCES tm_students(id),
  subject TEXT NOT NULL,
  timeslot TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'stopping', 'stopped', 'moved_to_academy')),
  deposit_amount NUMERIC(10,2),
  deposit_status TEXT NOT NULL DEFAULT 'none' CHECK (deposit_status IN ('none', 'not_collected', 'collected')),
  curriculum_briefed BOOLEAN NOT NULL DEFAULT false,
  group_chat_created BOOLEAN NOT NULL DEFAULT false,
  post_trial_checkin_done BOOLEAN NOT NULL DEFAULT false,
  monthly_est_profit NUMERIC(10,2),
  additional_materials TEXT,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_tm_assignments_tutor ON tm_assignments(tutor_id);
CREATE INDEX idx_tm_assignments_student ON tm_assignments(student_id);

CREATE TABLE tm_rate_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES tm_assignments(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  parent_rate NUMERIC(10,2) NOT NULL,
  tutor_rate NUMERIC(10,2) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (assignment_id, label)
);

CREATE TABLE tm_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE,
  assignment_id UUID NOT NULL REFERENCES tm_assignments(id),
  year INT NOT NULL,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  source TEXT NOT NULL CHECK (source IN ('generated', 'manual')),
  total_hours NUMERIC(6,2),
  invoice_amount NUMERIC(10,2) NOT NULL,
  tutor_payout NUMERIC(10,2) NOT NULL,
  profit NUMERIC(10,2) GENERATED ALWAYS AS (invoice_amount - tutor_payout) STORED,
  parent_paid_at DATE,
  tutor_paid_at DATE,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (assignment_id, year, month, source)
);
CREATE INDEX idx_tm_invoices_period ON tm_invoices(year, month);

CREATE TABLE tm_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES tm_assignments(id),
  tutor_id UUID NOT NULL REFERENCES tm_tutors(id),
  year INT NOT NULL,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'approved', 'returned')),
  submitted_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  return_reason TEXT,
  invoice_id UUID REFERENCES tm_invoices(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- One live submission per assignment-month; returned ones stay as history
CREATE UNIQUE INDEX idx_tm_submissions_live
  ON tm_submissions(assignment_id, year, month) WHERE status <> 'returned';

CREATE TABLE tm_timesheet_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES tm_assignments(id),
  tutor_id UUID NOT NULL REFERENCES tm_tutors(id),
  date DATE NOT NULL CHECK (date <= current_date),
  start_time TIME,
  end_time TIME,
  hours NUMERIC(5,2) CHECK (hours > 0),
  rate_tier_id UUID REFERENCES tm_rate_tiers(id) ON DELETE SET NULL,
  tier_label TEXT NOT NULL,
  parent_rate NUMERIC(10,2) NOT NULL,
  tutor_rate NUMERIC(10,2) NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'returned')),
  submission_id UUID REFERENCES tm_submissions(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES tm_invoices(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_tm_entries_assignment_date ON tm_timesheet_entries(assignment_id, date);
CREATE INDEX idx_tm_entries_tutor ON tm_timesheet_entries(tutor_id);
CREATE INDEX idx_tm_entries_submission ON tm_timesheet_entries(submission_id);

CREATE TABLE tm_entry_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES tm_timesheet_entries(id) ON DELETE CASCADE,
  edited_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  edited_at TIMESTAMPTZ DEFAULT now(),
  previous JSONB NOT NULL
);

CREATE TABLE tm_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL DEFAULT 'EduOwl',
  legal_name TEXT NOT NULL DEFAULT 'Education Consultancy Pte. Ltd.',
  payment_terms TEXT NOT NULL DEFAULT 'Payment to be made addressed to EDUOWL EDUCATION CONSULTANCY PTE. LTD. within 7 days of invoice',
  paynow_uen TEXT NOT NULL DEFAULT '202411710M',
  qr_code_path TEXT NOT NULL DEFAULT '/tm/paynow-qr.png',
  payment_details TEXT NOT NULL DEFAULT 'PayNow UEN 202411710M',
  default_rate_tiers JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);
INSERT INTO tm_settings DEFAULT VALUES;

-- ---------- Triggers ----------

-- Derive hours from start/end when hours is not supplied; require one or the other.
CREATE OR REPLACE FUNCTION tm_set_entry_hours()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.hours IS NULL AND NEW.start_time IS NOT NULL AND NEW.end_time IS NOT NULL THEN
    NEW.hours := ROUND(EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 3600.0, 2);
  END IF;
  IF NEW.hours IS NULL THEN
    RAISE EXCEPTION 'hours is required when start_time and end_time are not both set'
      USING ERRCODE = '23502';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER tm_set_entry_hours
  BEFORE INSERT OR UPDATE ON tm_timesheet_entries
  FOR EACH ROW EXECUTE FUNCTION tm_set_entry_hours();

CREATE OR REPLACE FUNCTION tm_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER tm_touch_updated_at
  BEFORE UPDATE ON tm_timesheet_entries
  FOR EACH ROW EXECUTE FUNCTION tm_touch_updated_at();

-- Invoice numbers: TM-YYYYMM-NNN, filling gaps left by deleted invoices
CREATE OR REPLACE FUNCTION tm_set_invoice_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  year_month TEXT;
  seq_num INT;
BEGIN
  year_month := LPAD(NEW.year::TEXT, 4, '0') || LPAD(NEW.month::TEXT, 2, '0');
  SELECT COALESCE(
    (SELECT s FROM generate_series(1, 999) s
     WHERE s NOT IN (
       SELECT CAST(SUBSTRING(invoice_number FROM '[0-9]+$') AS INT)
       FROM tm_invoices
       WHERE invoice_number LIKE 'TM-' || year_month || '-%'
     )
     ORDER BY s LIMIT 1),
    1
  ) INTO seq_num;
  NEW.invoice_number := 'TM-' || year_month || '-' || LPAD(seq_num::TEXT, 3, '0');
  RETURN NEW;
END;
$$;
CREATE TRIGGER tm_set_invoice_number
  BEFORE INSERT ON tm_invoices
  FOR EACH ROW
  WHEN (NEW.invoice_number IS NULL)
  EXECUTE FUNCTION tm_set_invoice_number();
```

- [ ] **Step 4: Run the tests**

```bash
npx supabase db reset && npm run db:test
```

Expected: `tm_schema.test.sql .. ok`, 15 tests. If `throws_ok` reports a different SQLSTATE than `23514`, the check constraint is not being hit; confirm the `date <= current_date` constraint exists before changing the test.

- [ ] **Step 5: Regenerate the Supabase types and commit**

```bash
npm run db:types
git add supabase/migrations/20260904120000_tm_schema.sql supabase/tests/tm_schema.test.sql src/lib/supabase/types.ts
git commit -m "feat(db): tutor matching schema with triggers and settings seed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Nz2dMwYkjrRRcXcuVwSWs1"
```

Note: `src/lib/supabase/client.ts` and `server.ts` do not pass the `Database` generic, so regenerating types changes nothing at compile time yet. Later slices may adopt the generic.

---

### Task 10: Row Level Security for Tutor Matching

**Files:**
- Create: `supabase/migrations/20260904130000_tm_rls.sql`, `supabase/tests/tm_rls.test.sql`

**Interfaces:**
- Consumes: `app_role()` (Task 5), all `tm_` tables (Task 9).
- Produces: `current_tutor_id() returns uuid`, view `tm_rate_tiers_tutor_view(id, assignment_id, label, tutor_rate, sort_order)`, and every policy in spec Section 3.

- [ ] **Step 1: Write the failing pgTAP test**

Create `supabase/tests/tm_rls.test.sql`:

```sql
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(16);

-- Two tutor logins and one admin
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tutor.a@example.com', '', now(), '{}', '{"full_name":"Tutor A"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tutor.b@example.com', '', now(), '{}', '{"full_name":"Tutor B"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zijieynwa@gmail.com', '', now(), '{}', '{"full_name":"Admin"}', now(), now());
UPDATE profiles SET role = 'tutor' WHERE id IN ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002');

INSERT INTO tm_tutors (id, profile_id, name) VALUES
  ('10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Tutor A'),
  ('10000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'Tutor B');
INSERT INTO tm_students (id, name, parent_name, parent_phone) VALUES
  ('20000000-0000-0000-0000-000000000001', 'Student of A', 'Parent A', '9111 1111'),
  ('20000000-0000-0000-0000-000000000002', 'Student of B', 'Parent B', '9222 2222');
INSERT INTO tm_assignments (id, code, tutor_id, student_id, subject, status) VALUES
  ('30000000-0000-0000-0000-000000000001', 'A01', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'English', 'active'),
  ('30000000-0000-0000-0000-000000000002', 'B01', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'Math', 'active'),
  ('30000000-0000-0000-0000-000000000003', 'A02', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'Science', 'stopped');
INSERT INTO tm_rate_tiers (assignment_id, label, parent_rate, tutor_rate) VALUES
  ('30000000-0000-0000-0000-000000000001', '1 to 1', 70, 50),
  ('30000000-0000-0000-0000-000000000002', '1 to 1', 80, 60);
INSERT INTO tm_timesheet_entries (id, assignment_id, tutor_id, date, hours, tier_label, parent_rate, tutor_rate, status) VALUES
  ('60000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', current_date, 1, '1 to 1', 70, 50, 'draft'),
  ('60000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', current_date, 2, '1 to 1', 70, 50, 'submitted'),
  ('60000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', current_date, 1, '1 to 1', 80, 60, 'draft');
INSERT INTO tm_invoices (assignment_id, year, month, source, invoice_amount, tutor_payout)
  VALUES ('30000000-0000-0000-0000-000000000001', 2026, 8, 'manual', 700, 500);

-- ---- Act as Tutor A ----
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';

SELECT is(current_tutor_id(), '10000000-0000-0000-0000-000000000001'::uuid, 'current_tutor_id resolves via profile');
SELECT is((SELECT count(*)::int FROM tm_tutors), 1, 'tutor sees only their own tutor row');
SELECT is((SELECT count(*)::int FROM tm_assignments), 2, 'tutor sees only their own assignments (any status)');
SELECT is((SELECT count(*)::int FROM tm_students), 1, 'tutor sees only students on their active assignments');
SELECT is((SELECT count(*)::int FROM tm_timesheet_entries), 2, 'tutor sees only their own entries');
SELECT is((SELECT count(*)::int FROM tm_invoices), 0, 'tutor cannot read invoices');
SELECT is((SELECT count(*)::int FROM tm_settings), 0, 'tutor cannot read settings');
SELECT is((SELECT count(*)::int FROM tm_rate_tiers), 0, 'tutor cannot read the rate tier table directly');
SELECT is((SELECT count(*)::int FROM tm_rate_tiers_tutor_view), 1, 'tutor reads own tiers through the view');
SELECT hasnt_column('public', 'tm_rate_tiers_tutor_view', 'parent_rate', 'the tutor view has no parent_rate column');

-- Can insert a draft on own active assignment
SELECT lives_ok(
  $$ INSERT INTO tm_timesheet_entries (assignment_id, tutor_id, date, hours, tier_label, parent_rate, tutor_rate)
     VALUES ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', current_date, 1, '1 to 1', 70, 50) $$,
  'tutor inserts a draft on own active assignment');
-- Cannot insert on someone else's assignment
SELECT throws_ok(
  $$ INSERT INTO tm_timesheet_entries (assignment_id, tutor_id, date, hours, tier_label, parent_rate, tutor_rate)
     VALUES ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', current_date, 1, '1 to 1', 80, 60) $$,
  '42501', NULL, 'tutor cannot insert on another tutor''s assignment');
-- Cannot insert on own stopped assignment
SELECT throws_ok(
  $$ INSERT INTO tm_timesheet_entries (assignment_id, tutor_id, date, hours, tier_label, parent_rate, tutor_rate)
     VALUES ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', current_date, 1, '1 to 1', 70, 50) $$,
  '42501', NULL, 'tutor cannot insert on a stopped assignment');
-- Cannot change a submitted entry (RLS filters it out of the UPDATE, so 0 rows)
UPDATE tm_timesheet_entries SET hours = 9 WHERE id = '60000000-0000-0000-0000-000000000002';
SELECT is((SELECT hours FROM tm_timesheet_entries WHERE id = '60000000-0000-0000-0000-000000000002'), 2.00::numeric, 'tutor cannot update a submitted entry');
-- Can change a draft
UPDATE tm_timesheet_entries SET hours = 3 WHERE id = '60000000-0000-0000-0000-000000000001';
SELECT is((SELECT hours FROM tm_timesheet_entries WHERE id = '60000000-0000-0000-0000-000000000001'), 3.00::numeric, 'tutor can update a draft entry');

-- ---- Act as admin ----
SET LOCAL request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000009","role":"authenticated"}';
SELECT is((SELECT count(*)::int FROM tm_timesheet_entries), 4, 'admin sees every entry');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx supabase db reset && npm run db:test
```

Expected: `tm_rls.test.sql` fails at `current_tutor_id` does not exist.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260904130000_tm_rls.sql`:

```sql
-- ============================================
-- EduOwl Tutor Matching - Row Level Security
-- ============================================

-- The tm_tutors.id of the calling user, or NULL.
CREATE OR REPLACE FUNCTION public.current_tutor_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id FROM public.tm_tutors t WHERE t.profile_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT public.app_role() = 'admin';
$$;

-- Tutors read their rate tiers through this view, which omits parent_rate.
-- The view runs as its owner (bypasses table RLS) and filters by caller itself.
CREATE VIEW tm_rate_tiers_tutor_view AS
  SELECT rt.id, rt.assignment_id, rt.label, rt.tutor_rate, rt.sort_order
  FROM tm_rate_tiers rt
  JOIN tm_assignments a ON a.id = rt.assignment_id
  WHERE a.tutor_id = public.current_tutor_id() OR public.is_admin();
GRANT SELECT ON tm_rate_tiers_tutor_view TO authenticated;

-- ---------- Enable RLS ----------
ALTER TABLE tm_tutors ENABLE ROW LEVEL SECURITY;
ALTER TABLE tm_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE tm_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tm_rate_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tm_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tm_timesheet_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE tm_entry_edits ENABLE ROW LEVEL SECURITY;
ALTER TABLE tm_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE tm_settings ENABLE ROW LEVEL SECURITY;

-- ---------- Admin: everything ----------
CREATE POLICY admin_all ON tm_tutors FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY admin_all ON tm_students FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY admin_all ON tm_assignments FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY admin_all ON tm_rate_tiers FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY admin_all ON tm_submissions FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY admin_all ON tm_timesheet_entries FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY admin_all ON tm_entry_edits FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY admin_all ON tm_invoices FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY admin_all ON tm_settings FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------- Tutor: own rows only ----------
CREATE POLICY tutor_select_self ON tm_tutors FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

CREATE POLICY tutor_select_own_assignments ON tm_assignments FOR SELECT TO authenticated
  USING (tutor_id = public.current_tutor_id());

CREATE POLICY tutor_select_students_on_active_assignments ON tm_students FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM tm_assignments a
    WHERE a.student_id = tm_students.id
      AND a.tutor_id = public.current_tutor_id()
      AND a.status = 'active'
  ));

CREATE POLICY tutor_select_own_entries ON tm_timesheet_entries FOR SELECT TO authenticated
  USING (tutor_id = public.current_tutor_id());

CREATE POLICY tutor_insert_draft_on_active_assignment ON tm_timesheet_entries FOR INSERT TO authenticated
  WITH CHECK (
    tutor_id = public.current_tutor_id()
    AND status = 'draft'
    AND EXISTS (
      SELECT 1 FROM tm_assignments a
      WHERE a.id = assignment_id
        AND a.tutor_id = public.current_tutor_id()
        AND a.status = 'active'
    )
  );

CREATE POLICY tutor_update_editable_entries ON tm_timesheet_entries FOR UPDATE TO authenticated
  USING (tutor_id = public.current_tutor_id() AND status IN ('draft', 'returned'))
  WITH CHECK (tutor_id = public.current_tutor_id() AND status IN ('draft', 'returned'));

CREATE POLICY tutor_delete_editable_entries ON tm_timesheet_entries FOR DELETE TO authenticated
  USING (tutor_id = public.current_tutor_id() AND status IN ('draft', 'returned'));

CREATE POLICY tutor_select_own_submissions ON tm_submissions FOR SELECT TO authenticated
  USING (tutor_id = public.current_tutor_id());

CREATE POLICY tutor_insert_own_submissions ON tm_submissions FOR INSERT TO authenticated
  WITH CHECK (
    tutor_id = public.current_tutor_id()
    AND status = 'submitted'
    AND EXISTS (
      SELECT 1 FROM tm_assignments a
      WHERE a.id = assignment_id AND a.tutor_id = public.current_tutor_id()
    )
  );

-- No tutor policies on tm_rate_tiers (use the view), tm_entry_edits, tm_invoices, tm_settings.
```

- [ ] **Step 4: Run the tests**

```bash
npx supabase db reset && npm run db:test
```

Expected: all three test files pass (`profiles`, `tm_schema`, `tm_rls`).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260904130000_tm_rls.sql supabase/tests/tm_rls.test.sql
git commit -m "feat(db): RLS policies and tutor rate tier view for tutor matching

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Nz2dMwYkjrRRcXcuVwSWs1"
```

---

### Task 11: Master list parsers (pure functions)

**Files:**
- Create: `src/lib/tm/import/csv.ts`, `csv.test.ts`, `money.ts`, `money.test.ts`, `rates.ts`, `rates.test.ts`, `months.ts`, `months.test.ts`, `master-list.ts`, `master-list.test.ts` (all under `src/lib/tm/import/`)

**Interfaces:**
- Produces:
  - `parseCsv(text: string): string[][]`
  - `parseMoney(cell: string | undefined): number | null`
  - `parseRateCell(cell: string | undefined): { label: string; rate: number }[]`
  - `buildRateTiers(parentCell, tutorCell): RateTier[]` where `RateTier = { label: string; parent_rate: number; tutor_rate: number; sort_order: number }`
  - `parseMonthHeaders(headerRow: string[], firstCol: number): { col: number; year: number; month: number }[]`
  - `parseMasterList(csv: string, codeOverrides?: Record<string, string>): { assignments: ImportedAssignment[]; warnings: string[] }`
  - `ImportedAssignment` (fields listed in Step 9). Task 12 consumes `parseMasterList` and `ImportedAssignment`.

The sheet layout, for reference: row 0 is the header with month labels starting at column 18 every third column (`Jan,,,Feb,,,...,Dec 24,,,Jan 25,...,August 26,,`); row 1 repeats `Invoice Amt,Tutor Pay,Diff` under each; data starts at row 2. Fixed columns: 0 No, 1 Tutor, 2 Tutor's Number, 3 Student, 4 Parent's Name, 5 Subject, 6 Address, 7 Timeslot, 8 Timesheet, 9 Deposit, 10 Parent's Payment Rate, 11 Tutor's Pay Rate, 12 Curriculum Briefed?, 13 Group Chat Created?, 14 Checked in after Trial?, 15 Monthly Est Profit, 16 Remarks, 17 Additional Materials.

- [ ] **Step 1: CSV parser test**

Create `src/lib/tm/import/csv.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { parseCsv } from "./csv"

describe("parseCsv", () => {
  it("splits simple rows and fields", () => {
    expect(parseCsv("a,b,c\n1,2,3\n")).toEqual([["a", "b", "c"], ["1", "2", "3"]])
  })
  it("keeps empty fields", () => {
    expect(parseCsv("a,,c\n,,\n")).toEqual([["a", "", "c"], ["", "", ""]])
  })
  it("handles quoted fields with commas, newlines, and escaped quotes", () => {
    const text = '"Group: 80/hr\n1 to 1: 120/hr","$1,840.00","say ""hi"""\n'
    expect(parseCsv(text)).toEqual([["Group: 80/hr\n1 to 1: 120/hr", "$1,840.00", 'say "hi"']])
  })
  it("handles CRLF line endings", () => {
    expect(parseCsv("a,b\r\nc,d")).toEqual([["a", "b"], ["c", "d"]])
  })
})
```

- [ ] **Step 2: CSV parser**

Create `src/lib/tm/import/csv.ts`:

```ts
/** Minimal RFC 4180 parser: quoted fields may contain commas, newlines, and doubled quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
      continue
    }
    if (c === '"') {
      inQuotes = true
    } else if (c === ",") {
      row.push(field)
      field = ""
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++
      row.push(field)
      rows.push(row)
      row = []
      field = ""
    } else {
      field += c
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}
```

Run `npm test`: csv tests pass.

- [ ] **Step 3: Money parser test and implementation**

Create `src/lib/tm/import/money.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { parseMoney } from "./money"

describe("parseMoney", () => {
  it("parses dollar amounts with separators", () => {
    expect(parseMoney("$1,840.00")).toBe(1840)
    expect(parseMoney("$560")).toBe(560)
    expect(parseMoney("S$120.00")).toBe(120)
    expect(parseMoney("487.9")).toBe(487.9)
    expect(parseMoney(" $0 ")).toBe(0)
  })
  it("returns null for blanks and non-numeric text", () => {
    expect(parseMoney("")).toBeNull()
    expect(parseMoney(undefined)).toBeNull()
    expect(parseMoney("No session")).toBeNull()
    expect(parseMoney("#REF!")).toBeNull()
    expect(parseMoney("Remainder")).toBeNull()
    expect(parseMoney("N/A")).toBeNull()
  })
})
```

Create `src/lib/tm/import/money.ts`:

```ts
/** "$1,840.00" -> 1840, "S$120.00" -> 120, "No session" -> null */
export function parseMoney(cell: string | undefined): number | null {
  if (!cell) return null
  const cleaned = cell.replace(/S?\$/g, "").replace(/,/g, "").trim()
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null
  return Math.round(parseFloat(cleaned) * 100) / 100
}
```

Run `npm test`: money tests pass.

- [ ] **Step 4: Rate parser test**

Create `src/lib/tm/import/rates.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { parseRateCell, buildRateTiers } from "./rates"

describe("parseRateCell", () => {
  it("parses a single unlabeled rate as 1 to 1", () => {
    expect(parseRateCell("70/hr")).toEqual([{ label: "1 to 1", rate: 70 }])
  })
  it("parses labeled multi-line rates", () => {
    expect(parseRateCell("Group: 80/hr\n1 to 1: 120/hr")).toEqual([
      { label: "Group", rate: 80 },
      { label: "1 to 1", rate: 120 },
    ])
  })
  it("normalises label aliases", () => {
    expect(parseRateCell("Zoom: 40/hr\nf2f: 50/hr")).toEqual([
      { label: "Zoom", rate: 40 },
      { label: "1 to 1", rate: 50 },
    ])
  })
  it("returns nothing for prose", () => {
    expect(parseRateCell("Tutor will collect payment herself")).toEqual([])
    expect(parseRateCell("")).toEqual([])
    expect(parseRateCell(undefined)).toEqual([])
  })
})

describe("buildRateTiers", () => {
  it("pairs a single parent rate with a single tutor rate", () => {
    expect(buildRateTiers("70/hr", "50/hr")).toEqual([
      { label: "1 to 1", parent_rate: 70, tutor_rate: 50, sort_order: 0 },
    ])
  })
  it("matches multi-tier parent and tutor cells by label", () => {
    expect(buildRateTiers("Group: 80/hr\n1 to 1: 120/hr", "Group: 80/hr\n1 to 1: 120/hr")).toEqual([
      { label: "Group", parent_rate: 80, tutor_rate: 80, sort_order: 0 },
      { label: "1 to 1", parent_rate: 120, tutor_rate: 120, sort_order: 1 },
    ])
  })
  it("applies a single tutor rate to every parent tier", () => {
    expect(buildRateTiers("Group: 80/hr\n1 to 1: 120/hr", "50/hr")).toEqual([
      { label: "Group", parent_rate: 80, tutor_rate: 50, sort_order: 0 },
      { label: "1 to 1", parent_rate: 120, tutor_rate: 50, sort_order: 1 },
    ])
  })
  it("expands a single parent rate across multiple tutor tiers", () => {
    expect(buildRateTiers("50/hr", "Zoom: 40/hr\nf2f: 50/hr")).toEqual([
      { label: "Zoom", parent_rate: 50, tutor_rate: 40, sort_order: 0 },
      { label: "1 to 1", parent_rate: 50, tutor_rate: 50, sort_order: 1 },
    ])
  })
  it("uses tutor rate 0 when the tutor cell has no rates", () => {
    expect(buildRateTiers("1 to 1: 65/hr", "")).toEqual([
      { label: "1 to 1", parent_rate: 65, tutor_rate: 0, sort_order: 0 },
    ])
  })
  it("returns nothing when the parent cell has no rates", () => {
    expect(buildRateTiers("Tutor will collect payment herself", "")).toEqual([])
  })
})
```

- [ ] **Step 5: Rate parser**

Create `src/lib/tm/import/rates.ts`:

```ts
export interface ParsedRate {
  label: string
  rate: number
}

export interface RateTier {
  label: string
  parent_rate: number
  tutor_rate: number
  sort_order: number
}

const DEFAULT_LABEL = "1 to 1"

const LABEL_ALIASES: Record<string, string> = {
  "1 to 1": "1 to 1",
  "1-1": "1 to 1",
  "1:1": "1 to 1",
  "1 to 1 face-to-face": "1 to 1",
  f2f: "1 to 1",
  "face to face": "1 to 1",
  group: "Group",
  zoom: "Zoom",
  online: "Zoom",
}

export function normaliseLabel(raw: string): string {
  const key = raw.trim().toLowerCase()
  return LABEL_ALIASES[key] ?? raw.trim()
}

const RATE_LINE = /^\s*(?:([^:]+):)?\s*S?\$?\s*(\d+(?:\.\d+)?)\s*\/\s*hr\s*$/i

/** "Group: 80/hr\n1 to 1: 120/hr" -> two rates; "70/hr" -> one rate labelled "1 to 1". */
export function parseRateCell(cell: string | undefined): ParsedRate[] {
  if (!cell) return []
  const out: ParsedRate[] = []
  for (const line of cell.split(/\r?\n/)) {
    const m = line.match(RATE_LINE)
    if (!m) continue
    out.push({ label: m[1] ? normaliseLabel(m[1]) : DEFAULT_LABEL, rate: parseFloat(m[2]) })
  }
  return out
}

function sameLabel(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase()
}

/**
 * Combine the parent-rate cell and tutor-rate cell into tiers.
 * - Same labels on both sides: match by label.
 * - One tutor rate: applies to every parent tier.
 * - One parent rate but several tutor tiers: one tier per tutor label, all at the parent rate.
 * - No tutor rates: tutor_rate 0 (flagged as a warning by the caller).
 */
export function buildRateTiers(parentCell: string | undefined, tutorCell: string | undefined): RateTier[] {
  const parents = parseRateCell(parentCell)
  const tutors = parseRateCell(tutorCell)
  if (parents.length === 0) return []

  if (parents.length === 1 && tutors.length > 1) {
    return tutors.map((t, i) => ({
      label: t.label,
      parent_rate: parents[0].rate,
      tutor_rate: t.rate,
      sort_order: i,
    }))
  }

  return parents.map((p, i) => {
    const byLabel = tutors.find((t) => sameLabel(t.label, p.label))
    const tutorRate = byLabel?.rate ?? (tutors.length === 1 ? tutors[0].rate : tutors[i]?.rate ?? 0)
    return { label: p.label, parent_rate: p.rate, tutor_rate: tutorRate, sort_order: i }
  })
}
```

Run `npm test`: rates tests pass.

- [ ] **Step 6: Month header test**

Create `src/lib/tm/import/months.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { parseMonthLabel, parseMonthHeaders } from "./months"

describe("parseMonthLabel", () => {
  it("parses labels with and without years", () => {
    expect(parseMonthLabel("Jan")).toEqual({ month: 1, year: null })
    expect(parseMonthLabel("Sept")).toEqual({ month: 9, year: null })
    expect(parseMonthLabel("Dec 24")).toEqual({ month: 12, year: 2024 })
    expect(parseMonthLabel("August 26")).toEqual({ month: 8, year: 2026 })
    expect(parseMonthLabel("June 2025")).toEqual({ month: 6, year: 2025 })
  })
  it("rejects non-month headers", () => {
    expect(parseMonthLabel("No")).toBeNull()
    expect(parseMonthLabel("Deposit")).toBeNull()
    expect(parseMonthLabel("Monthly Est Profit")).toBeNull()
    expect(parseMonthLabel("")).toBeNull()
  })
})

describe("parseMonthHeaders", () => {
  it("infers missing years from the next labelled month, walking right to left", () => {
    const header = ["No", "Tutor", "Nov", "", "", "Dec 24", "", "", "Jan 25", "", "", "May 26", "", ""]
    expect(parseMonthHeaders(header, 2)).toEqual([
      { col: 2, year: 2024, month: 11 },
      { col: 5, year: 2024, month: 12 },
      { col: 8, year: 2025, month: 1 },
      { col: 11, year: 2026, month: 5 },
    ])
  })
  it("assigns the previous year when an unlabelled month is later in the year than the next labelled one", () => {
    const header = ["Nov", "", "", "Feb 25"]
    expect(parseMonthHeaders(header, 0)).toEqual([
      { col: 0, year: 2024, month: 11 },
      { col: 3, year: 2025, month: 2 },
    ])
  })
  it("drops months whose year cannot be inferred", () => {
    expect(parseMonthHeaders(["Jan", "", "", "Feb"], 0)).toEqual([])
  })
})
```

- [ ] **Step 7: Month header parser**

Create `src/lib/tm/import/months.ts`:

```ts
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]

export interface MonthColumn {
  col: number
  year: number
  month: number // 1-12
}

export function parseMonthLabel(label: string): { month: number; year: number | null } | null {
  const m = label.trim().match(/^([A-Za-z]+)\.?\s*(\d{2}|\d{4})?$/)
  if (!m) return null
  const idx = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase())
  if (idx < 0) return null
  const year = m[2] ? (m[2].length === 2 ? 2000 + parseInt(m[2], 10) : parseInt(m[2], 10)) : null
  return { month: idx + 1, year }
}

/**
 * Find month columns in the header row from `firstCol` onward. Labels without a
 * year take their year from the nearest labelled month to their right: the same
 * year if that month is later in the calendar, otherwise the year before.
 */
export function parseMonthHeaders(headerRow: string[], firstCol: number): MonthColumn[] {
  const raw: { col: number; month: number; year: number | null }[] = []
  for (let c = firstCol; c < headerRow.length; c++) {
    const parsed = parseMonthLabel(headerRow[c] ?? "")
    if (parsed) raw.push({ col: c, ...parsed })
  }

  let nextYear: number | null = null
  let nextMonth: number | null = null
  for (let i = raw.length - 1; i >= 0; i--) {
    const r = raw[i]
    if (r.year === null && nextYear !== null && nextMonth !== null) {
      r.year = r.month < nextMonth ? nextYear : nextYear - 1
    }
    if (r.year !== null) {
      nextYear = r.year
      nextMonth = r.month
    }
  }

  return raw
    .filter((r) => r.year !== null)
    .map((r) => ({ col: r.col, year: r.year as number, month: r.month }))
}
```

Run `npm test`: months tests pass.

- [ ] **Step 8: Master list test**

Create `src/lib/tm/import/master-list.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import fs from "fs"
import path from "path"
import { parseMasterList } from "./master-list"

const HEADER_FIXED = "No,Tutor,Tutor's Number,Student,Parent's Name,Subject,Address,Timeslot,Timesheet,Deposit,Parent's Payment Rate,Tutor's Pay Rate,Curriculum Briefed?,Group Chat Created?,Checked in?,Monthly Est Profit,Remarks,Additional Materials "
const FIXTURE = [
  `${HEADER_FIXED},Dec 25,,,Jan 26,,,May 26,,`,
  `,,,,,,,,,,,,,,,,,,Invoice Amt,Tutor Pay,Diff,Invoice Amt,Tutor Pay,Diff,Invoice Amt,Tutor Pay,Diff`,
  `JAJE01,Guan Wen,9634 2496,Janice & Jeanie,Debbie Ang,Sec G2 Eng,Clementi,Sat 2-4pm,Guan Wen's Timesheet,N/A,70/hr,50/hr,Y,Y,,160,,,No session,,,$560.00,$400.00,$160.00,$700,$500,$200`,
  `ZB02,Zijie,9720 5889,Zhao Bin,Li Shiwei,Foundational Eng,,,Zijie's Timesheet,$960.00,"Group: 80/hr\n1 to 1: 120/hr","Group: 80/hr\n1 to 1: 120/hr",,,,,Owe ZB $330,,#REF!,,,$960.00,$960.00,$0.00,,,$0`,
  `R01,Madeline,9101 5596,Ray,Petrina,S3 G2 Chem,Blk 849,,NA(Tutor collects payment herself),N/A,Tutor will collect payment herself,,,,,,,,,,,$300,$0,$300,,,`,
  `R01,Shashank,,Rayyan,Stacy,S2 G3 Science,,,,$360.00,45/hr,35/hr,,,,,,,,,,,,,,,`,
  `,,,,,,,,,,,,,,,,,,,,,,,,,,,`,
  `,Continue,,Move to English Academy,,,,,,,,,,,,,,,,,,,,,,,,`,
].join("\n")

describe("parseMasterList (fixture)", () => {
  const result = parseMasterList(FIXTURE, { "R01:Rayyan": "RY01" })

  it("returns one assignment per row with a code, skipping legend rows", () => {
    expect(result.assignments.map((a) => a.code)).toEqual(["JAJE01", "ZB02", "R01", "RY01"])
  })

  it("maps the fixed columns", () => {
    const a = result.assignments[0]
    expect(a).toMatchObject({
      code: "JAJE01",
      tutor_name: "Guan Wen",
      tutor_phone: "9634 2496",
      student_name: "Janice & Jeanie",
      parent_name: "Debbie Ang",
      subject: "Sec G2 Eng",
      address: "Clementi",
      timeslot: "Sat 2-4pm",
      deposit_amount: null,
      deposit_status: "none",
      curriculum_briefed: true,
      group_chat_created: true,
      post_trial_checkin_done: false,
      monthly_est_profit: 160,
      remarks: null,
      additional_materials: null,
      status: "active",
    })
    expect(a.rate_tiers).toEqual([{ label: "1 to 1", parent_rate: 70, tutor_rate: 50, sort_order: 0 }])
  })

  it("reads monthly invoices as (year, month, amount, payout) and skips blanks and text", () => {
    expect(result.assignments[0].invoices).toEqual([
      { year: 2026, month: 1, invoice_amount: 560, tutor_payout: 400 },
      { year: 2026, month: 5, invoice_amount: 700, tutor_payout: 500 },
    ])
    expect(result.assignments[1].invoices).toEqual([
      { year: 2026, month: 1, invoice_amount: 960, tutor_payout: 960 },
    ])
  })

  it("records deposits as collected and multi-line rate tiers", () => {
    const zb = result.assignments[1]
    expect(zb.deposit_amount).toBe(960)
    expect(zb.deposit_status).toBe("collected")
    expect(zb.remarks).toBe("Owe ZB $330")
    expect(zb.rate_tiers.map((t) => t.label)).toEqual(["Group", "1 to 1"])
  })

  it("marks tutor-collects rows as stopped with no tiers and warns", () => {
    const r = result.assignments[2]
    expect(r.status).toBe("stopped")
    expect(r.rate_tiers).toEqual([])
    expect(r.invoices).toEqual([{ year: 2026, month: 1, invoice_amount: 300, tutor_payout: 0 }])
    expect(result.warnings.some((w) => w.includes("R01") && w.includes("no rate tiers"))).toBe(true)
  })

  it("applies code overrides for duplicates and warns about them", () => {
    expect(result.assignments[3].code).toBe("RY01")
    expect(result.assignments[3].deposit_amount).toBe(360)
    expect(result.warnings.some((w) => w.includes("RY01"))).toBe(true)
  })

  it("suffixes unexpected duplicate codes", () => {
    const dup = parseMasterList(FIXTURE, {})
    expect(dup.assignments[3].code).toBe("R01-2")
  })
})

describe("parseMasterList (real export)", () => {
  const file = path.resolve(__dirname, "../../../../docs/reference/Tutor Matching (Invoicing) - Demo New MasterList.csv")
  const result = parseMasterList(fs.readFileSync(file, "utf8"), { "R01:Rayyan": "RY01" })

  it("finds all 35 assignments with unique codes", () => {
    expect(result.assignments).toHaveLength(35)
    expect(new Set(result.assignments.map((a) => a.code)).size).toBe(35)
  })

  it("reads JAJE01 history from the last four month blocks", () => {
    const a = result.assignments.find((x) => x.code === "JAJE01")!
    expect(a.invoices).toEqual([
      { year: 2026, month: 5, invoice_amount: 560, tutor_payout: 400 },
      { year: 2026, month: 6, invoice_amount: 560, tutor_payout: 400 },
      { year: 2026, month: 7, invoice_amount: 700, tutor_payout: 500 },
    ])
  })

  it("reads ET02's zoom and face-to-face tutor tiers", () => {
    const a = result.assignments.find((x) => x.code === "ET02")!
    expect(a.rate_tiers).toEqual([
      { label: "Zoom", parent_rate: 50, tutor_rate: 40, sort_order: 0 },
      { label: "1 to 1", parent_rate: 50, tutor_rate: 50, sort_order: 1 },
    ])
  })
})
```

If the JAJE01 assertion fails, look at the last twelve cells of the JAJE01 row in the CSV: they are the May 26, June 26, July 26, and August 26 blocks in order. Fix the parser, not the expected values, unless the CSV genuinely differs.

- [ ] **Step 9: Master list parser**

Create `src/lib/tm/import/master-list.ts`:

```ts
import { parseCsv } from "./csv"
import { parseMoney } from "./money"
import { buildRateTiers, type RateTier } from "./rates"
import { parseMonthHeaders } from "./months"

export interface ImportedInvoice {
  year: number
  month: number
  invoice_amount: number
  tutor_payout: number
}

export interface ImportedAssignment {
  code: string
  tutor_name: string
  tutor_phone: string | null
  student_name: string
  parent_name: string | null
  subject: string
  address: string | null
  timeslot: string | null
  deposit_amount: number | null
  deposit_status: "none" | "collected"
  rate_tiers: RateTier[]
  curriculum_briefed: boolean
  group_chat_created: boolean
  post_trial_checkin_done: boolean
  monthly_est_profit: number | null
  remarks: string | null
  additional_materials: string | null
  status: "active" | "stopped"
  invoices: ImportedInvoice[]
}

export interface ParseResult {
  assignments: ImportedAssignment[]
  warnings: string[]
}

const COL = {
  code: 0, tutor: 1, phone: 2, student: 3, parent: 4, subject: 5, address: 6, timeslot: 7,
  timesheet: 8, deposit: 9, parentRate: 10, tutorRate: 11, briefed: 12, chat: 13, trial: 14,
  estProfit: 15, remarks: 16, materials: 17, firstMonth: 18,
} as const

function text(cell: string | undefined): string | null {
  const t = (cell ?? "").trim()
  return t.length ? t : null
}

function flag(cell: string | undefined): boolean {
  const t = (cell ?? "").trim().toLowerCase()
  return t.length > 0 && !["n", "no", "-", "x"].includes(t)
}

const COLLECTS_DIRECTLY = /collect/i

/**
 * Parse the master list CSV. `codeOverrides` maps "CODE:Student name" to a
 * replacement code, for rows whose code collides with an earlier row.
 */
export function parseMasterList(csv: string, codeOverrides: Record<string, string> = {}): ParseResult {
  const rows = parseCsv(csv)
  const warnings: string[] = []
  if (rows.length < 3) return { assignments: [], warnings: ["CSV has fewer than 3 rows"] }

  const months = parseMonthHeaders(rows[0], COL.firstMonth)
  if (months.length === 0) warnings.push("No month columns found in the header row")

  const seen = new Set<string>()
  const assignments: ImportedAssignment[] = []

  for (let r = 2; r < rows.length; r++) {
    const row = rows[r]
    const rawCode = text(row[COL.code])
    if (!rawCode) continue

    const studentName = text(row[COL.student]) ?? ""
    let code = codeOverrides[`${rawCode}:${studentName}`] ?? rawCode
    if (code !== rawCode) warnings.push(`Row ${r + 1}: code ${rawCode} for ${studentName} renamed to ${code}`)
    if (seen.has(code)) {
      let n = 2
      while (seen.has(`${code}-${n}`)) n++
      const renamed = `${code}-${n}`
      warnings.push(`Row ${r + 1}: duplicate code ${code} for ${studentName} renamed to ${renamed}; add a codeOverride`)
      code = renamed
    }
    seen.add(code)

    const parentRateCell = row[COL.parentRate]
    const tutorRateCell = row[COL.tutorRate]
    const remarks = text(row[COL.remarks])
    const collectsDirectly =
      COLLECTS_DIRECTLY.test(parentRateCell ?? "") ||
      COLLECTS_DIRECTLY.test(row[COL.timesheet] ?? "") ||
      COLLECTS_DIRECTLY.test(remarks ?? "")

    const rateTiers = buildRateTiers(parentRateCell, tutorRateCell)
    if (rateTiers.length === 0) warnings.push(`Row ${r + 1}: ${code} has no rate tiers (parent cell: "${(parentRateCell ?? "").trim()}")`)
    if (rateTiers.some((t) => t.tutor_rate === 0) && rateTiers.length > 0) warnings.push(`Row ${r + 1}: ${code} has a tier with tutor rate 0`)

    const depositAmount = parseMoney(row[COL.deposit])

    const invoices: ImportedInvoice[] = []
    for (const m of months) {
      const amount = parseMoney(row[m.col])
      if (amount === null) continue
      const payout = parseMoney(row[m.col + 1]) ?? 0
      invoices.push({ year: m.year, month: m.month, invoice_amount: amount, tutor_payout: payout })
    }

    assignments.push({
      code,
      tutor_name: text(row[COL.tutor]) ?? "Unknown tutor",
      tutor_phone: text(row[COL.phone]),
      student_name: studentName || "Unknown student",
      parent_name: text(row[COL.parent]),
      subject: text(row[COL.subject]) ?? "Unknown subject",
      address: text(row[COL.address]),
      timeslot: text(row[COL.timeslot]),
      deposit_amount: depositAmount,
      deposit_status: depositAmount === null ? "none" : "collected",
      rate_tiers: rateTiers,
      curriculum_briefed: flag(row[COL.briefed]),
      group_chat_created: flag(row[COL.chat]),
      post_trial_checkin_done: flag(row[COL.trial]),
      monthly_est_profit: parseMoney(row[COL.estProfit]),
      remarks: collectsDirectly && !remarks ? "Tutor collected payment directly (legacy)" : remarks,
      additional_materials: text(row[COL.materials]),
      status: collectsDirectly ? "stopped" : "active",
      invoices,
    })
  }

  return { assignments, warnings }
}
```

- [ ] **Step 10: Run all unit tests**

```bash
npm test
```

Expected: every test file under `src/lib/tm/import` passes, plus the earlier routing and workspace tests.

- [ ] **Step 11: Commit**

```bash
git add src/lib/tm/import
git commit -m "feat(tm): master list CSV parsers with unit tests

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Nz2dMwYkjrRRcXcuVwSWs1"
```

---

### Task 12: Import script

**Files:**
- Create: `scripts/import-master-list.ts`

**Interfaces:**
- Consumes: `parseMasterList`, `ImportedAssignment` (Task 11); tables from Task 9; env vars `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- Produces: `npm run import:master-list [-- --file <path>] [-- --dry-run]`. Idempotent: rerunning updates rather than duplicates.

- [ ] **Step 1: Write the script**

Create `scripts/import-master-list.ts`:

```ts
import fs from "fs"
import path from "path"
import { createClient } from "@supabase/supabase-js"
import { parseMasterList, type ImportedAssignment } from "../src/lib/tm/import/master-list"

const DEFAULT_FILE = path.resolve(__dirname, "../docs/reference/Tutor Matching (Invoicing) - Demo New MasterList.csv")
const CODE_OVERRIDES: Record<string, string> = { "R01:Rayyan": "RY01" }

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function main() {
  const file = arg("--file") ?? DEFAULT_FILE
  const dryRun = process.argv.includes("--dry-run")

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (use node --env-file=.env.local)")

  const { assignments, warnings } = parseMasterList(fs.readFileSync(file, "utf8"), CODE_OVERRIDES)
  const invoiceCount = assignments.reduce((n, a) => n + a.invoices.length, 0)
  const tutorNames = new Set(assignments.map((a) => a.tutor_name))
  const studentKeys = new Set(assignments.map((a) => `${a.student_name}|${a.parent_name ?? ""}`))

  console.log(`Parsed ${assignments.length} assignments, ${tutorNames.size} tutors, ${studentKeys.size} students, ${invoiceCount} monthly invoices`)
  for (const w of warnings) console.log(`  warning: ${w}`)
  if (dryRun) {
    console.log("Dry run, nothing written.")
    return
  }

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

  // Tutors by name
  const tutorIds = new Map<string, string>()
  for (const name of tutorNames) {
    const phone = assignments.find((a) => a.tutor_name === name && a.tutor_phone)?.tutor_phone ?? null
    const { data: existing } = await supabase.from("tm_tutors").select("id").eq("name", name).maybeSingle()
    if (existing) {
      if (phone) await supabase.from("tm_tutors").update({ phone }).eq("id", existing.id)
      tutorIds.set(name, existing.id)
    } else {
      const { data, error } = await supabase.from("tm_tutors").insert({ name, phone }).select("id").single()
      if (error) throw error
      tutorIds.set(name, data.id)
    }
  }

  // Students by (name, parent_name)
  const studentIds = new Map<string, string>()
  for (const a of assignments) {
    const k = `${a.student_name}|${a.parent_name ?? ""}`
    if (studentIds.has(k)) continue
    let q = supabase.from("tm_students").select("id").eq("name", a.student_name)
    q = a.parent_name ? q.eq("parent_name", a.parent_name) : q.is("parent_name", null)
    const { data: existing } = await q.maybeSingle()
    const fields = { name: a.student_name, parent_name: a.parent_name, address: a.address }
    if (existing) {
      await supabase.from("tm_students").update(fields).eq("id", existing.id)
      studentIds.set(k, existing.id)
    } else {
      const { data, error } = await supabase.from("tm_students").insert(fields).select("id").single()
      if (error) throw error
      studentIds.set(k, data.id)
    }
  }

  // Assignments by code, then tiers and invoices
  let created = 0, updated = 0, invoicesWritten = 0
  for (const a of assignments) {
    const row = assignmentRow(a, tutorIds.get(a.tutor_name)!, studentIds.get(`${a.student_name}|${a.parent_name ?? ""}`)!)
    const { data: existing } = await supabase.from("tm_assignments").select("id").eq("code", a.code).maybeSingle()
    let assignmentId: string
    if (existing) {
      const { error } = await supabase.from("tm_assignments").update(row).eq("id", existing.id)
      if (error) throw error
      assignmentId = existing.id
      updated++
    } else {
      const { data, error } = await supabase.from("tm_assignments").insert(row).select("id").single()
      if (error) throw error
      assignmentId = data.id
      created++
    }

    await supabase.from("tm_rate_tiers").delete().eq("assignment_id", assignmentId)
    if (a.rate_tiers.length) {
      const { error } = await supabase.from("tm_rate_tiers").insert(a.rate_tiers.map((t) => ({ ...t, assignment_id: assignmentId })))
      if (error) throw error
    }

    if (a.invoices.length) {
      const { error } = await supabase.from("tm_invoices").upsert(
        a.invoices.map((inv) => ({
          assignment_id: assignmentId,
          year: inv.year,
          month: inv.month,
          source: "manual",
          invoice_amount: inv.invoice_amount,
          tutor_payout: inv.tutor_payout,
          remarks: "Imported from master list",
        })),
        { onConflict: "assignment_id,year,month,source" }
      )
      if (error) throw error
      invoicesWritten += a.invoices.length
    }
  }

  console.log(`Done. Assignments created: ${created}, updated: ${updated}. Invoices upserted: ${invoicesWritten}.`)
}

function assignmentRow(a: ImportedAssignment, tutorId: string, studentId: string) {
  return {
    code: a.code,
    tutor_id: tutorId,
    student_id: studentId,
    subject: a.subject,
    timeslot: a.timeslot,
    status: a.status,
    deposit_amount: a.deposit_amount,
    deposit_status: a.deposit_status,
    curriculum_briefed: a.curriculum_briefed,
    group_chat_created: a.group_chat_created,
    post_trial_checkin_done: a.post_trial_checkin_done,
    monthly_est_profit: a.monthly_est_profit,
    additional_materials: a.additional_materials,
    remarks: a.remarks,
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
```

- [ ] **Step 2: Dry run**

```bash
npm run import:master-list -- --dry-run
```

Expected output starts with `Parsed 35 assignments, ` followed by tutor and student counts and the invoice count, then the warning lines (the R01 rename, the Madeline row with no tiers, and any tier with tutor rate 0), then `Dry run, nothing written.`

- [ ] **Step 3: Real run against local Supabase, twice**

```bash
npm run import:master-list
npm run import:master-list
```

Expected: first run prints `Assignments created: 35, updated: 0`; second prints `created: 0, updated: 35`, and the invoice count is identical both times. Then check the row counts:

```bash
docker exec supabase_db_eduowl psql -U postgres -d postgres -c "select (select count(*) from tm_assignments) assignments, (select count(*) from tm_rate_tiers) tiers, (select count(*) from tm_invoices) invoices, (select count(*) from tm_tutors) tutors, (select count(*) from tm_students) students;"
docker exec supabase_db_eduowl psql -U postgres -d postgres -c "select code, year, month, invoice_amount, tutor_payout, profit, invoice_number from tm_invoices i join tm_assignments a on a.id = i.assignment_id where code = 'JAJE01' order by year, month;"
```

Expected: 35 assignments, invoices equal to the parsed count, no duplicates after the second run, JAJE01 showing May, June, July 2026 with profit 160, 160, 200.

- [ ] **Step 4: Commit**

```bash
git add scripts/import-master-list.ts
git commit -m "feat(tm): idempotent master list import script

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Nz2dMwYkjrRRcXcuVwSWs1"
```

---

### Task 13: Test users, e2e auth helper, routing e2e, and final verification

**Files:**
- Create: `scripts/seed-test-users.ts`, `e2e/helpers/auth.ts`, `e2e/auth-routing.spec.ts`
- Modify: `playwright.config.ts`, `e2e/smoke-test.spec.ts` (add a signed-in `beforeEach`)

**Interfaces:**
- Consumes: env vars `E2E_*` from `.env.example`, `profiles`, `tm_tutors`.
- Produces: `signIn(context, email, password)` for every future e2e spec.

- [ ] **Step 1: Seed script**

Create `scripts/seed-test-users.ts`:

```ts
import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
if (!url.includes("127.0.0.1") && !url.includes("localhost")) throw new Error("Refusing to seed test users against a non-local Supabase URL")

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

async function ensureUser(email: string, password: string, fullName: string): Promise<string> {
  const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const existing = list?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
  if (existing) return existing.id
  const { data, error } = await supabase.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name: fullName },
  })
  if (error) throw error
  return data.user.id
}

async function main() {
  const env = (k: string) => {
    const v = process.env[k]
    if (!v) throw new Error(`${k} must be set in .env.local`)
    return v
  }

  const adminId = await ensureUser(env("E2E_ADMIN_EMAIL"), env("E2E_ADMIN_PASSWORD"), "E2E Admin")
  const tutorId = await ensureUser(env("E2E_TUTOR_EMAIL"), env("E2E_TUTOR_PASSWORD"), "E2E Tutor")
  await ensureUser(env("E2E_PENDING_EMAIL"), env("E2E_PENDING_PASSWORD"), "E2E Pending")

  // Promote the tutor and link a tm_tutors row
  await supabase.from("profiles").update({ role: "tutor" }).eq("id", tutorId)
  const { data: tutorRow } = await supabase.from("tm_tutors").select("id").eq("profile_id", tutorId).maybeSingle()
  if (!tutorRow) {
    const { error } = await supabase.from("tm_tutors").insert({ name: "E2E Tutor", profile_id: tutorId })
    if (error) throw error
  }

  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", adminId).single()
  if (adminProfile?.role !== "admin") throw new Error(`Admin user has role ${adminProfile?.role}; E2E_ADMIN_EMAIL must be in admin_emails`)

  console.log("Test users ready: admin, tutor (linked), pending")
}

main().catch((e) => { console.error(e); process.exit(1) })
```

Run it:

```bash
npm run seed:test-users
```

Expected: `Test users ready: admin, tutor (linked), pending`. Running it again prints the same line without errors.

- [ ] **Step 2: Load `.env.local` in Playwright and add the auth helper**

At the top of `playwright.config.ts`, before `defineConfig`, add:

```ts
import fs from "fs"

// Load .env.local so specs can read Supabase and E2E_* values (Next.js loads it for the server itself)
if (fs.existsSync(".env.local")) {
  for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim()
  }
}
```

Create `e2e/helpers/auth.ts`:

```ts
import type { BrowserContext } from "@playwright/test"

const CHUNK = 3180

/**
 * Sign a browser context in without the Google UI: password grant against
 * Supabase Auth, then write the session cookie in the format @supabase/ssr expects.
 */
export async function signIn(context: BrowserContext, email: string, password: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) throw new Error(`sign-in failed for ${email}: ${res.status} ${await res.text()}`)
  const session = await res.json()

  const ref = new URL(url).hostname.split(".")[0]
  const name = `sb-${ref}-auth-token`
  const value = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url")

  const chunks: string[] = []
  for (let i = 0; i < value.length; i += CHUNK) chunks.push(value.slice(i, i + CHUNK))
  const cookies = chunks.length === 1
    ? [{ name, value: chunks[0] }]
    : chunks.map((v, i) => ({ name: `${name}.${i}`, value: v }))

  await context.addCookies(cookies.map((c) => ({ ...c, domain: "localhost", path: "/" })))
}

export const users = {
  admin: { email: process.env.E2E_ADMIN_EMAIL!, password: process.env.E2E_ADMIN_PASSWORD! },
  tutor: { email: process.env.E2E_TUTOR_EMAIL!, password: process.env.E2E_TUTOR_PASSWORD! },
  pending: { email: process.env.E2E_PENDING_EMAIL!, password: process.env.E2E_PENDING_PASSWORD! },
}
```

- [ ] **Step 3: Routing spec**

Create `e2e/auth-routing.spec.ts`:

```ts
import { test, expect } from "@playwright/test"
import { signIn, users } from "./helpers/auth"

test.describe("anonymous", () => {
  test("is sent to login and sees the Google button", async ({ page }) => {
    await page.goto("/")
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole("button", { name: /continue with google/i })).toBeVisible()
  })
  test("cannot reach the portal or tutor matching", async ({ page }) => {
    await page.goto("/portal")
    await expect(page).toHaveURL(/\/login$/)
    await page.goto("/tm")
    await expect(page).toHaveURL(/\/login$/)
  })
})

test.describe("pending user", () => {
  test.beforeEach(async ({ context }) => signIn(context, users.pending.email, users.pending.password))
  test("only sees the holding page", async ({ page }) => {
    await page.goto("/")
    await expect(page).toHaveURL(/\/pending$/)
    await expect(page.getByText("Thanks for signing up")).toBeVisible()
    await page.goto("/portal")
    await expect(page).toHaveURL(/\/pending$/)
  })
})

test.describe("tutor", () => {
  test.beforeEach(async ({ context }) => signIn(context, users.tutor.email, users.tutor.password))
  test("lands in the portal and cannot leave it", async ({ page }) => {
    await page.goto("/")
    await expect(page).toHaveURL(/\/portal$/)
    await expect(page.getByText("EduOwl Tutor Matching")).toBeVisible()
    await expect(page.getByText("E2E Tutor")).toBeVisible()
    await page.goto("/tm")
    await expect(page).toHaveURL(/\/portal$/)
    await page.goto("/invoices")
    await expect(page).toHaveURL(/\/portal$/)
  })
  test("can move between portal tabs", async ({ page }) => {
    await page.goto("/portal")
    await page.getByRole("link", { name: "My Timesheet" }).click()
    await expect(page).toHaveURL(/\/portal\/timesheet$/)
    await expect(page.getByRole("heading", { name: "My Timesheet" })).toBeVisible()
  })
})

test.describe("admin", () => {
  test.beforeEach(async ({ context }) => signIn(context, users.admin.email, users.admin.password))
  test("lands on the academy dashboard and is bounced off login", async ({ page }) => {
    await page.goto("/login")
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByAltText("EduOwl English Academy").first()).toBeVisible()
  })
  test("switches workspaces and the choice is remembered", async ({ page }) => {
    await page.goto("/")
    await page.getByLabel("Switch workspace").click()
    await page.getByRole("menuitem", { name: "Tutor Matching" }).click()
    await expect(page).toHaveURL(/\/tm$/)
    await expect(page.getByAltText("Tutor Matching").first()).toBeVisible()
    await page.goto("/")
    await expect(page).toHaveURL(/\/tm$/)
    await page.getByLabel("Switch workspace").click()
    await page.getByRole("menuitem", { name: "EduOwl English Academy" }).click()
    await expect(page).toHaveURL(/\/$/)
    await page.goto("/")
    await expect(page).toHaveURL(/\/$/)
  })
  test("can open the tutor portal", async ({ page }) => {
    await page.goto("/portal")
    await expect(page).toHaveURL(/\/portal$/)
  })
  test("demo login route is gone", async ({ page }) => {
    // page.request shares the signed-in cookies, so this is not a login redirect
    const res = await page.request.post("/api/demo-login", { maxRedirects: 0 })
    expect(res.status()).toBe(404)
  })
})
```

- [ ] **Step 4: Sign the smoke test in**

At the top of `e2e/smoke-test.spec.ts`, after the imports, add:

```ts
import { signIn, users } from "./helpers/auth"

test.beforeEach(async ({ context }) => {
  await signIn(context, users.admin.email, users.admin.password)
})
```

- [ ] **Step 5: Run the e2e suites**

```bash
npx playwright test e2e/auth-routing.spec.ts e2e/smoke-test.spec.ts
```

Expected: all tests in both files pass. If `e2e/ux-audit.spec.ts` was passing before this slice, give it the same `beforeEach` and run it too; if it was already failing, leave it and note that in the commit message.

- [ ] **Step 6: Full verification**

```bash
npm run lint && npx tsc --noEmit && npm test && npm run build
npx supabase db reset && npm run db:test
grep -rin pegasus src scripts e2e README.md package.json public
```

Expected: lint clean, type-check clean, unit tests green, build succeeds, all three pgTAP files green, the grep prints nothing.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "test: e2e auth helper, role routing spec, local test users

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Nz2dMwYkjrRRcXcuVwSWs1"
```

---

## After this plan

Slice 1 is done when Task 13 Step 6 is green. Remaining for the user, from spec Section 10: create the production Supabase project, configure the Google OAuth client, set the Vercel env vars, run `supabase db push`, run `npm run import:master-list` against production, sign in with each admin account, and link Zijie's account to the imported "Zijie" tutor row once the Tutors screen exists in slice 2.

Slices 2 to 5 each get their own plan, written after this one lands:

2. Admin data entry: Tutors with pending signups, Students & Assignments, Settings, Master List.
3. Tutor portal: My Students, Log a Session, My Timesheet with `tm_submit_month`.
4. Approvals: queue, entry editing with audit log, `tm_approve_submission`, send back.
5. Invoices and dashboard: list, detail, WhatsApp text, Tutor Matching PDF, payment status, manual invoices, dashboard tiles.

## Carry-forward from slice 1 execution

Decisions and findings recorded during execution that later slices must honour:

- **Slice 3, first task:** add `tm_timesheet_entries_tutor_view` (every column except `parent_rate`, filtered by `current_tutor_id()`, `REVOKE` from `anon`/`public`, `security_barrier`), with a `hasnt_column` pgTAP test, and read entries in the portal only through it. The `tm_snapshot_entry_rates` trigger (migration `20260904140000`) now writes the true parent rate onto every tutor-created entry, and `tutor_select_own_entries` is a row policy, so the base table must not be queried by tutor-facing code.
- Tutor-facing inserts and updates on `tm_timesheet_entries` must send `rate_tier_id`; the trigger fills `tier_label`, `parent_rate`, `tutor_rate`. Sending rates from the client is ignored for non-admins.
- `tm_set_entry_hours` only computes `hours` when it is NULL. A UI edit that changes start or end time must send `hours: null` to force recomputation.
- The generated type for `current_tutor_id()` is non-nullable; it returns NULL for admins without a tutor row.
- `tm_invoices.total_hours` is `NUMERIC(6,2)` by ruling (monthly aggregate); per-entry hours stay `NUMERIC(5,2)`.
- Middleware and the OAuth callback treat a failed `profiles` lookup as `pending` (fail closed). Distinguishing a query error from a missing row is deferred polish.
- The repo has no ESLint config, so `npm run lint` prompts interactively. Adding one is deferred.
- Local Google sign-in is disabled in `supabase/config.toml` by default; e2e uses password-grant test users.
- Before the production import, confirm against the source sheet that `x` in the checklist columns means unchecked (the parser treats it as false) and that no remark contains the word "collect" (which marks an assignment `stopped`).
