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
import { Plus, Pencil, Trash2, DoorOpen } from "lucide-react"

interface Classroom {
  id: string
  name: string
  capacity: number | null
}

export function ClassroomsSettings() {
  const [items, setItems] = useState<Classroom[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Classroom | null>(null)
  const [deletingItem, setDeletingItem] = useState<Classroom | null>(null)
  const [name, setName] = useState("")
  const [capacity, setCapacity] = useState("")
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  async function fetchItems() {
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from("classrooms")
      .select("*")
      .order("name")
    if (error) {
      toast({ title: "Error", description: "Failed to load classrooms", variant: "destructive" })
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
    setCapacity("")
    setDialogOpen(true)
  }

  function openEdit(item: Classroom) {
    setEditingItem(item)
    setName(item.name)
    setCapacity(String(item.capacity))
    setDialogOpen(true)
  }

  function openDelete(item: Classroom) {
    setDeletingItem(item)
    setDeleteDialogOpen(true)
  }

  async function handleSave() {
    if (!name.trim() || !capacity) return
    setSaving(true)
    const supabase = createClient()

    const payload = { name: name.trim(), capacity: parseInt(capacity, 10) }

    if (editingItem) {
      const { error } = await supabase
        .from("classrooms")
        .update(payload)
        .eq("id", editingItem.id)
      if (error) {
        toast({ title: "Error", description: "Failed to update classroom", variant: "destructive" })
      } else {
        toast({ title: "Success", description: "Classroom updated successfully" })
      }
    } else {
      const { error } = await supabase
        .from("classrooms")
        .insert(payload)
      if (error) {
        toast({ title: "Error", description: "Failed to add classroom", variant: "destructive" })
      } else {
        toast({ title: "Success", description: "Classroom added successfully" })
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
      .from("classrooms")
      .delete()
      .eq("id", deletingItem.id)
    if (error) {
      toast({ title: "Error", description: "Failed to delete classroom", variant: "destructive" })
    } else {
      toast({ title: "Success", description: "Classroom deleted successfully" })
    }

    setSaving(false)
    setDeleteDialogOpen(false)
    setDeletingItem(null)
    fetchItems()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Classrooms</h3>
        <Button onClick={openAdd} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add Classroom
        </Button>
      </div>

      <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Capacity</TableHead>
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
                  <DoorOpen className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium text-muted-foreground">No classrooms yet</h3>
                  <p className="text-sm text-muted-foreground/70 mt-1">Get started by adding your first classroom.</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.name}</TableCell>
                <TableCell>{item.capacity}</TableCell>
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
            <DialogTitle>{editingItem ? "Edit Classroom" : "Add Classroom"}</DialogTitle>
            <DialogDescription>
              {editingItem ? "Update the classroom details." : "Enter the details for the new classroom."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="classroom-name">Name</Label>
              <Input
                id="classroom-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Room A"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="capacity">Capacity</Label>
              <Input
                id="capacity"
                type="number"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                placeholder="e.g. 10"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !name.trim() || !capacity}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Classroom</DialogTitle>
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
