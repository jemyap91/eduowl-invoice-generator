"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { fetchAll } from "@/lib/supabase/fetch-all"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { MasterListAssignments } from "@/components/tm/master-list-assignments"
import { MasterListHistory } from "@/components/tm/master-list-history"
import type { AssignmentSource } from "@/lib/tm/master-list"
import { currentPeriod, type Period } from "@/lib/tm/periods"
import { toNumber, type TmAssignment, type TmInvoice, type TmRateTier } from "@/lib/tm/types"

interface RawAssignment extends TmAssignment {
  tm_tutors: { id: string; name: string; phone: string | null } | null
  tm_students: { id: string; name: string; parent_name: string | null; address: string | null } | null
  tm_rate_tiers: TmRateTier[]
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function TmMasterListPage() {
  const [sources, setSources] = useState<AssignmentSource[]>([])
  const [invoices, setInvoices] = useState<TmInvoice[]>([])
  const [period, setPeriod] = useState<Period>(() => currentPeriod())
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const [assignmentsRes, invoicesRes] = await Promise.all([
      fetchAll(() => supabase.from("tm_assignments").select("*, tm_tutors(id, name, phone), tm_students(id, name, parent_name, address), tm_rate_tiers(*)").order("code")),
      fetchAll(() => supabase.from("tm_invoices").select("*").order("id")),
    ])
    if (assignmentsRes.error || invoicesRes.error) {
      toast({ title: "Error", description: "Failed to load the master list", variant: "destructive" })
      setLoading(false)
      return
    }
    setSources((assignmentsRes.data as unknown as RawAssignment[]).map((r) => {
      const { tm_tutors, tm_students, tm_rate_tiers, ...assignment } = r
      return {
        assignment: {
          ...assignment,
          deposit_amount: toNumber(assignment.deposit_amount as unknown as string),
          monthly_est_profit: toNumber(assignment.monthly_est_profit as unknown as string),
        },
        tutor: tm_tutors,
        student: tm_students,
        tiers: (tm_rate_tiers || []).map((t) => ({
          ...t,
          parent_rate: toNumber(t.parent_rate as unknown as string) ?? 0,
          tutor_rate: toNumber(t.tutor_rate as unknown as string) ?? 0,
        })),
      }
    }))
    setInvoices((invoicesRes.data as unknown as TmInvoice[]).map((i) => ({
      ...i,
      total_hours: toNumber(i.total_hours as unknown as string),
      invoice_amount: toNumber(i.invoice_amount as unknown as string) ?? 0,
      tutor_payout: toNumber(i.tutor_payout as unknown as string) ?? 0,
      profit: toNumber(i.profit as unknown as string) ?? 0,
    })))
    setLoading(false)
  }, [toast])

  useEffect(() => { load() }, [load])

  if (loading) return <Skeleton className="h-96 w-full" />

  return (
    <Tabs defaultValue="assignments" className="space-y-4">
      <TabsList>
        <TabsTrigger value="assignments">Assignments</TabsTrigger>
        <TabsTrigger value="history">Monthly History</TabsTrigger>
      </TabsList>
      <TabsContent value="assignments">
        <MasterListAssignments sources={sources} invoices={invoices} period={period} onPeriodChange={setPeriod} onDownload={downloadCsv} />
      </TabsContent>
      <TabsContent value="history">
        <MasterListHistory sources={sources} invoices={invoices} onDownload={downloadCsv} />
      </TabsContent>
    </Tabs>
  )
}
