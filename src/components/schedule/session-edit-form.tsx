"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
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
import { useToast } from "@/hooks/use-toast"
import { Pencil, AlertTriangle } from "lucide-react"
import type { SessionData } from "./session-card"

interface Option {
  id: string
  name: string
}

interface StudentOption {
  id: string
  name: string
  stream_id: string | null
  stream_name: string | null
}

interface SessionEditFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  session: SessionData
  onSaved: () => void
}

export function SessionEditForm({ open, onOpenChange, session, onSaved }: SessionEditFormProps) {
  const [tutors, setTutors] = useState<Option[]>([])
  const [classrooms, setClassrooms] = useState<Option[]>([])
  const [students, setStudents] = useState<StudentOption[]>([])
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const [tutorId, setTutorId] = useState(session.tutor_id)
  const [classroomId, setClassroomId] = useState(session.classroom_id)
  const [date, setDate] = useState(session.date)
  const [startTime, setStartTime] = useState(session.start_time.slice(0, 5))
  const [endTime, setEndTime] = useState(session.end_time.slice(0, 5))
  const [notes, setNotes] = useState(session.notes || "")
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>(
    session.session_students?.map((ss) => ss.student_id) || []
  )

  useEffect(() => {
    if (!open) return
    // Reset form values when session changes
    setTutorId(session.tutor_id)
    setClassroomId(session.classroom_id)
    setDate(session.date)
    setStartTime(session.start_time.slice(0, 5))
    setEndTime(session.end_time.slice(0, 5))
    setNotes(session.notes || "")
    setSelectedStudentIds(session.session_students?.map((ss) => ss.student_id) || [])

    async function fetchOptions() {
      setLoadingOptions(true)
      const supabase = createClient()
      const [tutorsRes, classroomsRes, studentsRes] = await Promise.all([
        supabase.from("tutors").select("id, name").order("name"),
        supabase.from("classrooms").select("id, name").order("name"),
        supabase
          .from("students")
          .select("id, name, stream_id, streams(name)")
          .order("name"),
      ])

      setTutors(tutorsRes.data || [])
      setClassrooms(classroomsRes.data || [])
      setStudents(
        (studentsRes.data || []).map((s: Record<string, unknown>) => ({
          id: s.id as string,
          name: s.name as string,
          stream_id: s.stream_id as string | null,
          stream_name: s.streams
            ? (s.streams as Record<string, unknown>).name as string
            : null,
        }))
      )
      setLoadingOptions(false)
    }
    fetchOptions()
  }, [open, session])

  function toggleStudent(studentId: string) {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    )
  }

  const isValid = tutorId && classroomId && date && startTime && endTime

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid) return
    setSaving(true)

    const supabase = createClient()

    // Update the session
    const { error: updateError } = await supabase
      .from("class_sessions")
      .update({
        tutor_id: tutorId,
        classroom_id: classroomId,
        date,
        start_time: startTime,
        end_time: endTime,
        notes: notes || null,
      })
      .eq("id", session.id)

    if (updateError) {
      toast({
        title: "Error",
        description: "Failed to update session",
        variant: "destructive",
      })
      setSaving(false)
      return
    }

    // Update session_students: remove deselected, add newly selected
    const existingStudentIds = new Set(session.session_students?.map((ss) => ss.student_id) || [])
    const newStudentIds = new Set(selectedStudentIds)

    // Students to remove
    const toRemove = [...existingStudentIds].filter((id) => !newStudentIds.has(id))
    // Students to add
    const toAdd = [...newStudentIds].filter((id) => !existingStudentIds.has(id))

    if (toRemove.length > 0) {
      const { error: removeError } = await supabase
        .from("session_students")
        .delete()
        .eq("session_id", session.id)
        .in("student_id", toRemove)

      if (removeError) {
        toast({
          title: "Warning",
          description: "Session updated but failed to remove some students",
          variant: "destructive",
        })
      }
    }

    if (toAdd.length > 0) {
      const studentPayloads = toAdd.map((studentId) => ({
        session_id: session.id,
        student_id: studentId,
        attendance_status: "pending",
      }))

      const { error: addError } = await supabase
        .from("session_students")
        .insert(studentPayloads)

      if (addError) {
        toast({
          title: "Warning",
          description: "Session updated but failed to add some students",
          variant: "destructive",
        })
      }
    }

    toast({
      title: "Success",
      description: "Session updated",
    })

    setSaving(false)
    onOpenChange(false)
    onSaved()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            <div className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Edit Session
            </div>
          </DialogTitle>
          <DialogDescription>
            Update session details, reschedule, or change student enrolments.
          </DialogDescription>
        </DialogHeader>

        {loadingOptions ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            Loading options...
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              {/* Tutor */}
              <div className="space-y-2">
                <Label>Tutor *</Label>
                <Select value={tutorId} onValueChange={setTutorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select tutor" />
                  </SelectTrigger>
                  <SelectContent>
                    {tutors.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Classroom */}
              <div className="space-y-2">
                <Label>Classroom *</Label>
                <Select value={classroomId} onValueChange={setClassroomId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select classroom" />
                  </SelectTrigger>
                  <SelectContent>
                    {classrooms.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date */}
              <div className="space-y-2">
                <Label htmlFor="edit-date">Date *</Label>
                <Input
                  id="edit-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>

              {/* Time */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-start-time">Start Time *</Label>
                  <Input
                    id="edit-start-time"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-end-time">End Time *</Label>
                  <Input
                    id="edit-end-time"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    required
                  />
                </div>
              </div>
              {startTime && endTime && endTime <= startTime && (
                <div className="flex items-center gap-2 text-amber-600 text-sm">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>End time is before or equal to start time</span>
                </div>
              )}

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="edit-notes">Notes</Label>
                <Textarea
                  id="edit-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes about this session..."
                  rows={3}
                />
              </div>

              {/* Students */}
              <div className="space-y-2">
                <Label>Students ({selectedStudentIds.length} selected)</Label>
                <ScrollArea className="h-40 rounded-md border p-3">
                  {students.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No students found.</p>
                  ) : (
                    <div className="space-y-2">
                      {students.map((student) => (
                        <div key={student.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`edit-student-${student.id}`}
                            checked={selectedStudentIds.includes(student.id)}
                            onCheckedChange={() => toggleStudent(student.id)}
                          />
                          <label
                            htmlFor={`edit-student-${student.id}`}
                            className="text-sm cursor-pointer select-none"
                          >
                            {student.name}
                            {student.stream_name && (
                              <span className="text-muted-foreground ml-1">
                                ({student.stream_name})
                              </span>
                            )}
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !isValid}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
