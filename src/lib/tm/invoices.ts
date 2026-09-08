import { currentPeriod, parseMonthInput, toMonthInput, type Period } from "@/lib/tm/periods"
import { MONTH_NAMES } from "@/lib/format"
import { toNumber, type TmInvoice, type TmInvoiceSource } from "@/lib/tm/types"

/** Select string for tm_invoices with the names the list, detail, WhatsApp, PDF, and dashboard need. */
export const INVOICE_SELECT =
  "*, tm_assignments(code, subject, tm_students(name, parent_name, parent_phone, address), tm_tutors(name))"

export interface InvoiceRow extends TmInvoice {
  code: string
  subject: string
  studentName: string
  parentName: string | null
  parentPhone: string | null
  address: string | null
  tutorName: string
}

export interface RawInvoiceRow {
  id: string
  invoice_number: string | null
  assignment_id: string
  year: number
  month: number
  source: string
  total_hours: string | number | null
  invoice_amount: string | number | null
  tutor_payout: string | number | null
  profit: string | number | null
  parent_paid_at: string | null
  tutor_paid_at: string | null
  remarks: string | null
  tm_assignments: {
    code: string
    subject: string
    tm_students: { name: string; parent_name: string | null; parent_phone: string | null; address: string | null } | null
    tm_tutors: { name: string } | null
  } | null
}

export function mapInvoiceRow(r: RawInvoiceRow): InvoiceRow {
  return {
    id: r.id,
    invoice_number: r.invoice_number,
    assignment_id: r.assignment_id,
    year: r.year,
    month: r.month,
    source: r.source as TmInvoiceSource,
    total_hours: toNumber(r.total_hours),
    invoice_amount: toNumber(r.invoice_amount) ?? 0,
    tutor_payout: toNumber(r.tutor_payout) ?? 0,
    profit: toNumber(r.profit) ?? 0,
    parent_paid_at: r.parent_paid_at,
    tutor_paid_at: r.tutor_paid_at,
    remarks: r.remarks,
    code: r.tm_assignments?.code ?? "",
    subject: r.tm_assignments?.subject ?? "",
    studentName: r.tm_assignments?.tm_students?.name ?? "",
    parentName: r.tm_assignments?.tm_students?.parent_name ?? null,
    parentPhone: r.tm_assignments?.tm_students?.parent_phone ?? null,
    address: r.tm_assignments?.tm_students?.address ?? null,
    tutorName: r.tm_assignments?.tm_tutors?.name ?? "",
  }
}

export interface InvoiceEntry {
  id: string
  date: string
  start_time: string | null
  end_time: string | null
  hours: number
  tier_label: string
  parent_rate: number
  tutor_rate: number
  note: string | null
}

export interface RawInvoiceEntryRow {
  id: string
  date: string
  start_time: string | null
  end_time: string | null
  hours: string | number | null
  tier_label: string | null
  parent_rate: string | number | null
  tutor_rate: string | number | null
  note: string | null
}

export function mapInvoiceEntry(r: RawInvoiceEntryRow): InvoiceEntry {
  return {
    id: r.id,
    date: r.date,
    start_time: r.start_time ? r.start_time.slice(0, 5) : null,
    end_time: r.end_time ? r.end_time.slice(0, 5) : null,
    hours: toNumber(r.hours) ?? 0,
    tier_label: r.tier_label ?? "",
    parent_rate: toNumber(r.parent_rate) ?? 0,
    tutor_rate: toNumber(r.tutor_rate) ?? 0,
    note: r.note,
  }
}

// ---- Filters, carried in the URL ----

export type PaidFilter = "any" | "paid" | "unpaid"
export type SourceFilter = "any" | TmInvoiceSource

export interface InvoiceFilter {
  month: Period | "all"
  tutorName: string
  studentName: string
  parentPaid: PaidFilter
  tutorPaid: PaidFilter
  source: SourceFilter
}

export function defaultFilter(now: Date = new Date()): InvoiceFilter {
  return { month: currentPeriod(now), tutorName: "all", studentName: "all", parentPaid: "any", tutorPaid: "any", source: "any" }
}

function paidFilter(v: string | null): PaidFilter {
  return v === "paid" || v === "unpaid" ? v : "any"
}

export function filterFromParams(params: URLSearchParams, now: Date = new Date()): InvoiceFilter {
  const d = defaultFilter(now)
  const m = params.get("month")
  const month: Period | "all" = m === "all" ? "all" : m ? parseMonthInput(m) ?? d.month : d.month
  const src = params.get("source")
  return {
    month,
    tutorName: params.get("tutor") || "all",
    studentName: params.get("student") || "all",
    parentPaid: paidFilter(params.get("parent_paid")),
    tutorPaid: paidFilter(params.get("tutor_paid")),
    source: src === "generated" || src === "manual" ? src : "any",
  }
}

/** Only non-default keys are written, except month, which is always explicit. */
export function filterToParams(f: InvoiceFilter): URLSearchParams {
  const p = new URLSearchParams()
  p.set("month", f.month === "all" ? "all" : toMonthInput(f.month))
  if (f.tutorName !== "all") p.set("tutor", f.tutorName)
  if (f.studentName !== "all") p.set("student", f.studentName)
  if (f.parentPaid !== "any") p.set("parent_paid", f.parentPaid)
  if (f.tutorPaid !== "any") p.set("tutor_paid", f.tutorPaid)
  if (f.source !== "any") p.set("source", f.source)
  return p
}

function paidMatches(value: string | null, f: PaidFilter): boolean {
  return f === "any" || (f === "paid" ? value !== null : value === null)
}

export function filterInvoices(rows: InvoiceRow[], f: InvoiceFilter): InvoiceRow[] {
  return rows.filter((r) =>
    (f.month === "all" || (r.year === f.month.year && r.month === f.month.month)) &&
    (f.tutorName === "all" || r.tutorName === f.tutorName) &&
    (f.studentName === "all" || r.studentName === f.studentName) &&
    paidMatches(r.parent_paid_at, f.parentPaid) &&
    paidMatches(r.tutor_paid_at, f.tutorPaid) &&
    (f.source === "any" || r.source === f.source),
  )
}

// ---- Totals and lines ----

function cents(n: number): number {
  return Math.round(n * 100)
}

export interface InvoiceTotals {
  count: number
  hours: number
  amount: number
  payout: number
  profit: number
}

export function invoiceTotals(rows: InvoiceRow[]): InvoiceTotals {
  let hours = 0, amount = 0, payout = 0, profit = 0
  for (const r of rows) {
    hours += cents(r.total_hours ?? 0)
    amount += cents(r.invoice_amount)
    payout += cents(r.tutor_payout)
    profit += cents(r.profit)
  }
  return { count: rows.length, hours: hours / 100, amount: amount / 100, payout: payout / 100, profit: profit / 100 }
}

export interface InvoiceLine {
  description: string
  hours: number | null
  rate: number | null
  total: number
}

export function manualLine(row: InvoiceRow): InvoiceLine {
  return { description: `${row.studentName} ${row.subject}`.trim(), hours: row.total_hours, rate: null, total: row.invoice_amount }
}

export function invoiceFileName(row: InvoiceRow): string {
  return `${row.studentName} ${MONTH_NAMES[row.month - 1].slice(0, 3)}'${String(row.year).slice(-2)} Invoice.pdf`
}
