import type { BrowserContext } from "@playwright/test"

const CHUNK = 3180

/**
 * Sign a browser context in without the Google UI: password grant against
 * Supabase Auth, then write the session cookie in the format @supabase/ssr expects.
 */
export async function signIn(context: BrowserContext, email: string, password: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) throw new Error(`sign-in failed for ${email}: ${res.status} ${await res.text()}`)
  const session = await res.json()

  const ref = new URL(url).hostname.split(".")[0]
  const name = `sb-${ref}-auth-token`
  const value = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url")

  const chunks: string[] = []
  for (let i = 0; i < value.length; i += CHUNK) chunks.push(value.slice(i, i + CHUNK))
  const cookies = chunks.length === 1
    ? [{ name, value: chunks[0] }]
    : chunks.map((v, i) => ({ name: `${name}.${i}`, value: v }))

  await context.addCookies(cookies.map((c) => ({ ...c, domain: "localhost", path: "/" })))
}

export const users = {
  admin: { email: process.env.E2E_ADMIN_EMAIL!, password: process.env.E2E_ADMIN_PASSWORD! },
  tutor: { email: process.env.E2E_TUTOR_EMAIL!, password: process.env.E2E_TUTOR_PASSWORD! },
  pending: { email: process.env.E2E_PENDING_EMAIL!, password: process.env.E2E_PENDING_PASSWORD! },
}
