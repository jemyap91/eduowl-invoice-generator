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
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, Pencil, Trash2, BookOpen } from "lucide-react"

interface Subject {
  id: string
  name: string
  level: string | null
}

export function SubjectsSettings() {
  const [items, setItems] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Subject | null>(null)
  const [deletingItem, setDeletingItem] = useState<Subject | null>(null)
  const [name, setName] = useState("")
  const [level, setLevel] = useState<string>("all")
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  async function fetchItems() {
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from("subjects")
      .select("*")
      .order("name")
    if (error) {
      toast({ title: "Error", description: "Failed to load subjects", variant: "destructive" })
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
    setLevel("all")
    setDialogOpen(true)
  }

  function openEdit(item: Subject) {
    setEditingItem(item)
    setName(item.name)
    setLevel(item.level || "all")
    setDialogOpen(true)
  }

  function openDelete(item: Subject) {
    setDeletingItem(item)
    setDeleteDialogOpen(true)
  }

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    const supabase = createClient()

    if (editingItem) {
      const { error } = await supabase
        .from("subjects")
        .update({ name: name.trim(), level })
        .eq("id", editingItem.id)
      if (error) {
        toast({ title: "Error", description: "Failed to update subject", variant: "destructive" })
      } else {
        toast({ title: "Success", description: "Subject updated successfully" })
      }
    } else {
      const { error } = await supabase
        .from("subjects")
        .insert({ name: name.trim(), level })
      if (error) {
        toast({ title: "Error", description: "Failed to add subject", variant: "destructive" })
      } else {
        toast({ title: "Success", description: "Subject added successfully" })
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
      .from("subjects")
      .delete()
      .eq("id", deletingItem.id)
    if (error) {
      toast({ title: "Error", description: "Failed to delete subject", variant: "destructive" })
    } else {
      toast({ title: "Success", description: "Subject deleted successfully" })
    }

    setSaving(false)
    setDeleteDialogOpen(false)
    setDeletingItem(null)
    fetchItems()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Subjects</h3>
        <Button onClick={openAdd} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add Subject
        </Button>
      </div>

      <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Level</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
              </TableRow>
            ))
          ) : items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="text-center">
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <BookOpen className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium text-muted-foreground">No subjects yet</h3>
                  <p className="text-sm text-muted-foreground/70 mt-1">Get started by adding your first subject.</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.name}</TableCell>
                <TableCell>
                  {item.level && (
                    <Badge variant="secondary">
                      {item.level.charAt(0).toUpperCase() + item.level.slice(1)}
                    </Badge>
                  )}
                </TableCell>
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
            <DialogTitle>{editingItem ? "Edit Subject" : "Add Subject"}</DialogTitle>
            <DialogDescription>
              {editingItem ? "Update the subject details." : "Enter details for the new subject."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Mathematics"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="level">Level</Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger id="level">
                  <SelectValue placeholder="Select level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary">Primary</SelectItem>
                  <SelectItem value="secondary">Secondary</SelectItem>
                  <SelectItem value="all">All Levels</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Subject</DialogTitle>
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
