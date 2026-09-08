import { MONTH_NAMES, formatCurrency } from "@/lib/format"
import type { Period } from "@/lib/tm/periods"
import type { RateLine } from "@/lib/tm/approvals"

export interface WhatsappInput {
  parentName: string | null
  studentName: string
  subject: string
  period: Period
  totalHours: number | null
  lines: RateLine[]
  invoiceAmount: number
  paymentDetails: string
}

/** The parent-facing message from the spec, one Rate line per tier used. */
export function whatsappText(i: WhatsappInput): string {
  const out: string[] = [
    `Hi ${i.parentName || "there"}, here's ${i.studentName}'s tuition invoice for ${MONTH_NAMES[i.period.month - 1]} ${i.period.year}:`,
    "",
    `Subject: ${i.subject}`,
  ]
  if (i.totalHours !== null) out.push(`Sessions: ${i.totalHours.toFixed(2)} hrs total`)
  for (const l of i.lines) out.push(`Rate: ${formatCurrency(l.rate)}/hr (${l.tierLabel})`)
  out.push(`Amount due: ${formatCurrency(i.invoiceAmount)}`, "", `Payment details: ${i.paymentDetails}`, "", "Thank you! — EduOwl Tutor Matching")
  return out.join("\n")
}
