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
import { Plus, Pencil, Trash2, Search, Users } from "lucide-react"
import { TutorForm } from "./tutor-form"

interface SubjectInfo {
  id: string
  name: string
}

interface StreamInfo {
  id: string
  name: string
}

interface Tutor {
  id: string
  name: string
  email: string | null
  phone: string | null
  created_at: string
  tutor_subjects: { subjects: SubjectInfo }[]
  tutor_streams: { streams: StreamInfo }[]
}

export function TutorList() {
  const [tutors, setTutors] = useState<Tutor[]>([])
  const [subjects, setSubjects] = useState<SubjectInfo[]>([])
  const [streams, setStreams] = useState<StreamInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingTutor, setEditingTutor] = useState<Tutor | null>(null)
  const [deletingTutor, setDeletingTutor] = useState<Tutor | null>(null)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const fetchTutors = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    const [tutorsRes, subjectsRes, streamsRes] = await Promise.all([
      supabase
        .from("tutors")
        .select("*, tutor_subjects(subjects(id, name)), tutor_streams(streams(id, name))")
        .order("name"),
      supabase
        .from("subjects")
        .select("id, name")
        .order("name"),
      supabase
        .from("streams")
        .select("id, name")
        .order("level_order"),
    ])

    if (tutorsRes.error) {
      toast({ title: "Error", description: "Failed to load tutors", variant: "destructive" })
    } else {
      setTutors((tutorsRes.data as unknown as Tutor[]) || [])
    }

    if (subjectsRes.error) {
      toast({ title: "Error", description: "Failed to load subjects", variant: "destructive" })
    } else {
      setSubjects(subjectsRes.data || [])
    }

    if (streamsRes.error) {
      toast({ title: "Error", description: "Failed to load streams", variant: "destructive" })
    } else {
      setStreams(streamsRes.data || [])
    }

    setLoading(false)
  }, [toast])

  useEffect(() => {
    fetchTutors()
  }, [fetchTutors])

  const filteredTutors = tutors.filter((tutor) =>
    tutor.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  function openAdd() {
    setEditingTutor(null)
    setDialogOpen(true)
  }

  function openEdit(tutor: Tutor) {
    setEditingTutor(tutor)
    setDialogOpen(true)
  }

  function openDelete(tutor: Tutor) {
    setDeletingTutor(tutor)
    setDeleteDialogOpen(true)
  }

  async function handleSave(values: { name: string; email: string; phone: string; subjectIds: string[]; streamIds: string[] }) {
    setSaving(true)
    const supabase = createClient()

    const payload = {
      name: values.name,
      email: values.email || null,
      phone: values.phone || null,
    }

    let tutorId: string | null = null

    if (editingTutor) {
      const { error } = await supabase
        .from("tutors")
        .update(payload)
        .eq("id", editingTutor.id)
      if (error) {
        toast({ title: "Error", description: "Failed to update tutor", variant: "destructive" })
        setSaving(false)
        return
      }
      tutorId = editingTutor.id
      toast({ title: "Success", description: "Tutor updated successfully" })
    } else {
      const { data, error } = await supabase
        .from("tutors")
        .insert(payload)
        .select("id")
        .single()
      if (error || !data) {
        toast({ title: "Error", description: "Failed to add tutor", variant: "destructive" })
        setSaving(false)
        return
      }
      tutorId = data.id
      toast({ title: "Success", description: "Tutor added successfully" })
    }

    // Sync tutor_subjects
    await supabase.from("tutor_subjects").delete().eq("tutor_id", tutorId)
    if (values.subjectIds.length > 0) {
      await supabase.from("tutor_subjects").insert(
        values.subjectIds.map((id) => ({ tutor_id: tutorId!, subject_id: id }))
      )
    }

    // Sync tutor_streams
    await supabase.from("tutor_streams").delete().eq("tutor_id", tutorId)
    if (values.streamIds.length > 0) {
      await supabase.from("tutor_streams").insert(
        values.streamIds.map((id) => ({ tutor_id: tutorId!, stream_id: id }))
      )
    }

    setSaving(false)
    setDialogOpen(false)
    fetchTutors()
  }

  async function handleDelete() {
    if (!deletingTutor) return
    setSaving(true)
    const supabase = createClient()

    const { error } = await supabase
      .from("tutors")
      .delete()
      .eq("id", deletingTutor.id)
    if (error) {
      toast({ title: "Error", description: "Failed to delete tutor", variant: "destructive" })
    } else {
      toast({ title: "Success", description: "Tutor deleted successfully" })
    }

    setSaving(false)
    setDeleteDialogOpen(false)
    setDeletingTutor(null)
    fetchTutors()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tutors..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={openAdd} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add Tutor
        </Button>
      </div>

      <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Subjects</TableHead>
            <TableHead>Levels</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
              </TableRow>
            ))
          ) : filteredTutors.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center">
                <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                  <Users className="h-8 w-8" />
                  {searchQuery ? (
                    <p>No tutors matching &quot;{searchQuery}&quot;</p>
                  ) : (
                    <p>No tutors found. Add one to get started.</p>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ) : (
            filteredTutors.map((tutor) => (
              <TableRow key={tutor.id}>
                <TableCell className="font-medium">{tutor.name}</TableCell>
                <TableCell>{tutor.email || "-"}</TableCell>
                <TableCell>{tutor.phone || "-"}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {tutor.tutor_subjects.length > 0
                      ? tutor.tutor_subjects.map((ts) => (
                          <Badge key={ts.subjects.id} variant="secondary">
                            {ts.subjects.name}
                          </Badge>
                        ))
                      : <span className="text-muted-foreground">-</span>}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {tutor.tutor_streams.length > 0
                      ? tutor.tutor_streams.map((ts) => (
                          <Badge key={ts.streams.id} variant="outline">
                            {ts.streams.name}
                          </Badge>
                        ))
                      : <span className="text-muted-foreground">-</span>}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(tutor)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openDelete(tutor)}>
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
            <DialogTitle>{editingTutor ? "Edit Tutor" : "Add Tutor"}</DialogTitle>
            <DialogDescription>
              {editingTutor
                ? "Update the tutor's details."
                : "Enter the details for the new tutor."}
            </DialogDescription>
          </DialogHeader>
          <TutorForm
            key={editingTutor?.id || "new"}
            onSubmit={handleSave}
            onCancel={() => setDialogOpen(false)}
            defaultValues={
              editingTutor
                ? {
                    name: editingTutor.name,
                    email: editingTutor.email || "",
                    phone: editingTutor.phone || "",
                  }
                : undefined
            }
            defaultSubjectIds={
              editingTutor
                ? editingTutor.tutor_subjects.map((ts) => ts.subjects.id)
                : undefined
            }
            defaultStreamIds={
              editingTutor
                ? editingTutor.tutor_streams.map((ts) => ts.streams.id)
                : undefined
            }
            subjects={subjects}
            streams={streams}
            isLoading={saving}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Tutor</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deletingTutor?.name}&quot;? This action cannot be undone.
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
