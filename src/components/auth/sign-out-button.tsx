"use client"

import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

export function SignOutButton({ label = "Sign out" }: { label?: string }) {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-2">
      <LogOut className="h-4 w-4" />
      {label}
    </Button>
  )
}
