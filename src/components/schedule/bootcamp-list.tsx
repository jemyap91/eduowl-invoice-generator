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
import { Plus, Trash2, ChevronRight, Calendar, CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react"
import { BootcampForm, BootcampFormValues } from "./bootcamp-form"

interface BootcampSeries {
  id: string
  subject_id: string
  tutor_id: string
  classroom_id: string
  class_type_id: string
  stream_id: string | null
  start_time: string
  end_time: string
  recurrence_start: string
  recurrence_end: string | null
  created_at: string
  subjects: { name: string } | null
  tutors: { name: string } | null
  classrooms: { name: string } | null
  class_types: { name: string } | null
  streams: { name: string } | null
  session_count: number
  student_count: number
}

interface SessionInfo {
  id: string
  date: string
  status: string
  student_count: number
}

function formatTime(time: string): string {
  const [h, m] = time.split(":")
  const hour = parseInt(h)
  const ampm = hour >= 12 ? "PM" : "AM"
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  return `${hour12}:${m} ${ampm}`
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

export function BootcampList() {
  const [bootcamps, setBootcamps] = useState<BootcampSeries[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingBootcamp, setDeletingBootcamp] = useState<BootcampSeries | null>(null)
  const [saving, setSaving] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedSessions, setExpandedSessions] = useState<SessionInfo[]>([])
  const [expandedStudents, setExpandedStudents] = useState<string[]>([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const { toast } = useToast()

  async function fetchBootcamps() {
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
      .eq("is_recurring", false)
      .order("created_at", { ascending: false })

    if (error) {
      toast({ title: "Error", description: "Failed to load bootcamps", variant: "destructive" })
      setLoading(false)
      return
    }

    const seriesIds = (data || []).map((s: Record<string, unknown>) => s.id as string)

    let sessionCounts: Record<string, number> = {}
    let studentCounts: Record<string, number> = {}

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

      const sessionIds = (sessions || []).map((s: { id: string }) => s.id)
      if (sessionIds.length > 0) {
        const { data: sessionStudents } = await supabase
          .from("session_students")
          .select("session_id, student_id")
          .in("session_id", sessionIds)

        if (sessionStudents) {
          const sessionToSeries: Record<string, string> = {}
          for (const session of sessions || []) {
            if (session.series_id) sessionToSeries[session.id] = session.series_id
          }

          const seriesStudents: Record<string, Set<string>> = {}
          for (const ss of sessionStudents) {
            const sid = sessionToSeries[ss.session_id]
            if (sid) {
              if (!seriesStudents[sid]) seriesStudents[sid] = new Set()
              seriesStudents[sid].add(ss.student_id)
            }
          }

          for (const [sid, students] of Object.entries(seriesStudents)) {
            studentCounts[sid] = students.size
          }
        }
      }
    }

    setBootcamps(
      (data || []).map((s) => {
        const item = s as unknown as BootcampSeries
        return {
          ...item,
          session_count: sessionCounts[item.id] || 0,
          student_count: studentCounts[item.id] || 0,
        }
      })
    )
    setLoading(false)
  }

  useEffect(() => {
    fetchBootcamps()
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

      if (sessionIds.length > 0) {
        const { data: sessionStudents } = await supabase
          .from("session_students")
          .select("session_id, student_id, students(name)")
          .in("session_id", sessionIds)

        if (sessionStudents) {
          const uniqueStudents = new Map<string, string>()
          for (const ss of sessionStudents) {
            studentCountMap[ss.session_id] = (studentCountMap[ss.session_id] || 0) + 1
            const name = (ss.students as unknown as { name: string })?.name
            if (name && !uniqueStudents.has(ss.student_id)) {
              uniqueStudents.set(ss.student_id, name)
            }
          }
          enrolledNames = Array.from(uniqueStudents.values()).sort()
        }
      }

      setExpandedStudents(enrolledNames)
      setExpandedSessions(
        sessions.map((s) => ({
          id: s.id,
          date: s.date,
          status: s.status ?? "scheduled",
          student_count: studentCountMap[s.id] || 0,
        }))
      )
    } else {
      setExpandedSessions([])
      setExpandedStudents([])
    }
    setLoadingSessions(false)
  }

  function openDelete(bootcamp: BootcampSeries) {
    setDeletingBootcamp(bootcamp)
    setDeleteDialogOpen(true)
  }

  async function handleDelete() {
    if (!deletingBootcamp) return
    setSaving(true)
    const supabase = createClient()

    const { error } = await supabase
      .from("class_series")
      .delete()
      .eq("id", deletingBootcamp.id)

    if (error) {
      toast({ title: "Error", description: "Failed to delete bootcamp", variant: "destructive" })
    } else {
      toast({ title: "Success", description: "Bootcamp and all sessions deleted" })
    }

    setSaving(false)
    setDeleteDialogOpen(false)
    setDeletingBootcamp(null)
    fetchBootcamps()
  }

  async function handleCreate(values: BootcampFormValues) {
    setSaving(true)
    const supabase = createClient()

    const sortedDates = [...values.selected_dates].sort()
    const recurrenceStart = sortedDates[0]
    const recurrenceEnd = sortedDates[sortedDates.length - 1]

    // 1. Insert class_series with is_recurring = false
    const { data: series, error: seriesError } = await supabase
      .from("class_series")
      .insert({
        subject_id: values.subject_id,
        tutor_id: values.tutor_id,
        classroom_id: values.classroom_id,
        class_type_id: values.class_type_id,
        stream_id: values.stream_id,
        day_of_week: null,
        start_time: values.start_time,
        end_time: values.end_time,
        recurrence_start: recurrenceStart,
        recurrence_end: recurrenceEnd,
        is_recurring: false,
      })
      .select("id")
      .single()

    if (seriesError || !series) {
      toast({ title: "Error", description: "Failed to create bootcamp", variant: "destructive" })
      setSaving(false)
      return
    }

    // 2. Insert class_sessions for each selected date
    const sessionPayloads = sortedDates.map((date) => ({
      series_id: series.id,
      subject_id: values.subject_id,
      tutor_id: values.tutor_id,
      classroom_id: values.classroom_id,
      class_type_id: values.class_type_id,
      stream_id: values.stream_id,
      date,
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
      toast({ title: "Error", description: "Bootcamp created but failed to generate sessions", variant: "destructive" })
      setSaving(false)
      setDialogOpen(false)
      fetchBootcamps()
      return
    }

    // 3. Enrol students in each session
    if (values.student_ids.length > 0 && sessions && sessions.length > 0) {
      const studentPayloads = sessions.flatMap((session: { id: string }) =>
        values.student_ids.map((studentId) => ({
          session_id: session.id,
          student_id: studentId,
          attendance_status: "pending" as const,
        }))
      )

      const batchSize = 500
      for (let i = 0; i < studentPayloads.length; i += batchSize) {
        const batch = studentPayloads.slice(i, i + batchSize)
        const { error: studentsError } = await supabase
          .from("session_students")
          .insert(batch)

        if (studentsError) {
          toast({ title: "Warning", description: "Sessions created but some student enrolments failed", variant: "destructive" })
          break
        }
      }
    }

    toast({
      title: "Success",
      description: `Bootcamp created with ${sessions?.length || 0} sessions`,
    })

    setSaving(false)
    setDialogOpen(false)
    fetchBootcamps()
  }

  const statusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
      case "cancelled":
        return <XCircle className="h-3.5 w-3.5 text-red-500" />
      default:
        return <Clock className="h-3.5 w-3.5 text-blue-500" />
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Bootcamp
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : bootcamps.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Calendar className="mx-auto h-8 w-8 mb-2 opacity-50" />
          <p>No bootcamps yet. Create one to get started.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30px]"></TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Tutor</TableHead>
              <TableHead>Class Type</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead className="text-center">Sessions</TableHead>
              <TableHead className="text-center">Students</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bootcamps.map((bc) => (
              <>
                <TableRow
                  key={bc.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => toggleExpand(bc.id)}
                >
                  <TableCell>
                    <ChevronRight
                      className={`h-4 w-4 transition-transform ${expandedId === bc.id ? "rotate-90" : ""}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    {bc.subjects?.name || "—"}
                    {bc.streams?.name && (
                      <Badge variant="outline" className="ml-2 text-xs">
                        {bc.streams.name}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{bc.tutors?.name || "—"}</TableCell>
                  <TableCell>{bc.class_types?.name || "—"}</TableCell>
                  <TableCell className="text-sm">
                    {formatTime(bc.start_time)} – {formatTime(bc.end_time)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(bc.recurrence_start)} – {formatDate(bc.recurrence_end || bc.recurrence_start)}
                  </TableCell>
                  <TableCell className="text-center">{bc.session_count}</TableCell>
                  <TableCell className="text-center">{bc.student_count}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation()
                        openDelete(bc)
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>

                {expandedId === bc.id && (
                  <TableRow key={`${bc.id}-details`}>
                    <TableCell colSpan={9} className="bg-muted/30 p-4">
                      {loadingSessions ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading sessions...
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {expandedStudents.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-1">Enrolled Students</p>
                              <p className="text-sm">{expandedStudents.join(", ")}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-2">Sessions</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                              {expandedSessions.map((session) => (
                                <div
                                  key={session.id}
                                  className="flex items-center gap-2 text-sm rounded-md border px-3 py-1.5 bg-background"
                                >
                                  {statusIcon(session.status)}
                                  <span>{formatDate(session.date)}</span>
                                  <span className="text-muted-foreground text-xs ml-auto">
                                    {session.student_count} students
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Bootcamp</DialogTitle>
            <DialogDescription>
              Schedule a bootcamp by selecting specific dates for sessions.
            </DialogDescription>
          </DialogHeader>
          <BootcampForm
            onSubmit={handleCreate}
            onCancel={() => setDialogOpen(false)}
            isLoading={saving}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Bootcamp</DialogTitle>
            <DialogDescription>
              This will permanently delete the bootcamp and all its sessions. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving ? "Deleting..." : "Delete Bootcamp"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
