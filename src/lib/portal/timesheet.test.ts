import { describe, it, expect } from "vitest"
import {
  entryPayout, groupByAssignment, sumEntries, submissionState, isEditable, canSubmit, formatHours, type PortalEntry,
} from "./timesheet"

const e = (over: Partial<PortalEntry>): PortalEntry => ({
  id: "e", assignment_id: "a1", date: "2026-09-02", start_time: null, end_time: null, hours: 1, rate_tier_id: "t1",
  tier_label: "1 to 1", tutor_rate: 50, note: null, status: "draft", submission_id: null, ...over,
})

describe("entryPayout and sums", () => {
  it("multiplies hours by the tutor rate, rounded to cents", () => {
    expect(entryPayout(e({ hours: 1.5, tutor_rate: 50 }))).toBe(75)
    expect(entryPayout(e({ hours: 0.33, tutor_rate: 55 }))).toBe(18.15)
  })
  it("sums hours and payout", () => {
    expect(sumEntries([e({ hours: 1.5 }), e({ id: "f", hours: 2, tutor_rate: 60 })])).toEqual({ hours: 3.5, payout: 195 })
    expect(sumEntries([])).toEqual({ hours: 0, payout: 0 })
  })
})

describe("groupByAssignment", () => {
  it("groups by assignment and sorts each group by date then creation order", () => {
    const g = groupByAssignment([
      e({ id: "1", assignment_id: "a2", date: "2026-09-03" }),
      e({ id: "2", assignment_id: "a1", date: "2026-09-05" }),
      e({ id: "3", assignment_id: "a1", date: "2026-09-01" }),
    ])
    expect([...g.keys()]).toEqual(["a2", "a1"])
    expect(g.get("a1")!.map((x) => x.id)).toEqual(["3", "2"])
  })
})

describe("submissionState", () => {
  it("maps a submission row to a state", () => {
    expect(submissionState(null)).toEqual({ kind: "none" })
    expect(submissionState({ status: "submitted", return_reason: null })).toEqual({ kind: "submitted" })
    expect(submissionState({ status: "approved", return_reason: null })).toEqual({ kind: "approved" })
    expect(submissionState({ status: "returned", return_reason: "Check hours" })).toEqual({ kind: "returned", reason: "Check hours" })
  })
  it("only none and returned are editable", () => {
    expect(isEditable({ kind: "none" })).toBe(true)
    expect(isEditable({ kind: "returned", reason: null })).toBe(true)
    expect(isEditable({ kind: "submitted" })).toBe(false)
    expect(isEditable({ kind: "approved" })).toBe(false)
  })
})

describe("canSubmit", () => {
  it("needs at least one editable entry and a tier on every one", () => {
    expect(canSubmit([], { kind: "none" })).toEqual({ ok: false, reason: "Log at least one session first." })
    expect(canSubmit([e({})], { kind: "none" })).toEqual({ ok: true })
    expect(canSubmit([e({ rate_tier_id: null })], { kind: "none" })).toEqual({ ok: false, reason: "Choose a rate tier for every session first." })
    expect(canSubmit([e({ status: "submitted" })], { kind: "submitted" })).toEqual({ ok: false, reason: "This month has already been submitted." })
    expect(canSubmit([e({ status: "returned" })], { kind: "returned", reason: "x" })).toEqual({ ok: true })
  })
})

describe("formatHours", () => {
  it("shows two decimals", () => {
    expect(formatHours(1.5)).toBe("1.50")
    expect(formatHours(2)).toBe("2.00")
  })
})
