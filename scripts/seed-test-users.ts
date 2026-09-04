import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
const host = new URL(url).hostname
if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(host)) throw new Error("Refusing to seed test users against a non-local Supabase URL")

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

async function ensureUser(email: string, password: string, fullName: string): Promise<string> {
  const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const existing = list?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
  if (existing) return existing.id
  const { data, error } = await supabase.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name: fullName },
  })
  if (error) throw error
  return data.user.id
}

async function main() {
  const env = (k: string) => {
    const v = process.env[k]
    if (!v) throw new Error(`${k} must be set in .env.local`)
    return v
  }

  const adminId = await ensureUser(env("E2E_ADMIN_EMAIL"), env("E2E_ADMIN_PASSWORD"), "E2E Admin")
  const tutorId = await ensureUser(env("E2E_TUTOR_EMAIL"), env("E2E_TUTOR_PASSWORD"), "E2E Tutor")
  await ensureUser(env("E2E_PENDING_EMAIL"), env("E2E_PENDING_PASSWORD"), "E2E Pending")

  // Promote the tutor and link a tm_tutors row
  await supabase.from("profiles").update({ role: "tutor" }).eq("id", tutorId)
  const { data: tutorRow } = await supabase.from("tm_tutors").select("id").eq("profile_id", tutorId).maybeSingle()
  if (!tutorRow) {
    const { error } = await supabase.from("tm_tutors").insert({ name: "E2E Tutor", profile_id: tutorId })
    if (error) throw error
  }

  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", adminId).single()
  if (adminProfile?.role !== "admin") throw new Error(`Admin user has role ${adminProfile?.role}; E2E_ADMIN_EMAIL must be in admin_emails`)

  console.log("Test users ready: admin, tutor (linked), pending")
}

main().catch((e) => { console.error(e); process.exit(1) })
