"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatCurrency } from "@/lib/format"
import { periodLabel } from "@/lib/tm/periods"
import { formatHours } from "@/lib/portal/timesheet"
import { invoiceTotals, type InvoiceRow } from "@/lib/tm/invoices"

interface Props {
  rows: InvoiceRow[]
  detailHref: (id: string) => string
  renderActions?: (row: InvoiceRow) => ReactNode
}

export function paidLabel(value: string | null): string {
  return value ?? "Unpaid"
}

export function InvoiceTable({ rows, detailHref, renderActions }: Props) {
  if (rows.length === 0) {
    return <Card><CardContent className="py-6 text-sm text-muted-foreground">No invoices match these filters.</CardContent></Card>
  }
  const t = invoiceTotals(rows)
  return (
    <div className="overflow-x-auto rounded-md border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice</TableHead>
            <TableHead>Month</TableHead>
            <TableHead>Code</TableHead>
            <TableHead>Tutor</TableHead>
            <TableHead>Student</TableHead>
            <TableHead>Subject</TableHead>
            <TableHead className="text-right">Hours</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-right">Payout</TableHead>
            <TableHead className="text-right">Profit</TableHead>
            <TableHead>Parent paid</TableHead>
            <TableHead>Tutor paid</TableHead>
            <TableHead>Source</TableHead>
            {renderActions && <TableHead />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">
                <Link href={detailHref(r.id)} className="text-primary underline">{r.invoice_number ?? "(no number)"}</Link>
              </TableCell>
              <TableCell>{periodLabel({ year: r.year, month: r.month })}</TableCell>
              <TableCell>{r.code}</TableCell>
              <TableCell>{r.tutorName}</TableCell>
              <TableCell>{r.studentName}</TableCell>
              <TableCell>{r.subject}</TableCell>
              <TableCell className="text-right">{r.total_hours === null ? "" : formatHours(r.total_hours)}</TableCell>
              <TableCell className="text-right">{formatCurrency(r.invoice_amount)}</TableCell>
              <TableCell className="text-right">{formatCurrency(r.tutor_payout)}</TableCell>
              <TableCell className="text-right">{formatCurrency(r.profit)}</TableCell>
              <TableCell>{paidLabel(r.parent_paid_at)}</TableCell>
              <TableCell>{paidLabel(r.tutor_paid_at)}</TableCell>
              <TableCell><Badge variant={r.source === "generated" ? "secondary" : "outline"}>{r.source === "generated" ? "Generated" : "Manual"}</Badge></TableCell>
              {renderActions && <TableCell className="text-right">{renderActions(r)}</TableCell>}
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={6}>{t.count} invoice{t.count === 1 ? "" : "s"}</TableCell>
            <TableCell className="text-right">{formatHours(t.hours)}</TableCell>
            <TableCell className="text-right">{formatCurrency(t.amount)}</TableCell>
            <TableCell className="text-right">{formatCurrency(t.payout)}</TableCell>
            <TableCell className="text-right">{formatCurrency(t.profit)}</TableCell>
            <TableCell colSpan={renderActions ? 4 : 3} />
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  )
}
