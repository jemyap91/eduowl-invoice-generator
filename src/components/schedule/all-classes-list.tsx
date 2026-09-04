"use client"

import { useCallback, useEffect, useState, useMemo } from "react"
import { format, parseISO } from "date-fns"
import { createClient } from "@/lib/supabase/client"
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
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Search, X, CalendarIcon, Trash2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { formatTime } from "@/lib/format"
import { SessionDetailSheet } from "./session-detail-sheet"
import type { SessionData } from "./session-card"

interface FilterOption {
  id: string
  name: string
}

function getStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "completed":
      return "default"
    case "cancelled":
      return "destructive"
    default:
      return "outline"
  }
}

export function AllClassesList() {
  const [sessions, setSessions] = useState<SessionData[]>([])
  const [loading, setLoading] = useState(true)

  // Filter options (loaded from DB)
  const [subjects, setSubjects] = useState<FilterOption[]>([])
  const [tutors, setTutors] = useState<FilterOption[]>([])
  const [classrooms, setClassrooms] = useState<FilterOption[]>([])
  const [students, setStudents] = useState<FilterOption[]>([])
  const [streams, setStreams] = useState<FilterOption[]>([])

  // Active filters
  const [search, setSearch] = useState("")
  const [subjectFilter, setSubjectFilter] = useState<string>("all")
  const [tutorFilter, setTutorFilter] = useState<string>("all")
  const [classroomFilter, setClassroomFilter] = useState<string>("all")
  const [studentFilter, setStudentFilter] = useState<string>("all")
  const [streamFilter, setStreamFilter] = useState<string>("all")
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined)
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined)

  // Detail sheet
  const [selectedSession, setSelectedSession] = useState<SessionData | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  // Delete
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingSession, setDeletingSession] = useState<SessionData | null>(null)
  const [deleting, setDeleting] = useState(false)
  const { toast } = useToast()

  const fetchFilterOptions = useCallback(async () => {
    const supabase = createClient()
    const [subjectsRes, tutorsRes, classroomsRes, studentsRes, streamsRes] = await Promise.all([
      supabase.from("subjects").select("id, name").order("name"),
      supabase.from("tutors").select("id, name").order("name"),
      supabase.from("classrooms").select("id, name").order("name"),
      supabase.from("students").select("id, name").order("name"),
      supabase.from("streams").select("id, name").order("name"),
    ])
    if (subjectsRes.data) setSubjects(subjectsRes.data)
    if (tutorsRes.data) setTutors(tutorsRes.data)
    if (classroomsRes.data) setClassrooms(classroomsRes.data)
    if (studentsRes.data) setStudents(studentsRes.data)
    if (streamsRes.data) setStreams(streamsRes.data)
  }, [])

  const fetchSessions = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    let query = supabase
      .from("class_sessions")
      .select(
        `
        *,
        subjects(name),
        tutors(name),
        classrooms(name),
        class_types(name),
        streams(name),
        class_series(is_recurring),
        session_students(student_id, attendance_status, students(name))
      `
      )
      .order("date", { ascending: false })
      .order("start_time", { ascending: true })

    // Apply server-side filters where possible
    if (subjectFilter !== "all") query = query.eq("subject_id", subjectFilter)
    if (tutorFilter !== "all") query = query.eq("tutor_id", tutorFilter)
    if (classroomFilter !== "all") query = query.eq("classroom_id", classroomFilter)
    if (streamFilter !== "all") query = query.eq("stream_id", streamFilter)
    if (dateFrom) query = query.gte("date", format(dateFrom, "yyyy-MM-dd"))
    if (dateTo) query = query.lte("date", format(dateTo, "yyyy-MM-dd"))

    const { data, error } = await query

    if (!error && data) {
      setSessions(data as unknown as SessionData[])
    } else {
      setSessions([])
    }
    setLoading(false)
  }, [subjectFilter, tutorFilter, classroomFilter, streamFilter, dateFrom, dateTo])

  useEffect(() => {
    fetchFilterOptions()
  }, [fetchFilterOptions])

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  // Client-side filtering for search text and student filter
  const filteredSessions = useMemo(() => {
    let result = sessions

    // Student filter (needs to check nested session_students)
    if (studentFilter !== "all") {
      result = result.filter((s) =>
        s.session_students?.some((ss) => ss.student_id === studentFilter)
      )
    }

    // Text search across multiple fields
    if (search.trim()) {
      const q = search.toLowerCase().trim()
      result = result.filter((s) => {
        const subjectName = s.subjects?.name?.toLowerCase() ?? ""
        const tutorName = s.tutors?.name?.toLowerCase() ?? ""
        const classroomName = s.classrooms?.name?.toLowerCase() ?? ""
        const streamName = s.streams?.name?.toLowerCase() ?? ""
        const studentNames = s.session_students
          ?.map((ss) => ss.students?.name?.toLowerCase() ?? "")
          .join(" ") ?? ""
        return (
          subjectName.includes(q) ||
          tutorName.includes(q) ||
          classroomName.includes(q) ||
          streamName.includes(q) ||
          studentNames.includes(q)
        )
      })
    }

    return result
  }, [sessions, search, studentFilter])

  const hasActiveFilters =
    search.trim() !== "" ||
    subjectFilter !== "all" ||
    tutorFilter !== "all" ||
    classroomFilter !== "all" ||
    studentFilter !== "all" ||
    streamFilter !== "all" ||
    dateFrom !== undefined ||
    dateTo !== undefined

  function clearFilters() {
    setSearch("")
    setSubjectFilter("all")
    setTutorFilter("all")
    setClassroomFilter("all")
    setStudentFilter("all")
    setStreamFilter("all")
    setDateFrom(undefined)
    setDateTo(undefined)
  }

  function handleRowClick(session: SessionData) {
    setSelectedSession(session)
    setDetailOpen(true)
  }

  function openDelete(session: SessionData) {
    setDeletingSession(session)
    setDeleteDialogOpen(true)
  }

  async function handleDelete() {
    if (!deletingSession) return
    setDeleting(true)
    const supabase = createClient()
    await supabase.from("session_students").delete().eq("session_id", deletingSession.id)
    const { error } = await supabase.from("class_sessions").delete().eq("id", deletingSession.id)

    if (error) {
      toast({ title: "Error", description: "Failed to delete session", variant: "destructive" })
    } else {
      toast({ title: "Success", description: "Session deleted" })
    }
    setDeleting(false)
    setDeleteDialogOpen(false)
    setDeletingSession(null)
    fetchSessions()
  }

  return (
    <div className="space-y-4 pt-4">
      {/* Search bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by subject, tutor, student, classroom..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5 text-muted-foreground">
            <X className="h-4 w-4" />
            Clear filters
          </Button>
        )}
      </div>

      {/* Filter dropdowns */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect
          label="Subject"
          value={subjectFilter}
          onChange={setSubjectFilter}
          options={subjects}
        />
        <FilterSelect
          label="Tutor"
          value={tutorFilter}
          onChange={setTutorFilter}
          options={tutors}
        />
        <FilterSelect
          label="Classroom"
          value={classroomFilter}
          onChange={setClassroomFilter}
          options={classrooms}
        />
        <FilterSelect
          label="Student"
          value={studentFilter}
          onChange={setStudentFilter}
          options={students}
        />
        <FilterSelect
          label="Stream"
          value={streamFilter}
          onChange={setStreamFilter}
          options={streams}
        />
        <DateFilter label="From" value={dateFrom} onChange={setDateFrom} />
        <DateFilter label="To" value={dateTo} onChange={setDateTo} />
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        {loading ? "Loading..." : `${filteredSessions.length} class${filteredSessions.length !== 1 ? "es" : ""} found`}
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Student(s)</TableHead>
              <TableHead>Classroom</TableHead>
              <TableHead>Tutor</TableHead>
              <TableHead>Stream</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 10 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : filteredSessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                  No classes found{hasActiveFilters ? " matching your filters" : ""}.
                </TableCell>
              </TableRow>
            ) : (
              filteredSessions.map((session) => (
                <TableRow
                  key={session.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleRowClick(session)}
                >
                  <TableCell className="whitespace-nowrap">
                    {format(parseISO(session.date), "EEE, d MMM yyyy")}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatTime(session.start_time)} - {formatTime(session.end_time)}
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{session.subjects?.name ?? "—"}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {session.session_students?.length > 0
                        ? session.session_students.map((ss) => (
                            <Badge
                              key={ss.student_id}
                              variant="secondary"
                              className="bg-primary/10 text-primary border-0 text-xs"
                            >
                              {ss.students?.name ?? "Unknown"}
                            </Badge>
                          ))
                        : <span className="text-muted-foreground text-sm">—</span>
                      }
                    </div>
                  </TableCell>
                  <TableCell>{session.classrooms?.name ?? "—"}</TableCell>
                  <TableCell>{session.tutors?.name ?? "—"}</TableCell>
                  <TableCell>{session.streams?.name ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <Badge
                        variant="secondary"
                        className="bg-primary/10 text-primary border-0"
                      >
                        {session.class_types?.name ?? "—"}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={
                          !session.series_id
                            ? "border-orange-300 text-orange-600"
                            : session.class_series?.is_recurring === false
                              ? "border-purple-300 text-purple-600"
                              : "border-blue-300 text-blue-600"
                        }
                      >
                        {!session.series_id
                          ? "Ad-hoc"
                          : session.class_series?.is_recurring === false
                            ? "Bootcamp"
                            : "Series"}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(session.status)} className="capitalize">
                      {session.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {!session.series_id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation()
                          openDelete(session)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Session detail sheet (reused from calendar) */}
      <SessionDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        session={selectedSession}
        onUpdated={fetchSessions}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Session</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete this session? This will remove all
              attendance records and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete Session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ─── Filter Components ─────────────────────────────────────────── */

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (val: string) => void
  options: FilterOption[]
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[150px] h-9 text-sm">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All {label}s</SelectItem>
        {options.map((opt) => (
          <SelectItem key={opt.id} value={opt.id}>
            {opt.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function DateFilter({
  label,
  value,
  onChange,
}: {
  label: string
  value: Date | undefined
  onChange: (val: Date | undefined) => void
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`h-9 text-sm gap-1.5 ${value ? "" : "text-muted-foreground"}`}
        >
          <CalendarIcon className="h-3.5 w-3.5" />
          {value ? format(value, "d MMM yyyy") : label}
          {value && (
            <X
              className="h-3 w-3 ml-1 hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation()
                onChange(undefined)
              }}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={onChange}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}
