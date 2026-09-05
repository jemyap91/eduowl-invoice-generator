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
import { Plus, Pencil, Trash2, CreditCard } from "lucide-react"

interface PaymentMethod {
  id: string
  name: string
  details: string | null
  display_order: number | null
}

export function PaymentMethodsSettings() {
  const [items, setItems] = useState<PaymentMethod[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<PaymentMethod | null>(null)
  const [deletingItem, setDeletingItem] = useState<PaymentMethod | null>(null)
  const [name, setName] = useState("")
  const [details, setDetails] = useState("")
  const [displayOrder, setDisplayOrder] = useState("")
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  async function fetchItems() {
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from("payment_methods")
      .select("*")
      .order("display_order")
    if (error) {
      toast({ title: "Error", description: "Failed to load payment methods", variant: "destructive" })
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
    setDetails("")
    setDisplayOrder("")
    setDialogOpen(true)
  }

  function openEdit(item: PaymentMethod) {
    setEditingItem(item)
    setName(item.name)
    setDetails(item.details || "")
    setDisplayOrder(String(item.display_order))
    setDialogOpen(true)
  }

  function openDelete(item: PaymentMethod) {
    setDeletingItem(item)
    setDeleteDialogOpen(true)
  }

  async function handleSave() {
    if (!name.trim() || !displayOrder) return
    setSaving(true)
    const supabase = createClient()

    const payload = {
      name: name.trim(),
      details: (details.trim() || null) as string,
      display_order: parseInt(displayOrder, 10),
    }

    if (editingItem) {
      const { error } = await supabase
        .from("payment_methods")
        .update(payload)
        .eq("id", editingItem.id)
      if (error) {
        toast({ title: "Error", description: "Failed to update payment method", variant: "destructive" })
      } else {
        toast({ title: "Success", description: "Payment method updated successfully" })
      }
    } else {
      const { error } = await supabase
        .from("payment_methods")
        .insert(payload)
      if (error) {
        toast({ title: "Error", description: "Failed to add payment method", variant: "destructive" })
      } else {
        toast({ title: "Success", description: "Payment method added successfully" })
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
      .from("payment_methods")
      .delete()
      .eq("id", deletingItem.id)
    if (error) {
      toast({ title: "Error", description: "Failed to delete payment method", variant: "destructive" })
    } else {
      toast({ title: "Success", description: "Payment method deleted successfully" })
    }

    setSaving(false)
    setDeleteDialogOpen(false)
    setDeletingItem(null)
    fetchItems()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Payment Methods</h3>
        <Button onClick={openAdd} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add Payment Method
        </Button>
      </div>

      <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Details</TableHead>
            <TableHead>Display Order</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
              </TableRow>
            ))
          ) : items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center">
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <CreditCard className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium text-muted-foreground">No payment methods yet</h3>
                  <p className="text-sm text-muted-foreground/70 mt-1">Get started by adding your first payment method.</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.name}</TableCell>
                <TableCell>{item.details || "-"}</TableCell>
                <TableCell>{item.display_order}</TableCell>
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
            <DialogTitle>{editingItem ? "Edit Payment Method" : "Add Payment Method"}</DialogTitle>
            <DialogDescription>
              {editingItem ? "Update the payment method details." : "Enter the details for the new payment method."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="pm-name">Name</Label>
              <Input
                id="pm-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. PayNow"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pm-details">Details</Label>
              <Input
                id="pm-details"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="e.g. 97205889"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="display-order">Display Order</Label>
              <Input
                id="display-order"
                type="number"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(e.target.value)}
                placeholder="e.g. 1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !name.trim() || !displayOrder}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Payment Method</DialogTitle>
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
