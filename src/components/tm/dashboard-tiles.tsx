"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/format"
import type { MonthFigures, Outstanding } from "@/lib/tm/dashboard"

interface Props {
  figures: MonthFigures
  outstanding: Outstanding
}

function Tile({ title, value, sub, href }: { title: string; value: string; sub?: string; href?: string }) {
  const body = (
    <Card className={href ? "hover:bg-primary/5 transition-colors" : ""}>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle></CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  )
  return href ? <Link href={href} aria-label={title}>{body}</Link> : body
}

export function DashboardTiles({ figures, outstanding }: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Tile title="Pending timesheets" value={String(figures.pending)} href="/tm/approvals" />
      <Tile title="Invoiced" value={formatCurrency(figures.invoiced)} />
      <Tile title="Tutor payouts" value={formatCurrency(figures.payouts)} />
      <Tile title="Profit" value={formatCurrency(figures.profit)} />
      <Tile
        title="Outstanding parent payments"
        value={formatCurrency(outstanding.parentSum)}
        sub={`${outstanding.parentCount} invoice${outstanding.parentCount === 1 ? "" : "s"} · all months`}
        href="/tm/invoices?month=all&parent_paid=unpaid"
      />
      <Tile
        title="Outstanding tutor payouts"
        value={formatCurrency(outstanding.tutorSum)}
        sub={`${outstanding.tutorCount} invoice${outstanding.tutorCount === 1 ? "" : "s"} · all months`}
        href="/tm/invoices?month=all&tutor_paid=unpaid"
      />
    </div>
  )
}
