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
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { invoiceLines } from "@/lib/tm/approvals"
import { whatsappText } from "@/lib/tm/whatsapp"
import { loadInvoiceContext } from "@/components/tm/invoice-data"
import { DeleteDialog, InvoiceMenu, PaidDialog, type InvoiceActionHandlers, type PaidWhich } from "@/components/tm/invoice-actions"
import { ManualInvoiceDialog } from "@/components/tm/manual-invoice-form"
import { InvoiceDetail } from "@/components/tm/invoice-detail"

function Invoices() {
  const params = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()
  const [rows, setRows] = useState<InvoiceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const filter = useMemo(() => filterFromParams(params), [params])
  const selectedId = params.get("invoice")
  const [paidTarget, setPaidTarget] = useState<{ row: InvoiceRow; which: PaidWhich } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<InvoiceRow | null>(null)
  const [manualOpen, setManualOpen] = useState(false)

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

  async function copyWhatsapp(row: InvoiceRow) {
    try {
      const { settings, entries } = await loadInvoiceContext(row)
      const text = whatsappText({
        parentName: row.parentName, studentName: row.studentName, subject: row.subject,
        period: { year: row.year, month: row.month }, totalHours: row.total_hours,
        lines: invoiceLines(entries), invoiceAmount: row.invoice_amount, paymentDetails: settings.payment_details,
      })
      await navigator.clipboard.writeText(text)
      toast({ title: "WhatsApp text copied" })
    } catch (e) {
      toast({ title: "Could not copy", description: e instanceof Error ? e.message : String(e), variant: "destructive" })
    }
  }

  const handlers: InvoiceActionHandlers = {
    onCopy: copyWhatsapp,
    onDownload: async (row) => {
      try {
        const { downloadInvoicePdf } = await import("@/components/tm/invoice-download")
        await downloadInvoicePdf(row)
        toast({ title: "Invoice PDF downloaded" })
      } catch (e) {
        console.error("PDF generation error:", e)
        toast({ title: "Failed to generate PDF", description: e instanceof Error ? e.message : String(e), variant: "destructive" })
      }
    },
    onPaid: (row, which) => setPaidTarget({ row, which }),
    onDelete: (row) => setDeleteTarget(row),
  }

  if (loading && rows.length === 0) return <Skeleton className="h-96 w-full" />
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
    return (
      <>
        <InvoiceDetail row={row} handlers={handlers} onChanged={load} backHref={listHref} />
        <PaidDialog target={paidTarget} onClose={() => setPaidTarget(null)} onSaved={load} />
        <DeleteDialog target={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={() => { setDeleteTarget(null); router.push(listHref); load() }} />
      </>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <InvoiceFilters filter={filter} onChange={setFilter} tutorNames={tutorNames} studentNames={studentNames} />
        <Button size="sm" onClick={() => setManualOpen(true)}><Plus className="mr-2 h-4 w-4" />New manual invoice</Button>
      </div>
      <InvoiceTable rows={visible} detailHref={detailHref} renderActions={(row) => <InvoiceMenu row={row} handlers={handlers} />} />
      <PaidDialog target={paidTarget} onClose={() => setPaidTarget(null)} onSaved={load} />
      <DeleteDialog target={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={load} />
      <ManualInvoiceDialog open={manualOpen} onOpenChange={setManualOpen} onCreated={load} />
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
