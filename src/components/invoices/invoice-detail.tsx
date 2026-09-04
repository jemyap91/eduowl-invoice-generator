"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Plus, Trash2, Loader2, PercentCircle } from "lucide-react"

interface InvoiceItem {
  id: string
  description: string
  hours: number | null
  hourly_rate: number | null
  total: number
  is_adhoc: boolean
}

interface InvoiceDetailProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoiceId: string | null
  studentName: string
  month: number
  year: number
  status: string
  onSaved: () => void
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

export function InvoiceDetail({
  open,
  onOpenChange,
  invoiceId,
  studentName,
  month,
  year,
  status,
  onSaved,
}: InvoiceDetailProps) {
  const [items, setItems] = useState<InvoiceItem[]>([])
  const [loading, setLoading] = useState(false)
  const [editItems, setEditItems] = useState<InvoiceItem[]>([])
  const [deletedIds, setDeletedIds] = useState<string[]>([])
  const [newRows, setNewRows] = useState<{ description: string; total: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [showDiscount, setShowDiscount] = useState(false)
  const [discountPercent, setDiscountPercent] = useState("")
  const [discountDesc, setDiscountDesc] = useState("Discount")
  const { toast } = useToast()

  useEffect(() => {
    if (open && invoiceId) {
      setLoading(true)
      setDeletedIds([])
      setNewRows([])
      setShowDiscount(false)
      setDiscountPercent("")
      setDiscountDesc("Discount")
      const supabase = createClient()
      supabase
        .from("invoice_items")
        .select("*")
        .eq("invoice_id", invoiceId)
        .order("is_adhoc")
        .order("created_at")
        .then(({ data, error }) => {
          if (error) {
            toast({ title: "Error", description: "Failed to load invoice items", variant: "destructive" })
          } else {
            const loaded = (data as InvoiceItem[]) || []
            setItems(loaded)
            setEditItems(loaded.map(i => ({ ...i })))
          }
          setLoading(false)
        })
    }
  }, [open, invoiceId, toast])

  function updateEditItem(id: string, field: "description" | "total", value: string) {
    setEditItems(prev =>
      prev.map(item =>
        item.id === id
          ? { ...item, [field]: field === "total" ? parseFloat(value) || 0 : value }
          : item
      )
    )
  }

  function markForDeletion(id: string) {
    setDeletedIds(prev => [...prev, id])
    setEditItems(prev => prev.filter(i => i.id !== id))
  }

  function addNewRow() {
    setNewRows(prev => [...prev, { description: "", total: "" }])
  }

  function updateNewRow(index: number, field: "description" | "total", value: string) {
    setNewRows(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r))
  }

  function removeNewRow(index: number) {
    setNewRows(prev => prev.filter((_, i) => i !== index))
  }

  // Subtotal before discount (existing items + new line items, excluding any previously saved discounts)
  const itemsSubtotal = editItems.reduce((sum, i) => sum + Number(i.total), 0)
    + newRows.reduce((sum, r) => sum + (parseFloat(r.total) || 0), 0)

  const discountPct = parseFloat(discountPercent) || 0
  // Calculate discount from positive items only (so discount doesn't compound on itself or other negative items)
  const positiveItemsTotal = editItems.filter(i => Number(i.total) > 0).reduce((sum, i) => sum + Number(i.total), 0)
    + newRows.filter(r => (parseFloat(r.total) || 0) > 0).reduce((sum, r) => sum + (parseFloat(r.total) || 0), 0)
  const discountAmount = showDiscount && discountPct > 0
    ? Math.round(positiveItemsTotal * discountPct) / 100
    : 0
  const editSubtotal = itemsSubtotal - discountAmount

  async function handleSave() {
    if (!invoiceId) return

    // Validate new rows
    const validNewRows = newRows.filter(r => r.description.trim())
    for (const row of newRows) {
      if (!row.description.trim() && (parseFloat(row.total) || 0) !== 0) {
        toast({ title: "Error", description: "New items must have a description", variant: "destructive" })
        return
      }
    }

    setSaving(true)
    try {
      const supabase = createClient()

      // Delete removed items
      if (deletedIds.length > 0) {
        const { error: delError } = await supabase
          .from("invoice_items")
          .delete()
          .in("id", deletedIds)
        if (delError) {
          toast({ title: "Error", description: "Failed to delete items", variant: "destructive" })
          setSaving(false)
          return
        }
      }

      // Update edited items
      for (const item of editItems) {
        const { error } = await supabase
          .from("invoice_items")
          .update({
            description: item.description,
            total: Math.round(Number(item.total) * 100) / 100,
          })
          .eq("id", item.id)
        if (error) {
          toast({ title: "Error", description: `Failed to update "${item.description}"`, variant: "destructive" })
          setSaving(false)
          return
        }
      }

      // Insert new rows + discount
      const rowsToInsert = [
        ...validNewRows.map(r => ({
          invoice_id: invoiceId,
          description: r.description.trim(),
          hours: null,
          hourly_rate: null,
          total: Math.round((parseFloat(r.total) || 0) * 100) / 100,
          is_adhoc: true,
        })),
        ...(discountAmount > 0 ? [{
          invoice_id: invoiceId,
          description: `${discountDesc.trim() || "Discount"} (${discountPct}%)`,
          hours: null,
          hourly_rate: null,
          total: -Math.round(discountAmount * 100) / 100,
          is_adhoc: true,
        }] : []),
      ]

      if (rowsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from("invoice_items")
          .insert(rowsToInsert)
        if (insertError) {
          toast({ title: "Error", description: "Failed to add new items", variant: "destructive" })
          setSaving(false)
          return
        }
      }

      // Update invoice subtotal
      const newSubtotal = editSubtotal
      await supabase
        .from("invoices")
        .update({ subtotal: Math.round(newSubtotal * 100) / 100 })
        .eq("id", invoiceId)

      toast({ title: "Success", description: "Invoice updated" })
      onSaved()
      onOpenChange(false)
    } catch {
      toast({ title: "Error", description: "Failed to save changes", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const isPaid = status === "paid"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Invoice</DialogTitle>
          <DialogDescription>
            {studentName} — {MONTH_NAMES[month - 1]} {year}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <p className="text-center text-sm text-muted-foreground py-4">Loading...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right w-[80px]">Hours</TableHead>
                  <TableHead className="text-right w-[80px]">Rate</TableHead>
                  <TableHead className="text-right w-[110px]">Total</TableHead>
                  {!isPaid && <TableHead className="w-[40px]" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {editItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-sm">
                      {isPaid ? (
                        <>
                          {item.description}
                          {item.is_adhoc && <Badge variant="outline" className="ml-2 text-xs">Extra</Badge>}
                        </>
                      ) : (
                        <Input
                          value={item.description}
                          onChange={(e) => updateEditItem(item.id, "description", e.target.value)}
                          className="h-8 text-sm"
                        />
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {item.hours != null ? item.hours : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {item.hourly_rate != null ? `$${Number(item.hourly_rate).toFixed(2)}` : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {isPaid ? (
                        `$${Number(item.total).toFixed(2)}`
                      ) : (
                        <Input
                          type="number"
                          value={item.total}
                          onChange={(e) => updateEditItem(item.id, "total", e.target.value)}
                          className="h-8 text-sm text-right w-[100px] ml-auto"
                          step="0.01"
                        />
                      )}
                    </TableCell>
                    {!isPaid && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => markForDeletion(item.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {/* New rows */}
                {newRows.map((row, i) => (
                  <TableRow key={`new-${i}`}>
                    <TableCell>
                      <Input
                        placeholder="Description (e.g. Materials)"
                        value={row.description}
                        onChange={(e) => updateNewRow(i, "description", e.target.value)}
                        className="h-8 text-sm"
                        autoFocus={i === newRows.length - 1}
                      />
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">—</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">—</TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={row.total}
                        onChange={(e) => updateNewRow(i, "total", e.target.value)}
                        className="h-8 text-sm text-right w-[100px] ml-auto"
                        step="0.01"
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => removeNewRow(i)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Add row buttons */}
          {!isPaid && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={addNewRow}>
                  <Plus className="mr-1 h-3 w-3" />
                  Add Line Item
                </Button>
                {!showDiscount && (
                  <Button variant="outline" size="sm" onClick={() => setShowDiscount(true)}>
                    <PercentCircle className="mr-1 h-3 w-3" />
                    Add Discount
                  </Button>
                )}
              </div>

              {showDiscount && (
                <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Discount</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground"
                      onClick={() => { setShowDiscount(false); setDiscountPercent(""); setDiscountDesc("Discount") }}
                    >
                      Remove
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Label (e.g. Sibling Discount)"
                      value={discountDesc}
                      onChange={(e) => setDiscountDesc(e.target.value)}
                      className="h-8 text-sm flex-1"
                    />
                    <div className="relative w-[100px]">
                      <Input
                        type="number"
                        placeholder="0"
                        value={discountPercent}
                        onChange={(e) => setDiscountPercent(e.target.value)}
                        className="h-8 text-sm text-right pr-7"
                        min="0"
                        max="100"
                        step="1"
                        autoFocus
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">%</span>
                    </div>
                  </div>
                  {discountAmount > 0 && (
                    <p className="text-sm text-red-600 tabular-nums">
                      -${discountAmount.toFixed(2)} off ${positiveItemsTotal.toFixed(2)}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Subtotal */}
          <div className="flex items-center justify-between border-t pt-4">
            <span className="text-sm font-semibold">Total</span>
            <span className="text-lg font-bold tabular-nums">${editSubtotal.toFixed(2)}</span>
          </div>
        </div>

        {!isPaid && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
