"use client"

import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"
import Image from "next/image"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

function GoogleMark() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5c-.3 1.5-1.1 2.8-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1C3.3 21.3 7.3 24 12 24z" />
      <path fill="#FBBC05" d="M5.3 14.3c-.5-1.5-.5-3.1 0-4.6V6.6H1.3c-1.7 3.4-1.7 7.4 0 10.8l4-3.1z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4C17.9 1.2 15.2 0 12 0 7.3 0 3.3 2.7 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" />
    </svg>
  )
}

function LoginForm() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const params = useSearchParams()
  const callbackError = params.get("error")

  async function signInWithGoogle() {
    setLoading(true)
    setError("")
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <Image src="/academy/logo.png" alt="EduOwl" width={200} height={113} priority />
          </div>
          <div>
            <CardTitle className="text-xl">EduOwl</CardTitle>
            <CardDescription>Sign in with your Google account</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={signInWithGoogle} className="w-full gap-2" disabled={loading} variant="outline">
            <GoogleMark />
            {loading ? "Redirecting..." : "Continue with Google"}
          </Button>
          {(error || callbackError) && (
            <p className="text-sm text-destructive text-center">
              {error || "Sign-in did not complete. Please try again."}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// useSearchParams needs a Suspense boundary in Next 14 for static rendering.
export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
