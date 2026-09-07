"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatCurrency } from "@/lib/format"
import { periodLabel } from "@/lib/tm/periods"
import { formatHours } from "@/lib/portal/timesheet"
import { groupByTutor, summariseEntries, type QueueSubmission, type ReturnedSubmission } from "@/lib/tm/approvals"

interface Props {
  queue: QueueSubmission[]
  returned: ReturnedSubmission[]
  onReview: (id: string) => void
}

function shortDate(iso: string | null): string {
  return iso ? iso.slice(0, 10) : ""
}

export function ApprovalQueue({ queue, returned, onReview }: Props) {
  const groups = groupByTutor(queue)

  return (
    <div className="space-y-6">
      {groups.length === 0 && (
        <Card><CardContent className="py-6 text-sm text-muted-foreground">Nothing is waiting for approval.</CardContent></Card>
      )}

      {groups.map(([tutorName, subs]) => (
        <Card key={tutorName}>
          <CardHeader><CardTitle className="text-base">{tutorName}</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Sessions</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                  <TableHead className="text-right">Invoice</TableHead>
                  <TableHead className="text-right">Payout</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {subs.map((s) => {
                  const t = summariseEntries(s.entries)
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.code}</TableCell>
                      <TableCell>{s.studentName}</TableCell>
                      <TableCell>{s.subject}</TableCell>
                      <TableCell>{periodLabel({ year: s.year, month: s.month })}</TableCell>
                      <TableCell className="text-right">{t.sessions}</TableCell>
                      <TableCell className="text-right">{formatHours(t.hours)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(t.amount)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(t.payout)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(t.profit)}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" aria-label={`Review ${s.code} ${periodLabel({ year: s.year, month: s.month })}`} onClick={() => onReview(s.id)}>Review</Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      {returned.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Returned, awaiting resubmission</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tutor</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Month</TableHead>
                  <TableHead>Returned</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {returned.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.tutorName}</TableCell>
                    <TableCell>{r.studentName}</TableCell>
                    <TableCell className="font-medium">{r.code}</TableCell>
                    <TableCell>{periodLabel({ year: r.year, month: r.month })}</TableCell>
                    <TableCell>{shortDate(r.reviewed_at)}</TableCell>
                    <TableCell className="max-w-md whitespace-pre-wrap">{r.return_reason}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
