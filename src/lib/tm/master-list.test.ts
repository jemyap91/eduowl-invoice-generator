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
