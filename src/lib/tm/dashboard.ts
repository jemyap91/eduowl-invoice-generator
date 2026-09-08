import type { Period } from "@/lib/tm/periods"

export interface PendingSubmission {
  id: string
  code: string
  subject: string
  studentName: string
  tutorName: string
  year: number
  month: number
  submitted_at: string | null
}

export interface RawPendingRow {
  id: string
  year: number
  month: number
  submitted_at: string | null
  tm_assignments: { code: string; subject: string; tm_students: { name: string } | null } | null
  tm_tutors: { name: string } | null
}

export function mapPendingRow(r: RawPendingRow): PendingSubmission {
  return {
    id: r.id,
    code: r.tm_assignments?.code ?? "",
    subject: r.tm_assignments?.subject ?? "",
    studentName: r.tm_assignments?.tm_students?.name ?? "",
    tutorName: r.tm_tutors?.name ?? "",
    year: r.year,
    month: r.month,
    submitted_at: r.submitted_at,
  }
}

type InvoiceMoney = { year: number; month: number; invoice_amount: number; tutor_payout: number; profit: number; parent_paid_at: string | null; tutor_paid_at: string | null }

function cents(n: number): number {
  return Math.round(n * 100)
}

export interface MonthFigures {
  pending: number
  invoiced: number
  payouts: number
  profit: number
}

export function monthFigures(invoices: InvoiceMoney[], submissions: { year: number; month: number }[], period: Period): MonthFigures {
  const inMonth = invoices.filter((i) => i.year === period.year && i.month === period.month)
  const sum = (pick: (i: InvoiceMoney) => number) => inMonth.reduce((s, i) => s + cents(pick(i)), 0) / 100
  return {
    pending: submissions.filter((s) => s.year === period.year && s.month === period.month).length,
    invoiced: sum((i) => i.invoice_amount),
    payouts: sum((i) => i.tutor_payout),
    profit: sum((i) => i.profit),
  }
}

export interface Outstanding {
  parentCount: number
  parentSum: number
  tutorCount: number
  tutorSum: number
}

export function outstanding(invoices: InvoiceMoney[]): Outstanding {
  const parent = invoices.filter((i) => i.parent_paid_at === null)
  const tutor = invoices.filter((i) => i.tutor_paid_at === null)
  return {
    parentCount: parent.length,
    parentSum: parent.reduce((s, i) => s + cents(i.invoice_amount), 0) / 100,
    tutorCount: tutor.length,
    tutorSum: tutor.reduce((s, i) => s + cents(i.tutor_payout), 0) / 100,
  }
}

export function oldestPending(subs: PendingSubmission[], limit = 5): PendingSubmission[] {
  return [...subs].sort((a, b) => (a.submitted_at ?? "").localeCompare(b.submitted_at ?? "")).slice(0, limit)
}
