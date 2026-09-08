"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency } from "@/lib/format"
import { periodLabel } from "@/lib/tm/periods"
import { formatHours } from "@/lib/portal/timesheet"
import { invoiceLines } from "@/lib/tm/approvals"
import { manualLine, type InvoiceEntry, type InvoiceLine, type InvoiceRow } from "@/lib/tm/invoices"
import { loadInvoiceEntries } from "./invoice-data"
import { InvoiceActionButtons, type InvoiceActionHandlers } from "./invoice-actions"

interface Props {
  row: InvoiceRow
  handlers: InvoiceActionHandlers
  onChanged: () => void
  backHref: string
}

function entryAmount(e: InvoiceEntry): number {
  return invoiceLines([e])[0]?.total ?? 0
}

export function InvoiceDetail({ row, handlers, onChanged, backHref }: Props) {
  const { toast } = useToast()
  const [entries, setEntries] = useState<InvoiceEntry[] | null>(null)
  const [remarks, setRemarks] = useState(row.remarks ?? "")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    setEntries(null)
    loadInvoiceEntries(row)
      .then((list) => { if (active) setEntries(list) })
      .catch((e: Error) => {
        toast({ title: "Could not load sessions", description: e.message, variant: "destructive" })
        if (active) setEntries([])
      })
    return () => { active = false }
  }, [row.id, row.source, toast])

  useEffect(() => { setRemarks(row.remarks ?? "") }, [row.id, row.remarks])

  async function saveRemarks() {
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from("tm_invoices").update({ remarks: remarks.trim() || null }).eq("id", row.id)
    setSaving(false)
    if (error) {
      toast({ title: "Could not save remarks", description: error.message, variant: "destructive" })
      return
    }
    toast({ title: "Remarks saved" })
    onChanged()
  }

  const month = periodLabel({ year: row.year, month: row.month })
  const lines: InvoiceLine[] = row.source === "generated" && entries
    ? invoiceLines(entries).map((l) => ({ description: `${row.studentName} ${row.subject} (${l.tierLabel})`, hours: l.hours, rate: l.rate, total: l.total }))
    : row.source === "manual" ? [manualLine(row)] : []

  return (
    <div className="space-y-4">
      <Link href={backHref} className="text-sm text-primary underline">Back to invoices</Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            {row.invoice_number ?? "Invoice"}
            <Badge variant={row.source === "generated" ? "secondary" : "outline"}>{row.source === "generated" ? "Generated" : "Manual"}</Badge>
          </CardTitle>
          <CardDescription>
            {row.studentName}{row.parentName ? ` (parent: ${row.parentName})` : ""} · {row.code} · {row.subject} · {month} · {row.tutorName}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {row.source === "generated" && (
            entries === null ? <Skeleton className="h-32 w-full" /> : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead className="text-right">Parent rate</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>{e.date}</TableCell>
                        <TableCell>{e.start_time && e.end_time ? `${e.start_time} to ${e.end_time}` : ""}</TableCell>
                        <TableCell className="text-right">{formatHours(e.hours)}</TableCell>
                        <TableCell>{e.tier_label}</TableCell>
                        <TableCell className="text-right">{formatCurrency(e.parent_rate)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(entryAmount(e))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )
          )}

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((l, i) => (
                  <TableRow key={i}>
                    <TableCell>{l.description}</TableCell>
                    <TableCell className="text-right">{l.hours === null ? "" : formatHours(l.hours)}</TableCell>
                    <TableCell className="text-right">{l.rate === null ? "" : formatCurrency(l.rate)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(l.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <p className="text-sm font-medium" data-testid="invoice-total">Total {formatCurrency(row.invoice_amount)} · Tutor payout {formatCurrency(row.tutor_payout)} · Profit {formatCurrency(row.profit)}</p>

          <div className="space-y-2">
            <Label htmlFor="invoice-remarks">Remarks</Label>
            <Textarea id="invoice-remarks" rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            <Button size="sm" variant="outline" onClick={saveRemarks} disabled={saving}>{saving ? "Saving..." : "Save remarks"}</Button>
          </div>

          <InvoiceActionButtons row={row} handlers={handlers} />
        </CardContent>
      </Card>
    </div>
  )
}
