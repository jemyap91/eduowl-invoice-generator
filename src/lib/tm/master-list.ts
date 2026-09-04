import { comparePeriods, periodKey, periodLabel, type Period } from "./periods"
import { toCsv, type CsvCell } from "./csv-export"
import type { TmAssignment, TmAssignmentStatus, TmDepositStatus, TmInvoice, TmInvoiceSource, TmRateTier } from "./types"
import { ASSIGNMENT_STATUS_LABELS, DEPOSIT_STATUS_LABELS } from "./types"

export interface AssignmentSource {
  assignment: TmAssignment
  tutor: { id: string; name: string; phone: string | null } | null
  student: { id: string; name: string; parent_name: string | null; address: string | null } | null
  tiers: TmRateTier[]
}

export interface AssignmentRow {
  id: string
  code: string
  tutorName: string
  tutorPhone: string
  studentName: string
  parentName: string
  subject: string
  address: string
  timeslot: string
  depositAmount: number | null
  depositStatus: TmDepositStatus
  parentRates: string
  tutorRates: string
  curriculumBriefed: boolean
  groupChatCreated: boolean
  postTrialCheckinDone: boolean
  monthlyEstProfit: number | null
  status: TmAssignmentStatus
  remarks: string
  additionalMaterials: string
  invoiceAmount: number | null
  tutorPay: number | null
  profit: number | null
  parentPaid: boolean | null
  tutorPaid: boolean | null
}

export interface HistoryRow {
  invoiceId: string
  periodKey: string
  periodLabel: string
  year: number
  month: number
  code: string
  tutorName: string
  studentName: string
  subject: string
  hours: number | null
  invoiceAmount: number
  tutorPay: number
  profit: number
  parentPaidAt: string | null
  tutorPaidAt: string | null
  source: TmInvoiceSource
  invoiceNumber: string
}

export function formatRates(tiers: TmRateTier[], which: "parent" | "tutor"): string {
  return [...tiers]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((t) => `${t.label} $${which === "parent" ? t.parent_rate : t.tutor_rate}`)
    .join(" · ")
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function buildAssignmentRows(sources: AssignmentSource[], invoices: TmInvoice[], period: Period): AssignmentRow[] {
  const byAssignment = new Map<string, TmInvoice[]>()
  for (const inv of invoices) {
    if (inv.year !== period.year || inv.month !== period.month) continue
    const list = byAssignment.get(inv.assignment_id) || []
    list.push(inv)
    byAssignment.set(inv.assignment_id, list)
  }

  return sources
    .map(({ assignment: a, tutor, student, tiers }) => {
      const monthInvoices = byAssignment.get(a.id) || []
      const has = monthInvoices.length > 0
      return {
        id: a.id,
        code: a.code,
        tutorName: tutor?.name ?? "",
        tutorPhone: tutor?.phone ?? "",
        studentName: student?.name ?? "",
        parentName: student?.parent_name ?? "",
        subject: a.subject,
        address: student?.address ?? "",
        timeslot: a.timeslot ?? "",
        depositAmount: a.deposit_amount,
        depositStatus: a.deposit_status,
        parentRates: formatRates(tiers, "parent"),
        tutorRates: formatRates(tiers, "tutor"),
        curriculumBriefed: a.curriculum_briefed,
        groupChatCreated: a.group_chat_created,
        postTrialCheckinDone: a.post_trial_checkin_done,
        monthlyEstProfit: a.monthly_est_profit,
        status: a.status,
        remarks: a.remarks ?? "",
        additionalMaterials: a.additional_materials ?? "",
        invoiceAmount: has ? round2(monthInvoices.reduce((s, i) => s + i.invoice_amount, 0)) : null,
        tutorPay: has ? round2(monthInvoices.reduce((s, i) => s + i.tutor_payout, 0)) : null,
        profit: has ? round2(monthInvoices.reduce((s, i) => s + i.profit, 0)) : null,
        parentPaid: has ? monthInvoices.every((i) => i.parent_paid_at !== null) : null,
        tutorPaid: has ? monthInvoices.every((i) => i.tutor_paid_at !== null) : null,
      }
    })
    .sort((x, y) => x.code.localeCompare(y.code))
}

export function buildHistoryRows(invoices: TmInvoice[], sources: AssignmentSource[]): HistoryRow[] {
  const byId = new Map(sources.map((s) => [s.assignment.id, s]))
  return invoices
    .map((inv) => {
      const src = byId.get(inv.assignment_id)
      const period = { year: inv.year, month: inv.month }
      return {
        invoiceId: inv.id,
        periodKey: periodKey(period),
        periodLabel: periodLabel(period),
        year: inv.year,
        month: inv.month,
        code: src?.assignment.code ?? "",
        tutorName: src?.tutor?.name ?? "",
        studentName: src?.student?.name ?? "",
        subject: src?.assignment.subject ?? "",
        hours: inv.total_hours,
        invoiceAmount: inv.invoice_amount,
        tutorPay: inv.tutor_payout,
        profit: inv.profit,
        parentPaidAt: inv.parent_paid_at,
        tutorPaidAt: inv.tutor_paid_at,
        source: inv.source,
        invoiceNumber: inv.invoice_number ?? "",
      }
    })
    .sort((a, b) => {
      const byPeriod = comparePeriods({ year: b.year, month: b.month }, { year: a.year, month: a.month })
      if (byPeriod !== 0) return byPeriod
      const byCode = a.code.localeCompare(b.code)
      if (byCode !== 0) return byCode
      return a.source === "manual" ? -1 : b.source === "manual" ? 1 : 0
    })
}

export interface AssignmentFilter {
  status: TmAssignmentStatus | "all"
  tutorName: string | "all"
}

export function filterAssignmentRows(rows: AssignmentRow[], f: AssignmentFilter): AssignmentRow[] {
  return rows.filter((r) => (f.status === "all" || r.status === f.status) && (f.tutorName === "all" || r.tutorName === f.tutorName))
}

export interface HistoryFilter {
  from: Period | null
  to: Period | null
  tutorName: string | "all"
  studentName: string | "all"
}

export function filterHistoryRows(rows: HistoryRow[], f: HistoryFilter): HistoryRow[] {
  return rows.filter((r) => {
    const p = { year: r.year, month: r.month }
    if (f.from && comparePeriods(p, f.from) < 0) return false
    if (f.to && comparePeriods(p, f.to) > 0) return false
    if (f.tutorName !== "all" && r.tutorName !== f.tutorName) return false
    if (f.studentName !== "all" && r.studentName !== f.studentName) return false
    return true
  })
}

export type SortDir = "asc" | "desc"

export function sortRows<T extends object>(rows: T[], key: keyof T, dir: SortDir): T[] {
  const sign = dir === "asc" ? 1 : -1
  return [...rows].sort((a, b) => {
    const x = a[key] as unknown
    const y = b[key] as unknown
    if (x === null || x === undefined) return y === null || y === undefined ? 0 : 1
    if (y === null || y === undefined) return -1
    if (typeof x === "number" && typeof y === "number") return (x - y) * sign
    if (typeof x === "boolean" && typeof y === "boolean") return (Number(x) - Number(y)) * sign
    return String(x).localeCompare(String(y)) * sign
  })
}

export function historyTotals(rows: HistoryRow[]): { hours: number; invoiceAmount: number; tutorPay: number; profit: number } {
  return {
    hours: round2(rows.reduce((s, r) => s + (r.hours ?? 0), 0)),
    invoiceAmount: round2(rows.reduce((s, r) => s + r.invoiceAmount, 0)),
    tutorPay: round2(rows.reduce((s, r) => s + r.tutorPay, 0)),
    profit: round2(rows.reduce((s, r) => s + r.profit, 0)),
  }
}

function paidCell(v: boolean | null): CsvCell {
  return v === null ? "" : v ? "Paid" : "Unpaid"
}

export function assignmentRowsToCsv(rows: AssignmentRow[], period: Period): string {
  const m = periodLabel(period)
  const headers = [
    "Code", "Tutor", "Tutor phone", "Student", "Parent", "Subject", "Address", "Timeslot",
    "Deposit", "Deposit status", "Parent rates", "Tutor rates",
    "Curriculum briefed", "Group chat created", "Checked in after trial", "Monthly est. profit",
    "Status", "Remarks", "Additional materials",
    `${m} invoice`, `${m} tutor pay`, `${m} profit`, `${m} parent paid`, `${m} tutor paid`,
  ]
  return toCsv(headers, rows.map((r) => [
    r.code, r.tutorName, r.tutorPhone, r.studentName, r.parentName, r.subject, r.address, r.timeslot,
    r.depositAmount, DEPOSIT_STATUS_LABELS[r.depositStatus], r.parentRates, r.tutorRates,
    r.curriculumBriefed, r.groupChatCreated, r.postTrialCheckinDone, r.monthlyEstProfit,
    ASSIGNMENT_STATUS_LABELS[r.status], r.remarks, r.additionalMaterials,
    r.invoiceAmount, r.tutorPay, r.profit, paidCell(r.parentPaid), paidCell(r.tutorPaid),
  ]))
}

export function historyRowsToCsv(rows: HistoryRow[]): string {
  const headers = ["Month", "Code", "Tutor", "Student", "Subject", "Hours", "Invoice amount", "Tutor pay", "Profit", "Parent paid", "Tutor paid", "Source", "Invoice number"]
  return toCsv(headers, rows.map((r) => [
    r.periodLabel, r.code, r.tutorName, r.studentName, r.subject, r.hours, r.invoiceAmount, r.tutorPay, r.profit,
    r.parentPaidAt ?? "", r.tutorPaidAt ?? "", r.source, r.invoiceNumber,
  ]))
}
