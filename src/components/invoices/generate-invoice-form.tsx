"use client"

import { useState, useEffect, useCallback } from "react"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { Plus, Trash2, Loader2 } from "lucide-react"
import { calculateInvoiceItems, type InvoiceLineItem } from "@/lib/invoices/calculate"

interface Student {
  id: string
  name: string
}

interface AdhocItem {
  description: string
  total: number
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

interface GenerateInvoiceFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onGenerated: () => void
}

export function GenerateInvoiceForm({ open, onOpenChange, onGenerated }: GenerateInvoiceFormProps) {
  const [students, setStudents] = useState<Student[]>([])
  const [studentId, setStudentId] = useState("")
  const [month, setMonth] = useState(String(new Date().getMonth() + 1))
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [calculatedItems, setCalculatedItems] = useState<InvoiceLineItem[]>([])
  const [adhocItems, setAdhocItems] = useState<AdhocItem[]>([])
  const [calculating, setCalculating] = useState(false)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const currentYear = new Date().getFullYear()
  const years = [currentYear - 1, currentYear, currentYear + 1]

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

  // Auto-calculate when student, month, or year changes
  const autoCalculate = useCallback(async (sid: string, m: string, y: string) => {
    if (!sid) {
      setCalculatedItems([])
      return
    }
    setCalculating(true)
    try {
      const supabase = createClient()
      const items = await calculateInvoiceItems(sid, Number(m), Number(y), supabase)
      setCalculatedItems(items)
    } catch {
      setCalculatedItems([])
    } finally {
      setCalculating(false)
    }
  }, [])

  useEffect(() => {
    if (open && studentId) {
      autoCalculate(studentId, month, year)
    }
  }, [open, studentId, month, year, autoCalculate])

  function resetForm() {
    setStudentId("")
    setMonth(String(new Date().getMonth() + 1))
    setYear(String(new Date().getFullYear()))
    setCalculatedItems([])
    setAdhocItems([])
  }

  function handleOpenChange(value: boolean) {
    if (!value) resetForm()
    onOpenChange(value)
  }

  function addAdhocItem() {
    setAdhocItems((prev) => [...prev, { description: "", total: 0 }])
  }

  function updateAdhocItem(index: number, field: keyof AdhocItem, value: string | number) {
    setAdhocItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    )
  }

  function removeAdhocItem(index: number) {
    setAdhocItems((prev) => prev.filter((_, i) => i !== index))
  }

  const subtotal =
    calculatedItems.reduce((sum, item) => sum + item.total, 0) +
    adhocItems.reduce((sum, item) => sum + (Number(item.total) || 0), 0)

  async function handleGenerate() {
    if (!studentId) return

    // Validate extra line items
    for (const item of adhocItems) {
      if (!item.description.trim()) {
        toast({ title: "Error", description: "All extra items must have a description", variant: "destructive" })
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
        if (invoiceError.code === "23505") {
          toast({
            title: "Error",
            description: "An invoice already exists for this student and month/year.",
            variant: "destructive",
          })
        } else {
          toast({ title: "Error", description: "Failed to create invoice", variant: "destructive" })
        }
        setSaving(false)
        return
      }

      // 2. Insert line items
      const allItems = [
        ...calculatedItems.map((item) => ({
          invoice_id: invoice.id,
          description: item.description,
          hours: item.hours,
          hourly_rate: item.hourlyRate,
          total: item.total,
          is_adhoc: false,
          dates_attended: item.datesAttended || null,
        })),
        ...adhocItems
          .filter((item) => item.description.trim())
          .map((item) => ({
            invoice_id: invoice.id,
            description: item.description,
            hours: null,
            hourly_rate: null,
            total: Number(item.total) || 0,
            is_adhoc: true,
          })),
      ]

      if (allItems.length > 0) {
        const { error: itemsError } = await supabase
          .from("invoice_items")
          .insert(allItems)

        if (itemsError) {
          toast({ title: "Error", description: "Invoice created but failed to add line items", variant: "destructive" })
          setSaving(false)
          return
        }
      }

      toast({ title: "Success", description: "Invoice generated successfully" })
      handleOpenChange(false)
      onGenerated()
    } catch {
      toast({ title: "Error", description: "Failed to generate invoice", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate Invoice</DialogTitle>
          <DialogDescription>
            Select a student and month to generate an invoice from their scheduled classes.
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

          {/* Calculated Items */}
          {studentId && (
            <>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Scheduled Classes</Label>
                {calculating ? (
                  <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Calculating...
                  </div>
                ) : calculatedItems.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right w-[80px]">Hours</TableHead>
                        <TableHead className="text-right w-[80px]">Rate</TableHead>
                        <TableHead className="text-right w-[100px]">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {calculatedItems.map((item, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-sm">{item.description}</TableCell>
                          <TableCell className="text-right text-sm">{item.hours}</TableCell>
                          <TableCell className="text-right text-sm">${item.hourlyRate.toFixed(2)}</TableCell>
                          <TableCell className="text-right text-sm font-medium">${item.total.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground">No scheduled classes found for this period.</p>
                )}
              </div>

              {/* Extra Items */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Extra Items</Label>
                  <Button variant="outline" size="sm" onClick={addAdhocItem}>
                    <Plus className="mr-1 h-3 w-3" />
                    Add Line Item
                  </Button>
                </div>
                {adhocItems.length > 0 && (
                  <div className="space-y-2">
                    {adhocItems.map((item, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Input
                          placeholder="Description"
                          value={item.description}
                          onChange={(e) => updateAdhocItem(i, "description", e.target.value)}
                          className="flex-1"
                        />
                        <Input
                          type="number"
                          placeholder="Total"
                          value={item.total || ""}
                          onChange={(e) => updateAdhocItem(i, "total", parseFloat(e.target.value) || 0)}
                          className="w-[120px]"
                          step="0.01"
                        />
                        <Button variant="ghost" size="icon" onClick={() => removeAdhocItem(i)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Subtotal */}
              <div className="flex items-center justify-between border-t pt-4">
                <span className="text-sm font-semibold">Subtotal</span>
                <span className="text-lg font-bold">${(Math.round(subtotal * 100) / 100).toFixed(2)}</span>
              </div>
            </>
          )}
        </div>

        {studentId && !calculating && (
          <DialogFooter>
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleGenerate} disabled={saving}>
              {saving ? "Generating..." : "Generate Invoice"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
