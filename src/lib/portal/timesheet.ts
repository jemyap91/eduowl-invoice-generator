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
