"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { useToast } from "@/hooks/use-toast"
import { Plus, Trash2, CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface Student {
  id: string
  name: string
}

interface ManualLineItem {
  description: string
  hours: string
  hourlyRate: string
  selectedDates: Date[]
  discount: string
  total: string
}

function emptyItem(): ManualLineItem {
  return { description: "", hours: "", hourlyRate: "", selectedDates: [], discount: "", total: "" }
}

function formatDatesForDisplay(dates: Date[]): string {
  if (dates.length === 0) return ""
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime())
  return sorted
    .map((d) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }))
    .join(", ")
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

interface ManualInvoiceFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onGenerated: () => void
}

export function ManualInvoiceForm({ open, onOpenChange, onGenerated }: ManualInvoiceFormProps) {
  const [students, setStudents] = useState<Student[]>([])
  const [studentId, setStudentId] = useState("")
  const [month, setMonth] = useState(String(new Date().getMonth() + 1))
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [items, setItems] = useState<ManualLineItem[]>([emptyItem()])
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const currentYear = new Date().getFullYear()
  const years = [currentYear - 1, currentYear, currentYear + 1]

  // Calendar month bounds for date picker
  const calendarMonth = new Date(Number(year), Number(month) - 1, 1)
  const monthStart = new Date(Number(year), Number(month) - 1, 1)
  const monthEnd = new Date(Number(year), Number(month), 0)

  useEffect(() => {
    if (open) {
      const supabase = createClient()
      supabase
        .from("students")
        .select("id, name")
        .order("name")
        .then(({ data }) => {
          setStudents(data || [])
        })
    }
  }, [open])

  function resetForm() {
    setStudentId("")
    setMonth(String(new Date().getMonth() + 1))
    setYear(String(new Date().getFullYear()))
    setItems([emptyItem()])
  }

  function handleOpenChange(value: boolean) {
    if (!value) resetForm()
    onOpenChange(value)
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem()])
  }

  function updateItem(index: number, field: keyof ManualLineItem, value: string | Date[]) {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item
        const updated = { ...item, [field]: value }

        // Auto-calculate total when both hours and rate are filled
        if (field === "hours" || field === "hourlyRate") {
          const hours = parseFloat(field === "hours" ? (value as string) : updated.hours)
          const rate = parseFloat(field === "hourlyRate" ? (value as string) : updated.hourlyRate)
          if (!isNaN(hours) && !isNaN(rate)) {
            updated.total = (hours * rate).toFixed(2)
          }
        }

        return updated
      })
    )
  }

  function removeItem(index: number) {
    setItems((prev) => {
      const next = prev.filter((_, i) => i !== index)
      return next.length === 0 ? [emptyItem()] : next
    })
  }

  const subtotal = items.reduce((sum, item) => {
    const total = parseFloat(item.total) || 0
    const discount = parseFloat(item.discount) || 0
    return sum + total - discount
  }, 0)

  async function handleCreate() {
    if (!studentId) {
      toast({ title: "Error", description: "Please select a student", variant: "destructive" })
      return
    }

    const validItems = items.filter((item) => item.description.trim() && item.total)
    if (validItems.length === 0) {
      toast({ title: "Error", description: "Add at least one line item with a description and total", variant: "destructive" })
      return
    }

    for (const item of items) {
      if (item.description.trim() && !item.total) {
        toast({ title: "Error", description: "All items with a description must have a total", variant: "destructive" })
        return
      }
    }

    setSaving(true)
    try {
      const supabase = createClient()

      // Look up parent for this student (optional)
      const { data: link } = await supabase
        .from("parent_students")
        .select("parent_id")
        .eq("student_id", studentId)
        .limit(1)
        .maybeSingle()

      // 1. Insert invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from("invoices")
        .insert({
          parent_id: link?.parent_id || null,
          student_id: studentId,
          month: Number(month),
          year: Number(year),
          subtotal: Math.round(subtotal * 100) / 100,
          status: "draft",
        })
        .select("id")
        .single()

      if (invoiceError) {
        toast({ title: "Error", description: "Failed to create invoice", variant: "destructive" })
        setSaving(false)
        return
      }

      // 2. Build line items + discount companion items
      const dbItems: {
        invoice_id: string
        description: string
        hours: number | null
        hourly_rate: number | null
        total: number
        is_adhoc: boolean
        dates_attended: string | null
      }[] = []

      for (const item of validItems) {
        const datesStr = formatDatesForDisplay(item.selectedDates)

        dbItems.push({
          invoice_id: invoice.id,
          description: item.description.trim(),
          hours: item.hours ? parseFloat(item.hours) : null,
          hourly_rate: item.hourlyRate ? parseFloat(item.hourlyRate) : null,
          total: parseFloat(item.total),
          is_adhoc: true,
          dates_attended: datesStr || null,
        })

        // Add discount as a separate negative line item
        const discount = parseFloat(item.discount)
        if (discount > 0) {
          dbItems.push({
            invoice_id: invoice.id,
            description: `Discount — ${item.description.trim()}`,
            hours: null,
            hourly_rate: null,
            total: -discount,
            is_adhoc: true,
            dates_attended: null,
          })
        }
      }

      const { error: itemsError } = await supabase
        .from("invoice_items")
        .insert(dbItems)

      if (itemsError) {
        toast({ title: "Error", description: "Invoice created but failed to add line items", variant: "destructive" })
        setSaving(false)
        return
      }

      toast({ title: "Success", description: "Manual invoice created successfully" })
      handleOpenChange(false)
      onGenerated()
    } catch {
      toast({ title: "Error", description: "Failed to create invoice", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[850px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Manual Invoice</DialogTitle>
          <DialogDescription>
            Build an invoice manually with custom line items.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Student Select */}
          <div className="space-y-2">
            <Label>Student</Label>
            <Select value={studentId} onValueChange={setStudentId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a student" />
              </SelectTrigger>
              <SelectContent>
                {students.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Month / Year */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Month</Label>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.map((name, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Year</Label>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Line Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Line Items</Label>
              <Button variant="outline" size="sm" onClick={addItem}>
                <Plus className="mr-1 h-3 w-3" />
                Add Line Item
              </Button>
            </div>

            {items.map((item, i) => (
              <div key={i} className="rounded-md border p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Description (e.g. Math Tuition - Group)"
                    value={item.description}
                    onChange={(e) => updateItem(i, "description", e.target.value)}
                    className="flex-1"
                  />
                  <Button variant="ghost" size="icon" onClick={() => removeItem(i)} className="h-8 w-8 shrink-0">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Hours</Label>
                    <Input
                      type="number"
                      placeholder="—"
                      value={item.hours}
                      onChange={(e) => updateItem(i, "hours", e.target.value)}
                      step="0.5"
                      min="0"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Rate ($/hr)</Label>
                    <Input
                      type="number"
                      placeholder="—"
                      value={item.hourlyRate}
                      onChange={(e) => updateItem(i, "hourlyRate", e.target.value)}
                      step="0.01"
                      min="0"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Total</Label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={item.total}
                      onChange={(e) => updateItem(i, "total", e.target.value)}
                      step="0.01"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Discount</Label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={item.discount}
                      onChange={(e) => updateItem(i, "discount", e.target.value)}
                      step="0.01"
                      min="0"
                    />
                  </div>
                </div>

                {/* Date Picker */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Dates Attended</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal h-9",
                          item.selectedDates.length === 0 && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                        <span className="truncate">
                          {item.selectedDates.length > 0
                            ? formatDatesForDisplay(item.selectedDates)
                            : "Click to select dates"}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="multiple"
                        selected={item.selectedDates}
                        onSelect={(dates) => updateItem(i, "selectedDates", dates || [])}
                        defaultMonth={calendarMonth}
                        disabled={[
                          { before: monthStart },
                          { after: monthEnd },
                        ]}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Per-item net total */}
                {(parseFloat(item.total) > 0 || parseFloat(item.discount) > 0) && (
                  <div className="flex justify-end gap-3 text-xs text-muted-foreground pt-1">
                    {parseFloat(item.discount) > 0 && (
                      <span className="text-red-600">
                        Discount: -${parseFloat(item.discount).toFixed(2)}
                      </span>
                    )}
                    <span className="font-medium text-foreground">
                      Net: ${((parseFloat(item.total) || 0) - (parseFloat(item.discount) || 0)).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Subtotal */}
          <div className="flex items-center justify-between border-t pt-4">
            <span className="text-sm font-semibold">Subtotal</span>
            <span className="text-lg font-bold">${(Math.round(subtotal * 100) / 100).toFixed(2)}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={saving}>
            {saving ? "Creating..." : "Create Invoice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
