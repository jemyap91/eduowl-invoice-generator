"use client"

import { useCallback, useEffect, useState, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { Checkbox } from "@/components/ui/checkbox"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { formatTime, MONTH_NAMES } from "@/lib/format"

interface Student {
  id: string
  name: string
  stream_name: string | null
}

interface SessionRecord {
  id: string
  session_id: string
  attendance_status: string
  class_sessions: {
    id: string
    date: string
    start_time: string
    end_time: string
    status: string
    subject_id: string
    subjects: { name: string } | null
    class_types: { name: string } | null
  }
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: "bg-gray-100", text: "text-gray-600", label: "Pending" },
  attended: { bg: "bg-green-100", text: "text-green-800", label: "Attended" },
  absent: { bg: "bg-orange-100", text: "text-orange-800", label: "Absent" },
  cancelled: { bg: "bg-red-100", text: "text-red-800", label: "Cancelled" },
}

function formatSessionDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00")
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]}`
}

export function AttendanceViewer() {
  const { toast } = useToast()

  // Students list
  const [students, setStudents] = useState<Student[]>([])
  const [loadingStudents, setLoadingStudents] = useState(true)

  // Selected state
  const [selectedStudentId, setSelectedStudentId] = useState<string>("")
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [subjectFilter, setSubjectFilter] = useState<string>("all")

  // Data
  const [sessions, setSessions] = useState<SessionRecord[]>([])
  const [makeupMap, setMakeupMap] = useState<Record<string, string>>({})
  const [totalMakeupsOwed, setTotalMakeupsOwed] = useState(0)
  const [subjectOptions, setSubjectOptions] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Fetch all students on mount
  useEffect(() => {
    async function fetchStudents() {
      setLoadingStudents(true)
      const supabase = createClient()
      const { data, error } = await supabase
        .from("students")
        .select("id, name, streams(name)")
        .order("name")

      if (error) {
        toast({ title: "Error", description: "Failed to load students", variant: "destructive" })
        setLoadingStudents(false)
        return
      }

      setStudents(
        (data || []).map((s: Record<string, unknown>) => ({
          id: s.id as string,
          name: s.name as string,
          stream_name: s.streams ? (s.streams as Record<string, unknown>).name as string : null,
        }))
      )
      setLoadingStudents(false)
    }
    fetchStudents()
  }, [toast])

  // Fetch subject options for selected student (all-time)
  useEffect(() => {
    if (!selectedStudentId) {
      setSubjectOptions([])
      return
    }

    async function fetchSubjects() {
      const supabase = createClient()
      const { data } = await supabase
        .from("session_students")
        .select("class_sessions!inner(subject_id, subjects(name))")
        .eq("student_id", selectedStudentId)

      if (!data) return

      const seen = new Map<string, string>()
      for (const row of data) {
        const cs = row.class_sessions as unknown as { subject_id: string; subjects: { name: string } | null }
        if (cs.subject_id && cs.subjects?.name && !seen.has(cs.subject_id)) {
          seen.set(cs.subject_id, cs.subjects.name)
        }
      }

      setSubjectOptions(
        Array.from(seen.entries())
          .map(([id, name]) => ({ id, name }))
          .sort((a, b) => a.name.localeCompare(b.name))
      )
    }
    fetchSubjects()
  }, [selectedStudentId])

  // Fetch attendance data when student/month/year changes
  const fetchAttendance = useCallback(async () => {
    if (!selectedStudentId) return
    setLoading(true)

    const supabase = createClient()
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const endDate = `${year}-${String(month).padStart(2, "0")}-${lastDay}`

    // Main query: sessions for this student in this month
    const { data, error } = await supabase
      .from("session_students")
      .select(`
        id, session_id, attendance_status,
        class_sessions!inner(
          id, date, start_time, end_time, status, subject_id,
          subjects(name),
          class_types(name)
        )
      `)
      .eq("student_id", selectedStudentId)
      .gte("class_sessions.date", startDate)
      .lte("class_sessions.date", endDate)

    if (error) {
      toast({ title: "Error", description: "Failed to load attendance data", variant: "destructive" })
      setLoading(false)
      return
    }

    // Sort client-side by date then start_time
    const records = ((data || []) as unknown as SessionRecord[]).sort((a, b) => {
      const dateA = a.class_sessions.date
      const dateB = b.class_sessions.date
      if (dateA !== dateB) return dateA.localeCompare(dateB)
      return a.class_sessions.start_time.localeCompare(b.class_sessions.start_time)
    })
    setSessions(records)
    setSelectedIds(new Set())

    // Makeup lookup for cancelled records
    const cancelledSessionIds = records
      .filter((r) => r.attendance_status === "cancelled")
      .map((r) => r.class_sessions.id)

    if (cancelledSessionIds.length > 0) {
      const { data: makeups } = await supabase
        .from("class_sessions")
        .select("makeup_for_session_id, date")
        .in("makeup_for_session_id", cancelledSessionIds)

      const map: Record<string, string> = {}
      for (const m of makeups || []) {
        map[m.makeup_for_session_id] = m.date
      }
      setMakeupMap(map)
    } else {
      setMakeupMap({})
    }

    // Running total of makeups owed (all-time)
    const { data: allCancelled } = await supabase
      .from("session_students")
      .select("session_id, class_sessions!inner(id)")
      .eq("student_id", selectedStudentId)
      .eq("attendance_status", "cancelled")

    if (allCancelled && allCancelled.length > 0) {
      const allCancelledIds = allCancelled.map(
        (r) => (r.class_sessions as unknown as { id: string }).id
      )

      const { data: allMakeups } = await supabase
        .from("class_sessions")
        .select("makeup_for_session_id")
        .in("makeup_for_session_id", allCancelledIds)

      const madeUpIds = new Set((allMakeups || []).map((m) => m.makeup_for_session_id))
      setTotalMakeupsOwed(allCancelledIds.filter((id) => !madeUpIds.has(id)).length)
    } else {
      setTotalMakeupsOwed(0)
    }

    setLoading(false)
  }, [selectedStudentId, month, year, toast])

  useEffect(() => {
    fetchAttendance()
  }, [fetchAttendance])

  // Apply client-side subject filter
  const filteredSessions = useMemo(() => {
    if (subjectFilter === "all") return sessions
    return sessions.filter(
      (s) => s.class_sessions.subject_id === subjectFilter
    )
  }, [sessions, subjectFilter])

  // Summary counts
  const counts = useMemo(() => {
    const total = filteredSessions.length
    const attended = filteredSessions.filter((s) => s.attendance_status === "attended").length
    const absent = filteredSessions.filter((s) => s.attendance_status === "absent").length
    return { total, attended, absent }
  }, [filteredSessions])

  async function updateAttendanceStatus(recordId: string, newStatus: string) {
    const supabase = createClient()
    const { error } = await supabase
      .from("session_students")
      .update({ attendance_status: newStatus })
      .eq("id", recordId)

    if (error) {
      toast({ title: "Error", description: "Failed to update attendance", variant: "destructive" })
      return
    }

    // Update local state immediately
    setSessions((prev) =>
      prev.map((s) =>
        s.id === recordId ? { ...s, attendance_status: newStatus } : s
      )
    )
    toast({ title: "Updated", description: "Attendance status updated" })
  }

  async function bulkUpdateStatus(newStatus: string) {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) {
      toast({ title: "No selection", description: "Select sessions first using the checkboxes", variant: "destructive" })
      return
    }

    const supabase = createClient()
    const { error } = await supabase
      .from("session_students")
      .update({ attendance_status: newStatus })
      .in("id", ids)

    if (error) {
      toast({ title: "Error", description: "Failed to update attendance", variant: "destructive" })
      return
    }

    setSessions((prev) =>
      prev.map((s) =>
        ids.includes(s.id) ? { ...s, attendance_status: newStatus } : s
      )
    )
    setSelectedIds(new Set())
    toast({ title: "Updated", description: `${ids.length} session${ids.length > 1 ? "s" : ""} marked as ${newStatus}` })
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    const allIds = filteredSessions.map((s) => s.id)
    const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id))
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(allIds))
    }
  }

  const navigateMonth = (delta: number) => {
    let newMonth = month + delta
    let newYear = year
    if (newMonth > 12) { newMonth = 1; newYear++ }
    if (newMonth < 1) { newMonth = 12; newYear-- }
    setMonth(newMonth)
    setYear(newYear)
  }

  const selectedStudentName = students.find((s) => s.id === selectedStudentId)?.name || ""

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={selectedStudentId} onValueChange={(v) => { setSelectedStudentId(v); setSubjectFilter("all") }}>
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder={loadingStudents ? "Loading..." : "Select a student"} />
          </SelectTrigger>
          <SelectContent>
            {students.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}{s.stream_name ? ` — ${s.stream_name}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => navigateMonth(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[120px] text-center">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => navigateMonth(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {subjectOptions.length > 0 && (
          <Select value={subjectFilter} onValueChange={setSubjectFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Subjects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subjects</SelectItem>
              {subjectOptions.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Content */}
      {!selectedStudentId ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Select a student to view their attendance.
        </p>
      ) : loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
          <Skeleton className="h-64" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg p-4 text-center bg-[#f0faf8]">
              <div className="text-2xl font-bold text-[#54ABA7]">{counts.total}</div>
              <div className="text-xs text-muted-foreground">Total Sessions</div>
            </div>
            <div className="rounded-lg p-4 text-center bg-green-50">
              <div className="text-2xl font-bold text-green-800">{counts.attended}</div>
              <div className="text-xs text-muted-foreground">Attended</div>
            </div>
            <div className="rounded-lg p-4 text-center bg-orange-50">
              <div className="text-2xl font-bold text-orange-800">{counts.absent}</div>
              <div className="text-xs text-muted-foreground">Absent</div>
            </div>
            <div className="rounded-lg p-4 text-center bg-red-50">
              <div className="text-2xl font-bold text-red-800">{totalMakeupsOwed}</div>
              <div className="text-xs text-muted-foreground">Makeups Owed (All Time)</div>
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
              <span className="text-sm font-medium mr-1">{selectedIds.size} selected</span>
              <span className="text-sm text-muted-foreground mr-1">— Mark as:</span>
              <Button variant="outline" size="sm" className="h-7 text-xs bg-green-50 text-green-800 hover:bg-green-100" onClick={() => bulkUpdateStatus("attended")}>
                Attended
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs bg-orange-50 text-orange-800 hover:bg-orange-100" onClick={() => bulkUpdateStatus("absent")}>
                Absent
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs bg-gray-50 text-gray-600 hover:bg-gray-100" onClick={() => bulkUpdateStatus("pending")}>
                Pending
              </Button>
            </div>
          )}

          {/* Sessions Table */}
          {filteredSessions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No sessions found for {selectedStudentName} in {MONTH_NAMES[month - 1]} {year}.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">
                      <Checkbox
                        checked={filteredSessions.length > 0 && filteredSessions.every((s) => selectedIds.has(s.id))}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Makeup</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSessions.map((record) => {
                    const cs = record.class_sessions
                    const style = STATUS_STYLES[record.attendance_status] || STATUS_STYLES.pending
                    const makeupDate = makeupMap[cs.id]

                    return (
                      <TableRow key={record.id} className={selectedIds.has(record.id) ? "bg-muted/30" : ""}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(record.id)}
                            onCheckedChange={() => toggleSelect(record.id)}
                          />
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatSessionDate(cs.date)}
                        </TableCell>
                        <TableCell>{cs.subjects?.name ?? "—"}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatTime(cs.start_time)}–{formatTime(cs.end_time)}
                        </TableCell>
                        <TableCell>{cs.class_types?.name ?? "—"}</TableCell>
                        <TableCell>
                          <Select
                            value={record.attendance_status}
                            onValueChange={(value) => updateAttendanceStatus(record.id, value)}
                          >
                            <SelectTrigger className={`h-7 w-[120px] text-xs border-0 ${style.bg} ${style.text} font-medium`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(STATUS_STYLES).map(([value, s]) => (
                                <SelectItem key={value} value={value}>
                                  <span className={`${s.text} text-xs`}>{s.label}</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {record.attendance_status !== "cancelled" ? (
                            <span className="text-muted-foreground">—</span>
                          ) : makeupDate ? (
                            <Badge variant="outline" className="bg-green-100 text-green-800 border-0 text-xs">
                              ✓ {formatSessionDate(makeupDate)}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-orange-100 text-orange-800 border-0 text-xs">
                              ⏳ Pending
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
