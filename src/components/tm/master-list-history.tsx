"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableFooter, TableHeader, TableRow } from "@/components/ui/table"
import { Download } from "lucide-react"
import { SortableHeader } from "./sortable-header"
import { formatCurrency } from "@/lib/format"
import {
  buildHistoryRows, filterHistoryRows, historyRowsToCsv, historyTotals, sortRows,
  type AssignmentSource, type HistoryRow, type SortDir,
} from "@/lib/tm/master-list"
import { parseMonthInput, toMonthInput, type Period } from "@/lib/tm/periods"
import type { TmInvoice } from "@/lib/tm/types"

interface Props {
  sources: AssignmentSource[]
  invoices: TmInvoice[]
  onDownload: (filename: string, csv: string) => void
}

type Key = keyof HistoryRow

export function MasterListHistory({ sources, invoices, onDownload }: Props) {
  const [from, setFrom] = useState<Period | null>(null)
  const [to, setTo] = useState<Period | null>(null)
  const [tutorName, setTutorName] = useState("all")
  const [studentName, setStudentName] = useState("all")
  const [sortKey, setSortKey] = useState<Key | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  const tutorNames = useMemo(() => Array.from(new Set(sources.map((s) => s.tutor?.name).filter(Boolean) as string[])).sort(), [sources])
  const studentNames = useMemo(() => Array.from(new Set(sources.map((s) => s.student?.name).filter(Boolean) as string[])).sort(), [sources])

  const rows = useMemo(() => {
    const built = buildHistoryRows(invoices, sources)
    const filtered = filterHistoryRows(built, { from, to, tutorName, studentName })
    return sortKey ? sortRows(filtered, sortKey, sortDir) : filtered
  }, [invoices, sources, from, to, tutorName, studentName, sortKey, sortDir])

  const totals = useMemo(() => historyTotals(rows), [rows])

  function onSort(column: Key) {
    if (sortKey === column) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else { setSortKey(column); setSortDir("asc") }
  }

  const head = (column: Key, label: string, align: "left" | "right" = "left") => (
    <SortableHeader column={column} label={label} sortKey={sortKey} sortDir={sortDir} onSort={onSort} align={align} />
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="mh-from">From</Label>
          <Input id="mh-from" type="month" className="w-[160px]" value={from ? toMonthInput(from) : ""} onChange={(e) => setFrom(parseMonthInput(e.target.value))} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="mh-to">To</Label>
          <Input id="mh-to" type="month" className="w-[160px]" value={to ? toMonthInput(to) : ""} onChange={(e) => setTo(parseMonthInput(e.target.value))} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="mh-tutor">Tutor</Label>
          <Select value={tutorName} onValueChange={setTutorName}>
            <SelectTrigger id="mh-tutor" className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tutors</SelectItem>
              {tutorNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="mh-student">Student</Label>
          <Select value={studentName} onValueChange={setStudentName}>
            <SelectTrigger id="mh-student" className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All students</SelectItem>
              {studentNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={() => onDownload("master-list-history.csv", historyRowsToCsv(rows))}>
            <Download className="mr-2 h-4 w-4" />Export CSV
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">{rows.length} invoice{rows.length === 1 ? "" : "s"}.</p>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {head("periodKey", "Month")}
              {head("code", "Code")}
              {head("tutorName", "Tutor")}
              {head("studentName", "Student")}
              {head("subject", "Subject")}
              {head("hours", "Hours", "right")}
              {head("invoiceAmount", "Invoice amount", "right")}
              {head("tutorPay", "Tutor pay", "right")}
              {head("profit", "Profit", "right")}
              {head("parentPaidAt", "Parent paid")}
              {head("tutorPaidAt", "Tutor paid")}
              {head("source", "Source")}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={12} className="text-center py-8 text-muted-foreground">No invoices match.</TableCell></TableRow>
            ) : rows.map((r) => (
              <TableRow key={r.invoiceId}>
                <TableCell className="whitespace-nowrap">{r.periodLabel}</TableCell>
                <TableCell className="font-mono text-xs">{r.code}</TableCell>
                <TableCell className="whitespace-nowrap">{r.tutorName}</TableCell>
                <TableCell className="whitespace-nowrap">{r.studentName}</TableCell>
                <TableCell>{r.subject}</TableCell>
                <TableCell className="text-right">{r.hours ?? "—"}</TableCell>
                <TableCell className="text-right">{formatCurrency(r.invoiceAmount)}</TableCell>
                <TableCell className="text-right">{formatCurrency(r.tutorPay)}</TableCell>
                <TableCell className="text-right">{formatCurrency(r.profit)}</TableCell>
                <TableCell>{r.parentPaidAt ? <Badge variant="secondary">✓ {r.parentPaidAt}</Badge> : <Badge variant="outline">Unpaid</Badge>}</TableCell>
                <TableCell>{r.tutorPaidAt ? <Badge variant="secondary">✓ {r.tutorPaidAt}</Badge> : <Badge variant="outline">Unpaid</Badge>}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.source}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          {rows.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={5} className="font-semibold">Totals</TableCell>
                <TableCell className="text-right font-semibold">{totals.hours.toFixed(2)}</TableCell>
                <TableCell className="text-right font-semibold">{formatCurrency(totals.invoiceAmount)}</TableCell>
                <TableCell className="text-right font-semibold">{formatCurrency(totals.tutorPay)}</TableCell>
                <TableCell className="text-right font-semibold">{formatCurrency(totals.profit)}</TableCell>
                <TableCell colSpan={3} />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </div>
  )
}
