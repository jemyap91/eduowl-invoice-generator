import fs from "fs"
import path from "path"
import { createClient } from "@supabase/supabase-js"
import { parseMasterList, type ImportedAssignment } from "../src/lib/tm/import/master-list"

const DEFAULT_FILE = path.resolve(__dirname, "../docs/reference/Tutor Matching (Invoicing) - Demo New MasterList.csv")
const CODE_OVERRIDES: Record<string, string> = { "R01:Rayyan": "RY01" }

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function main() {
  const file = arg("--file") ?? DEFAULT_FILE
  const dryRun = process.argv.includes("--dry-run")

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (use node --env-file=.env.local)")

  const { assignments, warnings } = parseMasterList(fs.readFileSync(file, "utf8"), CODE_OVERRIDES)
  const invoiceCount = assignments.reduce((n, a) => n + a.invoices.length, 0)
  const tutorNames = new Set(assignments.map((a) => a.tutor_name))
  const studentKeys = new Set(assignments.map((a) => `${a.student_name}|${a.parent_name ?? ""}`))

  console.log(`Parsed ${assignments.length} assignments, ${tutorNames.size} tutors, ${studentKeys.size} students, ${invoiceCount} monthly invoices`)
  for (const w of warnings) console.log(`  warning: ${w}`)
  if (dryRun) {
    console.log("Dry run, nothing written.")
    return
  }

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

  // Tutors by name
  const tutorIds = new Map<string, string>()
  for (const name of tutorNames) {
    const phone = assignments.find((a) => a.tutor_name === name && a.tutor_phone)?.tutor_phone ?? null
    const { data: existing } = await supabase.from("tm_tutors").select("id").eq("name", name).maybeSingle()
    if (existing) {
      if (phone) await supabase.from("tm_tutors").update({ phone }).eq("id", existing.id)
      tutorIds.set(name, existing.id)
    } else {
      const { data, error } = await supabase.from("tm_tutors").insert({ name, phone }).select("id").single()
      if (error) throw error
      tutorIds.set(name, data.id)
    }
  }

  // Students by (name, parent_name)
  const studentIds = new Map<string, string>()
  for (const a of assignments) {
    const k = `${a.student_name}|${a.parent_name ?? ""}`
    if (studentIds.has(k)) continue
    let q = supabase.from("tm_students").select("id").eq("name", a.student_name)
    q = a.parent_name ? q.eq("parent_name", a.parent_name) : q.is("parent_name", null)
    const { data: existing } = await q.maybeSingle()
    const fields = { name: a.student_name, parent_name: a.parent_name, address: a.address }
    if (existing) {
      await supabase.from("tm_students").update(fields).eq("id", existing.id)
      studentIds.set(k, existing.id)
    } else {
      const { data, error } = await supabase.from("tm_students").insert(fields).select("id").single()
      if (error) throw error
      studentIds.set(k, data.id)
    }
  }

  // Assignments by code, then tiers and invoices
  let created = 0, updated = 0, invoicesWritten = 0
  for (const a of assignments) {
    const row = assignmentRow(a, tutorIds.get(a.tutor_name)!, studentIds.get(`${a.student_name}|${a.parent_name ?? ""}`)!)
    const { data: existing } = await supabase.from("tm_assignments").select("id").eq("code", a.code).maybeSingle()
    let assignmentId: string
    if (existing) {
      const { error } = await supabase.from("tm_assignments").update(row).eq("id", existing.id)
      if (error) throw error
      assignmentId = existing.id
      updated++
    } else {
      const { data, error } = await supabase.from("tm_assignments").insert(row).select("id").single()
      if (error) throw error
      assignmentId = data.id
      created++
    }

    await supabase.from("tm_rate_tiers").delete().eq("assignment_id", assignmentId)
    if (a.rate_tiers.length) {
      const { error } = await supabase.from("tm_rate_tiers").insert(a.rate_tiers.map((t) => ({ ...t, assignment_id: assignmentId })))
      if (error) throw error
    }

    if (a.invoices.length) {
      const { error } = await supabase.from("tm_invoices").upsert(
        a.invoices.map((inv) => ({
          assignment_id: assignmentId,
          year: inv.year,
          month: inv.month,
          source: "manual",
          invoice_amount: inv.invoice_amount,
          tutor_payout: inv.tutor_payout,
          remarks: "Imported from master list",
        })),
        { onConflict: "assignment_id,year,month,source" }
      )
      if (error) throw error
      invoicesWritten += a.invoices.length
    }
  }

  console.log(`Done. Assignments created: ${created}, updated: ${updated}. Invoices upserted: ${invoicesWritten}.`)
}

function assignmentRow(a: ImportedAssignment, tutorId: string, studentId: string) {
  return {
    code: a.code,
    tutor_id: tutorId,
    student_id: studentId,
    subject: a.subject,
    timeslot: a.timeslot,
    status: a.status,
    deposit_amount: a.deposit_amount,
    deposit_status: a.deposit_status,
    curriculum_briefed: a.curriculum_briefed,
    group_chat_created: a.group_chat_created,
    post_trial_checkin_done: a.post_trial_checkin_done,
    monthly_est_profit: a.monthly_est_profit,
    additional_materials: a.additional_materials,
    remarks: a.remarks,
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
