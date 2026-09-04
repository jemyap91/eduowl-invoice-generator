"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table"
import { Download, Check, Minus } from "lucide-react"
import { SortableHeader } from "./sortable-header"
import { formatCurrency } from "@/lib/format"
import { ASSIGNMENT_STATUS_LABELS, DEPOSIT_STATUS_LABELS, type TmAssignmentStatus } from "@/lib/tm/types"
import {
  assignmentRowsToCsv, buildAssignmentRows, filterAssignmentRows, sortRows,
  type AssignmentRow, type AssignmentSource, type SortDir,
} from "@/lib/tm/master-list"
import { parseMonthInput, periodLabel, toMonthInput, type Period } from "@/lib/tm/periods"
import type { TmInvoice } from "@/lib/tm/types"

interface Props {
  sources: AssignmentSource[]
  invoices: TmInvoice[]
  period: Period
  onPeriodChange: (p: Period) => void
  onDownload: (filename: string, csv: string) => void
}

type Key = keyof AssignmentRow

function Flag({ value }: { value: boolean }) {
  return value ? <Check className="h-4 w-4 text-primary" aria-label="Yes" /> : <Minus className="h-4 w-4 text-muted-foreground" aria-label="No" />
}

function Paid({ value }: { value: boolean | null }) {
  if (value === null) return <span className="text-muted-foreground">—</span>
  return <Badge variant={value ? "secondary" : "outline"}>{value ? "Paid" : "Unpaid"}</Badge>
}

function money(v: number | null): string {
  return v === null ? "—" : formatCurrency(v)
}

export function MasterListAssignments({ sources, invoices, period, onPeriodChange, onDownload }: Props) {
  const [status, setStatus] = useState<TmAssignmentStatus | "all">("all")
  const [tutorName, setTutorName] = useState<string>("all")
  const [sortKey, setSortKey] = useState<Key | null>("code")
  const [sortDir, setSortDir] = useState<SortDir>("asc")

  const tutorNames = useMemo(() => Array.from(new Set(sources.map((s) => s.tutor?.name).filter(Boolean) as string[])).sort(), [sources])
  const rows = useMemo(() => {
    const built = buildAssignmentRows(sources, invoices, period)
    const filtered = filterAssignmentRows(built, { status, tutorName })
    return sortKey ? sortRows(filtered, sortKey, sortDir) : filtered
  }, [sources, invoices, period, status, tutorName, sortKey, sortDir])

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
          <Label htmlFor="ml-month">Month</Label>
          <Input id="ml-month" type="month" className="w-[160px]" value={toMonthInput(period)} onChange={(e) => { const p = parseMonthInput(e.target.value); if (p) onPeriodChange(p) }} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ml-status">Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as TmAssignmentStatus | "all")}>
            <SelectTrigger id="ml-status" className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {(Object.keys(ASSIGNMENT_STATUS_LABELS) as TmAssignmentStatus[]).map((s) => (
                <SelectItem key={s} value={s}>{ASSIGNMENT_STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="ml-tutor">Tutor</Label>
          <Select value={tutorName} onValueChange={setTutorName}>
            <SelectTrigger id="ml-tutor" className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tutors</SelectItem>
              {tutorNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={() => onDownload(`master-list-assignments-${toMonthInput(period)}.csv`, assignmentRowsToCsv(rows, period))}>
            <Download className="mr-2 h-4 w-4" />Export CSV
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">{rows.length} assignment{rows.length === 1 ? "" : "s"}. Month columns show {periodLabel(period)}.</p>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {head("code", "Code")}
              {head("tutorName", "Tutor")}
              {head("tutorPhone", "Phone")}
              {head("studentName", "Student")}
              {head("parentName", "Parent")}
              {head("subject", "Subject")}
              {head("address", "Address")}
              {head("timeslot", "Timeslot")}
              {head("depositAmount", "Deposit", "right")}
              {head("parentRates", "Parent rates")}
              {head("tutorRates", "Tutor rates")}
              {head("curriculumBriefed", "Briefed")}
              {head("groupChatCreated", "Chat")}
              {head("postTrialCheckinDone", "Trial ✓")}
              {head("monthlyEstProfit", "Est. profit", "right")}
              {head("status", "Status")}
              {head("remarks", "Remarks")}
              {head("additionalMaterials", "Materials")}
              {head("invoiceAmount", `${periodLabel(period)} invoice`, "right")}
              {head("tutorPay", "Tutor pay", "right")}
              {head("profit", "Profit", "right")}
              {head("parentPaid", "Parent paid")}
              {head("tutorPaid", "Tutor paid")}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={23} className="text-center py-8 text-muted-foreground">No assignments match.</TableCell></TableRow>
            ) : rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.code}</TableCell>
                <TableCell className="whitespace-nowrap">{r.tutorName}</TableCell>
                <TableCell className="whitespace-nowrap">{r.tutorPhone || "—"}</TableCell>
                <TableCell className="whitespace-nowrap">{r.studentName}</TableCell>
                <TableCell className="whitespace-nowrap">{r.parentName || "—"}</TableCell>
                <TableCell>{r.subject}</TableCell>
                <TableCell className="max-w-[200px] truncate" title={r.address}>{r.address || "—"}</TableCell>
                <TableCell>{r.timeslot || "—"}</TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {r.depositAmount === null ? "—" : `${formatCurrency(r.depositAmount)} ${r.depositStatus === "collected" ? "✓" : `(${DEPOSIT_STATUS_LABELS[r.depositStatus]})`}`}
                </TableCell>
                <TableCell className="text-xs whitespace-nowrap">{r.parentRates || "—"}</TableCell>
                <TableCell className="text-xs whitespace-nowrap">{r.tutorRates || "—"}</TableCell>
                <TableCell><Flag value={r.curriculumBriefed} /></TableCell>
                <TableCell><Flag value={r.groupChatCreated} /></TableCell>
                <TableCell><Flag value={r.postTrialCheckinDone} /></TableCell>
                <TableCell className="text-right">{money(r.monthlyEstProfit)}</TableCell>
                <TableCell><Badge variant={r.status === "active" ? "secondary" : "outline"}>{ASSIGNMENT_STATUS_LABELS[r.status]}</Badge></TableCell>
                <TableCell className="max-w-[200px] truncate" title={r.remarks}>{r.remarks || "—"}</TableCell>
                <TableCell className="max-w-[160px] truncate" title={r.additionalMaterials}>{r.additionalMaterials || "—"}</TableCell>
                <TableCell className="text-right">{money(r.invoiceAmount)}</TableCell>
                <TableCell className="text-right">{money(r.tutorPay)}</TableCell>
                <TableCell className="text-right">{money(r.profit)}</TableCell>
                <TableCell><Paid value={r.parentPaid} /></TableCell>
                <TableCell><Paid value={r.tutorPaid} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
