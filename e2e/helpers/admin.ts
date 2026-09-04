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
