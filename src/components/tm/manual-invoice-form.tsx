"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { fetchAll } from "@/lib/supabase/fetch-all"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { currentPeriod, parseMonthInput, toMonthInput } from "@/lib/tm/periods"

const MONEY = /^\d+(\.\d{1,2})?$/
function parseMoney(value: string): number | null {
  const v = value.trim()
  return MONEY.test(v) ? Number(v) : null
}

interface AssignmentOption {
  id: string
  code: string
  subject: string
  status: string
  studentName: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}

export function ManualInvoiceDialog({ open, onOpenChange, onCreated }: Props) {
  const { toast } = useToast()
  const [assignments, setAssignments] = useState<AssignmentOption[]>([])
  const [assignmentId, setAssignmentId] = useState("")
  const [month, setMonth] = useState(toMonthInput(currentPeriod()))
  const [hours, setHours] = useState("")
  const [amount, setAmount] = useState("")
  const [payout, setPayout] = useState("")
  const [remarks, setRemarks] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setAssignmentId(""); setMonth(toMonthInput(currentPeriod())); setHours(""); setAmount(""); setPayout(""); setRemarks(""); setError("")
    const supabase = createClient()
    fetchAll(() => supabase.from("tm_assignments").select("id, code, subject, status, tm_students(name)").order("code")).then((res) => {
      if (res.error) {
        toast({ title: "Could not load assignments", description: res.error.message, variant: "destructive" })
        return
      }
      const rows = (res.data as unknown as { id: string; code: string; subject: string; status: string; tm_students: { name: string } | null }[])
        .map((r) => ({ id: r.id, code: r.code, subject: r.subject, status: r.status, studentName: r.tm_students?.name ?? "" }))
      rows.sort((a, b) => (a.status === "active" ? 0 : 1) - (b.status === "active" ? 0 : 1) || a.code.localeCompare(b.code))
      setAssignments(rows)
    })
  }, [open, toast])

  async function save() {
    setError("")
    const period = parseMonthInput(month)
    const amountN = parseMoney(amount)
    const payoutN = parseMoney(payout)
    const hoursN = hours.trim() === "" ? null : parseMoney(hours)
    if (!assignmentId) { setError("Choose an assignment."); return }
    if (!period) { setError("Enter the month."); return }
    if (amountN === null || amountN <= 0) { setError("Invoice amount must be more than 0, with up to two decimals."); return }
    if (payoutN === null || payoutN < 0) { setError("Tutor payout must be 0 or more, with up to two decimals."); return }
    if (hours.trim() !== "" && (hoursN === null || hoursN <= 0)) { setError("Hours must be more than 0, with up to two decimals, or blank."); return }

    setBusy(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from("tm_invoices")
      .insert({ assignment_id: assignmentId, year: period.year, month: period.month, source: "manual", total_hours: hoursN, invoice_amount: amountN, tutor_payout: payoutN, remarks: remarks.trim() || null })
      .select("invoice_number")
      .single()
    setBusy(false)
    if (error) {
      const message = error.code === "23505" ? "A manual invoice for this month already exists" : error.message
      toast({ title: "Could not create the invoice", description: message, variant: "destructive" })
      return
    }
    toast({ title: data.invoice_number ? `Invoice ${data.invoice_number} created.` : "Invoice created." })
    onOpenChange(false)
    onCreated()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New manual invoice</DialogTitle>
          <DialogDescription>For months without logged sessions, or adjustments. The number is assigned on save.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mi-assignment">Assignment</Label>
            <Select value={assignmentId} onValueChange={setAssignmentId}>
              <SelectTrigger id="mi-assignment"><SelectValue placeholder="Choose an assignment" /></SelectTrigger>
              <SelectContent>
                {assignments.map((a) => <SelectItem key={a.id} value={a.id}>{a.code} · {a.studentName} · {a.subject}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="mi-month">Month</Label>
            <Input id="mi-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="mi-hours">Hours</Label>
              <Input id="mi-hours" inputMode="decimal" placeholder="optional" value={hours} onChange={(e) => setHours(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mi-amount">Invoice amount</Label>
              <Input id="mi-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mi-payout">Tutor payout</Label>
              <Input id="mi-payout" inputMode="decimal" value={payout} onChange={(e) => setPayout(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="mi-remarks">Remarks</Label>
            <Textarea id="mi-remarks" rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Saving..." : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
