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
