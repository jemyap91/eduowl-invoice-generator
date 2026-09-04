import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"

export async function POST() {
  const email = process.env.BYPASS_EMAIL
  const password = process.env.BYPASS_PASS

  if (!email || !password) {
    return NextResponse.json(
      { error: "Demo login not configured" },
      { status: 503 }
    )
  }

  // Build a response we can attach cookies to
  const response = NextResponse.json({ success: true })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return []
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return NextResponse.json(
      { error: "Demo login failed" },
      { status: 401 }
    )
  }

  return response
}
