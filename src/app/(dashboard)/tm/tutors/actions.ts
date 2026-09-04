"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Delete a pending signup's auth user. Only admins may call it, and only
 * profiles still in the `pending` role can be rejected.
 */
export async function rejectSignup(profileId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not signed in" }

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
  if (me?.role !== "admin") return { error: "Only admins can reject signups" }

  const admin = createAdminClient()
  const { data: target, error: lookupError } = await admin
    .from("profiles")
    .select("role")
    .eq("id", profileId)
    .maybeSingle()
  if (lookupError) return { error: lookupError.message }
  if (!target) return { error: "Signup not found" }
  if (target.role !== "pending") return { error: "Only pending signups can be rejected" }

  const { error } = await admin.auth.admin.deleteUser(profileId)
  if (error) return { error: error.message }
  return {}
}
