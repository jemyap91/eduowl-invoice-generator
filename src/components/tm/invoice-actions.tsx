"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useToast } from "@/hooks/use-toast"
import { MoreHorizontal } from "lucide-react"
import { todayIso } from "@/lib/portal/sessions"
import { periodLabel } from "@/lib/tm/periods"
import type { InvoiceRow } from "@/lib/tm/invoices"

export type PaidWhich = "parent" | "tutor"

export interface InvoiceActionHandlers {
  onCopy: (row: InvoiceRow) => void
  onDownload: (row: InvoiceRow) => void
  onPaid: (row: InvoiceRow, which: PaidWhich) => void
  onDelete: (row: InvoiceRow) => void
}

function paidItemLabel(row: InvoiceRow, which: PaidWhich): string {
  const set = which === "parent" ? row.parent_paid_at : row.tutor_paid_at
  const noun = which === "parent" ? "parent" : "tutor"
  return set ? `Edit ${noun} paid date` : `Mark ${noun} paid`
}

function deleteBlocked(row: InvoiceRow): boolean {
  return row.parent_paid_at !== null || row.tutor_paid_at !== null
}

export function InvoiceMenu({ row, handlers }: { row: InvoiceRow; handlers: InvoiceActionHandlers }) {
  const blocked = deleteBlocked(row)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Actions for ${row.invoice_number ?? row.id}`}><MoreHorizontal className="h-4 w-4" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => handlers.onCopy(row)}>Copy WhatsApp text</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => handlers.onDownload(row)}>Download PDF</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => handlers.onPaid(row, "parent")}>{paidItemLabel(row, "parent")}</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => handlers.onPaid(row, "tutor")}>{paidItemLabel(row, "tutor")}</DropdownMenuItem>
        <DropdownMenuSeparator />
        {blocked ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div><DropdownMenuItem disabled aria-disabled="true">Delete</DropdownMenuItem></div>
              </TooltipTrigger>
              <TooltipContent>Clear the paid dates first</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <DropdownMenuItem className="text-destructive" onSelect={() => handlers.onDelete(row)}>Delete</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function InvoiceActionButtons({ row, handlers }: { row: InvoiceRow; handlers: InvoiceActionHandlers }) {
  const blocked = deleteBlocked(row)
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={() => handlers.onCopy(row)}>Copy WhatsApp text</Button>
      <Button variant="outline" size="sm" onClick={() => handlers.onDownload(row)}>Download PDF</Button>
      <Button variant="outline" size="sm" onClick={() => handlers.onPaid(row, "parent")}>{paidItemLabel(row, "parent")}</Button>
      <Button variant="outline" size="sm" onClick={() => handlers.onPaid(row, "tutor")}>{paidItemLabel(row, "tutor")}</Button>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span><Button variant="destructive" size="sm" disabled={blocked} onClick={() => handlers.onDelete(row)}>Delete</Button></span>
          </TooltipTrigger>
          {blocked && <TooltipContent>Clear the paid dates first</TooltipContent>}
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}

interface PaidDialogProps {
  target: { row: InvoiceRow; which: PaidWhich } | null
  onClose: () => void
  onSaved: () => void
}

export function PaidDialog({ target, onClose, onSaved }: PaidDialogProps) {
  const { toast } = useToast()
  const [date, setDate] = useState("")
  const [busy, setBusy] = useState(false)
  const current = target ? (target.which === "parent" ? target.row.parent_paid_at : target.row.tutor_paid_at) : null

  useEffect(() => { setDate(current ?? todayIso()) }, [target, current])

  async function save(value: string | null) {
    if (!target) return
    setBusy(true)
    const supabase = createClient()
    const column = target.which === "parent" ? "parent_paid_at" : "tutor_paid_at"
    const { error } = await supabase.from("tm_invoices").update({ [column]: value }).eq("id", target.row.id)
    setBusy(false)
    if (error) {
      toast({ title: "Could not save", description: error.message, variant: "destructive" })
      return
    }
    const noun = target.which === "parent" ? "Parent payment" : "Tutor payout"
    toast({ title: value ? `${noun} recorded` : `${noun} cleared` })
    onClose()
    onSaved()
  }

  return (
    <Dialog open={target !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{target?.which === "parent" ? "Parent payment" : "Tutor payout"}</DialogTitle>
          <DialogDescription>
            {target ? `${target.row.invoice_number ?? "Invoice"} · ${target.row.studentName} · ${periodLabel({ year: target.row.year, month: target.row.month })}` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="paid-date">Date paid</Label>
          <Input id="paid-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          {current && <Button variant="outline" onClick={() => save(null)} disabled={busy}>Clear</Button>}
          <Button onClick={() => save(date)} disabled={busy || !date}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface DeleteDialogProps {
  target: InvoiceRow | null
  onClose: () => void
  onDeleted: () => void
}

export function DeleteDialog({ target, onClose, onDeleted }: DeleteDialogProps) {
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)

  async function remove() {
    if (!target) return
    setBusy(true)
    const supabase = createClient()
    const { error } = await supabase.rpc("tm_delete_invoice", { p_invoice_id: target.id })
    setBusy(false)
    if (error) {
      toast({ title: "Could not delete", description: error.message, variant: "destructive" })
      return
    }
    toast({ title: "Invoice deleted" })
    onClose()
    onDeleted()
  }

  const month = target ? periodLabel({ year: target.year, month: target.month }) : ""
  return (
    <Dialog open={target !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete invoice {target?.invoice_number ?? ""}?</DialogTitle>
          <DialogDescription>
            {target?.source === "generated"
              ? `This re-opens ${month} for ${target.studentName} so it can be approved again.`
              : "This removes the manual invoice."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="destructive" onClick={remove} disabled={busy}>{busy ? "Deleting..." : "Delete"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
