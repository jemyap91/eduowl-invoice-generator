"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { CalendarPlus, AlertTriangle } from "lucide-react"

interface Option {
  id: string
  name: string
}

interface StudentOption {
  id: string
  name: string
  stream_id: string | null
  stream_name: string | null
  subjects: string[]
}

interface AdhocSessionFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
  makeupForSessionId?: string | null
  defaultValues?: {
    subject_id?: string
    tutor_id?: string
    classroom_id?: string
    class_type_id?: string
    stream_id?: string
    start_time?: string
    end_time?: string
    student_ids?: string[]
  }
}

export function AdhocSessionForm({ open, onOpenChange, onCreated, makeupForSessionId, defaultValues }: AdhocSessionFormProps) {
  const [subjects, setSubjects] = useState<Option[]>([])
  const [tutors, setTutors] = useState<Option[]>([])
  const [classrooms, setClassrooms] = useState<Option[]>([])
  const [classTypes, setClassTypes] = useState<Option[]>([])
  const [streams, setStreams] = useState<Option[]>([])
  const [students, setStudents] = useState<StudentOption[]>([])
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const [subjectId, setSubjectId] = useState(defaultValues?.subject_id || "")
  const [tutorId, setTutorId] = useState(defaultValues?.tutor_id || "")
  const [classroomId, setClassroomId] = useState(defaultValues?.classroom_id || "")
  const [classTypeId, setClassTypeId] = useState(defaultValues?.class_type_id || "")
  const [streamId, setStreamId] = useState(defaultValues?.stream_id || "")
  const [date, setDate] = useState("")
  const [startTime, setStartTime] = useState(defaultValues?.start_time || "")
  const [endTime, setEndTime] = useState(defaultValues?.end_time || "")
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>(defaultValues?.student_ids || [])

  useEffect(() => {
    if (!open) return
    async function fetchOptions() {
      setLoadingOptions(true)
      const supabase = createClient()
      const [subjectsRes, tutorsRes, classroomsRes, classTypesRes, streamsRes, studentsRes] =
        await Promise.all([
          supabase.from("subjects").select("id, name").order("name"),
          supabase.from("tutors").select("id, name").order("name"),
          supabase.from("classrooms").select("id, name").order("name"),
          supabase.from("class_types").select("id, name").order("name"),
          supabase.from("streams").select("id, name").order("name"),
          supabase
            .from("students")
            .select("id, name, stream_id, streams(name), student_subjects(subjects(name))")
            .order("name"),
        ])

      setSubjects(subjectsRes.data || [])
      setTutors(tutorsRes.data || [])
      setClassrooms(classroomsRes.data || [])
      setClassTypes(classTypesRes.data || [])
      setStreams(streamsRes.data || [])
      setStudents(
        (studentsRes.data || []).map((s: Record<string, unknown>) => ({
          id: s.id as string,
          name: s.name as string,
          stream_id: s.stream_id as string | null,
          stream_name: s.streams
            ? (s.streams as Record<string, unknown>).name as string
            : null,
          subjects: Array.isArray(s.student_subjects)
            ? (s.student_subjects as Record<string, unknown>[])
                .map((ss) => (ss.subjects as Record<string, unknown>)?.name as string)
                .filter(Boolean)
            : [],
        }))
      )
      setLoadingOptions(false)
    }
    fetchOptions()
  }, [open])

  function resetForm() {
    setSubjectId("")
    setTutorId("")
    setClassroomId("")
    setClassTypeId("")
    setStreamId("")
    setDate("")
    setStartTime("")
    setEndTime("")
    setSelectedStudentIds([])
  }

  function toggleStudent(studentId: string) {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    )
  }

  const isValid = subjectId && tutorId && classroomId && classTypeId && date && startTime && endTime

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid) return
    setSaving(true)

    const supabase = createClient()

    // Insert ad-hoc session
    const { data: session, error: sessionError } = await supabase
      .from("class_sessions")
      .insert({
        series_id: null,
        subject_id: subjectId,
        tutor_id: tutorId,
        classroom_id: classroomId,
        class_type_id: classTypeId,
        stream_id: streamId || null,
        date,
        start_time: startTime,
        end_time: endTime,
        status: "scheduled",
        is_adhoc: true,
        makeup_for_session_id: makeupForSessionId || null,
      })
      .select("id")
      .single()

    if (sessionError || !session) {
      toast({
        title: "Error",
        description: "Failed to create session",
        variant: "destructive",
      })
      setSaving(false)
      return
    }

    // Insert session_students
    if (selectedStudentIds.length > 0) {
      const studentPayloads = selectedStudentIds.map((studentId) => ({
        session_id: session.id,
        student_id: studentId,
        attendance_status: "pending",
      }))

      const { error: studentsError } = await supabase
        .from("session_students")
        .insert(studentPayloads)

      if (studentsError) {
        toast({
          title: "Warning",
          description: "Session created but failed to enrol some students",
          variant: "destructive",
        })
      }
    }

    toast({
      title: "Success",
      description: makeupForSessionId ? "Makeup session created" : "Extra class created",
    })

    setSaving(false)
    resetForm()
    onOpenChange(false)
    onCreated()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            <div className="flex items-center gap-2">
              <CalendarPlus className="h-5 w-5" />
              Create Extra Class
            </div>
          </DialogTitle>
          <DialogDescription>
            {makeupForSessionId
              ? "Schedule a makeup class to replace the cancelled session. Fields are pre-filled from the original session."
              : "Create a one-off class that is not part of any recurring series."}
          </DialogDescription>
        </DialogHeader>

        {loadingOptions ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            Loading options...
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              {/* Subject */}
              <div className="space-y-2">
                <Label>Subject *</Label>
                <Select value={subjectId} onValueChange={setSubjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

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

              {/* Class Type */}
              <div className="space-y-2">
                <Label>Class Type *</Label>
                <Select value={classTypeId} onValueChange={setClassTypeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select class type" />
                  </SelectTrigger>
                  <SelectContent>
                    {classTypes.map((ct) => (
                      <SelectItem key={ct.id} value={ct.id}>
                        {ct.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Stream (optional) */}
              <div className="space-y-2">
                <Label>Stream</Label>
                <Select value={streamId} onValueChange={setStreamId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select stream (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {streams.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date */}
              <div className="space-y-2">
                <Label htmlFor="adhoc-date">Date *</Label>
                <Input
                  id="adhoc-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>

              {/* Time */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="adhoc-start-time">Start Time *</Label>
                  <Input
                    id="adhoc-start-time"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adhoc-end-time">End Time *</Label>
                  <Input
                    id="adhoc-end-time"
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
                            id={`adhoc-student-${student.id}`}
                            checked={selectedStudentIds.includes(student.id)}
                            onCheckedChange={() => toggleStudent(student.id)}
                          />
                          <label
                            htmlFor={`adhoc-student-${student.id}`}
                            className="text-sm cursor-pointer select-none"
                          >
                            {student.name}
                            {(student.stream_name || student.subjects.length > 0) && (
                              <span className="text-muted-foreground ml-1">
                                ({[student.stream_name, student.subjects.length > 0 ? student.subjects.join(", ") : null].filter(Boolean).join(" — ")})
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
                {saving ? "Creating..." : "Create Session"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
