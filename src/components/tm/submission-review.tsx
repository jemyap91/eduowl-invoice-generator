"use client"

import { useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { Pencil } from "lucide-react"
import { formatCurrency } from "@/lib/format"
import { toNumber } from "@/lib/tm/types"
import { periodLabel } from "@/lib/tm/periods"
import { formatHours } from "@/lib/portal/timesheet"
import type { SessionPayload } from "@/lib/portal/sessions"
import { SessionForm } from "@/components/portal/session-form"
import type { PortalAssignment } from "@/components/portal/use-portal-context"
import {
  entryAmount, entryToSessionInput, patchFromPayload, summariseEntries, type ApprovalEntry, type QueueSubmission,
} from "@/lib/tm/approvals"
import { EntryEditsBadge } from "./entry-edits-popover"

interface Props {
  submission: QueueSubmission
  onChanged: () => void
  onDone: () => void
}

export function SubmissionReview({ submission, onChanged, onDone }: Props) {
  const { toast } = useToast()
  const [editing, setEditing] = useState<ApprovalEntry | null>(null)
  const [formAssignment, setFormAssignment] = useState<PortalAssignment | null>(null)
  const [returning, setReturning] = useState(false)
  const [reason, setReason] = useState("")
  const [approving, setApproving] = useState(false)
  const [busy, setBusy] = useState(false)

  const month = periodLabel({ year: submission.year, month: submission.month })
  const totals = summariseEntries(submission.entries)

  async function openEdit(entry: ApprovalEntry) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("tm_rate_tiers")
      .select("id, assignment_id, label, tutor_rate, sort_order")
      .eq("assignment_id", submission.assignment_id)
      .order("sort_order")
    if (error) {
      toast({ title: "Could not load rate tiers", description: error.message, variant: "destructive" })
      return
    }
    setFormAssignment({
      id: submission.assignment_id,
      code: submission.code,
      subject: submission.subject,
      timeslot: null,
      studentName: submission.studentName,
      tiers: (data ?? []).map((t) => ({ id: t.id, assignment_id: t.assignment_id, label: t.label, tutor_rate: toNumber(t.tutor_rate) ?? 0, sort_order: t.sort_order ?? 0 })),
    })
    setEditing(entry)
  }

  async function handleEdit(payload: SessionPayload) {
    if (!editing) return
    setBusy(true)
    const supabase = createClient()
    const { error } = await supabase.rpc("tm_edit_entry", { p_entry_id: editing.id, p_patch: patchFromPayload(payload) })
    setBusy(false)
    if (error) {
      toast({ title: "Could not update the session", description: error.message, variant: "destructive" })
      return
    }
    setEditing(null)
    toast({ title: "Session updated" })
    onChanged()
  }

  async function handleReturn() {
    setBusy(true)
    const supabase = createClient()
    const { error } = await supabase.rpc("tm_return_submission", { p_submission_id: submission.id, p_reason: reason })
    setBusy(false)
    if (error) {
      toast({ title: "Could not send back", description: error.message, variant: "destructive" })
      return
    }
    setReturning(false)
    toast({ title: `Sent back to ${submission.tutorName}` })
    onChanged()
    onDone()
  }

  async function handleApprove() {
    setBusy(true)
    const supabase = createClient()
    const { data: invoiceId, error } = await supabase.rpc("tm_approve_submission", { p_submission_id: submission.id })
    if (error || !invoiceId) {
      setBusy(false)
      toast({ title: "Could not approve", description: error?.message ?? "No invoice was returned", variant: "destructive" })
      return
    }
    const { data: invoice } = await supabase.from("tm_invoices").select("invoice_number").eq("id", invoiceId).maybeSingle()
    setBusy(false)
    setApproving(false)
    toast({ title: "Approved", description: invoice?.invoice_number ? `Invoice ${invoice.invoice_number} created.` : "Invoice created." })
    onChanged()
    onDone()
  }

  return (
    <div className="space-y-4">
      <Link href="/tm/approvals" className="text-sm text-primary underline">Back to queue</Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{submission.studentName} · {submission.subject} · {month}</CardTitle>
          <CardDescription>
            {submission.tutorName} · {submission.code}
            {submission.submitted_at ? ` · submitted ${submission.submitted_at.slice(0, 10)}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead className="text-right">Parent rate</TableHead>
                  <TableHead className="text-right">Tutor rate</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {submission.entries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{e.date}</TableCell>
                    <TableCell>{e.start_time && e.end_time ? `${e.start_time} to ${e.end_time}` : ""}</TableCell>
                    <TableCell className="text-right">{formatHours(e.hours)}</TableCell>
                    <TableCell>{e.tier_label}</TableCell>
                    <TableCell className="text-right">{formatCurrency(e.parent_rate)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(e.tutor_rate)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(entryAmount(e))}</TableCell>
                    <TableCell className="max-w-xs">
                      <div className="flex items-center gap-2">
                        <EntryEditsBadge edits={e.edits} />
                        <span className="truncate">{e.note}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" aria-label={`Edit session on ${e.date}`} onClick={() => openEdit(e)}><Pencil className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <p className="text-sm font-medium" data-testid="review-totals">
            {totals.sessions} sessions · {formatHours(totals.hours)} h · Invoice {formatCurrency(totals.amount)} · Payout {formatCurrency(totals.payout)} · Profit {formatCurrency(totals.profit)}
          </p>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setReason(""); setReturning(true) }}>Send back</Button>
            <Button onClick={() => setApproving(true)}>Approve</Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit session</DialogTitle>
            <DialogDescription>The previous values are kept in the edit history.</DialogDescription>
          </DialogHeader>
          {editing && formAssignment && (
            <SessionForm
              key={editing.id}
              assignments={[formAssignment]}
              initial={entryToSessionInput(editing)}
              lockAssignment
              onSubmit={handleEdit}
              onCancel={() => setEditing(null)}
              submitLabel="Save changes"
              isLoading={busy}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={returning} onOpenChange={(o) => !o && setReturning(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send back to {submission.tutorName}</DialogTitle>
            <DialogDescription>The tutor sees this reason in their timesheet and can edit and resubmit the month.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="return-reason">Reason</Label>
            <Textarea id="return-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} required />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturning(false)} disabled={busy}>Cancel</Button>
            <Button onClick={handleReturn} disabled={busy || reason.trim() === ""}>Send back</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={approving} onOpenChange={(o) => !o && setApproving(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve {submission.studentName}, {month}</DialogTitle>
            <DialogDescription>
              {totals.sessions} sessions, {formatHours(totals.hours)} hours. Invoice {formatCurrency(totals.amount)}, tutor payout {formatCurrency(totals.payout)}, profit {formatCurrency(totals.profit)}. An invoice is created and the month is locked.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproving(false)} disabled={busy}>Cancel</Button>
            <Button onClick={handleApprove} disabled={busy}>{busy ? "Approving..." : "Approve"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
