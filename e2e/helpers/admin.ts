import { createClient } from "@supabase/supabase-js"

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for e2e fixtures")
  const host = new URL(url).hostname
  if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(host)) {
    throw new Error("Refusing to run e2e fixtures against a non-local Supabase URL")
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function findUserByEmail(email: string) {
  const { data } = await adminClient().auth.admin.listUsers({ perPage: 1000 })
  return data?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null
}

/** Creates a confirmed Google-less user; the signup trigger makes it a pending profile. */
export async function createPendingUser(email: string, fullName: string) {
  const existing = await findUserByEmail(email)
  if (existing) await adminClient().auth.admin.deleteUser(existing.id)
  const { data, error } = await adminClient().auth.admin.createUser({
    email, password: "e2e-throwaway-password", email_confirm: true, user_metadata: { full_name: fullName },
  })
  if (error) throw error
  return data.user
}

export async function deleteUserByEmail(email: string) {
  const user = await findUserByEmail(email)
  if (user) await adminClient().auth.admin.deleteUser(user.id)
}

export async function deleteTutorByName(name: string) {
  await adminClient().from("tm_tutors").delete().eq("name", name)
}

export async function unlinkTutorByName(name: string) {
  await adminClient().from("tm_tutors").update({ profile_id: null }).eq("name", name)
}

export async function unlinkProfileByEmail(email: string) {
  const user = await findUserByEmail(email)
  if (user) await adminClient().from("tm_tutors").update({ profile_id: null }).eq("profile_id", user.id)
}

/** Deletes a student and its assignments (rate tiers cascade). */
export async function deleteStudentByName(name: string) {
  const admin = adminClient()
  const { data: students } = await admin.from("tm_students").select("id").eq("name", name)
  for (const s of students ?? []) {
    await admin.from("tm_assignments").delete().eq("student_id", s.id)
    await admin.from("tm_students").delete().eq("id", s.id)
  }
}

/** Creates a student, an active assignment for the named tutor, and one "1 to 1" tier (parent 70 / tutor 50). */
export async function createAssignmentForTutor(tutorName: string, studentName: string, code: string) {
  const admin = adminClient()
  const { data: tutor, error: tErr } = await admin.from("tm_tutors").select("id").eq("name", tutorName).maybeSingle()
  if (tErr || !tutor) throw new Error(`tutor ${tutorName} not found: ${tErr?.message ?? "no row"}`)
  const { data: student, error: sErr } = await admin.from("tm_students").insert({ name: studentName, parent_name: "E2E Parent" }).select("id").single()
  if (sErr) throw sErr
  const { data: assignment, error: aErr } = await admin
    .from("tm_assignments")
    .insert({ code, tutor_id: tutor.id, student_id: student.id, subject: "E2E Subject", status: "active" })
    .select("id").single()
  if (aErr) throw aErr
  const { error: rErr } = await admin.from("tm_rate_tiers").insert({ assignment_id: assignment.id, label: "1 to 1", parent_rate: 70, tutor_rate: 50, sort_order: 0 })
  if (rErr) throw rErr
  return { tutorId: tutor.id, studentId: student.id, assignmentId: assignment.id }
}

/** Removes submissions, entries, assignments, and the student created by createAssignmentForTutor. */
export async function deleteAssignmentData(studentName: string) {
  const admin = adminClient()
  const { data: students } = await admin.from("tm_students").select("id").eq("name", studentName)
  for (const s of students ?? []) {
    const { data: assignments } = await admin.from("tm_assignments").select("id").eq("student_id", s.id)
    for (const a of assignments ?? []) {
      await admin.from("tm_timesheet_entries").delete().eq("assignment_id", a.id)
      await admin.from("tm_submissions").delete().eq("assignment_id", a.id)
      await admin.from("tm_assignments").delete().eq("id", a.id)
    }
    await admin.from("tm_students").delete().eq("id", s.id)
  }
}
