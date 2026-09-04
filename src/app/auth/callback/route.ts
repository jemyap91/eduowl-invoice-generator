import { NextResponse, type NextRequest } from "next/server"
import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { homeFor, type Role } from "@/lib/auth/routing"
import { WORKSPACE_COOKIE, isWorkspace } from "@/lib/workspace"

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  if (!code) return NextResponse.redirect(`${origin}/login?error=missing_code`)

  const pendingCookies: { name: string; value: string; options: CookieOptions }[] = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          pendingCookies.push(...cookiesToSet)
        },
      },
    }
  )

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error || !data.user) return NextResponse.redirect(`${origin}/login?error=auth`)

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle()
  const role = (profile?.role as Role | undefined) ?? "pending"

  const cookieWorkspace = request.cookies.get(WORKSPACE_COOKIE)?.value
  const workspace = isWorkspace(cookieWorkspace) ? cookieWorkspace : undefined

  const response = NextResponse.redirect(`${origin}${homeFor(role, workspace)}`)
  pendingCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
  return response
}
