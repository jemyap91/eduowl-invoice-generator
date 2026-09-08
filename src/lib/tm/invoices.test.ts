import { describe, it, expect } from "vitest"
import {
  defaultFilter, filterFromParams, filterToParams, filterInvoices, invoiceTotals, manualLine, invoiceFileName,
  mapInvoiceRow, mapInvoiceEntry, type InvoiceRow,
} from "./invoices"

const NOW = new Date(2026, 8, 8)

function row(over: Partial<InvoiceRow>): InvoiceRow {
  return {
    id: "i", invoice_number: "TM-202609-001", assignment_id: "a", year: 2026, month: 9, source: "generated",
    total_hours: 3.5, invoice_amount: 245, tutor_payout: 175, profit: 70, parent_paid_at: null, tutor_paid_at: null, remarks: null,
    code: "AA01", subject: "English", studentName: "Sam", parentName: "Pat", parentPhone: null, address: null, tutorName: "Tina",
    ...over,
  }
}

describe("filter codec", () => {
  it("defaults to the current month and everything else any/all", () => {
    expect(defaultFilter(NOW)).toEqual({ month: { year: 2026, month: 9 }, tutorName: "all", studentName: "all", parentPaid: "any", tutorPaid: "any", source: "any" })
    expect(filterFromParams(new URLSearchParams(""), NOW)).toEqual(defaultFilter(NOW))
  })
  it("reads every key and ignores junk", () => {
    const f = filterFromParams(new URLSearchParams("month=all&tutor=Tina&student=Sam&parent_paid=unpaid&tutor_paid=paid&source=manual&invoice=x"), NOW)
    expect(f).toEqual({ month: "all", tutorName: "Tina", studentName: "Sam", parentPaid: "unpaid", tutorPaid: "paid", source: "manual" })
    expect(filterFromParams(new URLSearchParams("month=2026-13&parent_paid=maybe&source=x"), NOW)).toEqual(defaultFilter(NOW))
  })
  it("round-trips through params", () => {
    const f = { month: { year: 2026, month: 2 }, tutorName: "Tina", studentName: "all", parentPaid: "paid" as const, tutorPaid: "any" as const, source: "generated" as const }
    expect(filterToParams(f).toString()).toBe("month=2026-02&tutor=Tina&parent_paid=paid&source=generated")
    expect(filterFromParams(filterToParams(f), NOW)).toEqual(f)
    expect(filterToParams({ ...defaultFilter(NOW), month: "all" }).toString()).toBe("month=all")
  })
})

describe("filterInvoices", () => {
  const rows = [
    row({ id: "1" }),
    row({ id: "2", month: 8, tutorName: "Zed", parent_paid_at: "2026-09-01" }),
    row({ id: "3", studentName: "Ali", source: "manual", tutor_paid_at: "2026-09-02" }),
  ]
  const ids = (f: Parameters<typeof filterInvoices>[1]) => filterInvoices(rows, f).map((r) => r.id)
  it("filters by month or all months", () => {
    expect(ids(defaultFilter(NOW))).toEqual(["1", "3"])
    expect(ids({ ...defaultFilter(NOW), month: "all" })).toEqual(["1", "2", "3"])
  })
  it("filters by tutor, student, paid state, and source", () => {
    expect(ids({ ...defaultFilter(NOW), month: "all", tutorName: "Zed" })).toEqual(["2"])
    expect(ids({ ...defaultFilter(NOW), studentName: "Ali" })).toEqual(["3"])
    expect(ids({ ...defaultFilter(NOW), month: "all", parentPaid: "paid" })).toEqual(["2"])
    expect(ids({ ...defaultFilter(NOW), month: "all", parentPaid: "unpaid" })).toEqual(["1", "3"])
    expect(ids({ ...defaultFilter(NOW), tutorPaid: "paid" })).toEqual(["3"])
    expect(ids({ ...defaultFilter(NOW), source: "manual" })).toEqual(["3"])
  })
})

describe("invoiceTotals", () => {
  it("sums in cents", () => {
    expect(invoiceTotals([row({ invoice_amount: 0.1, tutor_payout: 0.2, profit: -0.1, total_hours: 1.5 }), row({ invoice_amount: 0.2, tutor_payout: 0.1, profit: 0.1, total_hours: null })]))
      .toEqual({ count: 2, hours: 1.5, amount: 0.3, payout: 0.3, profit: 0 })
    expect(invoiceTotals([])).toEqual({ count: 0, hours: 0, amount: 0, payout: 0, profit: 0 })
  })
})

describe("manualLine and invoiceFileName", () => {
  it("describes a manual invoice as one line", () => {
    expect(manualLine(row({ source: "manual", total_hours: null, invoice_amount: 100 }))).toEqual({ description: "Sam English", hours: null, rate: null, total: 100 })
  })
  it("names the PDF after the student and month", () => {
    expect(invoiceFileName(row({}))).toBe("Sam Sep'26 Invoice.pdf")
    expect(invoiceFileName(row({ year: 2027, month: 1 }))).toBe("Sam Jan'27 Invoice.pdf")
  })
})

describe("mappers", () => {
  it("maps a PostgREST invoice row with nested embeds and numeric strings", () => {
    const r = mapInvoiceRow({
      id: "i", invoice_number: "TM-202609-001", assignment_id: "a", year: 2026, month: 9, source: "generated",
      total_hours: "3.50", invoice_amount: "245.00", tutor_payout: "175.00", profit: "70.00", parent_paid_at: null, tutor_paid_at: "2026-09-02", remarks: null,
      tm_assignments: { code: "AA01", subject: "English", tm_students: { name: "Sam", parent_name: "Pat", parent_phone: "9", address: "1 Road" }, tm_tutors: { name: "Tina" } },
    })
    expect(r).toMatchObject({ total_hours: 3.5, invoice_amount: 245, tutor_payout: 175, profit: 70, code: "AA01", studentName: "Sam", parentName: "Pat", parentPhone: "9", address: "1 Road", tutorName: "Tina" })
    expect(mapInvoiceRow({ id: "i", invoice_number: null, assignment_id: "a", year: 2026, month: 9, source: "manual", total_hours: null, invoice_amount: "1", tutor_payout: "0", profit: "1", parent_paid_at: null, tutor_paid_at: null, remarks: "r", tm_assignments: null }))
      .toMatchObject({ total_hours: null, code: "", studentName: "", parentName: null, tutorName: "" })
  })
  it("maps an entry row", () => {
    expect(mapInvoiceEntry({ id: "e", date: "2026-09-04", start_time: "14:00:00", end_time: "15:30:00", hours: "1.50", tier_label: "1 to 1", parent_rate: "70.00", tutor_rate: "50.00", note: null }))
      .toEqual({ id: "e", date: "2026-09-04", start_time: "14:00", end_time: "15:30", hours: 1.5, tier_label: "1 to 1", parent_rate: 70, tutor_rate: 50, note: null })
  })
})
