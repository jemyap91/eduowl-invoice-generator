"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus } from "lucide-react"
import { formatCurrency } from "@/lib/format"
import { usePortalContext } from "./use-portal-context"

export function AssignmentCards() {
  const { loading, error, assignments } = usePortalContext()

  if (loading) return <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-28 w-full" />)}</div>
  if (error) return <Card><CardContent className="py-6 text-sm text-destructive">{error}</CardContent></Card>
  if (assignments.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>My Students</CardTitle><CardDescription>You have no active students yet.</CardDescription></CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {assignments.map((a) => (
        <Card key={a.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{a.studentName}</CardTitle>
            <CardDescription>
              {a.subject}
              {a.timeslot ? ` · ${a.timeslot}` : ""}
              <span className="ml-2 font-mono text-xs">{a.code}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-3">
            <ul className="text-sm text-muted-foreground">
              {a.tiers.map((t) => (
                <li key={t.id}>{t.label}: {formatCurrency(t.tutor_rate)}/hr</li>
              ))}
              {a.tiers.length === 0 && <li>No rates set yet</li>}
            </ul>
            <Button asChild size="sm">
              <Link href={`/portal/log?assignment=${a.id}`}><Plus className="mr-1 h-4 w-4" />Log session</Link>
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
