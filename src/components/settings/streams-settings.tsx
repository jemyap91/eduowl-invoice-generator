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
import { Plus, Pencil, Trash2, Layers } from "lucide-react"

interface Stream {
  id: string
  name: string
  level_order: number
}

export function StreamsSettings() {
  const [items, setItems] = useState<Stream[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Stream | null>(null)
  const [deletingItem, setDeletingItem] = useState<Stream | null>(null)
  const [name, setName] = useState("")
  const [levelOrder, setLevelOrder] = useState("")
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  async function fetchItems() {
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from("streams")
      .select("*")
      .order("level_order")
    if (error) {
      toast({ title: "Error", description: "Failed to load streams", variant: "destructive" })
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
    setLevelOrder("")
    setDialogOpen(true)
  }

  function openEdit(item: Stream) {
    setEditingItem(item)
    setName(item.name)
    setLevelOrder(String(item.level_order))
    setDialogOpen(true)
  }

  function openDelete(item: Stream) {
    setDeletingItem(item)
    setDeleteDialogOpen(true)
  }

  async function handleSave() {
    if (!name.trim() || !levelOrder) return
    setSaving(true)
    const supabase = createClient()

    const payload = { name: name.trim(), level_order: parseInt(levelOrder, 10) }

    if (editingItem) {
      const { error } = await supabase
        .from("streams")
        .update(payload)
        .eq("id", editingItem.id)
      if (error) {
        toast({ title: "Error", description: "Failed to update stream", variant: "destructive" })
      } else {
        toast({ title: "Success", description: "Stream updated successfully" })
      }
    } else {
      const { error } = await supabase
        .from("streams")
        .insert(payload)
      if (error) {
        toast({ title: "Error", description: "Failed to add stream", variant: "destructive" })
      } else {
        toast({ title: "Success", description: "Stream added successfully" })
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
      .from("streams")
      .delete()
      .eq("id", deletingItem.id)
    if (error) {
      toast({ title: "Error", description: "Failed to delete stream", variant: "destructive" })
    } else {
      toast({ title: "Success", description: "Stream deleted successfully" })
    }

    setSaving(false)
    setDeleteDialogOpen(false)
    setDeletingItem(null)
    fetchItems()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Streams</h3>
        <Button onClick={openAdd} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add Stream
        </Button>
      </div>

      <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Level Order</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
              </TableRow>
            ))
          ) : items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="text-center">
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Layers className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium text-muted-foreground">No streams yet</h3>
                  <p className="text-sm text-muted-foreground/70 mt-1">Get started by adding your first stream.</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.name}</TableCell>
                <TableCell>{item.level_order}</TableCell>
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
            <DialogTitle>{editingItem ? "Edit Stream" : "Add Stream"}</DialogTitle>
            <DialogDescription>
              {editingItem ? "Update the stream details." : "Enter the details for the new stream."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="stream-name">Name</Label>
              <Input
                id="stream-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Primary 1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="level-order">Level Order</Label>
              <Input
                id="level-order"
                type="number"
                value={levelOrder}
                onChange={(e) => setLevelOrder(e.target.value)}
                placeholder="e.g. 1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !name.trim() || !levelOrder}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Stream</DialogTitle>
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
