"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { ApprovalQueue } from "@/components/tm/approval-queue"
import {
  mapQueueRow, mapReturnedRow, outstandingReturns,
  type QueueSubmission, type RawQueueRow, type RawReturnedRow, type ReturnedSubmission,
} from "@/lib/tm/approvals"

const QUEUE_SELECT =
  "id, assignment_id, year, month, submitted_at, " +
  "tm_assignments(code, subject, tm_students(name)), tm_tutors(name), " +
  "tm_timesheet_entries!submission_id(id, assignment_id, date, start_time, end_time, hours, rate_tier_id, tier_label, parent_rate, tutor_rate, note, status, tm_entry_edits(id, edited_at, previous))"

const RETURNED_SELECT =
  "id, assignment_id, year, month, reviewed_at, return_reason, tm_assignments(code, subject, tm_students(name)), tm_tutors(name)"

function Approvals() {
  const params = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()
  const [queue, setQueue] = useState<QueueSubmission[]>([])
  const [returned, setReturned] = useState<ReturnedSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const selectedId = params.get("submission")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const [queueRes, returnedRes] = await Promise.all([
      supabase.from("tm_submissions").select(QUEUE_SELECT).eq("status", "submitted").order("submitted_at"),
      supabase.from("tm_submissions").select(RETURNED_SELECT).eq("status", "returned").order("reviewed_at", { ascending: false }),
    ])
    if (queueRes.error || returnedRes.error) {
      const message = queueRes.error?.message ?? returnedRes.error?.message ?? "Could not load approvals"
      setError(message)
      toast({ title: "Could not load approvals", description: message, variant: "destructive" })
      setLoading(false)
      return
    }
    const queueRows = (queueRes.data as unknown as RawQueueRow[]).map(mapQueueRow)
    const returnedRows = (returnedRes.data as unknown as RawReturnedRow[]).map(mapReturnedRow)

    let live: { assignment_id: string; year: number; month: number }[] = []
    const assignmentIds = Array.from(new Set(returnedRows.map((r) => r.assignment_id)))
    if (assignmentIds.length > 0) {
      const { data } = await supabase
        .from("tm_submissions")
        .select("assignment_id, year, month")
        .neq("status", "returned")
        .in("assignment_id", assignmentIds)
      live = data ?? []
    }
    setQueue(queueRows)
    setReturned(outstandingReturns(returnedRows, live))
    setLoading(false)
  }, [toast])

  useEffect(() => { load() }, [load])

  if (loading) return <Skeleton className="h-96 w-full" />
  if (error) return <Card><CardContent className="py-6 text-sm text-destructive">{error}</CardContent></Card>

  if (selectedId) {
    const submission = queue.find((s) => s.id === selectedId)
    if (!submission) {
      return (
        <Card>
          <CardContent className="py-6 space-y-2 text-sm">
            <p>This submission is no longer waiting for approval</p>
            <Link href="/tm/approvals" className="text-primary underline">Back to queue</Link>
          </CardContent>
        </Card>
      )
    }
    // Task 5 replaces this with <SubmissionReview submission={submission} onChanged={load} onDone={() => router.push("/tm/approvals")} />
    return <Card><CardContent className="py-6 text-sm">{submission.code}</CardContent></Card>
  }

  return <ApprovalQueue queue={queue} returned={returned} onReview={(id) => router.push(`/tm/approvals?submission=${id}`)} />
}

export default function ApprovalsPage() {
  return (
    <Suspense>
      <Approvals />
    </Suspense>
  )
}
