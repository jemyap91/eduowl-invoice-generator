# Tutor Matching Slice 2: Admin Data Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the admin every screen needed to run Tutor Matching data entry: approve tutor signups, manage tutors, students, assignments with rate tiers, settings, and a Master List with monthly history and CSV export.

**Architecture:** Four new admin routes under `/tm/*` inside the existing `(dashboard)` route group, built the way the Academy screens are built: client components that query Supabase directly with the browser client (RLS makes the admin role the gate), shadcn tables and dialogs, a form component per entity, toasts for outcomes. Pure logic (rate-tier validation, assignment codes, master-list row building, sorting, CSV) lives in `src/lib/tm/` with Vitest coverage. The one operation that needs the service-role key, rejecting a signup, is a Next.js server action that verifies the caller is an admin before deleting the auth user.

**Tech Stack:** Next.js 14.2 App Router (client components + one server action), Supabase JS via `@supabase/ssr`, shadcn/ui (Table, Dialog, Tabs, Select, Checkbox, Textarea, Badge, Skeleton), lucide-react icons, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-04-tutor-matching-design.md` — Sections 2 (admin-as-tutor link, switcher), 3 (`tm_` columns), 5 (Tutors, Students & Assignments, Master List, Settings). Read the "Carry-forward from slice 1 execution" section at the end of `docs/superpowers/plans/2026-09-04-tutor-matching-foundation.md` too.

## Global Constraints

- Next.js stays on 14.2.x. No new runtime dependencies; everything here uses packages already installed.
- Workspace label for the sidebar is "Tutor Matching". Nav items and their hrefs, verbatim: Dashboard `/tm`, Tutors `/tm/tutors`, Students & Assignments `/tm/students`, Master List `/tm/master-list`, Settings `/tm/settings`.
- Column names are exactly those in spec Section 3 and the migrations `20260904120000_tm_schema.sql` and `20260904130000_tm_rls.sql`. Assignment statuses: `active`, `paused`, `stopping`, `stopped`, `moved_to_academy`. Deposit statuses: `none`, `not_collected`, `collected`. Tutor statuses: `active`, `inactive`.
- PostgREST returns `numeric` columns as strings. Every fetch that reads `parent_rate`, `tutor_rate`, `deposit_amount`, `monthly_est_profit`, `invoice_amount`, `tutor_payout`, `profit`, `total_hours` must pass the value through `toNumber()` from `src/lib/tm/types.ts` before it reaches logic or display.
- Rate tiers are stored one row per tier in `tm_rate_tiers` with `UNIQUE (assignment_id, label)`. Saving an assignment's tiers must preserve the ids of tiers whose label is unchanged (timesheet entries reference them), so tiers are upserted on `assignment_id,label` and only removed labels are deleted.
- Tutors never see parent rates. Nothing in this slice renders for the tutor role; all new screens are admin-only, and the middleware already confines tutors to `/portal`.
- Rejecting a pending signup deletes the auth user with the service-role key, server-side only, after verifying the caller's profile role is `admin` and the target's role is `pending`. `SUPABASE_SERVICE_ROLE_KEY` is never sent to the browser.
- Every commit message ends with:
  ```
  Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01Nz2dMwYkjrRRcXcuVwSWs1
  ```
- Run long commands (Playwright, `next build`, `supabase db reset`) in the foreground.
- Local dev: `npx supabase start` (project id `eduowl`), `.env.local` present, `npm run seed:test-users` after any `db reset`, and `npm run import:master-list` to have realistic data on screen.

## File Structure

| Path | Responsibility |
|---|---|
| `src/lib/tm/types.ts` | Row types for the `tm_` tables as the browser sees them, status label maps, `toNumber()` |
| `src/lib/tm/rate-tiers.ts` (+ `.test.ts`) | Draft/validate/serialise rate tiers for forms and the settings template |
| `src/lib/tm/assignments.ts` (+ `.test.ts`) | `suggestAssignmentCode()` |
| `src/lib/tm/periods.ts` (+ `.test.ts`) | Year/month helpers: keys, labels, `<input type="month">` parsing, ranges |
| `src/lib/tm/csv-export.ts` (+ `.test.ts`) | `toCsv()` |
| `src/lib/tm/master-list.ts` (+ `.test.ts`) | Build, filter, sort, and total the Assignments and Monthly History rows |
| `src/lib/supabase/admin.ts` | Service-role client for server-only code |
| `src/app/(dashboard)/tm/tutors/actions.ts` | Server action `rejectSignup(profileId)` |
| `src/app/(dashboard)/tm/tutors/page.tsx` | Tutors screen: pending signups + tutor list |
| `src/app/(dashboard)/tm/students/page.tsx` | Students & Assignments screen |
| `src/app/(dashboard)/tm/master-list/page.tsx` | Master List screen |
| `src/app/(dashboard)/tm/settings/page.tsx` | Settings screen |
| `src/components/tm/rate-tier-editor.tsx` | Editable rows of label / parent rate / tutor rate; used by Settings and the assignment form |
| `src/components/tm/settings-form.tsx` | Loads and saves the single `tm_settings` row |
| `src/components/tm/pending-signups.tsx` | Pending profiles with Create / Link / Reject |
| `src/components/tm/tutor-list.tsx`, `tutor-form.tsx` | Tutor table and add/edit dialog form |
| `src/components/tm/student-list.tsx`, `student-form.tsx` | Student table with expandable assignments, add/edit form |
| `src/components/tm/assignment-form.tsx` | Assignment add/edit form including the tier editor |
| `src/components/tm/master-list-assignments.tsx`, `master-list-history.tsx` | The two Master List tabs |
| `src/components/tm/sortable-header.tsx` | Clickable table header cell that toggles sort |
| `e2e/helpers/admin.ts` | Service-role helpers for e2e fixtures (create/delete throwaway auth users) |
| `e2e/tm-admin.spec.ts` | Admin data-entry end-to-end |

Modified: `src/lib/workspace.ts` (+ test), `src/components/layout/sidebar.tsx` (icons, portal entry), `src/components/layout/workspace-switcher.tsx` (portal entry).

---

### Task 1: Navigation, shared types, and route shells

**Files:**
- Modify: `src/lib/workspace.ts` (NAV_ITEMS.tm), `src/lib/workspace.test.ts`, `src/components/layout/sidebar.tsx` (ICONS)
- Create: `src/lib/tm/types.ts`, `src/app/(dashboard)/tm/tutors/page.tsx`, `src/app/(dashboard)/tm/students/page.tsx`, `src/app/(dashboard)/tm/master-list/page.tsx`, `src/app/(dashboard)/tm/settings/page.tsx`

**Interfaces:**
- Produces: the five nav items; `src/lib/tm/types.ts` exports used by every later task: `TmTutor`, `TmStudent`, `TmAssignment`, `TmRateTier`, `TmInvoice`, `TmSettings`, `TmAssignmentStatus`, `TmDepositStatus`, `ASSIGNMENT_STATUS_LABELS`, `DEPOSIT_STATUS_LABELS`, `toNumber(value): number | null`. The four page files are placeholders that Tasks 2, 3, 5, 8 replace.

- [ ] **Step 1: Failing nav test**

In `src/lib/workspace.test.ts`, add inside the `describe("NAV_ITEMS", ...)` block:

```ts
  it("lists the tutor matching admin screens in order", () => {
    expect(NAV_ITEMS.tm.map((i) => [i.label, i.href])).toEqual([
      ["Dashboard", "/tm"],
      ["Tutors", "/tm/tutors"],
      ["Students & Assignments", "/tm/students"],
      ["Master List", "/tm/master-list"],
      ["Settings", "/tm/settings"],
    ])
  })
```

Run `npm test`; expected: this test fails (only Dashboard present).

- [ ] **Step 2: Nav items and icons**

In `src/lib/workspace.ts`, replace the `tm` array in `NAV_ITEMS` with:

```ts
  tm: [
    { label: "Dashboard", href: "/tm" },
    { label: "Tutors", href: "/tm/tutors" },
    { label: "Students & Assignments", href: "/tm/students" },
    { label: "Master List", href: "/tm/master-list" },
    { label: "Settings", href: "/tm/settings" },
  ],
```

In `src/components/layout/sidebar.tsx`, add `Table2` to the lucide import and two entries to `ICONS`:

```ts
  "Students & Assignments": GraduationCap,
  "Master List": Table2,
```

Run `npm test`; expected: all pass.

- [ ] **Step 3: Shared types**

Create `src/lib/tm/types.ts`:

```ts
export type TmTutorStatus = "active" | "inactive"
export type TmAssignmentStatus = "active" | "paused" | "stopping" | "stopped" | "moved_to_academy"
export type TmDepositStatus = "none" | "not_collected" | "collected"
export type TmInvoiceSource = "generated" | "manual"

export const ASSIGNMENT_STATUS_LABELS: Record<TmAssignmentStatus, string> = {
  active: "Active",
  paused: "Paused",
  stopping: "Stopping",
  stopped: "Stopped",
  moved_to_academy: "Moved to Academy",
}

export const DEPOSIT_STATUS_LABELS: Record<TmDepositStatus, string> = {
  none: "None",
  not_collected: "Not yet collected",
  collected: "Collected",
}

export const TUTOR_STATUS_LABELS: Record<TmTutorStatus, string> = {
  active: "Active",
  inactive: "Inactive",
}

export interface TmTutor {
  id: string
  profile_id: string | null
  name: string
  phone: string | null
  status: TmTutorStatus
  created_at: string
}

export interface TmStudent {
  id: string
  name: string
  parent_name: string | null
  parent_phone: string | null
  contact_preference: string | null
  address: string | null
  remarks: string | null
  created_at: string
}

export interface TmRateTier {
  id: string
  assignment_id: string
  label: string
  parent_rate: number
  tutor_rate: number
  sort_order: number
}

export interface TmAssignment {
  id: string
  code: string
  tutor_id: string
  student_id: string
  subject: string
  timeslot: string | null
  status: TmAssignmentStatus
  deposit_amount: number | null
  deposit_status: TmDepositStatus
  curriculum_briefed: boolean
  group_chat_created: boolean
  post_trial_checkin_done: boolean
  monthly_est_profit: number | null
  additional_materials: string | null
  remarks: string | null
  created_at: string
}

export interface TmInvoice {
  id: string
  invoice_number: string | null
  assignment_id: string
  year: number
  month: number
  source: TmInvoiceSource
  total_hours: number | null
  invoice_amount: number
  tutor_payout: number
  profit: number
  parent_paid_at: string | null
  tutor_paid_at: string | null
  remarks: string | null
}

export interface TmSettings {
  id: string
  company_name: string
  legal_name: string
  payment_terms: string
  paynow_uen: string
  qr_code_path: string
  payment_details: string
  default_rate_tiers: unknown
}

/** PostgREST returns numeric columns as strings; normalise before use. */
export function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null
  const n = typeof value === "number" ? value : parseFloat(value)
  return Number.isFinite(n) ? n : null
}
```

- [ ] **Step 4: Route shells**

Create the four pages with this content, changing only the component name and title per file:

`src/app/(dashboard)/tm/tutors/page.tsx`:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function TmTutorsPage() {
  return (
    <Card>
      <CardHeader><CardTitle>Tutors</CardTitle></CardHeader>
      <CardContent className="text-sm text-muted-foreground">Coming in this slice.</CardContent>
    </Card>
  )
}
```

`src/app/(dashboard)/tm/students/page.tsx`: component `TmStudentsPage`, title "Students & Assignments".
`src/app/(dashboard)/tm/master-list/page.tsx`: component `TmMasterListPage`, title "Master List".
`src/app/(dashboard)/tm/settings/page.tsx`: component `TmSettingsPage`, title "Settings".

- [ ] **Step 5: Verify and commit**

```bash
npx tsc --noEmit && npm test && npm run build 2>&1 | grep -E "/tm/(tutors|students|master-list|settings)"
```

Expected: four routes listed.

```bash
git add -A
git commit -m "feat(tm): admin nav items, shared row types, route shells

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Nz2dMwYkjrRRcXcuVwSWs1"
```

---

### Task 2: Rate tier helpers, tier editor, and Settings

**Files:**
- Create: `src/lib/tm/rate-tiers.ts`, `src/lib/tm/rate-tiers.test.ts`, `src/components/tm/rate-tier-editor.tsx`, `src/components/tm/settings-form.tsx`
- Modify: `src/app/(dashboard)/tm/settings/page.tsx`

**Interfaces:**
- Produces:
  - `RateTierDraft = { key: string; id?: string; label: string; parent_rate: string; tutor_rate: string }`
  - `RateTierValue = { label: string; parent_rate: number; tutor_rate: number; sort_order: number }`
  - `newDraft(partial?): RateTierDraft`, `draftsFromValues(values: RateTierValue[]): RateTierDraft[]`, `draftsFromTiers(tiers: TmRateTier[]): RateTierDraft[]`
  - `validateTiers(drafts): { ok: true; tiers: RateTierValue[] } | { ok: false; error: string }`
  - `parseDefaultTiers(json: unknown): RateTierValue[]`
  - `<RateTierEditor value={drafts} onChange={setDrafts} />` component. Task 6 uses all of these.

- [ ] **Step 1: Failing tests**

Create `src/lib/tm/rate-tiers.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { validateTiers, parseDefaultTiers, draftsFromValues, newDraft } from "./rate-tiers"

describe("validateTiers", () => {
  it("accepts well-formed rows and assigns sort_order by position", () => {
    const result = validateTiers([
      { key: "a", label: "Group", parent_rate: "80", tutor_rate: "50" },
      { key: "b", label: " 1 to 1 ", parent_rate: "120.5", tutor_rate: "60" },
    ])
    expect(result).toEqual({
      ok: true,
      tiers: [
        { label: "Group", parent_rate: 80, tutor_rate: 50, sort_order: 0 },
        { label: "1 to 1", parent_rate: 120.5, tutor_rate: 60, sort_order: 1 },
      ],
    })
  })
  it("rejects an empty list", () => {
    expect(validateTiers([])).toEqual({ ok: false, error: "Add at least one rate tier." })
  })
  it("rejects a blank label", () => {
    expect(validateTiers([{ key: "a", label: "  ", parent_rate: "80", tutor_rate: "50" }]))
      .toEqual({ ok: false, error: "Every tier needs a label." })
  })
  it("rejects duplicate labels, case-insensitively", () => {
    expect(validateTiers([
      { key: "a", label: "Group", parent_rate: "80", tutor_rate: "50" },
      { key: "b", label: "group", parent_rate: "90", tutor_rate: "50" },
    ])).toEqual({ ok: false, error: 'Tier label "group" is used more than once.' })
  })
  it("rejects non-numeric or negative rates", () => {
    expect(validateTiers([{ key: "a", label: "Group", parent_rate: "abc", tutor_rate: "50" }]))
      .toEqual({ ok: false, error: 'Parent rate for "Group" must be a number of 0 or more.' })
    expect(validateTiers([{ key: "a", label: "Group", parent_rate: "80", tutor_rate: "-1" }]))
      .toEqual({ ok: false, error: 'Tutor rate for "Group" must be a number of 0 or more.' })
  })
})

describe("parseDefaultTiers", () => {
  it("reads a valid JSON array", () => {
    expect(parseDefaultTiers([{ label: "1 to 1", parent_rate: 70, tutor_rate: 50 }]))
      .toEqual([{ label: "1 to 1", parent_rate: 70, tutor_rate: 50, sort_order: 0 }])
  })
  it("accepts numeric strings and skips malformed entries", () => {
    expect(parseDefaultTiers([
      { label: "Group", parent_rate: "80", tutor_rate: "50" },
      { label: "", parent_rate: 1, tutor_rate: 1 },
      "junk",
      null,
    ])).toEqual([{ label: "Group", parent_rate: 80, tutor_rate: 50, sort_order: 0 }])
  })
  it("returns an empty list for anything else", () => {
    expect(parseDefaultTiers(null)).toEqual([])
    expect(parseDefaultTiers("[]")).toEqual([])
    expect(parseDefaultTiers({ label: "x" })).toEqual([])
  })
})

describe("drafts", () => {
  it("round-trips values to drafts with string rates and unique keys", () => {
    const drafts = draftsFromValues([
      { label: "Group", parent_rate: 80, tutor_rate: 50, sort_order: 0 },
      { label: "Zoom", parent_rate: 50, tutor_rate: 40, sort_order: 1 },
    ])
    expect(drafts.map((d) => [d.label, d.parent_rate, d.tutor_rate])).toEqual([
      ["Group", "80", "50"],
      ["Zoom", "50", "40"],
    ])
    expect(new Set(drafts.map((d) => d.key)).size).toBe(2)
  })
  it("newDraft starts blank with a fresh key", () => {
    const a = newDraft()
    const b = newDraft({ label: "Zoom" })
    expect(a).toMatchObject({ label: "", parent_rate: "", tutor_rate: "" })
    expect(b.label).toBe("Zoom")
    expect(a.key).not.toBe(b.key)
  })
})
```

Run `npx vitest run src/lib/tm/rate-tiers.test.ts`; expected: FAIL, module not found.

- [ ] **Step 2: Implementation**

Create `src/lib/tm/rate-tiers.ts`:

```ts
import type { TmRateTier } from "./types"

export interface RateTierDraft {
  key: string
  id?: string
  label: string
  parent_rate: string
  tutor_rate: string
}

export interface RateTierValue {
  label: string
  parent_rate: number
  tutor_rate: number
  sort_order: number
}

let keyCounter = 0
function nextKey(): string {
  keyCounter += 1
  return `tier-${Date.now().toString(36)}-${keyCounter}`
}

export function newDraft(partial: Partial<Omit<RateTierDraft, "key">> = {}): RateTierDraft {
  return { key: nextKey(), label: "", parent_rate: "", tutor_rate: "", ...partial }
}

export function draftsFromValues(values: RateTierValue[]): RateTierDraft[] {
  return values.map((v) =>
    newDraft({ label: v.label, parent_rate: String(v.parent_rate), tutor_rate: String(v.tutor_rate) })
  )
}

export function draftsFromTiers(tiers: TmRateTier[]): RateTierDraft[] {
  return [...tiers]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((t) =>
      newDraft({ id: t.id, label: t.label, parent_rate: String(t.parent_rate), tutor_rate: String(t.tutor_rate) })
    )
}

function parseRate(raw: string): number | null {
  const trimmed = raw.trim()
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null
  return Math.round(parseFloat(trimmed) * 100) / 100
}

export type ValidateResult = { ok: true; tiers: RateTierValue[] } | { ok: false; error: string }

export function validateTiers(drafts: RateTierDraft[]): ValidateResult {
  if (drafts.length === 0) return { ok: false, error: "Add at least one rate tier." }
  const seen = new Set<string>()
  const tiers: RateTierValue[] = []
  for (const [i, d] of drafts.entries()) {
    const label = d.label.trim()
    if (!label) return { ok: false, error: "Every tier needs a label." }
    const lower = label.toLowerCase()
    if (seen.has(lower)) return { ok: false, error: `Tier label "${label}" is used more than once.` }
    seen.add(lower)
    const parent = parseRate(d.parent_rate)
    if (parent === null) return { ok: false, error: `Parent rate for "${label}" must be a number of 0 or more.` }
    const tutor = parseRate(d.tutor_rate)
    if (tutor === null) return { ok: false, error: `Tutor rate for "${label}" must be a number of 0 or more.` }
    tiers.push({ label, parent_rate: parent, tutor_rate: tutor, sort_order: i })
  }
  return { ok: true, tiers }
}

/** Tolerant reader for tm_settings.default_rate_tiers (jsonb). */
export function parseDefaultTiers(json: unknown): RateTierValue[] {
  if (!Array.isArray(json)) return []
  const out: RateTierValue[] = []
  for (const item of json) {
    if (!item || typeof item !== "object") continue
    const rec = item as Record<string, unknown>
    const label = typeof rec.label === "string" ? rec.label.trim() : ""
    const parent = typeof rec.parent_rate === "number" ? rec.parent_rate : parseRate(String(rec.parent_rate ?? ""))
    const tutor = typeof rec.tutor_rate === "number" ? rec.tutor_rate : parseRate(String(rec.tutor_rate ?? ""))
    if (!label || parent === null || tutor === null) continue
    out.push({ label, parent_rate: parent, tutor_rate: tutor, sort_order: out.length })
  }
  return out
}
```

Run the test file; expected: all pass.

- [ ] **Step 3: Tier editor component**

Create `src/components/tm/rate-tier-editor.tsx`:

```tsx
"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2 } from "lucide-react"
import { newDraft, type RateTierDraft } from "@/lib/tm/rate-tiers"

interface RateTierEditorProps {
  value: RateTierDraft[]
  onChange: (next: RateTierDraft[]) => void
  idPrefix?: string
}

export function RateTierEditor({ value, onChange, idPrefix = "tier" }: RateTierEditorProps) {
  function update(key: string, patch: Partial<RateTierDraft>) {
    onChange(value.map((d) => (d.key === key ? { ...d, ...patch } : d)))
  }
  function remove(key: string) {
    onChange(value.filter((d) => d.key !== key))
  }
  function add() {
    onChange([...value, newDraft()])
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_110px_110px_40px] gap-2 text-xs font-medium text-muted-foreground px-1">
        <span>Label</span>
        <span>Parent $/hr</span>
        <span>Tutor $/hr</span>
        <span />
      </div>
      {value.length === 0 && (
        <p className="text-sm text-muted-foreground px-1">No tiers yet.</p>
      )}
      {value.map((d, i) => (
        <div key={d.key} className="grid grid-cols-[1fr_110px_110px_40px] gap-2 items-center">
          <div>
            <Label htmlFor={`${idPrefix}-label-${i}`} className="sr-only">Tier label</Label>
            <Input
              id={`${idPrefix}-label-${i}`}
              value={d.label}
              placeholder="e.g. 1 to 1"
              onChange={(e) => update(d.key, { label: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor={`${idPrefix}-parent-${i}`} className="sr-only">Parent rate</Label>
            <Input
              id={`${idPrefix}-parent-${i}`}
              inputMode="decimal"
              value={d.parent_rate}
              placeholder="0"
              onChange={(e) => update(d.key, { parent_rate: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor={`${idPrefix}-tutor-${i}`} className="sr-only">Tutor rate</Label>
            <Input
              id={`${idPrefix}-tutor-${i}`}
              inputMode="decimal"
              value={d.tutor_rate}
              placeholder="0"
              onChange={(e) => update(d.key, { tutor_rate: e.target.value })}
            />
          </div>
          <Button type="button" variant="ghost" size="icon" aria-label={`Remove tier ${i + 1}`} onClick={() => remove(d.key)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus className="mr-2 h-4 w-4" />
        Add tier
      </Button>
    </div>
  )
}
```

- [ ] **Step 4: Settings form**

Create `src/components/tm/settings-form.tsx`:

```tsx
"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { RateTierEditor } from "./rate-tier-editor"
import { draftsFromValues, parseDefaultTiers, validateTiers, type RateTierDraft } from "@/lib/tm/rate-tiers"
import type { TmSettings } from "@/lib/tm/types"

export function SettingsForm() {
  const [settingsId, setSettingsId] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState("")
  const [legalName, setLegalName] = useState("")
  const [paymentTerms, setPaymentTerms] = useState("")
  const [paynowUen, setPaynowUen] = useState("")
  const [paymentDetails, setPaymentDetails] = useState("")
  const [tiers, setTiers] = useState<RateTierDraft[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data, error } = await supabase.from("tm_settings").select("*").limit(1).maybeSingle()
      if (error || !data) {
        toast({ title: "Error", description: "Failed to load settings", variant: "destructive" })
        setLoading(false)
        return
      }
      const s = data as TmSettings
      setSettingsId(s.id)
      setCompanyName(s.company_name)
      setLegalName(s.legal_name)
      setPaymentTerms(s.payment_terms)
      setPaynowUen(s.paynow_uen)
      setPaymentDetails(s.payment_details)
      setTiers(draftsFromValues(parseDefaultTiers(s.default_rate_tiers)))
      setLoading(false)
    }
    load()
  }, [toast])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!settingsId) return
    const validated = tiers.length === 0 ? { ok: true as const, tiers: [] } : validateTiers(tiers)
    if (!validated.ok) {
      toast({ title: "Check the rate tier template", description: validated.error, variant: "destructive" })
      return
    }
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from("tm_settings")
      .update({
        company_name: companyName.trim(),
        legal_name: legalName.trim(),
        payment_terms: paymentTerms.trim(),
        paynow_uen: paynowUen.trim(),
        payment_details: paymentDetails.trim(),
        default_rate_tiers: validated.tiers.map(({ label, parent_rate, tutor_rate }) => ({ label, parent_rate, tutor_rate })),
      })
      .eq("id", settingsId)
    setSaving(false)
    if (error) {
      toast({ title: "Error", description: "Failed to save settings", variant: "destructive" })
      return
    }
    toast({ title: "Saved", description: "Tutor Matching settings updated" })
  }

  if (loading) {
    return <Skeleton className="h-64 w-full" />
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Company</CardTitle>
          <CardDescription>Shown on Tutor Matching invoices.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="company-name">Company name</Label>
            <Input id="company-name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="legal-name">Legal name</Label>
            <Input id="legal-name" value={legalName} onChange={(e) => setLegalName(e.target.value)} required />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment</CardTitle>
          <CardDescription>Used on the invoice PDF and in the WhatsApp message.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="paynow-uen">PayNow UEN</Label>
            <Input id="paynow-uen" value={paynowUen} onChange={(e) => setPaynowUen(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payment-details">Payment details (WhatsApp text)</Label>
            <Input id="payment-details" value={paymentDetails} onChange={(e) => setPaymentDetails(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payment-terms">Payment terms (PDF)</Label>
            <Textarea id="payment-terms" rows={3} value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} required />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Default rate tiers</CardTitle>
          <CardDescription>Pre-filled on every new assignment. Leave empty to start assignments blank.</CardDescription>
        </CardHeader>
        <CardContent>
          <RateTierEditor value={tiers} onChange={setTiers} idPrefix="default-tier" />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save settings"}</Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 5: Page**

Replace `src/app/(dashboard)/tm/settings/page.tsx` with:

```tsx
import { SettingsForm } from "@/components/tm/settings-form"

export default function TmSettingsPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <SettingsForm />
    </div>
  )
}
```

- [ ] **Step 6: Verify**

`npx tsc --noEmit && npm test`. Then `npm run dev`, sign in as the admin (use the e2e helper flow or Google), open `/tm/settings`, add a tier "1 to 1" 70 / 50, save, reload: the tier persists. Check in psql: `docker exec supabase_db_eduowl psql -U postgres -d postgres -c "select default_rate_tiers from tm_settings;"` shows the JSON array.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(tm): rate tier helpers and editor, tutor matching settings screen

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Nz2dMwYkjrRRcXcuVwSWs1"
```

---

### Task 3: Tutors screen with pending signups

**Files:**
- Create: `src/lib/supabase/admin.ts`, `src/app/(dashboard)/tm/tutors/actions.ts`, `src/components/tm/pending-signups.tsx`, `src/components/tm/tutor-form.tsx`, `src/components/tm/tutor-list.tsx`
- Modify: `src/app/(dashboard)/tm/tutors/page.tsx`

**Interfaces:**
- Consumes: `TmTutor`, `TUTOR_STATUS_LABELS` (Task 1); `profiles(id, email, full_name, role)`; `tm_tutors`; `tm_assignments(tutor_id, status)`.
- Produces: `rejectSignup(profileId: string): Promise<{ error?: string }>` server action; `<TutorList refreshKey />` and `<PendingSignups onChanged />` components; `createAdminClient()` (server-only) reused by nothing else in this slice but by slice 4's approval logic.

- [ ] **Step 1: Service-role client**

Create `src/lib/supabase/admin.ts`:

```ts
import "server-only"
import { createClient } from "@supabase/supabase-js"

/** Service-role client. Server-side only; bypasses RLS. Never import from client components. */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured")
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}
```

`server-only` is a package that ships with Next.js 14 (`import "server-only"` throws at build time if a client component imports the file). If `npx tsc --noEmit` cannot resolve it, add a `src/types/server-only.d.ts` containing `declare module "server-only"`.

- [ ] **Step 2: Reject server action**

Create `src/app/(dashboard)/tm/tutors/actions.ts`:

```ts
"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Delete a pending signup's auth user. Only admins may call it, and only
 * profiles still in the `pending` role can be rejected.
 */
export async function rejectSignup(profileId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not signed in" }

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
  if (me?.role !== "admin") return { error: "Only admins can reject signups" }

  const admin = createAdminClient()
  const { data: target, error: lookupError } = await admin
    .from("profiles")
    .select("role")
    .eq("id", profileId)
    .maybeSingle()
  if (lookupError) return { error: lookupError.message }
  if (!target) return { error: "Signup not found" }
  if (target.role !== "pending") return { error: "Only pending signups can be rejected" }

  const { error } = await admin.auth.admin.deleteUser(profileId)
  if (error) return { error: error.message }
  return {}
}
```

- [ ] **Step 3: Pending signups component**

Create `src/components/tm/pending-signups.tsx`:

```tsx
"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { UserPlus, Link2, UserX } from "lucide-react"
import { rejectSignup } from "@/app/(dashboard)/tm/tutors/actions"
import type { TmTutor } from "@/lib/tm/types"

interface PendingProfile {
  id: string
  email: string
  full_name: string | null
  created_at: string
}

type Mode = { kind: "create"; profile: PendingProfile } | { kind: "link"; profile: PendingProfile } | { kind: "reject"; profile: PendingProfile } | null

export function PendingSignups({ onChanged }: { onChanged: () => void }) {
  const [pending, setPending] = useState<PendingProfile[]>([])
  const [unlinkedTutors, setUnlinkedTutors] = useState<TmTutor[]>([])
  const [mode, setMode] = useState<Mode>(null)
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [tutorId, setTutorId] = useState("")
  const [busy, setBusy] = useState(false)
  const { toast } = useToast()

  const load = useCallback(async () => {
    const supabase = createClient()
    const [profilesRes, tutorsRes] = await Promise.all([
      supabase.from("profiles").select("id, email, full_name, created_at").eq("role", "pending").order("created_at"),
      supabase.from("tm_tutors").select("*").is("profile_id", null).order("name"),
    ])
    if (profilesRes.error || tutorsRes.error) {
      toast({ title: "Error", description: "Failed to load pending signups", variant: "destructive" })
      return
    }
    setPending((profilesRes.data as PendingProfile[]) || [])
    setUnlinkedTutors((tutorsRes.data as TmTutor[]) || [])
  }, [toast])

  useEffect(() => { load() }, [load])

  function openCreate(profile: PendingProfile) {
    setName(profile.full_name || "")
    setPhone("")
    setMode({ kind: "create", profile })
  }
  function openLink(profile: PendingProfile) {
    setTutorId("")
    setMode({ kind: "link", profile })
  }

  async function promote(profileId: string) {
    const supabase = createClient()
    const { error } = await supabase.from("profiles").update({ role: "tutor" }).eq("id", profileId)
    return error
  }

  async function handleCreate() {
    if (mode?.kind !== "create" || !name.trim()) return
    setBusy(true)
    const supabase = createClient()
    const { error: insertError } = await supabase
      .from("tm_tutors")
      .insert({ name: name.trim(), phone: phone.trim() || null, profile_id: mode.profile.id })
    const error = insertError || (await promote(mode.profile.id))
    setBusy(false)
    if (error) {
      toast({ title: "Error", description: "Failed to approve signup", variant: "destructive" })
      return
    }
    toast({ title: "Approved", description: `${name.trim()} can now use the tutor portal` })
    setMode(null)
    await load()
    onChanged()
  }

  async function handleLink() {
    if (mode?.kind !== "link" || !tutorId) return
    setBusy(true)
    const supabase = createClient()
    const { error: updateError } = await supabase
      .from("tm_tutors")
      .update({ profile_id: mode.profile.id })
      .eq("id", tutorId)
    const error = updateError || (await promote(mode.profile.id))
    setBusy(false)
    if (error) {
      toast({ title: "Error", description: "Failed to link signup", variant: "destructive" })
      return
    }
    toast({ title: "Linked", description: "Tutor account linked" })
    setMode(null)
    await load()
    onChanged()
  }

  async function handleReject() {
    if (mode?.kind !== "reject") return
    setBusy(true)
    const result = await rejectSignup(mode.profile.id)
    setBusy(false)
    if (result.error) {
      toast({ title: "Error", description: result.error, variant: "destructive" })
      return
    }
    toast({ title: "Rejected", description: `${mode.profile.email} was removed` })
    setMode(null)
    await load()
  }

  if (pending.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending signups</CardTitle>
        <CardDescription>People who signed in with Google and are waiting for approval.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Signed up</TableHead>
                <TableHead className="w-[320px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.full_name || "-"}</TableCell>
                  <TableCell>{p.email}</TableCell>
                  <TableCell>{new Date(p.created_at).toLocaleDateString("en-GB")}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => openCreate(p)}>
                        <UserPlus className="mr-2 h-4 w-4" />Create new tutor
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openLink(p)} disabled={unlinkedTutors.length === 0}>
                        <Link2 className="mr-2 h-4 w-4" />Link to existing
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setMode({ kind: "reject", profile: p })}>
                        <UserX className="mr-2 h-4 w-4" />Reject
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={mode?.kind === "create"} onOpenChange={(o) => !o && setMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create tutor</DialogTitle>
            <DialogDescription>A new tutor profile linked to {mode?.profile.email}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="signup-name">Name *</Label>
              <Input id="signup-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-phone">Phone</Label>
              <Input id="signup-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 9123 4567" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMode(null)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={busy || !name.trim()}>{busy ? "Saving..." : "Approve"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mode?.kind === "link"} onOpenChange={(o) => !o && setMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link to existing tutor</DialogTitle>
            <DialogDescription>Attach {mode?.profile.email} to a tutor that has no login yet.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="signup-tutor">Tutor</Label>
            <Select value={tutorId} onValueChange={setTutorId}>
              <SelectTrigger id="signup-tutor"><SelectValue placeholder="Choose a tutor" /></SelectTrigger>
              <SelectContent>
                {unlinkedTutors.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMode(null)}>Cancel</Button>
            <Button onClick={handleLink} disabled={busy || !tutorId}>{busy ? "Linking..." : "Link"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mode?.kind === "reject"} onOpenChange={(o) => !o && setMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject signup</DialogTitle>
            <DialogDescription>
              This deletes the Google account link for {mode?.profile.email}. They can sign up again later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMode(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={busy}>{busy ? "Rejecting..." : "Reject"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
```

- [ ] **Step 4: Tutor form**

Create `src/components/tm/tutor-form.tsx`:

```tsx
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DialogFooter } from "@/components/ui/dialog"
import { TUTOR_STATUS_LABELS, type TmTutorStatus } from "@/lib/tm/types"

export interface TutorFormValues {
  name: string
  phone: string
  status: TmTutorStatus
}

interface TutorFormProps {
  onSubmit: (values: TutorFormValues) => Promise<void>
  onCancel: () => void
  defaultValues?: Partial<TutorFormValues>
  isLoading?: boolean
}

export function TutorForm({ onSubmit, onCancel, defaultValues, isLoading }: TutorFormProps) {
  const [name, setName] = useState(defaultValues?.name || "")
  const [phone, setPhone] = useState(defaultValues?.phone || "")
  const [status, setStatus] = useState<TmTutorStatus>(defaultValues?.status || "active")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    await onSubmit({ name: name.trim(), phone: phone.trim(), status })
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="tm-tutor-name">Name *</Label>
          <Input id="tm-tutor-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Guan Wen" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tm-tutor-phone">Phone</Label>
          <Input id="tm-tutor-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 9634 2496" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tm-tutor-status">Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as TmTutorStatus)}>
            <SelectTrigger id="tm-tutor-status"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(TUTOR_STATUS_LABELS) as TmTutorStatus[]).map((s) => (
                <SelectItem key={s} value={s}>{TUTOR_STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={isLoading || !name.trim()}>{isLoading ? "Saving..." : "Save"}</Button>
      </DialogFooter>
    </form>
  )
}
```

- [ ] **Step 5: Tutor list**

Create `src/components/tm/tutor-list.tsx`:

```tsx
"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { Plus, Pencil, Search, Users } from "lucide-react"
import { TutorForm, type TutorFormValues } from "./tutor-form"
import { TUTOR_STATUS_LABELS, type TmTutor } from "@/lib/tm/types"

interface TutorRow extends TmTutor {
  profiles: { email: string } | null
  activeAssignments: number
}

export function TutorList({ refreshKey = 0 }: { refreshKey?: number }) {
  const [tutors, setTutors] = useState<TutorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<TutorRow | null>(null)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const [tutorsRes, assignmentsRes] = await Promise.all([
      supabase.from("tm_tutors").select("*, profiles(email)").order("name"),
      supabase.from("tm_assignments").select("tutor_id").eq("status", "active"),
    ])
    if (tutorsRes.error || assignmentsRes.error) {
      toast({ title: "Error", description: "Failed to load tutors", variant: "destructive" })
      setLoading(false)
      return
    }
    const counts = new Map<string, number>()
    for (const a of assignmentsRes.data || []) counts.set(a.tutor_id, (counts.get(a.tutor_id) || 0) + 1)
    const rows = ((tutorsRes.data as unknown as (TmTutor & { profiles: { email: string } | null })[]) || []).map((t) => ({
      ...t,
      activeAssignments: counts.get(t.id) || 0,
    }))
    setTutors(rows)
    setLoading(false)
  }, [toast])

  useEffect(() => { load() }, [load, refreshKey])

  const filtered = tutors.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))

  async function handleSave(values: TutorFormValues) {
    setSaving(true)
    const supabase = createClient()
    const payload = { name: values.name, phone: values.phone || null, status: values.status }
    const { error } = editing
      ? await supabase.from("tm_tutors").update(payload).eq("id", editing.id)
      : await supabase.from("tm_tutors").insert(payload)
    setSaving(false)
    if (error) {
      toast({ title: "Error", description: editing ? "Failed to update tutor" : "Failed to add tutor", variant: "destructive" })
      return
    }
    toast({ title: "Success", description: editing ? "Tutor updated" : "Tutor added" })
    setDialogOpen(false)
    setEditing(null)
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search tutors..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true) }}>
          <Plus className="mr-2 h-4 w-4" />Add Tutor
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Login</TableHead>
              <TableHead className="text-right">Active assignments</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-24" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center">
                  <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                    <Users className="h-8 w-8" />
                    <p>{search ? `No tutors matching "${search}"` : "No tutors yet. Add one or approve a signup."}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell>{t.phone || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={t.status === "active" ? "secondary" : "outline"}>{TUTOR_STATUS_LABELS[t.status]}</Badge>
                  </TableCell>
                  <TableCell>
                    {t.profiles?.email ? t.profiles.email : <span className="text-muted-foreground">Not linked</span>}
                  </TableCell>
                  <TableCell className="text-right">{t.activeAssignments}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" aria-label={`Edit ${t.name}`} onClick={() => { setEditing(t); setDialogOpen(true) }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Tutor" : "Add Tutor"}</DialogTitle>
            <DialogDescription>{editing ? "Update the tutor's details." : "A tutor without a login yet; link one when they sign up."}</DialogDescription>
          </DialogHeader>
          <TutorForm
            key={editing?.id || "new"}
            onSubmit={handleSave}
            onCancel={() => setDialogOpen(false)}
            defaultValues={editing ? { name: editing.name, phone: editing.phone || "", status: editing.status } : undefined}
            isLoading={saving}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 6: Page**

Replace `src/app/(dashboard)/tm/tutors/page.tsx` with:

```tsx
"use client"

import { useState } from "react"
import { PendingSignups } from "@/components/tm/pending-signups"
import { TutorList } from "@/components/tm/tutor-list"

export default function TmTutorsPage() {
  const [refreshKey, setRefreshKey] = useState(0)
  return (
    <div className="space-y-6">
      <PendingSignups onChanged={() => setRefreshKey((k) => k + 1)} />
      <TutorList refreshKey={refreshKey} />
    </div>
  )
}
```

- [ ] **Step 7: Verify**

`npx tsc --noEmit && npm run build`. Then with `npm run dev` and the seeded pending user (`pending.e2e@example.com` exists after `npm run seed:test-users`), sign in as admin, open `/tm/tutors`: the pending signups card lists it; "Create new tutor" with a name approves it (card disappears, tutor appears in the list with the email in Login). Re-run `npm run seed:test-users` to recreate a pending user, then "Reject" removes it. Confirm with `docker exec supabase_db_eduowl psql -U postgres -d postgres -c "select email, role from profiles order by email;"`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(tm): tutors screen with pending signup approval and rejection

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Nz2dMwYkjrRRcXcuVwSWs1"
```

---

### Task 4: Admin-as-tutor link and the portal entry in the switcher

**Files:**
- Modify: `src/components/tm/tutor-list.tsx`, `src/components/layout/workspace-switcher.tsx`, `src/components/layout/sidebar.tsx`

**Interfaces:**
- Consumes: `tm_tutors.profile_id`, `supabase.auth.getUser()`.
- Produces: `<WorkspaceSwitcher current collapsed showPortal />` prop; "Link my account" action on unlinked tutors.

- [ ] **Step 1: "Link my account" on unlinked tutors**

In `src/components/tm/tutor-list.tsx`:

Add state and a load of the current user's id and whether they already have a tutor row:

```tsx
  const [myProfileId, setMyProfileId] = useState<string | null>(null)
```

Inside `load()`, before `setLoading(false)`, add:

```tsx
    const { data: { user } } = await supabase.auth.getUser()
    setMyProfileId(user?.id ?? null)
```

Compute after `filtered`:

```tsx
  const iAmLinked = myProfileId !== null && tutors.some((t) => t.profile_id === myProfileId)
```

Add the handler:

```tsx
  async function linkMyAccount(tutor: TutorRow) {
    if (!myProfileId) return
    const supabase = createClient()
    const { error } = await supabase.from("tm_tutors").update({ profile_id: myProfileId }).eq("id", tutor.id)
    if (error) {
      toast({ title: "Error", description: "Failed to link your account", variant: "destructive" })
      return
    }
    toast({ title: "Linked", description: `You are now linked to ${tutor.name}. The tutor portal is in the workspace menu.` })
    load()
    window.dispatchEvent(new Event("tm-tutor-link-changed"))
  }
```

In the Login cell, when `!t.profiles?.email && !iAmLinked && myProfileId`, render next to "Not linked":

```tsx
                    <Button variant="link" size="sm" className="px-2" onClick={() => linkMyAccount(t)}>
                      Link my account
                    </Button>
```

- [ ] **Step 2: Switcher gains a portal entry**

In `src/components/layout/workspace-switcher.tsx`, add a prop and an item:

```tsx
export function WorkspaceSwitcher({ current, collapsed, showPortal = false }: { current: Workspace; collapsed?: boolean; showPortal?: boolean }) {
```

After the `WORKSPACES.map(...)` items inside `DropdownMenuContent`, add:

```tsx
        {showPortal && (
          <DropdownMenuItem onSelect={() => router.push("/portal")}>
            Tutor portal
          </DropdownMenuItem>
        )}
```

- [ ] **Step 3: Sidebar looks up the link**

In `src/components/layout/sidebar.tsx`, import `useEffect, useState` from React and `createClient` from `@/lib/supabase/client`. Inside `SidebarContent`, add:

```tsx
  const [showPortal, setShowPortal] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function check() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from("tm_tutors").select("id").eq("profile_id", user.id).maybeSingle()
      if (!cancelled) setShowPortal(Boolean(data))
    }
    check()
    window.addEventListener("tm-tutor-link-changed", check)
    return () => {
      cancelled = true
      window.removeEventListener("tm-tutor-link-changed", check)
    }
  }, [])
```

and pass it: `<WorkspaceSwitcher current={workspace} collapsed={collapsed} showPortal={showPortal} />`.

- [ ] **Step 4: Verify and commit**

`npx tsc --noEmit && npm test && npm run build`. In the browser as admin: on `/tm/tutors`, an unlinked tutor row shows "Link my account"; clicking it makes the workspace menu show "Tutor portal", which opens `/portal`. Re-check `/tm/tutors`: the link button is gone from every row because you are linked.

```bash
git add -A
git commit -m "feat(tm): admins can link themselves to a tutor and open the portal

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Nz2dMwYkjrRRcXcuVwSWs1"
```

---

### Task 5: Students screen with expandable assignments

**Files:**
- Create: `src/components/tm/student-form.tsx`, `src/components/tm/student-list.tsx`
- Modify: `src/app/(dashboard)/tm/students/page.tsx`

**Interfaces:**
- Consumes: `TmStudent`, `TmAssignment`, `TmRateTier`, `TmTutor`, `ASSIGNMENT_STATUS_LABELS`, `toNumber` (Task 1).
- Produces: `<StudentList />` that renders each student with its assignments beneath, and two extension points Task 6 fills: `onAddAssignment(student)` and `onEditAssignment(assignment)` props on an internal `AssignmentsTable` component (this task renders the buttons disabled with a title "Coming in the next task"; Task 6 wires them). Exported type `StudentWithAssignments`.

- [ ] **Step 1: Student form**

Create `src/components/tm/student-form.tsx`:

```tsx
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { DialogFooter } from "@/components/ui/dialog"

export interface StudentFormValues {
  name: string
  parent_name: string
  parent_phone: string
  contact_preference: string
  address: string
  remarks: string
}

interface StudentFormProps {
  onSubmit: (values: StudentFormValues) => Promise<void>
  onCancel: () => void
  defaultValues?: Partial<StudentFormValues>
  isLoading?: boolean
}

export function StudentForm({ onSubmit, onCancel, defaultValues, isLoading }: StudentFormProps) {
  const [values, setValues] = useState<StudentFormValues>({
    name: defaultValues?.name || "",
    parent_name: defaultValues?.parent_name || "",
    parent_phone: defaultValues?.parent_phone || "",
    contact_preference: defaultValues?.contact_preference || "",
    address: defaultValues?.address || "",
    remarks: defaultValues?.remarks || "",
  })

  function set<K extends keyof StudentFormValues>(key: K, value: string) {
    setValues((v) => ({ ...v, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!values.name.trim()) return
    await onSubmit({
      name: values.name.trim(),
      parent_name: values.parent_name.trim(),
      parent_phone: values.parent_phone.trim(),
      contact_preference: values.contact_preference.trim(),
      address: values.address.trim(),
      remarks: values.remarks.trim(),
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid gap-4 py-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="tm-student-name">Student name *</Label>
          <Input id="tm-student-name" value={values.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Zhao Bin" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tm-parent-name">Parent name</Label>
          <Input id="tm-parent-name" value={values.parent_name} onChange={(e) => set("parent_name", e.target.value)} placeholder="e.g. Li Shiwei" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tm-parent-phone">Parent phone</Label>
          <Input id="tm-parent-phone" type="tel" value={values.parent_phone} onChange={(e) => set("parent_phone", e.target.value)} placeholder="e.g. 9123 4567" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tm-contact-pref">Contact preference</Label>
          <Input id="tm-contact-pref" value={values.contact_preference} onChange={(e) => set("contact_preference", e.target.value)} placeholder="e.g. WeChat" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tm-address">Address</Label>
          <Input id="tm-address" value={values.address} onChange={(e) => set("address", e.target.value)} placeholder="Blk, street, unit" />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="tm-student-remarks">Remarks</Label>
          <Textarea id="tm-student-remarks" rows={2} value={values.remarks} onChange={(e) => set("remarks", e.target.value)} />
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={isLoading || !values.name.trim()}>{isLoading ? "Saving..." : "Save"}</Button>
      </DialogFooter>
    </form>
  )
}
```

- [ ] **Step 2: Student list with expandable assignments**

Create `src/components/tm/student-list.tsx`:

```tsx
"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { Plus, Pencil, Search, GraduationCap, ChevronDown, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { StudentForm, type StudentFormValues } from "./student-form"
import {
  ASSIGNMENT_STATUS_LABELS, toNumber,
  type TmAssignment, type TmRateTier, type TmStudent,
} from "@/lib/tm/types"

export interface AssignmentWithTiers extends TmAssignment {
  tm_tutors: { id: string; name: string } | null
  tm_rate_tiers: TmRateTier[]
}

export interface StudentWithAssignments extends TmStudent {
  assignments: AssignmentWithTiers[]
}

export function formatTierSummary(tiers: TmRateTier[]): string {
  return [...tiers]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((t) => `${t.label} $${t.parent_rate}/$${t.tutor_rate}`)
    .join(" · ")
}

interface StudentListProps {
  onAddAssignment?: (student: StudentWithAssignments) => void
  onEditAssignment?: (assignment: AssignmentWithTiers, student: StudentWithAssignments) => void
  refreshKey?: number
}

export function StudentList({ onAddAssignment, onEditAssignment, refreshKey = 0 }: StudentListProps) {
  const [students, setStudents] = useState<StudentWithAssignments[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<StudentWithAssignments | null>(null)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const [studentsRes, assignmentsRes] = await Promise.all([
      supabase.from("tm_students").select("*").order("name"),
      supabase.from("tm_assignments").select("*, tm_tutors(id, name), tm_rate_tiers(*)").order("code"),
    ])
    if (studentsRes.error || assignmentsRes.error) {
      toast({ title: "Error", description: "Failed to load students", variant: "destructive" })
      setLoading(false)
      return
    }
    const byStudent = new Map<string, AssignmentWithTiers[]>()
    for (const raw of (assignmentsRes.data as unknown as AssignmentWithTiers[]) || []) {
      const a: AssignmentWithTiers = {
        ...raw,
        deposit_amount: toNumber(raw.deposit_amount as unknown as string),
        monthly_est_profit: toNumber(raw.monthly_est_profit as unknown as string),
        tm_rate_tiers: (raw.tm_rate_tiers || []).map((t) => ({
          ...t,
          parent_rate: toNumber(t.parent_rate as unknown as string) ?? 0,
          tutor_rate: toNumber(t.tutor_rate as unknown as string) ?? 0,
        })),
      }
      const list = byStudent.get(a.student_id) || []
      list.push(a)
      byStudent.set(a.student_id, list)
    }
    setStudents(((studentsRes.data as TmStudent[]) || []).map((s) => ({ ...s, assignments: byStudent.get(s.id) || [] })))
    setLoading(false)
  }, [toast])

  useEffect(() => { load() }, [load, refreshKey])

  const filtered = students.filter((s) => {
    const q = search.toLowerCase()
    return s.name.toLowerCase().includes(q) || (s.parent_name || "").toLowerCase().includes(q)
      || s.assignments.some((a) => a.code.toLowerCase().includes(q))
  })

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSave(values: StudentFormValues) {
    setSaving(true)
    const supabase = createClient()
    const payload = {
      name: values.name,
      parent_name: values.parent_name || null,
      parent_phone: values.parent_phone || null,
      contact_preference: values.contact_preference || null,
      address: values.address || null,
      remarks: values.remarks || null,
    }
    const { error } = editing
      ? await supabase.from("tm_students").update(payload).eq("id", editing.id)
      : await supabase.from("tm_students").insert(payload)
    setSaving(false)
    if (error) {
      toast({ title: "Error", description: editing ? "Failed to update student" : "Failed to add student", variant: "destructive" })
      return
    }
    toast({ title: "Success", description: editing ? "Student updated" : "Student added" })
    setDialogOpen(false)
    setEditing(null)
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search students, parents, codes..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true) }}>
          <Plus className="mr-2 h-4 w-4" />Add Student
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]" />
              <TableHead>Student</TableHead>
              <TableHead>Parent</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead className="text-right">Assignments</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-24" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center">
                  <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                    <GraduationCap className="h-8 w-8" />
                    <p>{search ? `Nothing matching "${search}"` : "No students yet."}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((s) => {
                const open = expanded.has(s.id)
                return [
                  <TableRow key={s.id} className={cn(open && "bg-muted/40")}>
                    <TableCell>
                      <Button variant="ghost" size="icon" aria-label={open ? `Collapse ${s.name}` : `Expand ${s.name}`} aria-expanded={open} onClick={() => toggle(s.id)}>
                        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </Button>
                    </TableCell>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.parent_name || "-"}</TableCell>
                    <TableCell>
                      {s.parent_phone || "-"}
                      {s.contact_preference && <span className="ml-2 text-xs text-muted-foreground">({s.contact_preference})</span>}
                    </TableCell>
                    <TableCell className="text-right">{s.assignments.length}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" aria-label={`Edit ${s.name}`} onClick={() => { setEditing(s); setDialogOpen(true) }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>,
                  open && (
                    <TableRow key={`${s.id}-assignments`}>
                      <TableCell colSpan={6} className="bg-muted/20 p-0">
                        <AssignmentsTable
                          student={s}
                          onAdd={onAddAssignment}
                          onEdit={onEditAssignment}
                        />
                      </TableCell>
                    </TableRow>
                  ),
                ]
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null) }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Student" : "Add Student"}</DialogTitle>
            <DialogDescription>{editing ? "Update the student and parent details." : "Student and parent contact details."}</DialogDescription>
          </DialogHeader>
          <StudentForm
            key={editing?.id || "new"}
            onSubmit={handleSave}
            onCancel={() => setDialogOpen(false)}
            defaultValues={editing ? {
              name: editing.name,
              parent_name: editing.parent_name || "",
              parent_phone: editing.parent_phone || "",
              contact_preference: editing.contact_preference || "",
              address: editing.address || "",
              remarks: editing.remarks || "",
            } : undefined}
            isLoading={saving}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AssignmentsTable({
  student, onAdd, onEdit,
}: {
  student: StudentWithAssignments
  onAdd?: (student: StudentWithAssignments) => void
  onEdit?: (assignment: AssignmentWithTiers, student: StudentWithAssignments) => void
}) {
  return (
    <div className="px-4 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Assignments</span>
        <Button size="sm" variant="outline" onClick={() => onAdd?.(student)} disabled={!onAdd} title={onAdd ? undefined : "Coming in the next task"}>
          <Plus className="mr-2 h-4 w-4" />Add assignment
        </Button>
      </div>
      {student.assignments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No assignments yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Tutor</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Timeslot</TableHead>
              <TableHead>Rates (parent/tutor)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {student.assignments.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-mono text-xs">{a.code}</TableCell>
                <TableCell>{a.tm_tutors?.name || "-"}</TableCell>
                <TableCell>{a.subject}</TableCell>
                <TableCell>{a.timeslot || "-"}</TableCell>
                <TableCell className="text-xs">{formatTierSummary(a.tm_rate_tiers) || "-"}</TableCell>
                <TableCell><Badge variant={a.status === "active" ? "secondary" : "outline"}>{ASSIGNMENT_STATUS_LABELS[a.status]}</Badge></TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" aria-label={`Edit assignment ${a.code}`} onClick={() => onEdit?.(a, student)} disabled={!onEdit}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Page**

Replace `src/app/(dashboard)/tm/students/page.tsx` with:

```tsx
"use client"

import { StudentList } from "@/components/tm/student-list"

export default function TmStudentsPage() {
  return (
    <div className="space-y-6">
      <StudentList />
    </div>
  )
}
```

- [ ] **Step 4: Verify and commit**

`npx tsc --noEmit && npm run build`. In the browser (with `npm run import:master-list` data loaded), `/tm/students` lists 23 students; expanding "Zhao Bin" shows two assignments (ZB01 Guan Wen, ZB02 Zijie) with their tier summaries; Add Student creates a row; Edit updates it.

```bash
git add -A
git commit -m "feat(tm): students screen with expandable assignments

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Nz2dMwYkjrRRcXcuVwSWs1"
```

---

### Task 6: Assignment form with rate tiers

**Files:**
- Create: `src/lib/tm/assignments.ts`, `src/lib/tm/assignments.test.ts`, `src/components/tm/assignment-form.tsx`
- Modify: `src/components/tm/student-list.tsx`, `src/app/(dashboard)/tm/students/page.tsx`

**Interfaces:**
- Consumes: `RateTierEditor`, `draftsFromTiers`, `draftsFromValues`, `validateTiers`, `parseDefaultTiers` (Task 2); `StudentList` props and `AssignmentWithTiers`, `StudentWithAssignments` (Task 5).
- Produces: `suggestAssignmentCode(studentName: string, existingCodes: string[]): string`; `<AssignmentForm />`; assignment create/edit wired into the Students screen.

- [ ] **Step 1: Failing code-suggestion tests**

Create `src/lib/tm/assignments.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { suggestAssignmentCode } from "./assignments"

describe("suggestAssignmentCode", () => {
  it("uses the initials of the first two words plus a two-digit sequence", () => {
    expect(suggestAssignmentCode("Zhao Bin", [])).toBe("ZB01")
    expect(suggestAssignmentCode("Zhao Bin", ["ZB01"])).toBe("ZB02")
    expect(suggestAssignmentCode("Zhao Bin", ["ZB01", "ZB03"])).toBe("ZB04")
  })
  it("uses the first two letters of a single-word name", () => {
    expect(suggestAssignmentCode("David", [])).toBe("DA01")
    expect(suggestAssignmentCode("Ray", ["RA01"])).toBe("RA02")
  })
  it("joins sibling names on the ampersand", () => {
    expect(suggestAssignmentCode("Janice & Jeanie", [])).toBe("JJ01")
  })
  it("ignores codes with a different prefix and is case-insensitive", () => {
    expect(suggestAssignmentCode("Crystal", ["CR01", "cr02", "CH01"])).toBe("CR03")
  })
  it("falls back to XX for names with no letters", () => {
    expect(suggestAssignmentCode("  ", [])).toBe("XX01")
  })
})
```

Run `npx vitest run src/lib/tm/assignments.test.ts`; expected: FAIL.

- [ ] **Step 2: Implementation**

Create `src/lib/tm/assignments.ts`:

```ts
/**
 * Suggest a unique assignment code in the master list's style: initials of
 * the student's first two words (or first two letters of a single word),
 * upper-cased, plus a two-digit sequence that skips existing codes.
 */
export function suggestAssignmentCode(studentName: string, existingCodes: string[]): string {
  const words = studentName
    .replace(/&/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/[^A-Za-z]/g, ""))
    .filter(Boolean)
  let prefix: string
  if (words.length >= 2) prefix = words[0][0] + words[1][0]
  else if (words.length === 1) prefix = words[0].slice(0, 2).padEnd(2, "X")
  else prefix = "XX"
  prefix = prefix.toUpperCase()

  const taken = new Set(
    existingCodes
      .map((c) => c.toUpperCase())
      .filter((c) => c.startsWith(prefix) && /^\d+$/.test(c.slice(prefix.length)))
      .map((c) => parseInt(c.slice(prefix.length), 10))
  )
  let n = 1
  while (taken.has(n)) n += 1
  return `${prefix}${String(n).padStart(2, "0")}`
}
```

Run the test file; expected: all pass.

- [ ] **Step 3: Assignment form**

Create `src/components/tm/assignment-form.tsx`:

```tsx
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DialogFooter } from "@/components/ui/dialog"
import { RateTierEditor } from "./rate-tier-editor"
import { validateTiers, type RateTierDraft, type RateTierValue } from "@/lib/tm/rate-tiers"
import {
  ASSIGNMENT_STATUS_LABELS, DEPOSIT_STATUS_LABELS,
  type TmAssignmentStatus, type TmDepositStatus, type TmTutor,
} from "@/lib/tm/types"

export interface AssignmentFormValues {
  code: string
  tutor_id: string
  subject: string
  timeslot: string
  status: TmAssignmentStatus
  deposit_amount: number | null
  deposit_status: TmDepositStatus
  curriculum_briefed: boolean
  group_chat_created: boolean
  post_trial_checkin_done: boolean
  monthly_est_profit: number | null
  additional_materials: string
  remarks: string
  tiers: RateTierValue[]
}

interface AssignmentFormProps {
  studentName: string
  tutors: TmTutor[]
  subjectOptions: string[]
  initialTiers: RateTierDraft[]
  defaultValues?: Partial<Omit<AssignmentFormValues, "tiers">>
  onSubmit: (values: AssignmentFormValues) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
}

function parseMoney(raw: string): number | null | "invalid" {
  const t = raw.trim()
  if (!t) return null
  if (!/^\d+(\.\d+)?$/.test(t)) return "invalid"
  return Math.round(parseFloat(t) * 100) / 100
}

export function AssignmentForm({
  studentName, tutors, subjectOptions, initialTiers, defaultValues, onSubmit, onCancel, isLoading,
}: AssignmentFormProps) {
  const d = defaultValues
  const [code, setCode] = useState(d?.code || "")
  const [tutorId, setTutorId] = useState(d?.tutor_id || "")
  const [subject, setSubject] = useState(d?.subject || "")
  const [timeslot, setTimeslot] = useState(d?.timeslot || "")
  const [status, setStatus] = useState<TmAssignmentStatus>(d?.status || "active")
  const [depositAmount, setDepositAmount] = useState(d?.deposit_amount != null ? String(d.deposit_amount) : "")
  const [depositStatus, setDepositStatus] = useState<TmDepositStatus>(d?.deposit_status || "none")
  const [briefed, setBriefed] = useState(Boolean(d?.curriculum_briefed))
  const [chat, setChat] = useState(Boolean(d?.group_chat_created))
  const [trial, setTrial] = useState(Boolean(d?.post_trial_checkin_done))
  const [estProfit, setEstProfit] = useState(d?.monthly_est_profit != null ? String(d.monthly_est_profit) : "")
  const [materials, setMaterials] = useState(d?.additional_materials || "")
  const [remarks, setRemarks] = useState(d?.remarks || "")
  const [tiers, setTiers] = useState<RateTierDraft[]>(initialTiers)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!code.trim() || !tutorId || !subject.trim()) {
      setError("Code, tutor and subject are required.")
      return
    }
    const deposit = parseMoney(depositAmount)
    if (deposit === "invalid") { setError("Deposit must be a number."); return }
    const profit = parseMoney(estProfit)
    if (profit === "invalid") { setError("Monthly estimated profit must be a number."); return }
    const validated = validateTiers(tiers)
    if (!validated.ok) { setError(validated.error); return }
    await onSubmit({
      code: code.trim().toUpperCase(),
      tutor_id: tutorId,
      subject: subject.trim(),
      timeslot: timeslot.trim(),
      status,
      deposit_amount: deposit,
      deposit_status: deposit === null ? "none" : depositStatus === "none" ? "collected" : depositStatus,
      curriculum_briefed: briefed,
      group_chat_created: chat,
      post_trial_checkin_done: trial,
      monthly_est_profit: profit,
      additional_materials: materials.trim(),
      remarks: remarks.trim(),
      tiers: validated.tiers,
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid gap-4 py-4 sm:grid-cols-2">
        <p className="sm:col-span-2 text-sm text-muted-foreground">Student: <span className="font-medium text-foreground">{studentName}</span></p>

        <div className="space-y-2">
          <Label htmlFor="tm-asg-code">Code *</Label>
          <Input id="tm-asg-code" value={code} onChange={(e) => setCode(e.target.value)} className="font-mono uppercase" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tm-asg-tutor">Tutor *</Label>
          <Select value={tutorId} onValueChange={setTutorId}>
            <SelectTrigger id="tm-asg-tutor"><SelectValue placeholder="Choose a tutor" /></SelectTrigger>
            <SelectContent>
              {tutors.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}{t.status === "inactive" ? " (inactive)" : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="tm-asg-subject">Subject *</Label>
          <Input id="tm-asg-subject" list="tm-subject-options" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. S4 G2 English" required />
          <datalist id="tm-subject-options">
            {subjectOptions.map((s) => <option key={s} value={s} />)}
          </datalist>
        </div>
        <div className="space-y-2">
          <Label htmlFor="tm-asg-timeslot">Timeslot</Label>
          <Input id="tm-asg-timeslot" value={timeslot} onChange={(e) => setTimeslot(e.target.value)} placeholder="e.g. Sat 2-4pm" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tm-asg-status">Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as TmAssignmentStatus)}>
            <SelectTrigger id="tm-asg-status"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(ASSIGNMENT_STATUS_LABELS) as TmAssignmentStatus[]).map((s) => (
                <SelectItem key={s} value={s}>{ASSIGNMENT_STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="tm-asg-profit">Monthly est. profit ($)</Label>
          <Input id="tm-asg-profit" inputMode="decimal" value={estProfit} onChange={(e) => setEstProfit(e.target.value)} placeholder="e.g. 160" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tm-asg-deposit">Deposit ($)</Label>
          <Input id="tm-asg-deposit" inputMode="decimal" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder="Leave blank for none" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tm-asg-deposit-status">Deposit status</Label>
          <Select value={depositStatus} onValueChange={(v) => setDepositStatus(v as TmDepositStatus)} disabled={!depositAmount.trim()}>
            <SelectTrigger id="tm-asg-deposit-status"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(["not_collected", "collected"] as TmDepositStatus[]).map((s) => (
                <SelectItem key={s} value={s}>{DEPOSIT_STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <fieldset className="sm:col-span-2 space-y-2">
          <legend className="text-sm font-medium">Onboarding checklist</legend>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={briefed} onCheckedChange={(c) => setBriefed(c === true)} />Curriculum briefed</label>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={chat} onCheckedChange={(c) => setChat(c === true)} />Group chat created</label>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={trial} onCheckedChange={(c) => setTrial(c === true)} />Checked in after trial</label>
          </div>
        </fieldset>

        <div className="sm:col-span-2 space-y-2">
          <Label>Rate tiers *</Label>
          <RateTierEditor value={tiers} onChange={setTiers} idPrefix="asg-tier" />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="tm-asg-materials">Additional materials</Label>
          <Input id="tm-asg-materials" value={materials} onChange={(e) => setMaterials(e.target.value)} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="tm-asg-remarks">Remarks</Label>
          <Textarea id="tm-asg-remarks" rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder='e.g. "Contact via WeChat"' />
        </div>

        {error && <p className="sm:col-span-2 text-sm text-destructive">{error}</p>}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={isLoading}>{isLoading ? "Saving..." : "Save"}</Button>
      </DialogFooter>
    </form>
  )
}
```

- [ ] **Step 4: Wire the form into the Students page**

In `src/app/(dashboard)/tm/students/page.tsx`, replace the file with:

```tsx
"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { StudentList, type AssignmentWithTiers, type StudentWithAssignments } from "@/components/tm/student-list"
import { AssignmentForm, type AssignmentFormValues } from "@/components/tm/assignment-form"
import { draftsFromTiers, draftsFromValues, parseDefaultTiers, type RateTierDraft } from "@/lib/tm/rate-tiers"
import { suggestAssignmentCode } from "@/lib/tm/assignments"
import type { TmTutor } from "@/lib/tm/types"

type Target = { student: StudentWithAssignments; assignment: AssignmentWithTiers | null } | null

export default function TmStudentsPage() {
  const [target, setTarget] = useState<Target>(null)
  const [tutors, setTutors] = useState<TmTutor[]>([])
  const [subjects, setSubjects] = useState<string[]>([])
  const [allCodes, setAllCodes] = useState<string[]>([])
  const [defaultTiers, setDefaultTiers] = useState<RateTierDraft[]>([])
  const [saving, setSaving] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const { toast } = useToast()

  const loadLookups = useCallback(async () => {
    const supabase = createClient()
    const [tutorsRes, assignmentsRes, settingsRes] = await Promise.all([
      supabase.from("tm_tutors").select("*").order("name"),
      supabase.from("tm_assignments").select("code, subject"),
      supabase.from("tm_settings").select("default_rate_tiers").limit(1).maybeSingle(),
    ])
    setTutors((tutorsRes.data as TmTutor[]) || [])
    const rows = assignmentsRes.data || []
    setAllCodes(rows.map((r) => r.code))
    setSubjects(Array.from(new Set(rows.map((r) => r.subject))).sort())
    setDefaultTiers(draftsFromValues(parseDefaultTiers(settingsRes.data?.default_rate_tiers)))
  }, [])

  useEffect(() => { loadLookups() }, [loadLookups, refreshKey])

  function openAdd(student: StudentWithAssignments) {
    setTarget({ student, assignment: null })
  }
  function openEdit(assignment: AssignmentWithTiers, student: StudentWithAssignments) {
    setTarget({ student, assignment })
  }

  async function handleSave(values: AssignmentFormValues) {
    if (!target) return
    setSaving(true)
    const supabase = createClient()
    const payload = {
      code: values.code,
      tutor_id: values.tutor_id,
      student_id: target.student.id,
      subject: values.subject,
      timeslot: values.timeslot || null,
      status: values.status,
      deposit_amount: values.deposit_amount,
      deposit_status: values.deposit_status,
      curriculum_briefed: values.curriculum_briefed,
      group_chat_created: values.group_chat_created,
      post_trial_checkin_done: values.post_trial_checkin_done,
      monthly_est_profit: values.monthly_est_profit,
      additional_materials: values.additional_materials || null,
      remarks: values.remarks || null,
    }

    let assignmentId: string
    if (target.assignment) {
      const { error } = await supabase.from("tm_assignments").update(payload).eq("id", target.assignment.id)
      if (error) {
        setSaving(false)
        toast({ title: "Error", description: error.code === "23505" ? "That code is already in use." : "Failed to update assignment", variant: "destructive" })
        return
      }
      assignmentId = target.assignment.id
    } else {
      const { data, error } = await supabase.from("tm_assignments").insert(payload).select("id").single()
      if (error || !data) {
        setSaving(false)
        toast({ title: "Error", description: error?.code === "23505" ? "That code is already in use." : "Failed to add assignment", variant: "destructive" })
        return
      }
      assignmentId = data.id
    }

    // Tiers: upsert by (assignment_id, label) so unchanged labels keep their ids, then drop removed labels.
    const { error: tierError } = await supabase
      .from("tm_rate_tiers")
      .upsert(values.tiers.map((t) => ({ ...t, assignment_id: assignmentId })), { onConflict: "assignment_id,label" })
    if (tierError) {
      setSaving(false)
      toast({ title: "Error", description: "Assignment saved but rate tiers failed", variant: "destructive" })
      return
    }
    const keepLabels = values.tiers.map((t) => t.label)
    const { error: pruneError } = await supabase
      .from("tm_rate_tiers")
      .delete()
      .eq("assignment_id", assignmentId)
      .not("label", "in", `(${keepLabels.map((l) => `"${l.replace(/"/g, '\\"')}"`).join(",")})`)
    setSaving(false)
    if (pruneError) {
      toast({ title: "Error", description: "Assignment saved but an old rate tier could not be removed", variant: "destructive" })
      return
    }
    toast({ title: "Success", description: target.assignment ? "Assignment updated" : `Assignment ${values.code} added` })
    setTarget(null)
    setRefreshKey((k) => k + 1)
  }

  const editing = target?.assignment ?? null

  return (
    <div className="space-y-6">
      <StudentList onAddAssignment={openAdd} onEditAssignment={openEdit} refreshKey={refreshKey} />

      <Dialog open={target !== null} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.code}` : "Add Assignment"}</DialogTitle>
            <DialogDescription>{editing ? "Change the tutor, rates, status or notes." : "A tutor, a subject and the rate tiers for this student."}</DialogDescription>
          </DialogHeader>
          {target && (
            <AssignmentForm
              key={editing?.id || `new-${target.student.id}`}
              studentName={target.student.name}
              tutors={tutors}
              subjectOptions={subjects}
              initialTiers={editing ? draftsFromTiers(editing.tm_rate_tiers) : defaultTiers}
              defaultValues={editing ? {
                code: editing.code,
                tutor_id: editing.tutor_id,
                subject: editing.subject,
                timeslot: editing.timeslot || "",
                status: editing.status,
                deposit_amount: editing.deposit_amount,
                deposit_status: editing.deposit_status,
                curriculum_briefed: editing.curriculum_briefed,
                group_chat_created: editing.group_chat_created,
                post_trial_checkin_done: editing.post_trial_checkin_done,
                monthly_est_profit: editing.monthly_est_profit,
                additional_materials: editing.additional_materials || "",
                remarks: editing.remarks || "",
              } : { code: suggestAssignmentCode(target.student.name, allCodes) }}
              onSubmit={handleSave}
              onCancel={() => setTarget(null)}
              isLoading={saving}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

In `src/components/tm/student-list.tsx`, remove the `title="Coming in the next task"` and `disabled={!onAdd}` / `disabled={!onEdit}` attributes so the buttons are always enabled.

- [ ] **Step 5: Verify and commit**

`npx tsc --noEmit && npm test && npm run build`. In the browser on `/tm/students`: expand a student, "Add assignment" opens the dialog with a suggested code and the default tiers from Settings; saving shows the new row with tiers. Edit an existing assignment, rename one tier's label and change a rate, save: psql `select label, parent_rate, tutor_rate from tm_rate_tiers where assignment_id = '<id>'` shows the renamed tier as a new row and the old label gone, and the unchanged tier keeps its id.

```bash
git add -A
git commit -m "feat(tm): assignment form with rate tiers and code suggestion

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Nz2dMwYkjrRRcXcuVwSWs1"
```

---

### Task 7: Master list logic (periods, CSV, rows)

**Files:**
- Create: `src/lib/tm/periods.ts`, `src/lib/tm/periods.test.ts`, `src/lib/tm/csv-export.ts`, `src/lib/tm/csv-export.test.ts`, `src/lib/tm/master-list.ts`, `src/lib/tm/master-list.test.ts`

**Interfaces:**
- Consumes: `TmAssignment`, `TmRateTier`, `TmInvoice` (Task 1).
- Produces (all pure, used by Task 8):
  - periods: `Period = { year: number; month: number }`, `periodKey`, `periodLabel`, `currentPeriod(now?)`, `parseMonthInput`, `toMonthInput`, `comparePeriods`, `addMonths`, `periodsBetween`
  - csv: `CsvCell = string | number | boolean | null | undefined`, `toCsv(headers: string[], rows: CsvCell[][]): string`
  - master-list: `AssignmentSource`, `AssignmentRow`, `HistoryRow`, `formatRates(tiers, "parent" | "tutor")`, `buildAssignmentRows(sources, invoices, period)`, `buildHistoryRows(invoices, sources)`, `filterAssignmentRows(rows, filter)`, `filterHistoryRows(rows, filter)`, `sortRows(rows, key, dir)`, `historyTotals(rows)`, `assignmentRowsToCsv(rows, period)`, `historyRowsToCsv(rows)`

- [ ] **Step 1: Period tests**

Create `src/lib/tm/periods.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import {
  periodKey, periodLabel, currentPeriod, parseMonthInput, toMonthInput, comparePeriods, addMonths, periodsBetween,
} from "./periods"

describe("periods", () => {
  it("formats keys and labels", () => {
    expect(periodKey({ year: 2026, month: 8 })).toBe("2026-08")
    expect(periodLabel({ year: 2026, month: 8 })).toBe("Aug 2026")
    expect(toMonthInput({ year: 2026, month: 12 })).toBe("2026-12")
  })
  it("parses month inputs and rejects junk", () => {
    expect(parseMonthInput("2026-08")).toEqual({ year: 2026, month: 8 })
    expect(parseMonthInput("2026-13")).toBeNull()
    expect(parseMonthInput("")).toBeNull()
    expect(parseMonthInput("abc")).toBeNull()
  })
  it("derives the current period from a date", () => {
    expect(currentPeriod(new Date(2026, 8, 4))).toEqual({ year: 2026, month: 9 })
  })
  it("compares and adds months across year boundaries", () => {
    expect(comparePeriods({ year: 2025, month: 12 }, { year: 2026, month: 1 })).toBeLessThan(0)
    expect(comparePeriods({ year: 2026, month: 3 }, { year: 2026, month: 3 })).toBe(0)
    expect(addMonths({ year: 2026, month: 11 }, 3)).toEqual({ year: 2027, month: 2 })
    expect(addMonths({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 })
  })
  it("lists inclusive ranges ascending, empty when reversed", () => {
    expect(periodsBetween({ year: 2025, month: 11 }, { year: 2026, month: 2 }).map(periodKey))
      .toEqual(["2025-11", "2025-12", "2026-01", "2026-02"])
    expect(periodsBetween({ year: 2026, month: 2 }, { year: 2026, month: 1 })).toEqual([])
  })
})
```

- [ ] **Step 2: Periods implementation**

Create `src/lib/tm/periods.ts`:

```ts
export interface Period {
  year: number
  month: number // 1-12
}

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

export function periodKey(p: Period): string {
  return `${p.year}-${String(p.month).padStart(2, "0")}`
}

export function periodLabel(p: Period): string {
  return `${SHORT_MONTHS[p.month - 1]} ${p.year}`
}

export function toMonthInput(p: Period): string {
  return periodKey(p)
}

export function parseMonthInput(value: string): Period | null {
  const m = value.match(/^(\d{4})-(\d{2})$/)
  if (!m) return null
  const year = parseInt(m[1], 10)
  const month = parseInt(m[2], 10)
  if (month < 1 || month > 12) return null
  return { year, month }
}

export function currentPeriod(now: Date = new Date()): Period {
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

export function comparePeriods(a: Period, b: Period): number {
  return a.year !== b.year ? a.year - b.year : a.month - b.month
}

export function addMonths(p: Period, n: number): Period {
  const index = p.year * 12 + (p.month - 1) + n
  return { year: Math.floor(index / 12), month: (index % 12 + 12) % 12 + 1 }
}

export function periodsBetween(from: Period, to: Period): Period[] {
  const out: Period[] = []
  let cursor = from
  while (comparePeriods(cursor, to) <= 0) {
    out.push(cursor)
    cursor = addMonths(cursor, 1)
  }
  return out
}
```

Run `npx vitest run src/lib/tm/periods.test.ts`; expected: pass.

- [ ] **Step 3: CSV tests and implementation**

Create `src/lib/tm/csv-export.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { toCsv } from "./csv-export"

describe("toCsv", () => {
  it("writes a header row and CRLF-terminated data rows", () => {
    expect(toCsv(["a", "b"], [["1", 2], ["x", null]])).toBe("a,b\r\n1,2\r\nx,\r\n")
  })
  it("quotes fields containing commas, quotes, or newlines and doubles quotes", () => {
    expect(toCsv(["v"], [['say "hi", ok'], ["line1\nline2"]]))
      .toBe('v\r\n"say ""hi"", ok"\r\n"line1\nline2"\r\n')
  })
  it("renders booleans as Yes/No and undefined as empty", () => {
    expect(toCsv(["f"], [[true], [false], [undefined]])).toBe("f\r\nYes\r\nNo\r\n\r\n")
  })
})
```

Create `src/lib/tm/csv-export.ts`:

```ts
export type CsvCell = string | number | boolean | null | undefined

function escapeCell(cell: CsvCell): string {
  if (cell === null || cell === undefined) return ""
  if (typeof cell === "boolean") return cell ? "Yes" : "No"
  const s = String(cell)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** RFC 4180 CSV with CRLF line endings. Excel and Google Sheets open it directly. */
export function toCsv(headers: string[], rows: CsvCell[][]): string {
  const lines = [headers, ...rows].map((r) => r.map(escapeCell).join(","))
  return lines.join("\r\n") + "\r\n"
}
```

Run `npx vitest run src/lib/tm/csv-export.test.ts`; expected: pass.

- [ ] **Step 4: Master-list row tests**

Create `src/lib/tm/master-list.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import {
  buildAssignmentRows, buildHistoryRows, filterAssignmentRows, filterHistoryRows, sortRows, historyTotals,
  formatRates, assignmentRowsToCsv, historyRowsToCsv, type AssignmentSource,
} from "./master-list"
import type { TmInvoice } from "./types"

const tiers = (assignment_id: string) => [
  { id: `${assignment_id}-t2`, assignment_id, label: "1 to 1", parent_rate: 120, tutor_rate: 120, sort_order: 1 },
  { id: `${assignment_id}-t1`, assignment_id, label: "Group", parent_rate: 80, tutor_rate: 80, sort_order: 0 },
]

const sources: AssignmentSource[] = [
  {
    assignment: {
      id: "a1", code: "ZB02", tutor_id: "t1", student_id: "s1", subject: "Foundational Eng", timeslot: "Sat 2-4pm",
      status: "active", deposit_amount: 960, deposit_status: "collected", curriculum_briefed: true,
      group_chat_created: true, post_trial_checkin_done: false, monthly_est_profit: 0,
      additional_materials: null, remarks: "Owe ZB $330", created_at: "2026-01-01",
    },
    tutor: { id: "t1", name: "Zijie", phone: "9720 5889" },
    student: { id: "s1", name: "Zhao Bin", parent_name: "Li Shiwei", address: null },
    tiers: tiers("a1"),
  },
  {
    assignment: {
      id: "a2", code: "JAJE01", tutor_id: "t2", student_id: "s2", subject: "Sec G2 Eng", timeslot: null,
      status: "stopped", deposit_amount: null, deposit_status: "none", curriculum_briefed: false,
      group_chat_created: false, post_trial_checkin_done: false, monthly_est_profit: 160,
      additional_materials: null, remarks: null, created_at: "2026-01-01",
    },
    tutor: { id: "t2", name: "Guan Wen", phone: null },
    student: { id: "s2", name: "Janice & Jeanie", parent_name: "Debbie", address: "Clementi" },
    tiers: [{ id: "a2-t1", assignment_id: "a2", label: "1 to 1", parent_rate: 70, tutor_rate: 50, sort_order: 0 }],
  },
]

const inv = (over: Partial<TmInvoice>): TmInvoice => ({
  id: "i", invoice_number: "TM-202608-001", assignment_id: "a1", year: 2026, month: 8, source: "manual",
  total_hours: null, invoice_amount: 0, tutor_payout: 0, profit: 0, parent_paid_at: null, tutor_paid_at: null, remarks: null,
  ...over,
})

const invoices: TmInvoice[] = [
  inv({ id: "i1", assignment_id: "a1", year: 2026, month: 8, invoice_amount: 960, tutor_payout: 960, profit: 0, parent_paid_at: "2026-09-02", tutor_paid_at: "2026-09-03", total_hours: 8 }),
  inv({ id: "i2", assignment_id: "a1", year: 2026, month: 8, source: "generated", invoice_amount: 240, tutor_payout: 240, profit: 0, parent_paid_at: null, tutor_paid_at: "2026-09-03", total_hours: 2 }),
  inv({ id: "i3", assignment_id: "a2", year: 2026, month: 7, invoice_amount: 700, tutor_payout: 500, profit: 200, parent_paid_at: "2026-08-01", tutor_paid_at: "2026-08-01", total_hours: 10 }),
]

describe("formatRates", () => {
  it("lists tiers in sort order with the chosen rate", () => {
    expect(formatRates(tiers("a1"), "parent")).toBe("Group $80 · 1 to 1 $120")
    expect(formatRates([], "tutor")).toBe("")
  })
})

describe("buildAssignmentRows", () => {
  const rows = buildAssignmentRows(sources, invoices, { year: 2026, month: 8 })
  it("flattens reference columns", () => {
    expect(rows[0]).toMatchObject({
      code: "JAJE01", tutorName: "Guan Wen", tutorPhone: "", studentName: "Janice & Jeanie", parentName: "Debbie",
      address: "Clementi", parentRates: "1 to 1 $70", tutorRates: "1 to 1 $50", status: "stopped",
    })
    expect(rows.map((r) => r.code)).toEqual(["JAJE01", "ZB02"])
  })
  it("sums the selected month's invoices and reports paid only when every invoice is paid", () => {
    const zb = rows.find((r) => r.code === "ZB02")!
    expect(zb).toMatchObject({ invoiceAmount: 1200, tutorPay: 1200, profit: 0, parentPaid: false, tutorPaid: true })
    const ja = rows.find((r) => r.code === "JAJE01")!
    expect(ja).toMatchObject({ invoiceAmount: null, tutorPay: null, profit: null, parentPaid: null, tutorPaid: null })
  })
})

describe("buildHistoryRows", () => {
  const rows = buildHistoryRows(invoices, sources)
  it("makes one row per invoice, newest period first then by code", () => {
    expect(rows.map((r) => [r.periodKey, r.code, r.source])).toEqual([
      ["2026-08", "ZB02", "manual"],
      ["2026-08", "ZB02", "generated"],
      ["2026-07", "JAJE01", "manual"],
    ])
    expect(rows[2]).toMatchObject({ periodLabel: "Jul 2026", tutorName: "Guan Wen", studentName: "Janice & Jeanie", hours: 10, invoiceAmount: 700, tutorPay: 500, profit: 200 })
  })
})

describe("filters", () => {
  it("filters assignment rows by status and tutor", () => {
    const rows = buildAssignmentRows(sources, invoices, { year: 2026, month: 8 })
    expect(filterAssignmentRows(rows, { status: "active", tutorName: "all" }).map((r) => r.code)).toEqual(["ZB02"])
    expect(filterAssignmentRows(rows, { status: "all", tutorName: "Guan Wen" }).map((r) => r.code)).toEqual(["JAJE01"])
  })
  it("filters history rows by period range, tutor, and student", () => {
    const rows = buildHistoryRows(invoices, sources)
    expect(filterHistoryRows(rows, { from: { year: 2026, month: 8 }, to: { year: 2026, month: 8 }, tutorName: "all", studentName: "all" })).toHaveLength(2)
    expect(filterHistoryRows(rows, { from: null, to: null, tutorName: "Guan Wen", studentName: "all" })).toHaveLength(1)
    expect(filterHistoryRows(rows, { from: null, to: null, tutorName: "all", studentName: "Zhao Bin" })).toHaveLength(2)
  })
})

describe("sortRows and totals", () => {
  it("sorts strings, numbers, and nulls last in either direction", () => {
    const rows = [{ n: 2 as number | null, s: "b" }, { n: null, s: "a" }, { n: 1, s: "c" }]
    expect(sortRows(rows, "n", "asc").map((r) => r.n)).toEqual([1, 2, null])
    expect(sortRows(rows, "n", "desc").map((r) => r.n)).toEqual([2, 1, null])
    expect(sortRows(rows, "s", "asc").map((r) => r.s)).toEqual(["a", "b", "c"])
  })
  it("totals the history rows", () => {
    expect(historyTotals(buildHistoryRows(invoices, sources))).toEqual({ hours: 20, invoiceAmount: 1900, tutorPay: 1700, profit: 200 })
  })
})

describe("csv", () => {
  it("exports assignment rows with the month in the header", () => {
    const csv = assignmentRowsToCsv(buildAssignmentRows(sources, invoices, { year: 2026, month: 8 }), { year: 2026, month: 8 })
    expect(csv.split("\r\n")[0]).toContain("Aug 2026 invoice")
    expect(csv).toContain("ZB02,Zijie,9720 5889,Zhao Bin,Li Shiwei")
  })
  it("exports history rows", () => {
    const csv = historyRowsToCsv(buildHistoryRows(invoices, sources))
    expect(csv.split("\r\n")[0]).toBe("Month,Code,Tutor,Student,Subject,Hours,Invoice amount,Tutor pay,Profit,Parent paid,Tutor paid,Source,Invoice number")
    expect(csv).toContain("Jul 2026,JAJE01,Guan Wen,Janice & Jeanie,Sec G2 Eng,10,700,500,200,2026-08-01,2026-08-01,manual,TM-202608-001")
  })
})
```

Run `npx vitest run src/lib/tm/master-list.test.ts`; expected: FAIL, module not found.

- [ ] **Step 5: Master-list implementation**

Create `src/lib/tm/master-list.ts`:

```ts
import { comparePeriods, periodKey, periodLabel, type Period } from "./periods"
import { toCsv, type CsvCell } from "./csv-export"
import type { TmAssignment, TmAssignmentStatus, TmDepositStatus, TmInvoice, TmInvoiceSource, TmRateTier } from "./types"
import { ASSIGNMENT_STATUS_LABELS, DEPOSIT_STATUS_LABELS } from "./types"

export interface AssignmentSource {
  assignment: TmAssignment
  tutor: { id: string; name: string; phone: string | null } | null
  student: { id: string; name: string; parent_name: string | null; address: string | null } | null
  tiers: TmRateTier[]
}

export interface AssignmentRow {
  id: string
  code: string
  tutorName: string
  tutorPhone: string
  studentName: string
  parentName: string
  subject: string
  address: string
  timeslot: string
  depositAmount: number | null
  depositStatus: TmDepositStatus
  parentRates: string
  tutorRates: string
  curriculumBriefed: boolean
  groupChatCreated: boolean
  postTrialCheckinDone: boolean
  monthlyEstProfit: number | null
  status: TmAssignmentStatus
  remarks: string
  additionalMaterials: string
  invoiceAmount: number | null
  tutorPay: number | null
  profit: number | null
  parentPaid: boolean | null
  tutorPaid: boolean | null
}

export interface HistoryRow {
  invoiceId: string
  periodKey: string
  periodLabel: string
  year: number
  month: number
  code: string
  tutorName: string
  studentName: string
  subject: string
  hours: number | null
  invoiceAmount: number
  tutorPay: number
  profit: number
  parentPaidAt: string | null
  tutorPaidAt: string | null
  source: TmInvoiceSource
  invoiceNumber: string
}

export function formatRates(tiers: TmRateTier[], which: "parent" | "tutor"): string {
  return [...tiers]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((t) => `${t.label} $${which === "parent" ? t.parent_rate : t.tutor_rate}`)
    .join(" · ")
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function buildAssignmentRows(sources: AssignmentSource[], invoices: TmInvoice[], period: Period): AssignmentRow[] {
  const byAssignment = new Map<string, TmInvoice[]>()
  for (const inv of invoices) {
    if (inv.year !== period.year || inv.month !== period.month) continue
    const list = byAssignment.get(inv.assignment_id) || []
    list.push(inv)
    byAssignment.set(inv.assignment_id, list)
  }

  return sources
    .map(({ assignment: a, tutor, student, tiers }) => {
      const monthInvoices = byAssignment.get(a.id) || []
      const has = monthInvoices.length > 0
      return {
        id: a.id,
        code: a.code,
        tutorName: tutor?.name ?? "",
        tutorPhone: tutor?.phone ?? "",
        studentName: student?.name ?? "",
        parentName: student?.parent_name ?? "",
        subject: a.subject,
        address: student?.address ?? "",
        timeslot: a.timeslot ?? "",
        depositAmount: a.deposit_amount,
        depositStatus: a.deposit_status,
        parentRates: formatRates(tiers, "parent"),
        tutorRates: formatRates(tiers, "tutor"),
        curriculumBriefed: a.curriculum_briefed,
        groupChatCreated: a.group_chat_created,
        postTrialCheckinDone: a.post_trial_checkin_done,
        monthlyEstProfit: a.monthly_est_profit,
        status: a.status,
        remarks: a.remarks ?? "",
        additionalMaterials: a.additional_materials ?? "",
        invoiceAmount: has ? round2(monthInvoices.reduce((s, i) => s + i.invoice_amount, 0)) : null,
        tutorPay: has ? round2(monthInvoices.reduce((s, i) => s + i.tutor_payout, 0)) : null,
        profit: has ? round2(monthInvoices.reduce((s, i) => s + i.profit, 0)) : null,
        parentPaid: has ? monthInvoices.every((i) => i.parent_paid_at !== null) : null,
        tutorPaid: has ? monthInvoices.every((i) => i.tutor_paid_at !== null) : null,
      }
    })
    .sort((x, y) => x.code.localeCompare(y.code))
}

export function buildHistoryRows(invoices: TmInvoice[], sources: AssignmentSource[]): HistoryRow[] {
  const byId = new Map(sources.map((s) => [s.assignment.id, s]))
  return invoices
    .map((inv) => {
      const src = byId.get(inv.assignment_id)
      const period = { year: inv.year, month: inv.month }
      return {
        invoiceId: inv.id,
        periodKey: periodKey(period),
        periodLabel: periodLabel(period),
        year: inv.year,
        month: inv.month,
        code: src?.assignment.code ?? "",
        tutorName: src?.tutor?.name ?? "",
        studentName: src?.student?.name ?? "",
        subject: src?.assignment.subject ?? "",
        hours: inv.total_hours,
        invoiceAmount: inv.invoice_amount,
        tutorPay: inv.tutor_payout,
        profit: inv.profit,
        parentPaidAt: inv.parent_paid_at,
        tutorPaidAt: inv.tutor_paid_at,
        source: inv.source,
        invoiceNumber: inv.invoice_number ?? "",
      }
    })
    .sort((a, b) => {
      const byPeriod = comparePeriods({ year: b.year, month: b.month }, { year: a.year, month: a.month })
      if (byPeriod !== 0) return byPeriod
      const byCode = a.code.localeCompare(b.code)
      if (byCode !== 0) return byCode
      return a.source === "manual" ? -1 : b.source === "manual" ? 1 : 0
    })
}

export interface AssignmentFilter {
  status: TmAssignmentStatus | "all"
  tutorName: string | "all"
}

export function filterAssignmentRows(rows: AssignmentRow[], f: AssignmentFilter): AssignmentRow[] {
  return rows.filter((r) => (f.status === "all" || r.status === f.status) && (f.tutorName === "all" || r.tutorName === f.tutorName))
}

export interface HistoryFilter {
  from: Period | null
  to: Period | null
  tutorName: string | "all"
  studentName: string | "all"
}

export function filterHistoryRows(rows: HistoryRow[], f: HistoryFilter): HistoryRow[] {
  return rows.filter((r) => {
    const p = { year: r.year, month: r.month }
    if (f.from && comparePeriods(p, f.from) < 0) return false
    if (f.to && comparePeriods(p, f.to) > 0) return false
    if (f.tutorName !== "all" && r.tutorName !== f.tutorName) return false
    if (f.studentName !== "all" && r.studentName !== f.studentName) return false
    return true
  })
}

export type SortDir = "asc" | "desc"

export function sortRows<T extends object>(rows: T[], key: keyof T, dir: SortDir): T[] {
  const sign = dir === "asc" ? 1 : -1
  return [...rows].sort((a, b) => {
    const x = a[key] as unknown
    const y = b[key] as unknown
    if (x === null || x === undefined) return y === null || y === undefined ? 0 : 1
    if (y === null || y === undefined) return -1
    if (typeof x === "number" && typeof y === "number") return (x - y) * sign
    if (typeof x === "boolean" && typeof y === "boolean") return (Number(x) - Number(y)) * sign
    return String(x).localeCompare(String(y)) * sign
  })
}

export function historyTotals(rows: HistoryRow[]): { hours: number; invoiceAmount: number; tutorPay: number; profit: number } {
  return {
    hours: round2(rows.reduce((s, r) => s + (r.hours ?? 0), 0)),
    invoiceAmount: round2(rows.reduce((s, r) => s + r.invoiceAmount, 0)),
    tutorPay: round2(rows.reduce((s, r) => s + r.tutorPay, 0)),
    profit: round2(rows.reduce((s, r) => s + r.profit, 0)),
  }
}

function paidCell(v: boolean | null): CsvCell {
  return v === null ? "" : v ? "Paid" : "Unpaid"
}

export function assignmentRowsToCsv(rows: AssignmentRow[], period: Period): string {
  const m = periodLabel(period)
  const headers = [
    "Code", "Tutor", "Tutor phone", "Student", "Parent", "Subject", "Address", "Timeslot",
    "Deposit", "Deposit status", "Parent rates", "Tutor rates",
    "Curriculum briefed", "Group chat created", "Checked in after trial", "Monthly est. profit",
    "Status", "Remarks", "Additional materials",
    `${m} invoice`, `${m} tutor pay`, `${m} profit`, `${m} parent paid`, `${m} tutor paid`,
  ]
  return toCsv(headers, rows.map((r) => [
    r.code, r.tutorName, r.tutorPhone, r.studentName, r.parentName, r.subject, r.address, r.timeslot,
    r.depositAmount, DEPOSIT_STATUS_LABELS[r.depositStatus], r.parentRates, r.tutorRates,
    r.curriculumBriefed, r.groupChatCreated, r.postTrialCheckinDone, r.monthlyEstProfit,
    ASSIGNMENT_STATUS_LABELS[r.status], r.remarks, r.additionalMaterials,
    r.invoiceAmount, r.tutorPay, r.profit, paidCell(r.parentPaid), paidCell(r.tutorPaid),
  ]))
}

export function historyRowsToCsv(rows: HistoryRow[]): string {
  const headers = ["Month", "Code", "Tutor", "Student", "Subject", "Hours", "Invoice amount", "Tutor pay", "Profit", "Parent paid", "Tutor paid", "Source", "Invoice number"]
  return toCsv(headers, rows.map((r) => [
    r.periodLabel, r.code, r.tutorName, r.studentName, r.subject, r.hours, r.invoiceAmount, r.tutorPay, r.profit,
    r.parentPaidAt ?? "", r.tutorPaidAt ?? "", r.source, r.invoiceNumber,
  ]))
}
```

Run `npm test`; expected: all files pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/tm
git commit -m "feat(tm): master list row builders, filters, sorting, CSV export

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Nz2dMwYkjrRRcXcuVwSWs1"
```

---

### Task 8: Master List screen

**Files:**
- Create: `src/components/tm/sortable-header.tsx`, `src/components/tm/master-list-assignments.tsx`, `src/components/tm/master-list-history.tsx`
- Modify: `src/app/(dashboard)/tm/master-list/page.tsx`

**Interfaces:**
- Consumes: everything from Task 7; `toNumber`, status label maps (Task 1); `formatCurrency` from `src/lib/format.ts`.
- Produces: the Master List page with two tabs.

- [ ] **Step 1: Sortable header**

Create `src/components/tm/sortable-header.tsx`:

```tsx
"use client"

import { TableHead } from "@/components/ui/table"
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import type { SortDir } from "@/lib/tm/master-list"

interface SortableHeaderProps<K extends string> {
  column: K
  label: string
  sortKey: K | null
  sortDir: SortDir
  onSort: (column: K) => void
  className?: string
  align?: "left" | "right"
}

export function SortableHeader<K extends string>({ column, label, sortKey, sortDir, onSort, className, align = "left" }: SortableHeaderProps<K>) {
  const active = sortKey === column
  const Icon = !active ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown
  return (
    <TableHead className={cn("whitespace-nowrap", align === "right" && "text-right", className)}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn("inline-flex items-center gap-1 hover:text-foreground", active && "text-foreground font-semibold")}
        aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
      >
        {label}
        <Icon className="h-3 w-3" />
      </button>
    </TableHead>
  )
}
```

- [ ] **Step 2: Assignments tab**

Create `src/components/tm/master-list-assignments.tsx`:

```tsx
"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table"
import { Download, Check, Minus } from "lucide-react"
import { SortableHeader } from "./sortable-header"
import { formatCurrency } from "@/lib/format"
import { ASSIGNMENT_STATUS_LABELS, DEPOSIT_STATUS_LABELS, type TmAssignmentStatus } from "@/lib/tm/types"
import {
  assignmentRowsToCsv, buildAssignmentRows, filterAssignmentRows, sortRows,
  type AssignmentRow, type AssignmentSource, type SortDir,
} from "@/lib/tm/master-list"
import { parseMonthInput, periodLabel, toMonthInput, type Period } from "@/lib/tm/periods"
import type { TmInvoice } from "@/lib/tm/types"

interface Props {
  sources: AssignmentSource[]
  invoices: TmInvoice[]
  period: Period
  onPeriodChange: (p: Period) => void
  onDownload: (filename: string, csv: string) => void
}

type Key = keyof AssignmentRow

function Flag({ value }: { value: boolean }) {
  return value ? <Check className="h-4 w-4 text-primary" aria-label="Yes" /> : <Minus className="h-4 w-4 text-muted-foreground" aria-label="No" />
}

function Paid({ value }: { value: boolean | null }) {
  if (value === null) return <span className="text-muted-foreground">—</span>
  return <Badge variant={value ? "secondary" : "outline"}>{value ? "Paid" : "Unpaid"}</Badge>
}

function money(v: number | null): string {
  return v === null ? "—" : formatCurrency(v)
}

export function MasterListAssignments({ sources, invoices, period, onPeriodChange, onDownload }: Props) {
  const [status, setStatus] = useState<TmAssignmentStatus | "all">("all")
  const [tutorName, setTutorName] = useState<string>("all")
  const [sortKey, setSortKey] = useState<Key | null>("code")
  const [sortDir, setSortDir] = useState<SortDir>("asc")

  const tutorNames = useMemo(() => Array.from(new Set(sources.map((s) => s.tutor?.name).filter(Boolean) as string[])).sort(), [sources])
  const rows = useMemo(() => {
    const built = buildAssignmentRows(sources, invoices, period)
    const filtered = filterAssignmentRows(built, { status, tutorName })
    return sortKey ? sortRows(filtered, sortKey, sortDir) : filtered
  }, [sources, invoices, period, status, tutorName, sortKey, sortDir])

  function onSort(column: Key) {
    if (sortKey === column) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else { setSortKey(column); setSortDir("asc") }
  }

  const head = (column: Key, label: string, align: "left" | "right" = "left") => (
    <SortableHeader column={column} label={label} sortKey={sortKey} sortDir={sortDir} onSort={onSort} align={align} />
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="ml-month">Month</Label>
          <Input id="ml-month" type="month" className="w-[160px]" value={toMonthInput(period)} onChange={(e) => { const p = parseMonthInput(e.target.value); if (p) onPeriodChange(p) }} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ml-status">Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as TmAssignmentStatus | "all")}>
            <SelectTrigger id="ml-status" className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {(Object.keys(ASSIGNMENT_STATUS_LABELS) as TmAssignmentStatus[]).map((s) => (
                <SelectItem key={s} value={s}>{ASSIGNMENT_STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="ml-tutor">Tutor</Label>
          <Select value={tutorName} onValueChange={setTutorName}>
            <SelectTrigger id="ml-tutor" className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tutors</SelectItem>
              {tutorNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={() => onDownload(`master-list-assignments-${toMonthInput(period)}.csv`, assignmentRowsToCsv(rows, period))}>
            <Download className="mr-2 h-4 w-4" />Export CSV
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">{rows.length} assignment{rows.length === 1 ? "" : "s"}. Month columns show {periodLabel(period)}.</p>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {head("code", "Code")}
              {head("tutorName", "Tutor")}
              {head("tutorPhone", "Phone")}
              {head("studentName", "Student")}
              {head("parentName", "Parent")}
              {head("subject", "Subject")}
              {head("address", "Address")}
              {head("timeslot", "Timeslot")}
              {head("depositAmount", "Deposit", "right")}
              {head("parentRates", "Parent rates")}
              {head("tutorRates", "Tutor rates")}
              {head("curriculumBriefed", "Briefed")}
              {head("groupChatCreated", "Chat")}
              {head("postTrialCheckinDone", "Trial ✓")}
              {head("monthlyEstProfit", "Est. profit", "right")}
              {head("status", "Status")}
              {head("remarks", "Remarks")}
              {head("additionalMaterials", "Materials")}
              {head("invoiceAmount", `${periodLabel(period)} invoice`, "right")}
              {head("tutorPay", "Tutor pay", "right")}
              {head("profit", "Profit", "right")}
              {head("parentPaid", "Parent paid")}
              {head("tutorPaid", "Tutor paid")}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={23} className="text-center py-8 text-muted-foreground">No assignments match.</TableCell></TableRow>
            ) : rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.code}</TableCell>
                <TableCell className="whitespace-nowrap">{r.tutorName}</TableCell>
                <TableCell className="whitespace-nowrap">{r.tutorPhone || "—"}</TableCell>
                <TableCell className="whitespace-nowrap">{r.studentName}</TableCell>
                <TableCell className="whitespace-nowrap">{r.parentName || "—"}</TableCell>
                <TableCell>{r.subject}</TableCell>
                <TableCell className="max-w-[200px] truncate" title={r.address}>{r.address || "—"}</TableCell>
                <TableCell>{r.timeslot || "—"}</TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {r.depositAmount === null ? "—" : `${formatCurrency(r.depositAmount)} ${r.depositStatus === "collected" ? "✓" : `(${DEPOSIT_STATUS_LABELS[r.depositStatus]})`}`}
                </TableCell>
                <TableCell className="text-xs whitespace-nowrap">{r.parentRates || "—"}</TableCell>
                <TableCell className="text-xs whitespace-nowrap">{r.tutorRates || "—"}</TableCell>
                <TableCell><Flag value={r.curriculumBriefed} /></TableCell>
                <TableCell><Flag value={r.groupChatCreated} /></TableCell>
                <TableCell><Flag value={r.postTrialCheckinDone} /></TableCell>
                <TableCell className="text-right">{money(r.monthlyEstProfit)}</TableCell>
                <TableCell><Badge variant={r.status === "active" ? "secondary" : "outline"}>{ASSIGNMENT_STATUS_LABELS[r.status]}</Badge></TableCell>
                <TableCell className="max-w-[200px] truncate" title={r.remarks}>{r.remarks || "—"}</TableCell>
                <TableCell className="max-w-[160px] truncate" title={r.additionalMaterials}>{r.additionalMaterials || "—"}</TableCell>
                <TableCell className="text-right">{money(r.invoiceAmount)}</TableCell>
                <TableCell className="text-right">{money(r.tutorPay)}</TableCell>
                <TableCell className="text-right">{money(r.profit)}</TableCell>
                <TableCell><Paid value={r.parentPaid} /></TableCell>
                <TableCell><Paid value={r.tutorPaid} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: History tab**

Create `src/components/tm/master-list-history.tsx`:

```tsx
"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableFooter, TableHeader, TableRow } from "@/components/ui/table"
import { Download } from "lucide-react"
import { SortableHeader } from "./sortable-header"
import { formatCurrency } from "@/lib/format"
import {
  buildHistoryRows, filterHistoryRows, historyRowsToCsv, historyTotals, sortRows,
  type AssignmentSource, type HistoryRow, type SortDir,
} from "@/lib/tm/master-list"
import { parseMonthInput, toMonthInput, type Period } from "@/lib/tm/periods"
import type { TmInvoice } from "@/lib/tm/types"

interface Props {
  sources: AssignmentSource[]
  invoices: TmInvoice[]
  onDownload: (filename: string, csv: string) => void
}

type Key = keyof HistoryRow

export function MasterListHistory({ sources, invoices, onDownload }: Props) {
  const [from, setFrom] = useState<Period | null>(null)
  const [to, setTo] = useState<Period | null>(null)
  const [tutorName, setTutorName] = useState("all")
  const [studentName, setStudentName] = useState("all")
  const [sortKey, setSortKey] = useState<Key | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  const tutorNames = useMemo(() => Array.from(new Set(sources.map((s) => s.tutor?.name).filter(Boolean) as string[])).sort(), [sources])
  const studentNames = useMemo(() => Array.from(new Set(sources.map((s) => s.student?.name).filter(Boolean) as string[])).sort(), [sources])

  const rows = useMemo(() => {
    const built = buildHistoryRows(invoices, sources)
    const filtered = filterHistoryRows(built, { from, to, tutorName, studentName })
    return sortKey ? sortRows(filtered, sortKey, sortDir) : filtered
  }, [invoices, sources, from, to, tutorName, studentName, sortKey, sortDir])

  const totals = useMemo(() => historyTotals(rows), [rows])

  function onSort(column: Key) {
    if (sortKey === column) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else { setSortKey(column); setSortDir("asc") }
  }

  const head = (column: Key, label: string, align: "left" | "right" = "left") => (
    <SortableHeader column={column} label={label} sortKey={sortKey} sortDir={sortDir} onSort={onSort} align={align} />
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="mh-from">From</Label>
          <Input id="mh-from" type="month" className="w-[160px]" value={from ? toMonthInput(from) : ""} onChange={(e) => setFrom(parseMonthInput(e.target.value))} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="mh-to">To</Label>
          <Input id="mh-to" type="month" className="w-[160px]" value={to ? toMonthInput(to) : ""} onChange={(e) => setTo(parseMonthInput(e.target.value))} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="mh-tutor">Tutor</Label>
          <Select value={tutorName} onValueChange={setTutorName}>
            <SelectTrigger id="mh-tutor" className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tutors</SelectItem>
              {tutorNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="mh-student">Student</Label>
          <Select value={studentName} onValueChange={setStudentName}>
            <SelectTrigger id="mh-student" className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All students</SelectItem>
              {studentNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={() => onDownload("master-list-history.csv", historyRowsToCsv(rows))}>
            <Download className="mr-2 h-4 w-4" />Export CSV
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">{rows.length} invoice{rows.length === 1 ? "" : "s"}.</p>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {head("periodKey", "Month")}
              {head("code", "Code")}
              {head("tutorName", "Tutor")}
              {head("studentName", "Student")}
              {head("subject", "Subject")}
              {head("hours", "Hours", "right")}
              {head("invoiceAmount", "Invoice amount", "right")}
              {head("tutorPay", "Tutor pay", "right")}
              {head("profit", "Profit", "right")}
              {head("parentPaidAt", "Parent paid")}
              {head("tutorPaidAt", "Tutor paid")}
              {head("source", "Source")}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={12} className="text-center py-8 text-muted-foreground">No invoices match.</TableCell></TableRow>
            ) : rows.map((r) => (
              <TableRow key={r.invoiceId}>
                <TableCell className="whitespace-nowrap">{r.periodLabel}</TableCell>
                <TableCell className="font-mono text-xs">{r.code}</TableCell>
                <TableCell className="whitespace-nowrap">{r.tutorName}</TableCell>
                <TableCell className="whitespace-nowrap">{r.studentName}</TableCell>
                <TableCell>{r.subject}</TableCell>
                <TableCell className="text-right">{r.hours ?? "—"}</TableCell>
                <TableCell className="text-right">{formatCurrency(r.invoiceAmount)}</TableCell>
                <TableCell className="text-right">{formatCurrency(r.tutorPay)}</TableCell>
                <TableCell className="text-right">{formatCurrency(r.profit)}</TableCell>
                <TableCell>{r.parentPaidAt ? <Badge variant="secondary">✓ {r.parentPaidAt}</Badge> : <Badge variant="outline">Unpaid</Badge>}</TableCell>
                <TableCell>{r.tutorPaidAt ? <Badge variant="secondary">✓ {r.tutorPaidAt}</Badge> : <Badge variant="outline">Unpaid</Badge>}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.source}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          {rows.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={5} className="font-semibold">Totals</TableCell>
                <TableCell className="text-right font-semibold">{totals.hours}</TableCell>
                <TableCell className="text-right font-semibold">{formatCurrency(totals.invoiceAmount)}</TableCell>
                <TableCell className="text-right font-semibold">{formatCurrency(totals.tutorPay)}</TableCell>
                <TableCell className="text-right font-semibold">{formatCurrency(totals.profit)}</TableCell>
                <TableCell colSpan={3} />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </div>
  )
}
```

`TableFooter` is exported by `src/components/ui/table.tsx` (shadcn default). If it is not, add it there following the `TableHeader` pattern with `<tfoot className={cn("border-t bg-muted/50 font-medium", className)}>`.

- [ ] **Step 4: Page**

Replace `src/app/(dashboard)/tm/master-list/page.tsx` with:

```tsx
"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { MasterListAssignments } from "@/components/tm/master-list-assignments"
import { MasterListHistory } from "@/components/tm/master-list-history"
import type { AssignmentSource } from "@/lib/tm/master-list"
import { currentPeriod, type Period } from "@/lib/tm/periods"
import { toNumber, type TmAssignment, type TmInvoice, type TmRateTier } from "@/lib/tm/types"

interface RawAssignment extends TmAssignment {
  tm_tutors: { id: string; name: string; phone: string | null } | null
  tm_students: { id: string; name: string; parent_name: string | null; address: string | null } | null
  tm_rate_tiers: TmRateTier[]
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function TmMasterListPage() {
  const [sources, setSources] = useState<AssignmentSource[]>([])
  const [invoices, setInvoices] = useState<TmInvoice[]>([])
  const [period, setPeriod] = useState<Period>(() => currentPeriod())
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const [assignmentsRes, invoicesRes] = await Promise.all([
      supabase.from("tm_assignments").select("*, tm_tutors(id, name, phone), tm_students(id, name, parent_name, address), tm_rate_tiers(*)").order("code"),
      supabase.from("tm_invoices").select("*"),
    ])
    if (assignmentsRes.error || invoicesRes.error) {
      toast({ title: "Error", description: "Failed to load the master list", variant: "destructive" })
      setLoading(false)
      return
    }
    setSources(((assignmentsRes.data as unknown as RawAssignment[]) || []).map((r) => {
      const { tm_tutors, tm_students, tm_rate_tiers, ...assignment } = r
      return {
        assignment: {
          ...assignment,
          deposit_amount: toNumber(assignment.deposit_amount as unknown as string),
          monthly_est_profit: toNumber(assignment.monthly_est_profit as unknown as string),
        },
        tutor: tm_tutors,
        student: tm_students,
        tiers: (tm_rate_tiers || []).map((t) => ({
          ...t,
          parent_rate: toNumber(t.parent_rate as unknown as string) ?? 0,
          tutor_rate: toNumber(t.tutor_rate as unknown as string) ?? 0,
        })),
      }
    }))
    setInvoices(((invoicesRes.data as unknown as TmInvoice[]) || []).map((i) => ({
      ...i,
      total_hours: toNumber(i.total_hours as unknown as string),
      invoice_amount: toNumber(i.invoice_amount as unknown as string) ?? 0,
      tutor_payout: toNumber(i.tutor_payout as unknown as string) ?? 0,
      profit: toNumber(i.profit as unknown as string) ?? 0,
    })))
    setLoading(false)
  }, [toast])

  useEffect(() => { load() }, [load])

  if (loading) return <Skeleton className="h-96 w-full" />

  return (
    <Tabs defaultValue="assignments" className="space-y-4">
      <TabsList>
        <TabsTrigger value="assignments">Assignments</TabsTrigger>
        <TabsTrigger value="history">Monthly History</TabsTrigger>
      </TabsList>
      <TabsContent value="assignments">
        <MasterListAssignments sources={sources} invoices={invoices} period={period} onPeriodChange={setPeriod} onDownload={downloadCsv} />
      </TabsContent>
      <TabsContent value="history">
        <MasterListHistory sources={sources} invoices={invoices} onDownload={downloadCsv} />
      </TabsContent>
    </Tabs>
  )
}
```

- [ ] **Step 5: Verify and commit**

`npx tsc --noEmit && npm test && npm run build`. In the browser with imported data on `/tm/master-list`: the Assignments tab shows 35 rows; setting Month to `2026-07` fills JAJE01's invoice columns with $700.00 / $500.00 / $200.00; sorting by Tutor works; Export downloads a CSV whose first line contains "Jul 2026 invoice". Monthly History shows 70 rows with a totals row; filtering From/To `2026-07` to `2026-07` narrows it and the totals change.

```bash
git add -A
git commit -m "feat(tm): master list screen with assignments and monthly history tabs

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Nz2dMwYkjrRRcXcuVwSWs1"
```

---

### Task 9: End-to-end tests and final verification

**Files:**
- Create: `e2e/helpers/admin.ts`, `e2e/tm-admin.spec.ts`

**Interfaces:**
- Consumes: `signIn`, `users` from `e2e/helpers/auth.ts`; env `SUPABASE_SERVICE_ROLE_KEY` (loaded by `playwright.config.ts`).
- Produces: `createPendingUser(email)`, `deleteUserByEmail(email)`, `findUserByEmail(email)` for fixtures.

- [ ] **Step 1: Service-role fixture helper**

Create `e2e/helpers/admin.ts`:

```ts
import { createClient } from "@supabase/supabase-js"

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for e2e fixtures")
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function findUserByEmail(email: string) {
  const { data } = await adminClient().auth.admin.listUsers({ perPage: 1000 })
  return data?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null
}

/** Creates a confirmed Google-less user; the signup trigger makes it a pending profile. */
export async function createPendingUser(email: string, fullName: string) {
  const existing = await findUserByEmail(email)
  if (existing) await adminClient().auth.admin.deleteUser(existing.id)
  const { data, error } = await adminClient().auth.admin.createUser({
    email, password: "e2e-throwaway-password", email_confirm: true, user_metadata: { full_name: fullName },
  })
  if (error) throw error
  return data.user
}

export async function deleteUserByEmail(email: string) {
  const user = await findUserByEmail(email)
  if (user) await adminClient().auth.admin.deleteUser(user.id)
}

export async function deleteTutorByName(name: string) {
  await adminClient().from("tm_tutors").delete().eq("name", name)
}
```

- [ ] **Step 2: The spec**

Create `e2e/tm-admin.spec.ts`:

```ts
import { test, expect } from "@playwright/test"
import { signIn, users } from "./helpers/auth"
import { createPendingUser, deleteUserByEmail, deleteTutorByName, findUserByEmail } from "./helpers/admin"

const stamp = Date.now().toString(36)

test.describe("tutor matching admin", () => {
  test.beforeEach(async ({ context }) => signIn(context, users.admin.email, users.admin.password))

  test("settings save and reload", async ({ page }) => {
    await page.goto("/tm/settings")
    const uen = page.getByLabel("PayNow UEN")
    const original = await uen.inputValue()
    await uen.fill("202411710M-E2E")
    await page.getByRole("button", { name: "Save settings" }).click()
    await expect(page.getByText("Tutor Matching settings updated")).toBeVisible()
    await page.reload()
    await expect(page.getByLabel("PayNow UEN")).toHaveValue("202411710M-E2E")
    await page.getByLabel("PayNow UEN").fill(original)
    await page.getByRole("button", { name: "Save settings" }).click()
    await expect(page.getByText("Tutor Matching settings updated")).toBeVisible()
  })

  test("add a tutor", async ({ page }) => {
    const name = `E2E Tutor ${stamp}`
    await page.goto("/tm/tutors")
    await page.getByRole("button", { name: "Add Tutor" }).click()
    await page.getByLabel("Name *").fill(name)
    await page.getByLabel("Phone").fill("9000 0000")
    await page.getByRole("button", { name: "Save" }).click()
    await expect(page.getByRole("cell", { name })).toBeVisible()
    await expect(page.getByRole("row", { name: new RegExp(name) })).toContainText("Not linked")
  })

  test("approve a pending signup as a new tutor", async ({ page }) => {
    const email = `approve.${stamp}@example.com`
    const name = `Approved ${stamp}`
    await createPendingUser(email, name)
    try {
      await page.goto("/tm/tutors")
      const row = page.getByRole("row", { name: new RegExp(email) })
      await expect(row).toBeVisible()
      await row.getByRole("button", { name: "Create new tutor" }).click()
      await expect(page.getByLabel("Name *")).toHaveValue(name)
      await page.getByRole("button", { name: "Approve" }).click()
      await expect(page.getByText(`${name} can now use the tutor portal`)).toBeVisible()
      await expect(page.getByRole("row", { name: new RegExp(name) })).toContainText(email)
    } finally {
      await deleteUserByEmail(email)
      await deleteTutorByName(name)
    }
  })

  test("reject a pending signup deletes the account", async ({ page }) => {
    const email = `reject.${stamp}@example.com`
    await createPendingUser(email, "Reject Me")
    try {
      await page.goto("/tm/tutors")
      const row = page.getByRole("row", { name: new RegExp(email) })
      await row.getByRole("button", { name: "Reject" }).click()
      await page.getByRole("dialog").getByRole("button", { name: "Reject" }).click()
      await expect(page.getByText(`${email} was removed`)).toBeVisible()
      await expect(page.getByRole("row", { name: new RegExp(email) })).toHaveCount(0)
      expect(await findUserByEmail(email)).toBeNull()
    } finally {
      await deleteUserByEmail(email)
    }
  })

  test("add a student, an assignment with tiers, and see it in the master list", async ({ page }) => {
    const student = `E2E Student ${stamp}`
    await page.goto("/tm/students")
    await page.getByRole("button", { name: "Add Student" }).click()
    await page.getByLabel("Student name *").fill(student)
    await page.getByLabel("Parent name").fill("E2E Parent")
    await page.getByRole("button", { name: "Save" }).click()
    await expect(page.getByRole("cell", { name: student })).toBeVisible()

    await page.getByRole("button", { name: `Expand ${student}` }).click()
    await page.getByRole("button", { name: "Add assignment" }).click()
    const code = await page.getByLabel("Code *").inputValue()
    expect(code).toMatch(/^[A-Z]{2}\d{2}$/)
    await page.getByLabel("Tutor *").click()
    await page.getByRole("option").first().click()
    await page.getByLabel("Subject *").fill("E2E Subject")
    // Ensure at least one tier row exists and fill the first one
    if ((await page.getByLabel("Tier label").count()) === 0) {
      await page.getByRole("button", { name: "Add tier" }).click()
    }
    await page.getByLabel("Tier label").first().fill("1 to 1")
    await page.getByLabel("Parent rate").first().fill("70")
    await page.getByLabel("Tutor rate").first().fill("50")
    await page.getByRole("button", { name: "Save" }).click()
    await expect(page.getByText(`Assignment ${code} added`)).toBeVisible()
    await expect(page.getByRole("cell", { name: code })).toBeVisible()

    await page.goto("/tm/master-list")
    await expect(page.getByRole("cell", { name: code })).toBeVisible()
    await expect(page.getByRole("row", { name: new RegExp(code) })).toContainText("1 to 1 $70")

    const download = page.waitForEvent("download")
    await page.getByRole("button", { name: "Export CSV" }).click()
    expect((await download).suggestedFilename()).toMatch(/^master-list-assignments-\d{4}-\d{2}\.csv$/)

    await page.getByRole("tab", { name: "Monthly History" }).click()
    await expect(page.getByRole("button", { name: "Export CSV" })).toBeVisible()
  })
})
```

- [ ] **Step 3: Run the suite**

```bash
npm run seed:test-users
npx playwright test e2e/tm-admin.spec.ts --reporter=list
```

Expected: 5 passed. Selector mismatches against the real UI may be corrected in the spec; a behaviour failure means a bug in an earlier task and must be reported, not patched around.

- [ ] **Step 4: Full verification**

```bash
npx tsc --noEmit && npm test && npm run build
npx playwright test e2e/auth-routing.spec.ts e2e/smoke-test.spec.ts e2e/tm-admin.spec.ts --reporter=list
```

Expected: unit tests green, build lists `/tm/tutors`, `/tm/students`, `/tm/master-list`, `/tm/settings`, and all e2e files pass. `npm run db:test` is unchanged by this slice; run it once to confirm 53 assertions still pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test(tm): admin data entry end-to-end

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Nz2dMwYkjrRRcXcuVwSWs1"
```

---

## After this plan

Slice 3 (tutor portal) follows. Its first task must add `tm_timesheet_entries_tutor_view` (every column except `parent_rate`, filtered by `current_tutor_id()`, revoked from `anon`/`public`, `security_barrier`) with a `hasnt_column` test, and the portal must read entries only through it; see the carry-forward section of the slice 1 plan.
