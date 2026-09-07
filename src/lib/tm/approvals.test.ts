import { describe, it, expect } from "vitest"
import {
  summariseEntries, entryAmount, groupByTutor, outstandingReturns, describeEdit, entryToSessionInput, patchFromPayload,
  sortEntries, mapQueueRow, mapReturnedRow, type ApprovalEntry, type QueueSubmission, type ReturnedSubmission,
} from "./approvals"

function entry(over: Partial<ApprovalEntry>): ApprovalEntry {
  return {
    id: "e", assignment_id: "a", date: "2026-09-04", start_time: null, end_time: null, hours: 1,
    rate_tier_id: "t", tier_label: "1 to 1", parent_rate: 70, tutor_rate: 50, note: null, status: "submitted", edits: [],
    ...over,
  }
}
function sub(over: Partial<QueueSubmission>): QueueSubmission {
  return { id: "s", assignment_id: "a", code: "AA01", subject: "English", studentName: "Sam", tutorName: "Tina", year: 2026, month: 9, submitted_at: "2026-09-05T00:00:00Z", entries: [], ...over }
}

describe("summariseEntries", () => {
  it("sums hours, amount, payout, and profit", () => {
    const s = summariseEntries([entry({ hours: 1.5 }), entry({ hours: 2, tier_label: "Group", parent_rate: 40, tutor_rate: 30 })])
    expect(s).toEqual({ sessions: 2, hours: 3.5, amount: 185, payout: 135, profit: 50 })
  })
  it("rounds per rate line, not per entry or per total", () => {
    // 0.5 x 10.01 = 5.005 per line -> 5.01 each -> 10.02 (total-first rounding would give 10.01)
    const s = summariseEntries([
      entry({ hours: 0.5, tier_label: "A", parent_rate: 10.01, tutor_rate: 10.01 }),
      entry({ hours: 0.5, tier_label: "B", parent_rate: 10.01, tutor_rate: 10.01 }),
    ])
    expect(s.amount).toBe(10.02)
    expect(s.payout).toBe(10.02)
    // Same label and rate: one line -> 1.0 x 10.01 = 10.01
    const one = summariseEntries([entry({ hours: 0.5, parent_rate: 10.01 }), entry({ hours: 0.5, parent_rate: 10.01 })])
    expect(one.amount).toBe(10.01)
  })
  it("is zero for no entries", () => {
    expect(summariseEntries([])).toEqual({ sessions: 0, hours: 0, amount: 0, payout: 0, profit: 0 })
  })
})

describe("entryAmount", () => {
  it("is hours times parent rate to cents", () => {
    expect(entryAmount(entry({ hours: 1.5, parent_rate: 70 }))).toBe(105)
    expect(entryAmount(entry({ hours: 0.5, parent_rate: 10.01 }))).toBe(5.01)
  })
})

describe("groupByTutor", () => {
  it("groups by tutor name in name order, submissions by submitted_at", () => {
    const groups = groupByTutor([
      sub({ id: "1", tutorName: "Zed", submitted_at: "2026-09-02T00:00:00Z" }),
      sub({ id: "2", tutorName: "Amy", submitted_at: "2026-09-03T00:00:00Z" }),
      sub({ id: "3", tutorName: "Zed", submitted_at: "2026-09-01T00:00:00Z" }),
    ])
    expect(groups.map(([name, list]) => [name, list.map((s) => s.id)])).toEqual([["Amy", ["2"]], ["Zed", ["3", "1"]]])
  })
})

describe("outstandingReturns", () => {
  const r = (id: string, month: number): ReturnedSubmission => ({
    id, assignment_id: "a", code: "AA01", subject: "English", studentName: "Sam", tutorName: "Tina", year: 2026, month, reviewed_at: null, return_reason: "x",
  })
  it("drops returned months that have a later live submission", () => {
    const out = outstandingReturns([r("aug", 8), r("sep", 9)], [{ assignment_id: "a", year: 2026, month: 9 }])
    expect(out.map((s) => s.id)).toEqual(["aug"])
  })
  it("ignores live rows for other assignments", () => {
    const out = outstandingReturns([r("sep", 9)], [{ assignment_id: "b", year: 2026, month: 9 }])
    expect(out.map((s) => s.id)).toEqual(["sep"])
  })
})

describe("describeEdit", () => {
  it("lists every previous value, with none for nulls", () => {
    expect(describeEdit({ date: "2026-09-04", start_time: "14:00:00", end_time: "15:30:00", hours: "1.50", tier_label: "1 to 1", note: null })).toEqual([
      "Date: 2026-09-04", "Time: 14:00 to 15:30", "Hours: 1.50", "Tier: 1 to 1", "Note: none",
    ])
    expect(describeEdit({ date: "2026-09-04", hours: 2, tier_label: "Group", note: "Revision" })).toEqual([
      "Date: 2026-09-04", "Time: none", "Hours: 2.00", "Tier: Group", "Note: Revision",
    ])
  })
})

describe("entryToSessionInput and patchFromPayload", () => {
  it("round-trips an entry through the form shapes", () => {
    const e = entry({ id: "e1", assignment_id: "a1", start_time: "14:00", end_time: "15:30", hours: 1.5, rate_tier_id: "t1", note: "Revision" })
    expect(entryToSessionInput(e)).toEqual({ assignmentId: "a1", date: "2026-09-04", start: "14:00", end: "15:30", hours: "1.5", rateTierId: "t1", note: "Revision" })
    expect(entryToSessionInput(entry({ rate_tier_id: null, note: null }))).toMatchObject({ rateTierId: "", note: "", start: "", end: "", hours: "1" })
    expect(patchFromPayload({ assignment_id: "a1", date: "2026-09-04", start_time: "14:00", end_time: "15:30", hours: null, rate_tier_id: "t1", note: "Revision" })).toEqual({
      date: "2026-09-04", start_time: "14:00", end_time: "15:30", hours: null, rate_tier_id: "t1", note: "Revision",
    })
  })
})

describe("sortEntries", () => {
  it("orders by date then start time, nulls last", () => {
    const list = [
      entry({ id: "c", date: "2026-09-05" }),
      entry({ id: "b", date: "2026-09-04", start_time: "16:00" }),
      entry({ id: "a", date: "2026-09-04", start_time: "09:00" }),
      entry({ id: "d", date: "2026-09-04" }),
    ]
    expect(sortEntries(list).map((e) => e.id)).toEqual(["a", "b", "d", "c"])
  })
})

describe("mappers", () => {
  it("maps a PostgREST queue row, coercing numerics and keeping only submitted entries", () => {
    const s = mapQueueRow({
      id: "s1", assignment_id: "a1", year: 2026, month: 9, submitted_at: "2026-09-05T00:00:00Z",
      tm_assignments: { code: "AA01", subject: "English", tm_students: { name: "Sam" } },
      tm_tutors: { name: "Tina" },
      tm_timesheet_entries: [
        { id: "e1", assignment_id: "a1", date: "2026-09-04", start_time: "14:00:00", end_time: "15:30:00", hours: "1.50", rate_tier_id: "t1", tier_label: "1 to 1", parent_rate: "70.00", tutor_rate: "50.00", note: null, status: "submitted",
          tm_entry_edits: [{ id: "x1", edited_at: "2026-09-06T00:00:00Z", previous: { hours: 1 } }] },
        { id: "e0", assignment_id: "a1", date: "2026-08-04", start_time: null, end_time: null, hours: "1.00", rate_tier_id: "t1", tier_label: "1 to 1", parent_rate: "70.00", tutor_rate: "50.00", note: null, status: "returned", tm_entry_edits: [] },
      ],
    })
    expect(s).toMatchObject({ code: "AA01", subject: "English", studentName: "Sam", tutorName: "Tina" })
    expect(s.entries).toHaveLength(1)
    expect(s.entries[0]).toMatchObject({ id: "e1", start_time: "14:00", end_time: "15:30", hours: 1.5, parent_rate: 70, tutor_rate: 50 })
    expect(s.entries[0].edits[0]).toEqual({ id: "x1", edited_at: "2026-09-06T00:00:00Z", previous: { hours: 1 } })
  })
  it("maps a returned row and tolerates missing embeds", () => {
    expect(mapReturnedRow({ id: "s2", assignment_id: "a1", year: 2026, month: 8, reviewed_at: null, return_reason: "Check", tm_assignments: null, tm_tutors: null })).toEqual({
      id: "s2", assignment_id: "a1", code: "", subject: "", studentName: "", tutorName: "", year: 2026, month: 8, reviewed_at: null, return_reason: "Check",
    })
  })
})
