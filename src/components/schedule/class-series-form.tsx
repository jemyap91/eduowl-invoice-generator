"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { AlertTriangle } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { DialogFooter } from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Option {
  id: string
  name: string
}

function initFrom24(time: string): { hour: string; minute: string; period: string } {
  if (!time) return { hour: "", minute: "", period: "" }
  const [h, m] = time.split(":")
  const hour24 = parseInt(h)
  const period = hour24 >= 12 ? "PM" : "AM"
  const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24
  return { hour: String(hour12), minute: m, period }
}

function to24(hour: string, minute: string, period: string): string {
  if (!hour || !minute || !period) return ""
  let h = parseInt(hour)
  if (period === "PM" && h !== 12) h += 12
  if (period === "AM" && h === 12) h = 0
  return `${String(h).padStart(2, "0")}:${minute}`
}

function TimeSelect({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const [hour, setHour] = useState(() => initFrom24(value).hour)
  const [minute, setMinute] = useState(() => initFrom24(value).minute)
  const [period, setPeriod] = useState(() => initFrom24(value).period)

  function handleHour(v: string) {
    setHour(v)
    const result = to24(v, minute, period)
    if (result) onChange(result)
  }
  function handleMinute(v: string) {
    setMinute(v)
    const result = to24(hour, v, period)
    if (result) onChange(result)
  }
  function handlePeriod(v: string) {
    setPeriod(v)
    const result = to24(hour, minute, v)
    if (result) onChange(result)
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-1.5">
        <Select value={hour || undefined} onValueChange={handleHour}>
          <SelectTrigger className="w-[70px]">
            <SelectValue placeholder="Hr" />
          </SelectTrigger>
          <SelectContent position="popper" className="max-h-60">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
              <SelectItem key={h} value={String(h)}>{h}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={minute || undefined} onValueChange={handleMinute}>
          <SelectTrigger className="w-[70px]">
            <SelectValue placeholder="Min" />
          </SelectTrigger>
          <SelectContent position="popper" className="max-h-60">
            {["00", "15", "30", "45"].map((m) => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={period || undefined} onValueChange={handlePeriod}>
          <SelectTrigger className="w-[72px]">
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="AM">AM</SelectItem>
            <SelectItem value="PM">PM</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

interface StudentOption {
  id: string
  name: string
  stream_id: string | null
  stream_name: string | null
  subjects: string[]
}

export interface ClassSeriesFormValues {
  subject_id: string
  tutor_id: string
  classroom_id: string
  class_type_id: string
  stream_id: string | null
  day_of_week: number
  start_time: string
  end_time: string
  recurrence_start: string
  recurrence_end: string | null
  student_ids: string[]
}

interface ClassSeriesFormProps {
  onSubmit: (values: ClassSeriesFormValues) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
  defaultValues?: Partial<ClassSeriesFormValues>
  isEditMode?: boolean
}

const DAYS_OF_WEEK = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
]

export function ClassSeriesForm({ onSubmit, onCancel, isLoading, defaultValues, isEditMode }: ClassSeriesFormProps) {
  const [subjects, setSubjects] = useState<Option[]>([])
  const [tutors, setTutors] = useState<Option[]>([])
  const [classrooms, setClassrooms] = useState<Option[]>([])
  const [classTypes, setClassTypes] = useState<Option[]>([])
  const [streams, setStreams] = useState<Option[]>([])
  const [students, setStudents] = useState<StudentOption[]>([])
  const [loadingOptions, setLoadingOptions] = useState(true)

  const [subjectId, setSubjectId] = useState(defaultValues?.subject_id || "")
  const [tutorId, setTutorId] = useState(defaultValues?.tutor_id || "")
  const [classroomId, setClassroomId] = useState(defaultValues?.classroom_id || "")
  const [classTypeId, setClassTypeId] = useState(defaultValues?.class_type_id || "")
  const [streamId, setStreamId] = useState(defaultValues?.stream_id || "")
  const [dayOfWeek, setDayOfWeek] = useState(defaultValues?.day_of_week !== undefined ? String(defaultValues.day_of_week) : "")
  const [startTime, setStartTime] = useState(defaultValues?.start_time || "")
  const [endTime, setEndTime] = useState(defaultValues?.end_time || "")
  const [recurrenceStart, setRecurrenceStart] = useState(defaultValues?.recurrence_start || "")
  const [recurrenceEnd, setRecurrenceEnd] = useState(defaultValues?.recurrence_end || "")
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>(defaultValues?.student_ids || [])

  useEffect(() => {
    async function fetchOptions() {
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
  }, [])

  function toggleStudent(studentId: string) {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    )
  }

  const isValid =
    subjectId &&
    tutorId &&
    classroomId &&
    classTypeId &&
    dayOfWeek !== "" &&
    startTime &&
    endTime &&
    recurrenceStart

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid) return
    await onSubmit({
      subject_id: subjectId,
      tutor_id: tutorId,
      classroom_id: classroomId,
      class_type_id: classTypeId,
      stream_id: streamId || null,
      day_of_week: parseInt(dayOfWeek),
      start_time: startTime,
      end_time: endTime,
      recurrence_start: recurrenceStart,
      recurrence_end: recurrenceEnd || null,
      student_ids: selectedStudentIds,
    })
  }

  if (loadingOptions) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        Loading options...
      </div>
    )
  }

  return (
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

        {/* Day of Week */}
        <div className="space-y-2">
          <Label>Day of Week *</Label>
          <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
            <SelectTrigger>
              <SelectValue placeholder="Select day" />
            </SelectTrigger>
            <SelectContent>
              {DAYS_OF_WEEK.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Time */}
        <div className="grid grid-cols-2 gap-4">
          <TimeSelect label="Start Time *" value={startTime} onChange={setStartTime} />
          <TimeSelect label="End Time *" value={endTime} onChange={setEndTime} />
        </div>
        {startTime && endTime && endTime <= startTime && (
          <div className="flex items-center gap-2 text-amber-600 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>End time is before or equal to start time</span>
          </div>
        )}

        {/* Recurrence Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="recurrence-start">Recurrence Start *</Label>
            <Input
              id="recurrence-start"
              type="date"
              value={recurrenceStart}
              onChange={(e) => setRecurrenceStart(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="recurrence-end">Recurrence End</Label>
            <Input
              id="recurrence-end"
              type="date"
              value={recurrenceEnd}
              onChange={(e) => setRecurrenceEnd(e.target.value)}
            />
          </div>
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
                      id={`student-${student.id}`}
                      checked={selectedStudentIds.includes(student.id)}
                      onCheckedChange={() => toggleStudent(student.id)}
                    />
                    <label
                      htmlFor={`student-${student.id}`}
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
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading || !isValid}>
          {isLoading ? (isEditMode ? "Saving..." : "Creating...") : (isEditMode ? "Save Changes" : "Create Series")}
        </Button>
      </DialogFooter>
    </form>
  )
}
