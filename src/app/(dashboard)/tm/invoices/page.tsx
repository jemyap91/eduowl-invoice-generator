"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { fetchAll } from "@/lib/supabase/fetch-all"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { InvoiceFilters } from "@/components/tm/invoice-filters"
import { InvoiceTable } from "@/components/tm/invoice-table"
import {
  INVOICE_SELECT, filterFromParams, filterInvoices, filterToParams, mapInvoiceRow,
  type InvoiceFilter, type InvoiceRow, type RawInvoiceRow,
} from "@/lib/tm/invoices"

function Invoices() {
  const params = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()
  const [rows, setRows] = useState<InvoiceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const filter = useMemo(() => filterFromParams(params), [params])
  const selectedId = params.get("invoice")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const res = await fetchAll(() =>
      supabase.from("tm_invoices").select(INVOICE_SELECT)
        .order("year", { ascending: false }).order("month", { ascending: false }).order("invoice_number"),
    )
    if (res.error) {
      setError(res.error.message)
      toast({ title: "Could not load invoices", description: res.error.message, variant: "destructive" })
      setLoading(false)
      return
    }
    setRows((res.data as unknown as RawInvoiceRow[]).map(mapInvoiceRow))
    setLoading(false)
  }, [toast])

  useEffect(() => { load() }, [load])

  const listHref = `/tm/invoices?${filterToParams(filter).toString()}`
  function setFilter(f: InvoiceFilter) {
    router.replace(`/tm/invoices?${filterToParams(f).toString()}`)
  }
  function detailHref(id: string) {
    const p = filterToParams(filter)
    p.set("invoice", id)
    return `/tm/invoices?${p.toString()}`
  }

  const visible = useMemo(() => filterInvoices(rows, filter), [rows, filter])
  const tutorNames = useMemo(() => Array.from(new Set(rows.map((r) => r.tutorName).filter(Boolean))).sort(), [rows])
  const studentNames = useMemo(() => Array.from(new Set(rows.map((r) => r.studentName).filter(Boolean))).sort(), [rows])

  if (loading) return <Skeleton className="h-96 w-full" />
  if (error) return <Card><CardContent className="py-6 text-sm text-destructive">{error}</CardContent></Card>

  if (selectedId) {
    const row = rows.find((r) => r.id === selectedId)
    if (!row) {
      return (
        <Card>
          <CardContent className="py-6 space-y-2 text-sm">
            <p>This invoice no longer exists</p>
            <Link href={listHref} className="text-primary underline">Back to invoices</Link>
          </CardContent>
        </Card>
      )
    }
    // Task 6 replaces this with <InvoiceDetail row={row} handlers={handlers} onChanged={load} backHref={listHref} />
    return <Card><CardContent className="py-6 text-sm">{row.invoice_number}</CardContent></Card>
  }

  return (
    <div className="space-y-4">
      <InvoiceFilters filter={filter} onChange={setFilter} tutorNames={tutorNames} studentNames={studentNames} />
      {/* Task 5 adds the "New manual invoice" button, the dialogs, and renderActions */}
      <InvoiceTable rows={visible} detailHref={detailHref} />
    </div>
  )
}

export default function InvoicesPage() {
  return (
    <Suspense>
      <Invoices />
    </Suspense>
  )
}
