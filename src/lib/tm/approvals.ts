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
