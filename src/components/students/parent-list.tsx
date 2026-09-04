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
import { Input } from "@/components/ui/input"
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
import { Plus, Pencil, Trash2, Search, Link2, Users } from "lucide-react"
import { ParentForm } from "./parent-form"
import { LinkStudentDialog } from "./link-student-dialog"

interface StudentInfo {
  id: string
  name: string
}

interface Parent {
  id: string
  name: string
  email: string | null
  phone: string | null
  parent_students: { students: StudentInfo }[]
}

interface AllStudent {
  id: string
  name: string
}

export function ParentList() {
  const [items, setItems] = useState<Parent[]>([])
  const [allStudents, setAllStudents] = useState<AllStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Parent | null>(null)
  const [deletingItem, setDeletingItem] = useState<Parent | null>(null)
  const [linkingParent, setLinkingParent] = useState<Parent | null>(null)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState("")
  const { toast } = useToast()

  const fetchItems = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const [parentsRes, studentsRes] = await Promise.all([
      supabase
        .from("parents")
        .select("*, parent_students(students(id, name))")
        .order("name"),
      supabase
        .from("students")
        .select("id, name")
        .order("name"),
    ])

    if (parentsRes.error) {
      toast({ title: "Error", description: "Failed to load parents", variant: "destructive" })
    } else {
      setItems((parentsRes.data as unknown as Parent[]) || [])
    }

    if (studentsRes.error) {
      toast({ title: "Error", description: "Failed to load students", variant: "destructive" })
    } else {
      setAllStudents(studentsRes.data || [])
    }
    setLoading(false)
  }, [toast])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  function openAdd() {
    setEditingItem(null)
    setDialogOpen(true)
  }

  function openEdit(item: Parent) {
    setEditingItem(item)
    setDialogOpen(true)
  }

  function openDelete(item: Parent) {
    setDeletingItem(item)
    setDeleteDialogOpen(true)
  }

  function openLinkDialog(item: Parent) {
    setLinkingParent(item)
    setLinkDialogOpen(true)
  }

  async function handleSave(values: { name: string; email: string; phone: string; studentIds: string[] }) {
    setSaving(true)
    const supabase = createClient()

    const payload = {
      name: values.name,
      email: values.email || null,
      phone: values.phone || null,
    }

    let parentId: string | null = null

    if (editingItem) {
      const { error } = await supabase
        .from("parents")
        .update(payload)
        .eq("id", editingItem.id)
      if (error) {
        toast({ title: "Error", description: "Failed to update parent", variant: "destructive" })
        setSaving(false)
        return
      }
      parentId = editingItem.id
      toast({ title: "Success", description: "Parent updated successfully" })
    } else {
      const { data, error } = await supabase
        .from("parents")
        .insert(payload)
        .select("id")
        .single()
      if (error || !data) {
        toast({ title: "Error", description: "Failed to add parent", variant: "destructive" })
        setSaving(false)
        return
      }
      parentId = data.id
      toast({ title: "Success", description: "Parent added successfully" })
    }

    // Sync parent_students
    await supabase.from("parent_students").delete().eq("parent_id", parentId)
    if (values.studentIds.length > 0) {
      await supabase.from("parent_students").insert(
        values.studentIds.map((id) => ({ parent_id: parentId!, student_id: id }))
      )
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
      .from("parents")
      .delete()
      .eq("id", deletingItem.id)
    if (error) {
      toast({ title: "Error", description: "Failed to delete parent", variant: "destructive" })
    } else {
      toast({ title: "Success", description: "Parent deleted successfully" })
    }

    setSaving(false)
    setDeleteDialogOpen(false)
    setDeletingItem(null)
    fetchItems()
  }

  function handleLinksChanged() {
    fetchItems()
  }

  const filtered = items.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase())
  )

  // Get linked students for the currently linking parent (refreshed from latest items state)
  const linkingParentData = linkingParent
    ? items.find((p) => p.id === linkingParent.id)
    : null
  const linkedStudents = linkingParentData
    ? linkingParentData.parent_students.map((ps) => ps.students)
    : []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search parents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={openAdd} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add Parent
        </Button>
      </div>

      <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Children</TableHead>
            <TableHead className="w-[140px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
              </TableRow>
            ))
          ) : filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center">
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium text-muted-foreground">
                    {search ? "No matching parents" : "No parents yet"}
                  </h3>
                  <p className="text-sm text-muted-foreground/70 mt-1">
                    {search
                      ? `No parents matching "${search}".`
                      : "Get started by adding your first parent."}
                  </p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell>{item.email ?? "—"}</TableCell>
                <TableCell>{item.phone ?? "—"}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {item.parent_students.length > 0
                      ? item.parent_students.map((ps) => (
                          <Badge key={ps.students.id} variant="secondary">
                            {ps.students.name}
                          </Badge>
                        ))
                      : <span className="text-muted-foreground">—</span>}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => openLinkDialog(item)} title="Link Student">
                      <Link2 className="h-4 w-4" />
                    </Button>
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
            <DialogTitle>{editingItem ? "Edit Parent" : "Add Parent"}</DialogTitle>
            <DialogDescription>
              {editingItem ? "Update the parent details." : "Enter the details for the new parent."}
            </DialogDescription>
          </DialogHeader>
          <ParentForm
            key={editingItem?.id ?? "new"}
            onSubmit={handleSave}
            onCancel={() => setDialogOpen(false)}
            defaultValues={
              editingItem
                ? {
                    name: editingItem.name,
                    email: editingItem.email ?? "",
                    phone: editingItem.phone ?? "",
                  }
                : undefined
            }
            defaultStudentIds={
              editingItem
                ? editingItem.parent_students.map((ps) => ps.students.id)
                : undefined
            }
            students={allStudents}
            saving={saving}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Parent</DialogTitle>
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

      {linkingParent && (
        <LinkStudentDialog
          open={linkDialogOpen}
          onOpenChange={setLinkDialogOpen}
          parentId={linkingParent.id}
          parentName={linkingParent.name}
          linkedStudents={linkedStudents}
          allStudents={allStudents}
          onLinksChanged={handleLinksChanged}
        />
      )}
    </div>
  )
}
