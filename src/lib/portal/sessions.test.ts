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
