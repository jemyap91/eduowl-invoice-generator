"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { periodLabel } from "@/lib/tm/periods"
import type { PendingSubmission } from "@/lib/tm/dashboard"

export function PendingList({ rows }: { rows: PendingSubmission[] }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Oldest pending submissions</CardTitle></CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing is waiting for approval.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tutor</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Month</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.tutorName}</TableCell>
                  <TableCell>{s.studentName}</TableCell>
                  <TableCell className="font-medium">{s.code}</TableCell>
                  <TableCell>{periodLabel({ year: s.year, month: s.month })}</TableCell>
                  <TableCell>{s.submitted_at ? s.submitted_at.slice(0, 10) : ""}</TableCell>
                  <TableCell className="text-right">
                    <Link href={`/tm/approvals?submission=${s.id}`} className="text-primary underline" aria-label={`Review ${s.code} ${periodLabel({ year: s.year, month: s.month })}`}>Review</Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
