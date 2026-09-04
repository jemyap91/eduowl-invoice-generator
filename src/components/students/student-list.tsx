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
import { Badge } from "@/components/ui/badge"
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
import { Plus, Pencil, Trash2, Search, GraduationCap } from "lucide-react"
import { StudentForm } from "./student-form"

interface Stream {
  id: string
  name: string
  level_order: number
}

interface SubjectInfo {
  id: string
  name: string
  level: string
}

interface ParentInfo {
  id: string
  name: string
}

interface ParentOption {
  id: string
  name: string
}

interface Student {
  id: string
  name: string
  stream_id: string | null
  streams: { name: string } | null
  parent_students: { parents: ParentInfo }[]
  student_subjects: { subjects: SubjectInfo }[]
}

export function StudentList() {
  const [items, setItems] = useState<Student[]>([])
  const [streams, setStreams] = useState<Stream[]>([])
  const [subjects, setSubjects] = useState<SubjectInfo[]>([])
  const [allParents, setAllParents] = useState<ParentOption[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Student | null>(null)
  const [deletingItem, setDeletingItem] = useState<Student | null>(null)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState("")
  const { toast } = useToast()

  const fetchItems = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const [studentsRes, streamsRes, subjectsRes, parentsRes] = await Promise.all([
      supabase
        .from("students")
        .select("*, streams(name), parent_students(parents(id, name)), student_subjects(subjects(id, name, level))")
        .order("name"),
      supabase
        .from("streams")
        .select("*")
        .order("level_order"),
      supabase
        .from("subjects")
        .select("id, name, level")
        .order("name"),
      supabase
        .from("parents")
        .select("id, name")
        .order("name"),
    ])

    if (studentsRes.error) {
      toast({ title: "Error", description: "Failed to load students", variant: "destructive" })
    } else {
      setItems((studentsRes.data as unknown as Student[]) || [])
    }

    if (streamsRes.error) {
      toast({ title: "Error", description: "Failed to load streams", variant: "destructive" })
    } else {
      setStreams(streamsRes.data || [])
    }

    if (subjectsRes.error) {
      toast({ title: "Error", description: "Failed to load subjects", variant: "destructive" })
    } else {
      setSubjects(subjectsRes.data || [])
    }

    if (parentsRes.error) {
      toast({ title: "Error", description: "Failed to load parents", variant: "destructive" })
    } else {
      setAllParents(parentsRes.data || [])
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

  function openEdit(item: Student) {
    setEditingItem(item)
    setDialogOpen(true)
  }

  function openDelete(item: Student) {
    setDeletingItem(item)
    setDeleteDialogOpen(true)
  }

  async function handleSave(values: { name: string; stream_id: string | null; subjectIds: string[]; parentIds: string[] }) {
    setSaving(true)
    const supabase = createClient()

    const payload = {
      name: values.name,
      stream_id: values.stream_id,
    }

    let studentId: string | null = null

    if (editingItem) {
      const { error } = await supabase
        .from("students")
        .update(payload)
        .eq("id", editingItem.id)
      if (error) {
        toast({ title: "Error", description: "Failed to update student", variant: "destructive" })
        setSaving(false)
        return
      }
      studentId = editingItem.id
      toast({ title: "Success", description: "Student updated successfully" })
    } else {
      const { data, error } = await supabase
        .from("students")
        .insert(payload)
        .select("id")
        .single()
      if (error || !data) {
        toast({ title: "Error", description: "Failed to add student", variant: "destructive" })
        setSaving(false)
        return
      }
      studentId = data.id
      toast({ title: "Success", description: "Student added successfully" })
    }

    // Sync student_subjects
    await supabase.from("student_subjects").delete().eq("student_id", studentId)
    if (values.subjectIds.length > 0) {
      await supabase.from("student_subjects").insert(
        values.subjectIds.map((id) => ({ student_id: studentId!, subject_id: id }))
      )
    }

    // Sync parent_students
    await supabase.from("parent_students").delete().eq("student_id", studentId)
    if (values.parentIds.length > 0) {
      await supabase.from("parent_students").insert(
        values.parentIds.map((id) => ({ student_id: studentId!, parent_id: id }))
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
      .from("students")
      .delete()
      .eq("id", deletingItem.id)
    if (error) {
      toast({ title: "Error", description: "Failed to delete student", variant: "destructive" })
    } else {
      toast({ title: "Success", description: "Student deleted successfully" })
    }

    setSaving(false)
    setDeleteDialogOpen(false)
    setDeletingItem(null)
    fetchItems()
  }

  const filtered = items.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search students..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={openAdd} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add Student
        </Button>
      </div>

      <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Stream</TableHead>
            <TableHead>Subjects</TableHead>
            <TableHead>Parent(s)</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
              </TableRow>
            ))
          ) : filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center">
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <GraduationCap className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium text-muted-foreground">
                    {search ? "No matching students" : "No students yet"}
                  </h3>
                  <p className="text-sm text-muted-foreground/70 mt-1">
                    {search
                      ? `No students matching "${search}".`
                      : "Get started by adding your first student."}
                  </p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell>{item.streams?.name ?? "\u2014"}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {item.student_subjects.length > 0
                      ? item.student_subjects.map((ss) => (
                          <Badge key={ss.subjects.id} variant="secondary">
                            {ss.subjects.name}
                          </Badge>
                        ))
                      : <span className="text-muted-foreground">—</span>}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {item.parent_students.length > 0
                      ? item.parent_students.map((ps) => (
                          <Badge key={ps.parents.id} variant="secondary">
                            {ps.parents.name}
                          </Badge>
                        ))
                      : <span className="text-muted-foreground">—</span>}
                  </div>
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
            <DialogTitle>{editingItem ? "Edit Student" : "Add Student"}</DialogTitle>
            <DialogDescription>
              {editingItem ? "Update the student details." : "Enter the details for the new student."}
            </DialogDescription>
          </DialogHeader>
          <StudentForm
            key={editingItem?.id ?? "new"}
            onSubmit={handleSave}
            onCancel={() => setDialogOpen(false)}
            defaultValues={
              editingItem
                ? { name: editingItem.name, stream_id: editingItem.stream_id }
                : undefined
            }
            defaultSubjectIds={
              editingItem
                ? editingItem.student_subjects.map((ss) => ss.subjects.id)
                : undefined
            }
            defaultParentIds={
              editingItem
                ? editingItem.parent_students.map((ps) => ps.parents.id)
                : undefined
            }
            subjects={subjects}
            streams={streams}
            parents={allParents}
            saving={saving}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Student</DialogTitle>
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
