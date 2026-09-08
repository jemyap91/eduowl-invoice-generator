"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { fetchAll } from "@/lib/supabase/fetch-all"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { DashboardTiles } from "@/components/tm/dashboard-tiles"
import { PendingList } from "@/components/tm/pending-list"
import { currentPeriod, parseMonthInput, toMonthInput, type Period } from "@/lib/tm/periods"
import { INVOICE_SELECT, mapInvoiceRow, type InvoiceRow, type RawInvoiceRow } from "@/lib/tm/invoices"
import { mapPendingRow, monthFigures, oldestPending, outstanding, type PendingSubmission, type RawPendingRow } from "@/lib/tm/dashboard"

const PENDING_SELECT = "id, year, month, submitted_at, tm_assignments(code, subject, tm_students(name)), tm_tutors(name)"

export default function TutorMatchingDashboardPage() {
  const { toast } = useToast()
  const [period, setPeriod] = useState<Period>(() => currentPeriod())
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [pending, setPending] = useState<PendingSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const [invRes, subRes] = await Promise.all([
      fetchAll(() => supabase.from("tm_invoices").select(INVOICE_SELECT).order("id")),
      supabase.from("tm_submissions").select(PENDING_SELECT).eq("status", "submitted").order("submitted_at"),
    ])
    if (invRes.error || subRes.error) {
      const message = invRes.error?.message ?? subRes.error?.message ?? "Could not load the dashboard"
      setError(message)
      toast({ title: "Could not load the dashboard", description: message, variant: "destructive" })
      setLoading(false)
      return
    }
    setInvoices((invRes.data as unknown as RawInvoiceRow[]).map(mapInvoiceRow))
    setPending((subRes.data as unknown as RawPendingRow[]).map(mapPendingRow))
    setLoading(false)
  }, [toast])

  useEffect(() => { load() }, [load])

  const figures = useMemo(() => monthFigures(invoices, pending, period), [invoices, pending, period])
  const owed = useMemo(() => outstanding(invoices), [invoices])
  const oldest = useMemo(() => oldestPending(pending, 5), [pending])

  if (loading) return <Skeleton className="h-96 w-full" />
  if (error) return <Card><CardContent className="py-6 text-sm text-destructive">{error}</CardContent></Card>

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Label htmlFor="dash-month">Month</Label>
        <Input id="dash-month" type="month" className="w-[170px]" value={toMonthInput(period)} onChange={(e) => { const p = parseMonthInput(e.target.value); if (p) setPeriod(p) }} />
      </div>
      <DashboardTiles figures={figures} outstanding={owed} />
      <PendingList rows={oldest} />
    </div>
  )
}
