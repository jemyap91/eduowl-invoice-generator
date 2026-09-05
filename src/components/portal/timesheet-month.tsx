"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { Pencil, Trash2, Send } from "lucide-react"
import { formatCurrency } from "@/lib/format"
import { toNumber } from "@/lib/tm/types"
import { parseMonthInput, periodLabel, toMonthInput, type Period } from "@/lib/tm/periods"
import { monthBounds, type SessionPayload } from "@/lib/portal/sessions"
import {
  canSubmit, entryPayout, formatHours, groupByAssignment, isEditable, submissionState, sumEntries,
  type PortalEntry, type SubmissionState,
} from "@/lib/portal/timesheet"
import { SessionForm } from "./session-form"
import { usePortalContext, type PortalAssignment } from "./use-portal-context"

interface Props {
  period: Period
  onPeriodChange: (p: Period) => void
}

type Submission = { id: string; assignment_id: string; status: string; return_reason: string | null }

export function TimesheetMonth({ period, onPeriodChange }: Props) {
  const ctx = usePortalContext()
  const { toast } = useToast()
  const [entries, setEntries] = useState<PortalEntry[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<PortalEntry | null>(null)
  const [deleting, setDeleting] = useState<PortalEntry | null>(null)
  const [submitting, setSubmitting] = useState<PortalAssignment | null>(null)
  const [busy, setBusy] = useState(false)
  const [extraLabels, setExtraLabels] = useState<Map<string, string>>(new Map())

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { from, to } = monthBounds(period)
    const [entriesRes, subsRes] = await Promise.all([
      supabase.from("tm_timesheet_entries_tutor_view").select("*").gte("date", from).lte("date", to).order("date"),
      supabase.from("tm_submissions").select("id, assignment_id, status, return_reason").eq("year", period.year).eq("month", period.month).order("created_at", { ascending: false }),
    ])
    if (entriesRes.error || subsRes.error) {
      toast({ title: "Error", description: "Could not load your timesheet", variant: "destructive" })
      setLoading(false)
      return
    }
    const entriesRows: PortalEntry[] = (entriesRes.data ?? []).flatMap((r) => (r.id && r.assignment_id && r.date && r.status ? [{
      id: r.id,
      assignment_id: r.assignment_id,
      date: r.date,
      start_time: r.start_time ? r.start_time.slice(0, 5) : null,
      end_time: r.end_time ? r.end_time.slice(0, 5) : null,
      hours: toNumber(r.hours) ?? 0,
      rate_tier_id: r.rate_tier_id,
      tier_label: r.tier_label ?? "",
      tutor_rate: toNumber(r.tutor_rate) ?? 0,
      note: r.note,
      status: r.status as PortalEntry["status"],
      submission_id: r.submission_id,
    }] : []))
    setEntries(entriesRows)
    setSubmissions(subsRes.data ?? [])
    const known = new Set(ctx.assignments.map((a) => a.id))
    const missing = Array.from(new Set(entriesRows.map((e) => e.assignment_id))).filter((id) => !known.has(id))
    if (missing.length > 0) {
      const { data: extra } = await supabase
        .from("tm_assignments")
        .select("id, subject, tm_students(name)")
        .in("id", missing)
      const labels = new Map<string, string>()
      for (const row of extra ?? []) {
        const student = (row.tm_students as { name: string } | null)?.name ?? ""
        labels.set(row.id, `${student ? `${student} · ` : ""}${row.subject}`)
      }
      setExtraLabels(labels)
    } else {
      setExtraLabels(new Map())
    }
    setLoading(false)
  }, [period, toast, ctx.assignments])

  useEffect(() => { load() }, [load])

  const groups = useMemo(() => groupByAssignment(entries), [entries])

  // The live submission per assignment: the newest non-returned one, else the newest returned one.
  function stateFor(assignmentId: string): SubmissionState {
    const mine = submissions.filter((s) => s.assignment_id === assignmentId)
    const live = mine.find((s) => s.status !== "returned") ?? mine[0] ?? null
    return submissionState(live)
  }

  async function handleEdit(payload: SessionPayload) {
    if (!editing) return
    setBusy(true)
    const supabase = createClient()
    const { error } = await supabase
      .from("tm_timesheet_entries")
      .update({ date: payload.date, start_time: payload.start_time, end_time: payload.end_time, hours: payload.hours, rate_tier_id: payload.rate_tier_id, note: payload.note })
      .eq("id", editing.id)
    setBusy(false)
    if (error) {
      toast({ title: "Could not save", description: error.message, variant: "destructive" })
      return
    }
    setEditing(null)
    toast({ title: "Session updated" })
    load()
  }

  async function handleDelete() {
    if (!deleting) return
    setBusy(true)
    const supabase = createClient()
    const { error } = await supabase.from("tm_timesheet_entries").delete().eq("id", deleting.id)
    setBusy(false)
    if (error) {
      toast({ title: "Could not delete", description: error.message, variant: "destructive" })
      return
    }
    setDeleting(null)
    toast({ title: "Session deleted" })
    load()
  }

  async function handleSubmit() {
    if (!submitting) return
    setBusy(true)
    const supabase = createClient()
    const { error } = await supabase.rpc("tm_submit_month", { p_assignment_id: submitting.id, p_year: period.year, p_month: period.month })
    setBusy(false)
    if (error) {
      toast({ title: "Could not submit", description: error.message, variant: "destructive" })
      return
    }
    setSubmitting(null)
    toast({ title: "Submitted", description: `${periodLabel(period)} for ${submitting.studentName} is waiting for approval.` })
    load()
  }

  if (ctx.loading || loading) return <Skeleton className="h-96 w-full" />
  if (ctx.error) return <Card><CardContent className="py-6 text-sm text-destructive">{ctx.error}</CardContent></Card>

  // Show every active assignment, plus any assignment that has entries this month (e.g. now paused).
  const assignmentIds = Array.from(new Set([...ctx.assignments.map((a) => a.id), ...groups.keys()]))
  const byId = new Map(ctx.assignments.map((a) => [a.id, a]))

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="timesheet-month">Month</Label>
          <Input id="timesheet-month" type="month" className="w-[170px]" value={toMonthInput(period)} onChange={(e) => { const p = parseMonthInput(e.target.value); if (p) onPeriodChange(p) }} />
        </div>
      </div>

      {assignmentIds.length === 0 && (
        <Card><CardContent className="py-6 text-sm text-muted-foreground">No students and no sessions for {periodLabel(period)}.</CardContent></Card>
      )}

      {assignmentIds.map((id) => {
        const a = byId.get(id)
        const list = groups.get(id) ?? []
        const state = stateFor(id)
        const totals = sumEntries(list)
        const submitCheck = canSubmit(list, state)
        const editable = isEditable(state)
        const title = a ? `${a.studentName} · ${a.subject}` : extraLabels.get(id) ?? "Assignment"
        return (
          <Card key={id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{title}</CardTitle>
                  <CardDescription>{periodLabel(period)}</CardDescription>
                </div>
                <StatusBadge state={state} />
              </div>
              {state.kind === "returned" && (
                <p className="text-sm text-destructive">Returned: {state.reason || "no reason given"}</p>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {list.length === 0 ? (
                <p className="text-sm text-muted-foreground">No sessions logged.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Tier</TableHead>
                        <TableHead className="text-right">Hours</TableHead>
                        <TableHead className="text-right">Pay</TableHead>
                        <TableHead>Note</TableHead>
                        <TableHead className="w-[80px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {list.map((e) => {
                        const rowEditable = editable && (e.status === "draft" || e.status === "returned")
                        return (
                          <TableRow key={e.id}>
                            <TableCell className="whitespace-nowrap">{e.date}{e.start_time && e.end_time ? <span className="block text-xs text-muted-foreground">{e.start_time}–{e.end_time}</span> : null}</TableCell>
                            <TableCell>{e.rate_tier_id ? e.tier_label : <Badge variant="destructive">Choose a tier</Badge>}</TableCell>
                            <TableCell className="text-right">{formatHours(e.hours)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(entryPayout(e))}</TableCell>
                            <TableCell className="max-w-[160px] truncate" title={e.note ?? ""}>{e.note || "—"}</TableCell>
                            <TableCell>
                              {rowEditable && (
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="icon" aria-label={`Edit session on ${e.date}`} onClick={() => setEditing(e)}><Pencil className="h-4 w-4" /></Button>
                                  <Button variant="ghost" size="icon" aria-label={`Delete session on ${e.date}`} onClick={() => setDeleting(e)}><Trash2 className="h-4 w-4" /></Button>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
              <div className="flex items-center justify-between">
                <p className="text-sm"><span className="text-muted-foreground">Total:</span> {formatHours(totals.hours)} h · {formatCurrency(totals.payout)}</p>
                {a && editable && (
                  <Button size="sm" disabled={!submitCheck.ok} title={submitCheck.ok ? undefined : submitCheck.reason} onClick={() => setSubmitting(a)}>
                    <Send className="mr-2 h-4 w-4" />{state.kind === "returned" ? "Resubmit" : "Submit for approval"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit session</DialogTitle>
            <DialogDescription>Changing the times recalculates the hours.</DialogDescription>
          </DialogHeader>
          {editing && (
            <SessionForm
              key={editing.id}
              assignments={ctx.assignments}
              lockAssignment
              initial={{
                assignmentId: editing.assignment_id,
                date: editing.date,
                start: editing.start_time ?? "",
                end: editing.end_time ?? "",
                hours: editing.start_time ? "" : String(editing.hours),
                rateTierId: editing.rate_tier_id ?? "",
                note: editing.note ?? "",
              }}
              onSubmit={handleEdit}
              onCancel={() => setEditing(null)}
              submitLabel="Save changes"
              isLoading={busy}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete session</DialogTitle>
            <DialogDescription>Remove the session on {deleting?.date}? This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={busy}>{busy ? "Deleting..." : "Delete"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={submitting !== null} onOpenChange={(o) => !o && setSubmitting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit {periodLabel(period)}?</DialogTitle>
            <DialogDescription>
              {submitting ? `${submitting.studentName} · ${submitting.subject}. ` : ""}
              Your sessions for this month will be locked while EduOwl reviews them. If anything needs changing, they can send it back to you.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitting(null)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={busy}>{busy ? "Submitting..." : "Submit"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StatusBadge({ state }: { state: SubmissionState }) {
  if (state.kind === "submitted") return <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">Submitted, waiting for approval</Badge>
  if (state.kind === "approved") return <Badge className="bg-green-100 text-green-900 hover:bg-green-100">Approved</Badge>
  if (state.kind === "returned") return <Badge variant="destructive">Returned</Badge>
  return <Badge variant="outline">Not submitted</Badge>
}
