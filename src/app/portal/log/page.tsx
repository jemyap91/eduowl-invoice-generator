"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { SessionForm } from "@/components/portal/session-form"
import { usePortalContext } from "@/components/portal/use-portal-context"
import type { SessionPayload } from "@/lib/portal/sessions"

function LogSession() {
  const { loading, error, tutor, assignments } = usePortalContext()
  const params = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)

  async function handleSubmit(payload: SessionPayload) {
    if (!tutor) return
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from("tm_timesheet_entries").insert({
      ...payload,
      tutor_id: tutor.id,
      status: "draft",
      // Placeholders: the tm_snapshot_entry_rates trigger overwrites these from the chosen tier.
      tier_label: "",
      parent_rate: 0,
      tutor_rate: 0,
    })
    setSaving(false)
    if (error) {
      toast({ title: "Could not save the session", description: error.message, variant: "destructive" })
      return
    }
    toast({ title: "Session logged" })
    router.push(`/portal/timesheet?month=${payload.date.slice(0, 7)}`)
  }

  if (loading) return <Skeleton className="h-96 w-full" />
  if (error) return <Card><CardContent className="py-6 text-sm text-destructive">{error}</CardContent></Card>

  return (
    <Card>
      <CardHeader>
        <CardTitle>Log a Session</CardTitle>
        <CardDescription>Record one tutoring session. It stays a draft until you submit the month.</CardDescription>
      </CardHeader>
      <CardContent>
        {assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground">You have no active students to log against.</p>
        ) : (
          <SessionForm
            assignments={assignments}
            defaultAssignmentId={params.get("assignment") ?? undefined}
            onSubmit={handleSubmit}
            isLoading={saving}
          />
        )}
      </CardContent>
    </Card>
  )
}

export default function LogSessionPage() {
  return (
    <Suspense>
      <LogSession />
    </Suspense>
  )
}
