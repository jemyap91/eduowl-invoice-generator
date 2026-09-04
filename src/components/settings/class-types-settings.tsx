"use client"

import { useEffect, useState } from "react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { Plus, Pencil, Trash2, Tag } from "lucide-react"

interface ClassType {
  id: string
  name: string
  hourly_rate: number
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
  }).format(amount)
}

export function ClassTypesSettings() {
  const [items, setItems] = useState<ClassType[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ClassType | null>(null)
  const [deletingItem, setDeletingItem] = useState<ClassType | null>(null)
  const [name, setName] = useState("")
  const [hourlyRate, setHourlyRate] = useState("")
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  async function fetchItems() {
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from("class_types")
      .select("*")
      .order("name")
    if (error) {
      toast({ title: "Error", description: "Failed to load class types", variant: "destructive" })
    } else {
      setItems(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchItems()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function openAdd() {
    setEditingItem(null)
    setName("")
    setHourlyRate("")
    setDialogOpen(true)
  }

  function openEdit(item: ClassType) {
    setEditingItem(item)
    setName(item.name)
    setHourlyRate(String(item.hourly_rate))
    setDialogOpen(true)
  }

  function openDelete(item: ClassType) {
    setDeletingItem(item)
    setDeleteDialogOpen(true)
  }

  async function handleSave() {
    if (!name.trim() || !hourlyRate) return
    setSaving(true)
    const supabase = createClient()

    const payload = { name: name.trim(), hourly_rate: parseFloat(hourlyRate) }

    if (editingItem) {
      const { error } = await supabase
        .from("class_types")
        .update(payload)
        .eq("id", editingItem.id)
      if (error) {
        toast({ title: "Error", description: "Failed to update class type", variant: "destructive" })
      } else {
        toast({ title: "Success", description: "Class type updated successfully" })
      }
    } else {
      const { error } = await supabase
        .from("class_types")
        .insert(payload)
      if (error) {
        toast({ title: "Error", description: "Failed to add class type", variant: "destructive" })
      } else {
        toast({ title: "Success", description: "Class type added successfully" })
      }
    }

    setSaving(false)
    setDialogOpen(false)
    fetchItems()
  }

  async function handleDelete() {
    if (!deletingItem) return
    setSaving(true)
    const supabase = createClient()

    const { error } = await supabase
      .from("class_types")
      .delete()
      .eq("id", deletingItem.id)
    if (error) {
      toast({ title: "Error", description: "Failed to delete class type", variant: "destructive" })
    } else {
      toast({ title: "Success", description: "Class type deleted successfully" })
    }

    setSaving(false)
    setDeleteDialogOpen(false)
    setDeletingItem(null)
    fetchItems()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Class Types & Rates</h3>
        <Button onClick={openAdd} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add Class Type
        </Button>
      </div>

      <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Hourly Rate</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
              </TableRow>
            ))
          ) : items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="text-center">
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Tag className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium text-muted-foreground">No class types yet</h3>
                  <p className="text-sm text-muted-foreground/70 mt-1">Get started by adding your first class type.</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.name}</TableCell>
                <TableCell>{formatCurrency(item.hourly_rate)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openDelete(item)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Class Type" : "Add Class Type"}</DialogTitle>
            <DialogDescription>
              {editingItem ? "Update the class type details." : "Enter the details for the new class type."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="class-type-name">Name</Label>
              <Input
                id="class-type-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Group Class"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hourly-rate">Hourly Rate (SGD)</Label>
              <Input
                id="hourly-rate"
                type="number"
                step="0.01"
                min="0"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                placeholder="e.g. 25.00"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !name.trim() || !hourlyRate}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Class Type</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deletingItem?.name}&quot;? This action cannot be undone.
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
    </div>
  )
}
