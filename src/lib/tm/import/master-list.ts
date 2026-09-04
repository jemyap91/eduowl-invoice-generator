import { parseCsv } from "./csv"
import { parseMoney } from "./money"
import { buildRateTiers, type RateTier } from "./rates"
import { parseMonthHeaders } from "./months"

export interface ImportedInvoice {
  year: number
  month: number
  invoice_amount: number
  tutor_payout: number
}

export interface ImportedAssignment {
  code: string
  tutor_name: string
  tutor_phone: string | null
  student_name: string
  parent_name: string | null
  subject: string
  address: string | null
  timeslot: string | null
  deposit_amount: number | null
  deposit_status: "none" | "collected"
  rate_tiers: RateTier[]
  curriculum_briefed: boolean
  group_chat_created: boolean
  post_trial_checkin_done: boolean
  monthly_est_profit: number | null
  remarks: string | null
  additional_materials: string | null
  status: "active" | "stopped"
  invoices: ImportedInvoice[]
}

export interface ParseResult {
  assignments: ImportedAssignment[]
  warnings: string[]
}

const COL = {
  code: 0, tutor: 1, phone: 2, student: 3, parent: 4, subject: 5, address: 6, timeslot: 7,
  timesheet: 8, deposit: 9, parentRate: 10, tutorRate: 11, briefed: 12, chat: 13, trial: 14,
  estProfit: 15, remarks: 16, materials: 17, firstMonth: 18,
} as const

function text(cell: string | undefined): string | null {
  const t = (cell ?? "").trim()
  return t.length ? t : null
}

function flag(cell: string | undefined): boolean {
  const t = (cell ?? "").trim().toLowerCase()
  return t.length > 0 && !["n", "no", "-", "x"].includes(t)
}

const COLLECTS_DIRECTLY = /collect/i

/**
 * Parse the master list CSV. `codeOverrides` maps "CODE:Student name" to a
 * replacement code, for rows whose code collides with an earlier row.
 */
export function parseMasterList(csv: string, codeOverrides: Record<string, string> = {}): ParseResult {
  const rows = parseCsv(csv)
  const warnings: string[] = []
  if (rows.length < 3) return { assignments: [], warnings: ["CSV has fewer than 3 rows"] }

  const months = parseMonthHeaders(rows[0], COL.firstMonth)
  if (months.length === 0) warnings.push("No month columns found in the header row")

  const seen = new Set<string>()
  const assignments: ImportedAssignment[] = []

  for (let r = 2; r < rows.length; r++) {
    const row = rows[r]
    const rawCode = text(row[COL.code])
    if (!rawCode) continue

    const studentName = text(row[COL.student]) ?? ""
    let code = codeOverrides[`${rawCode}:${studentName}`] ?? rawCode
    if (code !== rawCode) warnings.push(`Row ${r + 1}: code ${rawCode} for ${studentName} renamed to ${code}`)
    if (seen.has(code)) {
      let n = 2
      while (seen.has(`${code}-${n}`)) n++
      const renamed = `${code}-${n}`
      warnings.push(`Row ${r + 1}: duplicate code ${code} for ${studentName} renamed to ${renamed}; add a codeOverride`)
      code = renamed
    }
    seen.add(code)

    const parentRateCell = row[COL.parentRate]
    const tutorRateCell = row[COL.tutorRate]
    const remarks = text(row[COL.remarks])
    const collectsDirectly =
      COLLECTS_DIRECTLY.test(parentRateCell ?? "") ||
      COLLECTS_DIRECTLY.test(row[COL.timesheet] ?? "") ||
      COLLECTS_DIRECTLY.test(remarks ?? "")

    const rateTiers = buildRateTiers(parentRateCell, tutorRateCell)
    if (rateTiers.length === 0) warnings.push(`Row ${r + 1}: ${code} has no rate tiers (parent cell: "${(parentRateCell ?? "").trim()}")`)
    if (rateTiers.some((t) => t.tutor_rate === 0) && rateTiers.length > 0) warnings.push(`Row ${r + 1}: ${code} has a tier with tutor rate 0`)

    const depositAmount = parseMoney(row[COL.deposit])

    const invoices: ImportedInvoice[] = []
    for (const m of months) {
      const amount = parseMoney(row[m.col])
      if (amount === null) continue
      const payout = parseMoney(row[m.col + 1]) ?? 0
      invoices.push({ year: m.year, month: m.month, invoice_amount: amount, tutor_payout: payout })
    }

    assignments.push({
      code,
      tutor_name: text(row[COL.tutor]) ?? "Unknown tutor",
      tutor_phone: text(row[COL.phone]),
      student_name: studentName || "Unknown student",
      parent_name: text(row[COL.parent]),
      subject: text(row[COL.subject]) ?? "Unknown subject",
      address: text(row[COL.address]),
      timeslot: text(row[COL.timeslot]),
      deposit_amount: depositAmount,
      deposit_status: depositAmount === null ? "none" : "collected",
      rate_tiers: rateTiers,
      curriculum_briefed: flag(row[COL.briefed]),
      group_chat_created: flag(row[COL.chat]),
      post_trial_checkin_done: flag(row[COL.trial]),
      monthly_est_profit: parseMoney(row[COL.estProfit]),
      remarks: collectsDirectly && !remarks ? "Tutor collected payment directly (legacy)" : remarks,
      additional_materials: text(row[COL.materials]),
      status: collectsDirectly ? "stopped" : "active",
      invoices,
    })
  }

  return { assignments, warnings }
}
