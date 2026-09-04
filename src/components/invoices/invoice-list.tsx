"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useToast } from "@/hooks/use-toast"
import { Pencil, Send, CheckCircle, Trash2, FileText, ChevronDown, ChevronRight } from "lucide-react"
import { InvoiceDetail } from "./invoice-detail"
import dynamic from "next/dynamic"

const DownloadInvoiceButton = dynamic(
  () => import("./download-invoice-button").then(mod => ({ default: mod.DownloadInvoiceButton })),
  { ssr: false }
)

interface Invoice {
  id: string
  parent_id: string
  student_id: string
  month: number
  year: number
  subtotal: number
  status: string
  created_at: string
  parents: { name: string } | null
  students: { name: string }
}

interface InvoiceItem {
  id: string
  description: string
  hours: number | null
  hourly_rate: number | null
  total: number
  is_adhoc: boolean
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

function statusBadgeVariant(status: string) {
  switch (status) {
    case "draft":
      return "outline" as const
    case "sent":
      return "secondary" as const
    case "paid":
      return "default" as const
    default:
      return "outline" as const
  }
}

function InlineItems({ invoiceId, subtotal }: { invoiceId: string; subtotal: number }) {
  const [items, setItems] = useState<InvoiceItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from("invoice_items")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("is_adhoc")
      .order("created_at")
      .then(({ data }) => {
        setItems((data as InvoiceItem[]) || [])
        setLoading(false)
      })
  }, [invoiceId])

  if (loading) {
    return (
      <div className="py-4 px-8 space-y-2.5">
        <Skeleton className="h-3.5 w-full max-w-md" />
        <Skeleton className="h-3.5 w-full max-w-sm" />
        <Skeleton className="h-3.5 w-full max-w-xs" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="py-4 px-8 text-sm text-muted-foreground italic">
        No line items found.
      </div>
    )
  }

  return (
    <div className="px-8 py-3">
      <div className="rounded-md border border-border/60 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 text-xs text-muted-foreground uppercase tracking-wider">
              <th className="text-left font-medium py-2 px-3">Description</th>
              <th className="text-right font-medium py-2 px-3 w-[80px]">Hours</th>
              <th className="text-right font-medium py-2 px-3 w-[80px]">Rate</th>
              <th className="text-right font-medium py-2 px-3 w-[100px]">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={item.id} className={i > 0 ? "border-t border-border/40" : ""}>
                <td className="py-2 px-3">
                  <span className="text-foreground">{item.description}</span>
                  {item.is_adhoc && (
                    <Badge variant="outline" className="ml-2 text-[10px] py-0 px-1.5 font-normal text-muted-foreground border-muted-foreground/30">Ad-hoc</Badge>
                  )}
                </td>
                <td className="text-right py-2 px-3 text-muted-foreground tabular-nums">
                  {item.hours != null ? item.hours : "—"}
                </td>
                <td className="text-right py-2 px-3 text-muted-foreground tabular-nums">
                  {item.hourly_rate != null ? `$${Number(item.hourly_rate).toFixed(2)}` : "—"}
                </td>
                <td className={`text-right py-2 px-3 font-medium tabular-nums ${Number(item.total) < 0 ? "text-red-600" : ""}`}>
                  {Number(item.total) < 0 ? `-$${Math.abs(Number(item.total)).toFixed(2)}` : `$${Number(item.total).toFixed(2)}`}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[#54ABA7]/30 bg-muted/30">
              <td colSpan={3} className="text-right py-2.5 px-3 text-sm font-semibold text-muted-foreground">
                Total
              </td>
              <td className="text-right py-2.5 px-3 text-sm font-bold tabular-nums text-[#54ABA7]">
                ${Number(subtotal).toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

export function InvoiceList() {
  const [items, setItems] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("all")
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingItem, setDeletingItem] = useState<Invoice | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const fetchItems = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from("invoices")
      .select("*, parents(name), students(name)")
      .order("created_at", { ascending: false })

    if (error) {
      toast({ title: "Error", description: "Failed to load invoices", variant: "destructive" })
    } else {
      setItems((data as unknown as Invoice[]) || [])
    }
    setLoading(false)
  }, [toast])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  function toggleExpanded(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function openEdit(item: Invoice) {
    setSelectedInvoice(item)
    setDetailOpen(true)
  }

  function openDelete(item: Invoice) {
    setDeletingItem(item)
    setDeleteDialogOpen(true)
  }

  async function handleDelete() {
    if (!deletingItem) return
    setSaving(true)
    const supabase = createClient()

    const { error } = await supabase
      .from("invoices")
      .delete()
      .eq("id", deletingItem.id)

    if (error) {
      toast({ title: "Error", description: "Failed to delete invoice", variant: "destructive" })
    } else {
      toast({ title: "Success", description: "Invoice deleted successfully" })
    }

    setSaving(false)
    setDeleteDialogOpen(false)
    setDeletingItem(null)
    fetchItems()
  }

  async function updateStatus(invoiceId: string, newStatus: string) {
    const supabase = createClient()
    const { error } = await supabase
      .from("invoices")
      .update({ status: newStatus })
      .eq("id", invoiceId)

    if (error) {
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" })
    } else {
      toast({ title: "Success", description: `Invoice marked as ${newStatus}` })
      fetchItems()
    }
  }

  function handleSaved() {
    fetchItems()
    setExpandedIds(prev => {
      // Clear expanded for the edited invoice so it refetches items on next expand
      if (selectedInvoice) {
        const next = new Set(prev)
        next.delete(selectedInvoice.id)
        return next
      }
      return prev
    })
  }

  const filtered = statusFilter === "all"
    ? items
    : items.filter((item) => item.status === statusFilter)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="w-[180px]">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border/60">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="w-[36px]" />
            <TableHead className="font-semibold">Student</TableHead>
            <TableHead className="font-semibold">Period</TableHead>
            <TableHead className="text-right font-semibold">Total</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
            <TableHead className="font-semibold">Created</TableHead>
            <TableHead className="w-[180px] text-right font-semibold">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell />
                <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                <TableCell><Skeleton className="h-5 w-14" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
              </TableRow>
            ))
          ) : filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center">
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <h3 className="text-base font-medium text-muted-foreground">
                    {statusFilter !== "all" ? `No ${statusFilter} invoices` : "No invoices yet"}
                  </h3>
                  <p className="text-sm text-muted-foreground/60 mt-1">
                    {statusFilter !== "all"
                      ? "Try changing the status filter."
                      : "Get started by generating your first invoice."}
                  </p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((item) => {
              const isExpanded = expandedIds.has(item.id)
              return (
                <>
                  <TableRow
                    key={item.id}
                    className={`cursor-pointer transition-colors hover:bg-muted/30 ${isExpanded ? "bg-muted/20" : ""}`}
                    onClick={() => toggleExpanded(item.id)}
                  >
                    <TableCell className="pr-0 pl-3">
                      <div className={`transition-transform duration-200 ${isExpanded ? "rotate-0" : "-rotate-90"}`}>
                        <ChevronDown className="h-4 w-4 text-muted-foreground/70" />
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{item.students?.name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {MONTH_NAMES[item.month - 1]} {item.year}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      ${Number(item.subtotal).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={statusBadgeVariant(item.status)}
                        className={
                          item.status === "paid"
                            ? "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                            : item.status === "sent"
                              ? "bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-50"
                              : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50"
                        }
                      >
                        {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(item.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <TooltipProvider delayDuration={0}>
                        <div className="flex items-center justify-end gap-0.5">
                          {item.status !== "paid" && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(item)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit Invoice</TooltipContent>
                            </Tooltip>
                          )}
                          {item.status === "draft" && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => updateStatus(item.id, "sent")}
                                >
                                  <Send className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Mark as Sent</TooltipContent>
                            </Tooltip>
                          )}
                          {item.status !== "paid" && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => updateStatus(item.id, "paid")}
                                >
                                  <CheckCircle className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Mark as Paid</TooltipContent>
                            </Tooltip>
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div>
                                <DownloadInvoiceButton
                                  invoiceId={item.id}
                                  studentName={item.students?.name ?? ""}
                                  month={item.month}
                                  year={item.year}
                                  variant="ghost"
                                  iconOnly
                                />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>Download PDF</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => openDelete(item)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete</TooltipContent>
                          </Tooltip>
                        </div>
                      </TooltipProvider>
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow key={`${item.id}-detail`} className="hover:bg-transparent">
                      <TableCell colSpan={7} className="bg-muted/10 p-0 border-b-2 border-border/30">
                        <InlineItems invoiceId={item.id} subtotal={item.subtotal} />
                      </TableCell>
                    </TableRow>
                  )}
                </>
              )
            })
          )}
        </TableBody>
      </Table>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Invoice</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the invoice for {deletingItem?.students?.name ?? ""} ({
                deletingItem ? `${MONTH_NAMES[deletingItem.month - 1]} ${deletingItem.year}` : ""
              })? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice Edit Dialog */}
      {selectedInvoice && (
        <InvoiceDetail
          open={detailOpen}
          onOpenChange={setDetailOpen}
          invoiceId={selectedInvoice.id}
          studentName={selectedInvoice.students?.name ?? ""}
          month={selectedInvoice.month}
          year={selectedInvoice.year}
          status={selectedInvoice.status}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
