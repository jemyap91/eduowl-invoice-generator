import Image from "next/image"
import { createClient } from "@/lib/supabase/server"
import { PortalTabs } from "@/components/portal/portal-tabs"
import { SignOutButton } from "@/components/auth/sign-out-button"

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = user
    ? await supabase.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle()
    : { data: null }

  return (
    <div data-workspace="tm" className="min-h-screen flex flex-col bg-gray-50">
      <header className="h-14 shrink-0 flex items-center justify-between px-4 bg-white border-b">
        <div className="flex items-center gap-2">
          <Image src="/tm/logo.png" alt="EduOwl Tutor Matching" width={36} height={36} />
          <span className="font-semibold">EduOwl Tutor Matching</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-sm text-muted-foreground">
            {profile?.full_name || profile?.email}
          </span>
          <SignOutButton label="" />
        </div>
      </header>
      <PortalTabs />
      <main className="flex-1 w-full max-w-3xl mx-auto p-4">{children}</main>
    </div>
  )
}
