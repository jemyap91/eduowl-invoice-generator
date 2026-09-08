import { describe, it, expect } from "vitest"
import { monthFigures, outstanding, oldestPending, mapPendingRow, type PendingSubmission } from "./dashboard"

const inv = (over: { year?: number; month?: number; invoice_amount?: number; tutor_payout?: number; profit?: number; parent_paid_at?: string | null; tutor_paid_at?: string | null }) => ({
  year: 2026, month: 9, invoice_amount: 100, tutor_payout: 60, profit: 40, parent_paid_at: null, tutor_paid_at: null, ...over,
})
const sub = (over: Partial<PendingSubmission>): PendingSubmission => ({
  id: "s", code: "AA01", subject: "English", studentName: "Sam", tutorName: "Tina", year: 2026, month: 9, submitted_at: "2026-09-05T00:00:00Z", ...over,
})

describe("monthFigures", () => {
  it("sums the picked month only and counts its pending submissions", () => {
    const f = monthFigures([inv({}), inv({ invoice_amount: 0.1, tutor_payout: 0.2, profit: -0.1 }), inv({ month: 8, invoice_amount: 999 })], [sub({}), sub({ id: "t", month: 8 })], { year: 2026, month: 9 })
    expect(f).toEqual({ pending: 1, invoiced: 100.1, payouts: 60.2, profit: 39.9 })
  })
})

describe("outstanding", () => {
  it("counts and sums unpaid invoices across all months", () => {
    const o = outstanding([inv({}), inv({ month: 8, parent_paid_at: "2026-09-01" }), inv({ month: 7, tutor_paid_at: "2026-09-01", invoice_amount: 50, tutor_payout: 30 })])
    expect(o).toEqual({ parentCount: 2, parentSum: 150, tutorCount: 2, tutorSum: 120 })
  })
})

describe("oldestPending", () => {
  it("orders by submitted_at ascending and caps", () => {
    const list = oldestPending([sub({ id: "c", submitted_at: "2026-09-03T00:00:00Z" }), sub({ id: "a", submitted_at: "2026-09-01T00:00:00Z" }), sub({ id: "b", submitted_at: "2026-09-02T00:00:00Z" })], 2)
    expect(list.map((s) => s.id)).toEqual(["a", "b"])
  })
})

describe("mapPendingRow", () => {
  it("maps embeds and tolerates nulls", () => {
    expect(mapPendingRow({ id: "s", year: 2026, month: 9, submitted_at: null, tm_assignments: { code: "AA01", subject: "English", tm_students: { name: "Sam" } }, tm_tutors: { name: "Tina" } }))
      .toEqual({ id: "s", code: "AA01", subject: "English", studentName: "Sam", tutorName: "Tina", year: 2026, month: 9, submitted_at: null })
    expect(mapPendingRow({ id: "s", year: 2026, month: 9, submitted_at: null, tm_assignments: null, tm_tutors: null })).toMatchObject({ code: "", studentName: "", tutorName: "" })
  })
})
