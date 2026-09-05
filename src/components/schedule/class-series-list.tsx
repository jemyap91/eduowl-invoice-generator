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
import { Plus, Trash2, Pencil, CalendarPlus, BookOpen, ChevronRight, Calendar, CheckCircle2, XCircle, Clock, Loader2, ArrowRight } from "lucide-react"
import { ClassSeriesForm, ClassSeriesFormValues } from "./class-series-form"
import { generateSessionDates } from "@/lib/schedule/generate-sessions"

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

interface ClassSeries {
  id: string
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
  is_recurring: boolean
  created_at: string
  subjects: { name: string } | null
  tutors: { name: string } | null
  classrooms: { name: string } | null
  class_types: { name: string } | null
  streams: { name: string } | null
  session_count: number
  student_count: number
  student_names: string[]
}

interface SessionInfo {
  id: string
  date: string
  status: string
  student_count: number
  makeup_date: string | null
  cancelled_students: string[]
}

function formatTime(time: string): string {
  const [h, m] = time.split(":")
  const hour = parseInt(h)
  const ampm = hour >= 12 ? "PM" : "AM"
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  return `${hour12}:${m} ${ampm}`
}

export function ClassSeriesList() {
  const [seriesList, setSeriesList] = useState<ClassSeries[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingSeries, setEditingSeries] = useState<ClassSeries | null>(null)
  const [editStudentIds, setEditStudentIds] = useState<string[]>([])
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingSeries, setDeletingSeries] = useState<ClassSeries | null>(null)
  const [saving, setSaving] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedSessions, setExpandedSessions] = useState<SessionInfo[]>([])
  const [expandedStudents, setExpandedStudents] = useState<string[]>([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const { toast } = useToast()

  async function fetchSeries() {
    setLoading(true)
    const supabase = createClient()

    const { data, error } = await supabase
      .from("class_series")
      .select(`
        *,
        subjects(name),
        tutors(name),
        classrooms(name),
        class_types(name),
        streams(name)
      `)
      .eq("is_recurring", true)
      .order("day_of_week")
      .order("start_time")

    if (error) {
      toast({ title: "Error", description: "Failed to load class series", variant: "destructive" })
      setLoading(false)
      return
    }

    // Fetch session counts and student counts for each series
    const seriesIds = (data || []).map((s: Record<string, unknown>) => s.id as string)

    let sessionCounts: Record<string, number> = {}
    let studentCounts: Record<string, number> = {}
    let studentNameMap: Record<string, string[]> = {}

    if (seriesIds.length > 0) {
      const { data: sessions } = await supabase
        .from("class_sessions")
        .select("id, series_id")
        .in("series_id", seriesIds)

      if (sessions) {
        for (const session of sessions) {
          if (session.series_id) sessionCounts[session.series_id] = (sessionCounts[session.series_id] || 0) + 1
        }
      }

      // Get unique student counts per series via session_students
      const sessionIds = (sessions || []).map((s: { id: string }) => s.id)
      if (sessionIds.length > 0) {
        const { data: sessionStudents } = await supabase
          .from("session_students")
          .select("session_id, student_id, students(name)")
          .in("session_id", sessionIds)

        if (sessionStudents) {
          // Map session_id to series_id, then count unique students per series
          const sessionToSeries: Record<string, string> = {}
          for (const session of sessions || []) {
            if (session.series_id) sessionToSeries[session.id] = session.series_id
          }

          const seriesStudents: Record<string, Map<string, string>> = {}
          for (const ss of sessionStudents) {
            const sid = sessionToSeries[ss.session_id]
            if (sid) {
              if (!seriesStudents[sid]) seriesStudents[sid] = new Map()
              const name = (ss.students as unknown as { name: string })?.name || "Unknown"
              seriesStudents[sid].set(ss.student_id, name)
            }
          }

          for (const [sid, students] of Object.entries(seriesStudents)) {
            studentCounts[sid] = students.size
            studentNameMap[sid] = Array.from(students.values()).sort()
          }
        }
      }
    }

    setSeriesList(
      (data || []).map((s) => {
        const item = s as unknown as ClassSeries
        return {
          ...item,
          session_count: sessionCounts[item.id] || 0,
          student_count: studentCounts[item.id] || 0,
          student_names: studentNameMap[item.id] || [],
        }
      })
    )
    setLoading(false)
  }

  useEffect(() => {
    fetchSeries()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function toggleExpand(seriesId: string) {
    if (expandedId === seriesId) {
      setExpandedId(null)
      return
    }

    setExpandedId(seriesId)
    setLoadingSessions(true)
    const supabase = createClient()

    const { data: sessions } = await supabase
      .from("class_sessions")
      .select("id, date, status")
      .eq("series_id", seriesId)
      .order("date")

    if (sessions) {
      const sessionIds = sessions.map((s: { id: string }) => s.id)
      let studentCountMap: Record<string, number> = {}
      let enrolledNames: string[] = []
      let makeupDateMap: Record<string, string> = {}
      let cancelledStudentsMap: Record<string, string[]> = {}

      if (sessionIds.length > 0) {
        // Fetch student counts, names, and attendance statuses
        const { data: sessionStudents } = await supabase
          .from("session_students")
          .select("session_id, student_id, attendance_status, students(name)")
          .in("session_id", sessionIds)

        if (sessionStudents) {
          const uniqueStudents = new Map<string, string>()
          for (const ss of sessionStudents) {
            studentCountMap[ss.session_id] = (studentCountMap[ss.session_id] || 0) + 1
            const name = (ss.students as unknown as { name: string })?.name
            if (name && !uniqueStudents.has(ss.student_id)) {
              uniqueStudents.set(ss.student_id, name)
            }
            // Track per-session cancelled students
            if (ss.attendance_status === "cancelled" && name) {
              if (!cancelledStudentsMap[ss.session_id]) cancelledStudentsMap[ss.session_id] = []
              cancelledStudentsMap[ss.session_id].push(name)
            }
          }
          enrolledNames = Array.from(uniqueStudents.values()).sort()
        }

        // Fetch makeup sessions linked to cancelled sessions in this series
        const { data: makeupSessions } = await supabase
          .from("class_sessions")
          .select("makeup_for_session_id, date")
          .in("makeup_for_session_id", sessionIds)

        if (makeupSessions) {
          for (const ms of makeupSessions) {
            if (ms.makeup_for_session_id) {
              makeupDateMap[ms.makeup_for_session_id] = ms.date
            }
          }
        }
      }

      setExpandedStudents(enrolledNames)
      setExpandedSessions(
        sessions.map((s) => ({
          id: s.id,
          date: s.date,
          status: s.status ?? "scheduled",
          student_count: studentCountMap[s.id] || 0,
          makeup_date: makeupDateMap[s.id] || null,
          cancelled_students: cancelledStudentsMap[s.id] || [],
        }))
      )
    } else {
      setExpandedSessions([])
      setExpandedStudents([])
    }
    setLoadingSessions(false)
  }

  async function openEdit(series: ClassSeries) {
    // Fetch enrolled student IDs for this series from the first future session
    const supabase = createClient()
    const today = new Date().toISOString().split("T")[0]
    const { data: futureSession } = await supabase
      .from("class_sessions")
      .select("id")
      .eq("series_id", series.id)
      .gte("date", today)
      .order("date")
      .limit(1)
      .single()

    let studentIds: string[] = []
    if (futureSession) {
      const { data: sessionStudents } = await supabase
        .from("session_students")
        .select("student_id")
        .eq("session_id", futureSession.id)
      studentIds = (sessionStudents || []).map((ss: { student_id: string }) => ss.student_id)
    }

    setEditStudentIds(studentIds)
    setEditingSeries(series)
    setDialogOpen(true)
  }

  function openDelete(series: ClassSeries) {
    setDeletingSeries(series)
    setDeleteDialogOpen(true)
  }

  async function handleDelete() {
    if (!deletingSeries) return
    setSaving(true)
    const supabase = createClient()

    // 1. Find all sessions in this series
    const { data: seriesSessions } = await supabase
      .from("class_sessions")
      .select("id")
      .eq("series_id", deletingSeries.id)

    // 2. Delete any makeup sessions linked to these sessions
    if (seriesSessions && seriesSessions.length > 0) {
      const sessionIds = seriesSessions.map((s: { id: string }) => s.id)
      const { data: makeupSessions } = await supabase
        .from("class_sessions")
        .select("id")
        .in("makeup_for_session_id", sessionIds)

      if (makeupSessions && makeupSessions.length > 0) {
        const makeupIds = makeupSessions.map((s: { id: string }) => s.id)
        await supabase.from("session_students").delete().in("session_id", makeupIds)
        await supabase.from("class_sessions").delete().in("id", makeupIds)
      }
    }

    // 3. Delete the series (cascades to series sessions)
    const { error } = await supabase
      .from("class_series")
      .delete()
      .eq("id", deletingSeries.id)

    if (error) {
      toast({ title: "Error", description: "Failed to delete class series", variant: "destructive" })
    } else {
      toast({ title: "Success", description: "Class series, all sessions, and makeup sessions deleted" })
    }

    setSaving(false)
    setDeleteDialogOpen(false)
    setDeletingSeries(null)
    fetchSeries()
  }

  async function handleCreate(values: ClassSeriesFormValues) {
    setSaving(true)
    const supabase = createClient()

    // 1. Insert class_series
    const { data: series, error: seriesError } = await supabase
      .from("class_series")
      .insert({
        subject_id: values.subject_id,
        tutor_id: values.tutor_id,
        classroom_id: values.classroom_id,
        class_type_id: values.class_type_id,
        stream_id: values.stream_id,
        day_of_week: values.day_of_week,
        start_time: values.start_time,
        end_time: values.end_time,
        recurrence_start: values.recurrence_start,
        recurrence_end: values.recurrence_end,
        is_recurring: true,
      })
      .select("id")
      .single()

    if (seriesError || !series) {
      toast({
        title: "Error",
        description: "Failed to create class series",
        variant: "destructive",
      })
      setSaving(false)
      return
    }

    // 2. Generate session dates
    const sessionDates = generateSessionDates(
      values.day_of_week,
      new Date(values.recurrence_start + "T00:00:00"),
      values.recurrence_end ? new Date(values.recurrence_end + "T00:00:00") : null
    )

    // 3. Batch insert class_sessions
    const sessionPayloads = sessionDates.map((sd) => ({
      series_id: series.id,
      subject_id: values.subject_id,
      tutor_id: values.tutor_id,
      classroom_id: values.classroom_id,
      class_type_id: values.class_type_id,
      stream_id: values.stream_id,
      date: sd.date,
      start_time: values.start_time,
      end_time: values.end_time,
      status: "scheduled" as const,
      is_adhoc: false,
    }))

    const { data: sessions, error: sessionsError } = await supabase
      .from("class_sessions")
      .insert(sessionPayloads)
      .select("id")

    if (sessionsError) {
      toast({
        title: "Error",
        description: "Series created but failed to generate sessions",
        variant: "destructive",
      })
      setSaving(false)
      setDialogOpen(false)
      fetchSeries()
      return
    }

    // 4. Batch insert session_students for each session
    if (values.student_ids.length > 0 && sessions && sessions.length > 0) {
      const studentPayloads = sessions.flatMap((session: { id: string }) =>
        values.student_ids.map((studentId) => ({
          session_id: session.id,
          student_id: studentId,
          attendance_status: "pending" as const,
        }))
      )

      // Insert in batches of 500 to avoid payload limits
      const batchSize = 500
      for (let i = 0; i < studentPayloads.length; i += batchSize) {
        const batch = studentPayloads.slice(i, i + batchSize)
        const { error: studentsError } = await supabase
          .from("session_students")
          .insert(batch)

        if (studentsError) {
          toast({
            title: "Warning",
            description: "Sessions created but some student enrolments failed",
            variant: "destructive",
          })
          break
        }
      }
    }

    toast({
      title: "Success",
      description: `Class series created with ${sessions?.length || 0} sessions`,
    })

    setSaving(false)
    setDialogOpen(false)
    setEditingSeries(null)
    fetchSeries()
  }

  async function handleUpdate(values: ClassSeriesFormValues) {
    if (!editingSeries) return
    setSaving(true)
    const supabase = createClient()
    const today = new Date().toISOString().split("T")[0]

    // 1. Update the class_series record
    const { error: seriesError } = await supabase
      .from("class_series")
      .update({
        subject_id: values.subject_id,
        tutor_id: values.tutor_id,
        classroom_id: values.classroom_id,
        class_type_id: values.class_type_id,
        stream_id: values.stream_id,
        day_of_week: values.day_of_week,
        start_time: values.start_time,
        end_time: values.end_time,
        recurrence_start: values.recurrence_start,
        recurrence_end: values.recurrence_end,
      })
      .eq("id", editingSeries.id)

    if (seriesError) {
      toast({ title: "Error", description: "Failed to update class series", variant: "destructive" })
      setSaving(false)
      return
    }

    // 2. Update future sessions with changed fields
    const { error: sessionsError } = await supabase
      .from("class_sessions")
      .update({
        subject_id: values.subject_id,
        tutor_id: values.tutor_id,
        classroom_id: values.classroom_id,
        class_type_id: values.class_type_id,
        stream_id: values.stream_id,
        start_time: values.start_time,
        end_time: values.end_time,
      })
      .eq("series_id", editingSeries.id)
      .gte("date", today)

    if (sessionsError) {
      toast({ title: "Warning", description: "Series updated but failed to update future sessions", variant: "destructive" })
    }

    // 3. Handle day_of_week or recurrence date changes — regenerate future sessions
    if (
      values.day_of_week !== editingSeries.day_of_week ||
      values.recurrence_start !== editingSeries.recurrence_start ||
      values.recurrence_end !== (editingSeries.recurrence_end || "")
    ) {
      // Delete future sessions
      const { data: futureSessions } = await supabase
        .from("class_sessions")
        .select("id")
        .eq("series_id", editingSeries.id)
        .gte("date", today)

      if (futureSessions && futureSessions.length > 0) {
        const futureIds = futureSessions.map((s: { id: string }) => s.id)
        await supabase.from("session_students").delete().in("session_id", futureIds)
        await supabase.from("class_sessions").delete().in("id", futureIds)
      }

      // Regenerate from today onwards
      const effectiveStart = values.recurrence_start > today ? values.recurrence_start : today
      const sessionDates = generateSessionDates(
        values.day_of_week,
        new Date(effectiveStart + "T00:00:00"),
        values.recurrence_end ? new Date(values.recurrence_end + "T00:00:00") : null
      )

      if (sessionDates.length > 0) {
        const sessionPayloads = sessionDates.map((sd) => ({
          series_id: editingSeries.id,
          subject_id: values.subject_id,
          tutor_id: values.tutor_id,
          classroom_id: values.classroom_id,
          class_type_id: values.class_type_id,
          stream_id: values.stream_id,
          date: sd.date,
          start_time: values.start_time,
          end_time: values.end_time,
          status: "scheduled" as const,
          is_adhoc: false,
        }))

        const { data: newSessions } = await supabase
          .from("class_sessions")
          .insert(sessionPayloads)
          .select("id")

        // Re-enrol students in new sessions
        if (values.student_ids.length > 0 && newSessions && newSessions.length > 0) {
          const studentPayloads = newSessions.flatMap((session: { id: string }) =>
            values.student_ids.map((studentId) => ({
              session_id: session.id,
              student_id: studentId,
              attendance_status: "pending" as const,
            }))
          )
          const batchSize = 500
          for (let i = 0; i < studentPayloads.length; i += batchSize) {
            await supabase.from("session_students").insert(studentPayloads.slice(i, i + batchSize))
          }
        }
      }
    } else {
      // Day/dates unchanged — just sync students on future sessions
      const { data: futureSessions } = await supabase
        .from("class_sessions")
        .select("id")
        .eq("series_id", editingSeries.id)
        .gte("date", today)

      if (futureSessions && futureSessions.length > 0) {
        const futureIds = futureSessions.map((s: { id: string }) => s.id)
        // Remove old enrolments
        await supabase.from("session_students").delete().in("session_id", futureIds)
        // Re-enrol
        if (values.student_ids.length > 0) {
          const studentPayloads = futureSessions.flatMap((session: { id: string }) =>
            values.student_ids.map((studentId) => ({
              session_id: session.id,
              student_id: studentId,
              attendance_status: "pending" as const,
            }))
          )
          const batchSize = 500
          for (let i = 0; i < studentPayloads.length; i += batchSize) {
            await supabase.from("session_students").insert(studentPayloads.slice(i, i + batchSize))
          }
        }
      }
    }

    toast({ title: "Success", description: "Class series updated. Future sessions have been updated." })
    setSaving(false)
    setDialogOpen(false)
    setEditingSeries(null)
    fetchSeries()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div />
        <Button onClick={() => { setEditingSeries(null); setDialogOpen(true) }} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Create Class Series
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[30px]" />
            <TableHead>Subject</TableHead>
            <TableHead>Students</TableHead>
            <TableHead>Day / Time</TableHead>
            <TableHead>Classroom</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Stream</TableHead>
            <TableHead>Sessions</TableHead>
            <TableHead>Tutor</TableHead>
            <TableHead className="w-[80px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 10 }).map((_, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : seriesList.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="text-center">
                <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                  <BookOpen className="h-8 w-8" />
                  <p>No class series yet. Create one to get started.</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            seriesList.map((series) => {
              const isExpanded = expandedId === series.id
              const today = new Date().toISOString().split("T")[0]
              return (
                <>
                  <TableRow
                    key={series.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => toggleExpand(series.id)}
                  >
                    <TableCell className="w-[30px] px-2">
                      <ChevronRight
                        className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {series.subjects?.name || "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {series.student_names.length > 0
                          ? series.student_names.map((name) => (
                              <Badge
                                key={name}
                                variant="secondary"
                                className="bg-primary/10 text-primary border-0 text-xs"
                              >
                                {name}
                              </Badge>
                            ))
                          : <span className="text-muted-foreground text-sm">—</span>
                        }
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{DAYS[series.day_of_week]}</div>
                        <div className="text-muted-foreground">
                          {formatTime(series.start_time)} - {formatTime(series.end_time)}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{series.classrooms?.name || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {series.class_types?.name || "-"}
                      </Badge>
                    </TableCell>
                    <TableCell>{series.streams?.name || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{series.session_count}</Badge>
                    </TableCell>
                    <TableCell>{series.tutors?.name || "-"}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(series)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDelete(series)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow key={`${series.id}-detail`}>
                      <TableCell colSpan={10} className="p-0">
                        <div className="border-t border-b border-border/50 bg-muted/30 px-6 py-4">
                          {loadingSessions ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                              <Loader2 className="h-4 w-4 animate-spin" /> Loading sessions...
                            </div>
                          ) : expandedSessions.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No sessions generated for this series.</p>
                          ) : (
                            <div className="space-y-4">
                              {expandedStudents.length > 0 && (
                                <div>
                                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                                    Enrolled Students ({expandedStudents.length})
                                  </h4>
                                  <div className="flex flex-wrap gap-1.5">
                                    {expandedStudents.map((name) => (
                                      <Badge key={name} variant="secondary" className="text-xs">
                                        {name}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                              <div className="flex items-center justify-between">
                                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                  Session Dates ({expandedSessions.length} sessions)
                                </h4>
                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Upcoming</span>
                                  <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-500" /> Completed</span>
                                  <span className="flex items-center gap-1"><XCircle className="h-3 w-3 text-red-400" /> Cancelled</span>
                                </div>
                              </div>
                              <div className="space-y-3">
                                {(() => {
                                  const MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
                                    "July", "August", "September", "October", "November", "December"]
                                  const grouped: Record<string, SessionInfo[]> = {}
                                  for (const session of expandedSessions) {
                                    const d = new Date(session.date + "T00:00:00")
                                    const key = `${d.getFullYear()}-${d.getMonth()}`
                                    if (!grouped[key]) grouped[key] = []
                                    grouped[key].push(session)
                                  }
                                  return Object.entries(grouped).map(([key, sessions]) => {
                                    const [yr, mo] = key.split("-")
                                    return (
                                      <div key={key}>
                                        <h5 className="text-xs font-semibold text-muted-foreground mb-1.5">
                                          {MONTH_NAMES[parseInt(mo)]} {yr}
                                        </h5>
                                        <div className="flex flex-wrap gap-2">
                                          {sessions.map((session) => {
                                            const isPast = session.date < today
                                            const isCompleted = session.status === "completed"
                                            const isCancelled = session.status === "cancelled"
                                            const dateObj = new Date(session.date + "T00:00:00")
                                            const formatted = dateObj.toLocaleDateString("en-GB", {
                                              weekday: "short",
                                              day: "numeric",
                                              month: "short",
                                              year: "numeric",
                                            })
                                            const makeupFormatted = session.makeup_date
                                              ? new Date(session.makeup_date + "T00:00:00").toLocaleDateString("en-GB", {
                                                  weekday: "short",
                                                  day: "numeric",
                                                  month: "short",
                                                })
                                              : null
                                            return isCancelled ? (
                                              <div
                                                key={session.id}
                                                className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm"
                                              >
                                                <div className="flex items-center gap-2">
                                                  <XCircle className="h-3.5 w-3.5 shrink-0 text-red-400" />
                                                  <span className="text-red-400 line-through">{formatted}</span>
                                                </div>
                                                {makeupFormatted && (
                                                  <div className="flex items-center gap-1.5 mt-1 ml-[22px] text-xs">
                                                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                                    <span className="text-blue-600 font-medium">{makeupFormatted}</span>
                                                  </div>
                                                )}
                                              </div>
                                            ) : (
                                              <div
                                                key={session.id}
                                                className={`rounded-md border px-3 py-2 text-sm ${
                                                  session.cancelled_students.length > 0
                                                    ? "border-red-200 bg-red-50/60"
                                                    : isCompleted
                                                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                                      : isPast
                                                        ? "border-border/50 bg-muted/50 text-muted-foreground"
                                                        : "border-border bg-white"
                                                }`}
                                              >
                                                <div className="flex items-center gap-2">
                                                  {session.cancelled_students.length > 0 ? (
                                                    <XCircle className="h-3.5 w-3.5 shrink-0 text-red-400" />
                                                  ) : isCompleted ? (
                                                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                                                  ) : (
                                                    <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                                  )}
                                                  <span className="truncate">{formatted}</span>
                                                  {session.student_count > 0 && (
                                                    <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0">
                                                      {session.student_count}
                                                    </Badge>
                                                  )}
                                                </div>
                                                {session.cancelled_students.length > 0 && (
                                                  <div className="mt-1 ml-[22px] text-xs text-red-500">
                                                    Cancelled: {session.cancelled_students.join(", ")}
                                                  </div>
                                                )}
                                              </div>
                                            )
                                          })}
                                        </div>
                                      </div>
                                    )
                                  })
                                })()}
                              </div>
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              )
            })
          )}
        </TableBody>
      </Table>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open)
        if (!open) setEditingSeries(null)
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              <div className="flex items-center gap-2">
                <CalendarPlus className="h-5 w-5" />
                {editingSeries ? "Edit Class Series" : "Create Class Series"}
              </div>
            </DialogTitle>
            <DialogDescription>
              {editingSeries
                ? "Update the series details. Changes will apply to all future sessions."
                : "Set up a recurring class. Sessions will be automatically generated for each week within the recurrence period."}
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 -mx-6 px-6">
          <ClassSeriesForm
            key={editingSeries?.id ?? (dialogOpen ? "open" : "closed")}
            onSubmit={editingSeries ? handleUpdate : handleCreate}
            onCancel={() => { setDialogOpen(false); setEditingSeries(null) }}
            isLoading={saving}
            isEditMode={!!editingSeries}
            defaultValues={editingSeries ? {
              subject_id: editingSeries.subject_id,
              tutor_id: editingSeries.tutor_id,
              classroom_id: editingSeries.classroom_id,
              class_type_id: editingSeries.class_type_id,
              stream_id: editingSeries.stream_id,
              day_of_week: editingSeries.day_of_week,
              start_time: editingSeries.start_time,
              end_time: editingSeries.end_time,
              recurrence_start: editingSeries.recurrence_start,
              recurrence_end: editingSeries.recurrence_end,
              student_ids: editStudentIds,
            } : undefined}
          />
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Class Series</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this class series? This will also
              delete all {deletingSeries?.session_count || 0} sessions and
              student enrolments. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={saving}
            >
              {saving ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
