export type TmTutorStatus = "active" | "inactive"
export type TmAssignmentStatus = "active" | "paused" | "stopping" | "stopped" | "moved_to_academy"
export type TmDepositStatus = "none" | "not_collected" | "collected"
export type TmInvoiceSource = "generated" | "manual"

export const ASSIGNMENT_STATUS_LABELS: Record<TmAssignmentStatus, string> = {
  active: "Active",
  paused: "Paused",
  stopping: "Stopping",
  stopped: "Stopped",
  moved_to_academy: "Moved to Academy",
}

export const DEPOSIT_STATUS_LABELS: Record<TmDepositStatus, string> = {
  none: "None",
  not_collected: "Not yet collected",
  collected: "Collected",
}

export const TUTOR_STATUS_LABELS: Record<TmTutorStatus, string> = {
  active: "Active",
  inactive: "Inactive",
}

export interface TmTutor {
  id: string
  profile_id: string | null
  name: string
  phone: string | null
  status: TmTutorStatus
  created_at: string
}

export interface TmStudent {
  id: string
  name: string
  parent_name: string | null
  parent_phone: string | null
  contact_preference: string | null
  address: string | null
  remarks: string | null
  created_at: string
}

export interface TmRateTier {
  id: string
  assignment_id: string
  label: string
  parent_rate: number
  tutor_rate: number
  sort_order: number
}

export interface TmAssignment {
  id: string
  code: string
  tutor_id: string
  student_id: string
  subject: string
  timeslot: string | null
  status: TmAssignmentStatus
  deposit_amount: number | null
  deposit_status: TmDepositStatus
  curriculum_briefed: boolean
  group_chat_created: boolean
  post_trial_checkin_done: boolean
  monthly_est_profit: number | null
  additional_materials: string | null
  remarks: string | null
  created_at: string
}

export interface TmInvoice {
  id: string
  invoice_number: string | null
  assignment_id: string
  year: number
  month: number
  source: TmInvoiceSource
  total_hours: number | null
  invoice_amount: number
  tutor_payout: number
  profit: number
  parent_paid_at: string | null
  tutor_paid_at: string | null
  remarks: string | null
}

export interface TmSettings {
  id: string
  company_name: string
  legal_name: string
  payment_terms: string
  paynow_uen: string
  qr_code_path: string
  payment_details: string
  default_rate_tiers: unknown
}

/** PostgREST returns numeric columns as strings; normalise before use. */
export function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null
  const n = typeof value === "number" ? value : parseFloat(value)
  return Number.isFinite(n) ? n : null
}
