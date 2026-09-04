import { createClient } from "@supabase/supabase-js"

/**
 * Service-role client. Server-side only; bypasses RLS.
 * Only import this from files marked "use server" or from route handlers.
 * Never import it from a client component: the key would be bundled for the browser.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured")
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}
