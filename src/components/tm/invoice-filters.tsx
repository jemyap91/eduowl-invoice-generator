"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { currentPeriod, parseMonthInput, toMonthInput } from "@/lib/tm/periods"
import type { InvoiceFilter, PaidFilter, SourceFilter } from "@/lib/tm/invoices"

interface Props {
  filter: InvoiceFilter
  onChange: (f: InvoiceFilter) => void
  tutorNames: string[]
  studentNames: string[]
}

export function InvoiceFilters({ filter, onChange, tutorNames, studentNames }: Props) {
  const allMonths = filter.month === "all"
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label htmlFor="inv-month">Month</Label>
        <div className="flex gap-2">
          <Input
            id="inv-month" type="month" className="w-[160px]"
            value={filter.month === "all" ? "" : toMonthInput(filter.month)}
            onChange={(e) => { const p = parseMonthInput(e.target.value); if (p) onChange({ ...filter, month: p }) }}
          />
          <Button
            type="button" variant={allMonths ? "default" : "outline"} aria-pressed={allMonths}
            onClick={() => onChange({ ...filter, month: allMonths ? currentPeriod() : "all" })}
          >
            All months
          </Button>
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="inv-tutor">Tutor</Label>
        <Select value={filter.tutorName} onValueChange={(v) => onChange({ ...filter, tutorName: v })}>
          <SelectTrigger id="inv-tutor" className="w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tutors</SelectItem>
            {tutorNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="inv-student">Student</Label>
        <Select value={filter.studentName} onValueChange={(v) => onChange({ ...filter, studentName: v })}>
          <SelectTrigger id="inv-student" className="w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All students</SelectItem>
            {studentNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="inv-parent-paid">Parent paid</Label>
        <Select value={filter.parentPaid} onValueChange={(v) => onChange({ ...filter, parentPaid: v as PaidFilter })}>
          <SelectTrigger id="inv-parent-paid" className="w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="unpaid">Unpaid</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="inv-tutor-paid">Tutor paid</Label>
        <Select value={filter.tutorPaid} onValueChange={(v) => onChange({ ...filter, tutorPaid: v as PaidFilter })}>
          <SelectTrigger id="inv-tutor-paid" className="w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="unpaid">Unpaid</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="inv-source">Source</Label>
        <Select value={filter.source} onValueChange={(v) => onChange({ ...filter, source: v as SourceFilter })}>
          <SelectTrigger id="inv-source" className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any</SelectItem>
            <SelectItem value="generated">Generated</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
