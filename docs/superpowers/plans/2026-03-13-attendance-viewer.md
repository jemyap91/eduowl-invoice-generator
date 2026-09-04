# Attendance Viewer Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a student-centric attendance viewer page with attendance status enum migration and updates to all existing components that reference the old `attended` boolean.

**Architecture:** Database migration replaces boolean `attended` with a 4-value enum `attendance_status`. All existing components are updated to use the new column. A new `/attendance` page provides a read-only table view filtered by student, month, and subject, with summary cards and makeup tracking.

**Tech Stack:** Next.js 14 (App Router), Supabase (PostgreSQL), TypeScript, Tailwind CSS, shadcn/ui, Lucide icons

**Spec:** `docs/superpowers/specs/2026-03-13-attendance-viewer-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `supabase/migrations/20260313200000_attendance_status_enum.sql` | Migration: replace `attended` boolean with `attendance_status` enum |
| `src/app/(dashboard)/attendance/page.tsx` | Attendance page route (client component, thin wrapper) |
| `src/components/attendance/attendance-viewer.tsx` | Main viewer: student selector, filters, summary cards, sessions table |

### Modified Files
| File | Change |
|------|--------|
| `src/components/schedule/session-card.tsx:31` | `SessionData` interface: `attended: boolean` → `attendance_status: string` |
| `src/components/schedule/attendance-sheet.tsx` | Replace boolean checkbox with 3-option status selector |
| `src/components/schedule/attendance-badge.tsx:7` | Interface: `attended: boolean` → `attendance_status: string` |
| `src/components/dashboard/todays-classes.tsx:28,57,107-111` | Interface + query + counting logic |
| `src/components/schedule/calendar-view.tsx:101` | Query: `attended` → `attendance_status` |
| `src/components/schedule/all-classes-list.tsx:122` | Query: `attended` → `attendance_status` |
| `src/components/schedule/session-edit-form.tsx:176` | Insert: `attended: false` → `attendance_status: 'pending'` |
| `src/components/schedule/adhoc-session-form.tsx:186` | Insert: `attended: false` → `attendance_status: 'pending'` |
| `src/components/schedule/class-series-list.tsx:402,537,564` | Inserts: `attended: false` → `attendance_status: 'pending'` |
| `src/components/layout/sidebar.tsx:28-35` | Add "Attendance" nav item |
| `src/lib/invoices/calculate.ts` | No change needed — already queries by session enrollment, not by `attended` |

---

## Chunk 1: Database Migration + Existing Component Updates

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260313200000_attendance_status_enum.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
BEGIN;

-- Create the enum type
CREATE TYPE attendance_status AS ENUM ('pending', 'attended', 'absent', 'cancelled');

-- Add new column with default
ALTER TABLE session_students ADD COLUMN attendance_status attendance_status NOT NULL DEFAULT 'pending';

-- Migrate existing data: attended = true → 'attended'
UPDATE session_students SET attendance_status = 'attended' WHERE attended = true;

-- Migrate existing data: attended = false for PAST sessions → 'absent'
UPDATE session_students ss
SET attendance_status = 'absent'
FROM class_sessions cs
WHERE ss.session_id = cs.id
  AND ss.attended = false
  AND cs.date < CURRENT_DATE;

-- Migrate existing data: attended = false for cancelled sessions → 'cancelled'
UPDATE session_students ss
SET attendance_status = 'cancelled'
FROM class_sessions cs
WHERE ss.session_id = cs.id
  AND ss.attendance_status = 'absent'
  AND cs.status = 'cancelled';

-- Remaining attended = false (future sessions) stay as 'pending' (the default)

-- Drop old column
ALTER TABLE session_students DROP COLUMN attended;

-- Composite index for the primary query pattern (student + status)
CREATE INDEX idx_session_students_student_status ON session_students(student_id, attendance_status);

COMMIT;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260313200000_attendance_status_enum.sql
git commit -m "feat: add attendance_status enum migration replacing attended boolean"
```

---

### Task 2: Update SessionData Interface + SessionCard

**Files:**
- Modify: `src/components/schedule/session-card.tsx:31`

- [ ] **Step 1: Update the `SessionData` interface**

In `src/components/schedule/session-card.tsx`, line 31, change the `session_students` type:

```typescript
// Before:
session_students: { student_id: string; attended: boolean; students: { name: string } | null }[]

// After:
session_students: { student_id: string; attendance_status: string; students: { name: string } | null }[]
```

This is the shared interface imported by `CalendarView`, `AllClassesList`, `SessionDetailSheet`, `SessionEditForm`, etc. Changing it here propagates the type to all consumers.

- [ ] **Step 2: Commit**

```bash
git add src/components/schedule/session-card.tsx
git commit -m "feat: update SessionData interface to use attendance_status"
```

---

### Task 3: Update AttendanceBadge

**Files:**
- Modify: `src/components/schedule/attendance-badge.tsx`

- [ ] **Step 1: Update the interface and counting logic**

Replace the entire component. Change `attended: boolean` to `attendance_status: string` and count by status value:

```typescript
"use client"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

export interface AttendanceBadgeProps {
  sessionStudents: { attendance_status: string }[]
}

export function AttendanceBadge({ sessionStudents }: AttendanceBadgeProps) {
  const total = sessionStudents.length
  if (total === 0) return null

  const attended = sessionStudents.filter((s) => s.attendance_status === "attended").length
  const ratio = attended / total

  let colorClass: string
  if (ratio === 1) {
    colorClass = "bg-green-100 text-green-800 border-green-200"
  } else if (ratio > 0) {
    colorClass = "bg-yellow-100 text-yellow-800 border-yellow-200"
  } else {
    colorClass = "bg-gray-100 text-gray-600 border-gray-200"
  }

  return (
    <Badge
      variant="outline"
      className={cn("text-[10px] px-1 py-0 h-4 font-medium", colorClass)}
    >
      {attended}/{total}
    </Badge>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/schedule/attendance-badge.tsx
git commit -m "feat: update AttendanceBadge to use attendance_status"
```

---

### Task 4: Update TodaysClasses Dashboard Widget

**Files:**
- Modify: `src/components/dashboard/todays-classes.tsx:28,57,107-111`

- [ ] **Step 1: Update the interface (line 28)**

```typescript
// Before:
session_students: { attended: boolean }[]

// After:
session_students: { attendance_status: string }[]
```

- [ ] **Step 2: Update the query (line 57)**

```typescript
// Before:
"id, start_time, end_time, status, subjects(name), tutors(name), classrooms(name), class_types(name), streams(name), session_students(attended)"

// After:
"id, start_time, end_time, status, subjects(name), tutors(name), classrooms(name), class_types(name), streams(name), session_students(attendance_status)"
```

- [ ] **Step 3: Update the counting logic (lines 107-111)**

```typescript
// Before:
const attended = session.session_students.filter(
  (s) => s.attended
).length
const hasAttendance = session.session_students.some(
  (s) => s.attended
)

// After:
const attended = session.session_students.filter(
  (s) => s.attendance_status === "attended"
).length
const hasAttendance = session.session_students.some(
  (s) => s.attendance_status === "attended"
)
```

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/todays-classes.tsx
git commit -m "feat: update TodaysClasses to use attendance_status"
```

---

### Task 5: Update CalendarView + AllClassesList Queries

**Files:**
- Modify: `src/components/schedule/calendar-view.tsx:101`
- Modify: `src/components/schedule/all-classes-list.tsx:122`

- [ ] **Step 1: Update CalendarView query (line 101)**

```typescript
// Before:
session_students(student_id, attended, students(name))

// After:
session_students(student_id, attendance_status, students(name))
```

- [ ] **Step 2: Update AllClassesList query (line 122)**

```typescript
// Before:
session_students(student_id, attended, students(name))

// After:
session_students(student_id, attendance_status, students(name))
```

- [ ] **Step 3: Commit**

```bash
git add src/components/schedule/calendar-view.tsx src/components/schedule/all-classes-list.tsx
git commit -m "feat: update calendar and all-classes queries to use attendance_status"
```

---

### Task 6: Update Session Insert Forms

**Files:**
- Modify: `src/components/schedule/session-edit-form.tsx:176`
- Modify: `src/components/schedule/adhoc-session-form.tsx:186`
- Modify: `src/components/schedule/class-series-list.tsx:402,537,564`

- [ ] **Step 1: Update SessionEditForm (line 176)**

```typescript
// Before:
attended: false,

// After:
attendance_status: "pending",
```

- [ ] **Step 2: Update AdhocSessionForm (line 186)**

```typescript
// Before:
attended: false,

// After:
attendance_status: "pending",
```

- [ ] **Step 3: Update ClassSeriesList (lines 402, 537, 564)**

All three instances:

```typescript
// Before:
attended: false,

// After:
attendance_status: "pending",
```

- [ ] **Step 4: Commit**

```bash
git add src/components/schedule/session-edit-form.tsx src/components/schedule/adhoc-session-form.tsx src/components/schedule/class-series-list.tsx
git commit -m "feat: update session insert forms to use attendance_status: pending"
```

---

### Task 7: Update AttendanceSheet (Boolean → 3-Option Selector)

**Files:**
- Modify: `src/components/schedule/attendance-sheet.tsx`

This is the biggest change in this chunk. Replace the boolean checkbox UI with a 3-option radio group per student.

- [ ] **Step 1: Rewrite the AttendanceSheet component**

Replace the full contents of `src/components/schedule/attendance-sheet.tsx`:

```typescript
"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export interface AttendanceSheetProps {
  sessionId: string
  sessionStatus?: string
  onUpdate?: () => void
}

type AttendanceStatus = "pending" | "attended" | "absent" | "cancelled"

interface SessionStudent {
  id: string
  student_id: string
  attendance_status: AttendanceStatus
  students: {
    name: string
    streams: { name: string } | null
  } | null
}

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; color: string }[] = [
  { value: "attended", label: "Attended", color: "bg-green-100 text-green-800 border-green-300" },
  { value: "absent", label: "Absent", color: "bg-orange-100 text-orange-800 border-orange-300" },
  { value: "cancelled", label: "Cancelled", color: "bg-red-100 text-red-800 border-red-300" },
]

export function AttendanceSheet({ sessionId, sessionStatus, onUpdate }: AttendanceSheetProps) {
  const [students, setStudents] = useState<SessionStudent[]>([])
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const fetchStudents = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from("session_students")
      .select("*, students(name, streams(name))")
      .eq("session_id", sessionId)
      .order("students(name)")

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load attendance data",
        variant: "destructive",
      })
      setLoading(false)
      return
    }

    const records = (data || []) as SessionStudent[]
    setStudents(records)
    const initial: Record<string, AttendanceStatus> = {}
    for (const s of records) {
      initial[s.id] = s.attendance_status
    }
    setAttendance(initial)
    setLoading(false)
  }, [sessionId, toast])

  useEffect(() => {
    fetchStudents()
  }, [fetchStudents])

  const setStatus = (id: string, status: AttendanceStatus) => {
    setAttendance((prev) => ({ ...prev, [id]: status }))
  }

  const markAll = (status: AttendanceStatus) => {
    setAttendance((prev) => {
      const next: Record<string, AttendanceStatus> = {}
      for (const key of Object.keys(prev)) {
        next[key] = status
      }
      return next
    })
  }

  const saveAttendance = async () => {
    setSaving(true)
    const supabase = createClient()

    const updates = Object.entries(attendance).map(([id, attendance_status]) =>
      supabase.from("session_students").update({ attendance_status }).eq("id", id)
    )

    const results = await Promise.all(updates)
    const hasError = results.some((r) => r.error)

    if (hasError) {
      toast({
        title: "Error",
        description: "Failed to save some attendance records",
        variant: "destructive",
      })
      setSaving(false)
      return
    }

    // Auto-mark session as completed when saving attendance
    if (sessionStatus === "scheduled") {
      await supabase
        .from("class_sessions")
        .update({ status: "completed" })
        .eq("id", sessionId)
    }

    toast({
      title: "Success",
      description: sessionStatus === "scheduled"
        ? "Attendance saved & session completed"
        : "Attendance saved successfully",
    })
    onUpdate?.()
    setSaving(false)
  }

  const totalStudents = students.length
  const attendedCount = Object.values(attendance).filter((s) => s === "attended").length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (totalStudents === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No students enrolled in this session.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          {attendedCount}/{totalStudents} attended
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => markAll("attended")}>
            Mark All Present
          </Button>
          <Button variant="outline" size="sm" onClick={() => markAll("absent")}>
            Mark All Absent
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {students.map((student) => (
          <div
            key={student.id}
            className="rounded-md border p-3 space-y-2"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {student.students?.name || "Unknown Student"}
              </p>
              {student.students?.streams?.name && (
                <p className="text-xs text-muted-foreground">
                  {student.students.streams.name}
                </p>
              )}
            </div>
            <div className="flex gap-1.5">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setStatus(student.id, opt.value)}
                  className={cn(
                    "text-xs px-2.5 py-1 rounded-full border transition-all",
                    attendance[student.id] === opt.value
                      ? opt.color + " font-medium"
                      : "bg-white text-muted-foreground border-gray-200 hover:bg-muted/50"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Button
        onClick={saveAttendance}
        disabled={saving}
        className="w-full"
      >
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {sessionStatus === "scheduled" ? "Save Attendance & Complete" : "Save Attendance"}
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Verify the app compiles**

Run: `npx next build 2>&1 | head -30` or `npx next lint`
Expected: No TypeScript errors related to `attended` vs `attendance_status`

- [ ] **Step 3: Commit**

```bash
git add src/components/schedule/attendance-sheet.tsx
git commit -m "feat: replace attendance checkbox with 3-option status selector"
```

---

### Task 8: Update Session Cancellation/Restore to Propagate attendance_status

**Files:**
- Modify: `src/components/schedule/session-detail-sheet.tsx:93-124` (updateStatus function)
- Modify: `src/components/schedule/session-detail-sheet.tsx:126-164` (restoreSession function)

When a session is cancelled via the detail sheet, all enrolled students should have their `attendance_status` set to `'cancelled'`. When restored, they should be reset to `'pending'`.

- [ ] **Step 1: Update updateStatus to propagate to session_students (lines 93-124)**

After the session status is updated successfully (inside the `else` block at line 108), add the student status propagation:

```typescript
// Add BEFORE line 109 (setCancelDialogOpen(false)):
if (newStatus === "cancelled") {
  await supabase
    .from("session_students")
    .update({ attendance_status: "cancelled" })
    .eq("session_id", session.id)
}
```

- [ ] **Step 2: Update restoreSession to reset attendance_status (lines 126-164)**

After restoring the session to scheduled (after line 147), reset student statuses:

```typescript
// Add AFTER the restore update (after line 147, inside the else block at line 151):
await supabase
  .from("session_students")
  .update({ attendance_status: "pending" })
  .eq("session_id", session.id)
```

- [ ] **Step 3: Commit**

```bash
git add src/components/schedule/session-detail-sheet.tsx
git commit -m "feat: propagate attendance_status on session cancel/restore"
```

---

### Task 9: Add Attendance to Sidebar Navigation (was Task 8)

**Files:**
- Modify: `src/components/layout/sidebar.tsx:28-35`

- [ ] **Step 1: Add ClipboardCheck import**

In `src/components/layout/sidebar.tsx`, add `ClipboardCheck` to the lucide-react import (line 8):

```typescript
// Before:
import {
  LayoutDashboard,
  Calendar,
  GraduationCap,
  Users,
  FileText,
  Settings,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

// After:
import {
  LayoutDashboard,
  Calendar,
  ClipboardCheck,
  GraduationCap,
  Users,
  FileText,
  Settings,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
```

- [ ] **Step 2: Add the nav item (between Schedule and Students & Parents)**

```typescript
// Before:
const navItems = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Schedule", href: "/schedule", icon: Calendar },
  { label: "Students & Parents", href: "/students", icon: GraduationCap },
  { label: "Tutors", href: "/tutors", icon: Users },
  { label: "Invoices", href: "/invoices", icon: FileText },
  { label: "Settings", href: "/settings", icon: Settings },
];

// After:
const navItems = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Schedule", href: "/schedule", icon: Calendar },
  { label: "Attendance", href: "/attendance", icon: ClipboardCheck },
  { label: "Students & Parents", href: "/students", icon: GraduationCap },
  { label: "Tutors", href: "/tutors", icon: Users },
  { label: "Invoices", href: "/invoices", icon: FileText },
  { label: "Settings", href: "/settings", icon: Settings },
];
```

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/sidebar.tsx
git commit -m "feat: add Attendance to sidebar navigation"
```

---

## Chunk 2: Attendance Viewer Page

### Task 10: Create the Attendance Viewer Component

**Files:**
- Create: `src/components/attendance/attendance-viewer.tsx`

This is the main component. It contains: student selector, month/year + subject filters, summary cards, and the sessions table with makeup status.

- [ ] **Step 1: Create the attendance viewer**

Create `src/components/attendance/attendance-viewer.tsx`:

```typescript
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

interface MakeupLink {
  makeup_for_session_id: string
  date: string
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
  const [month, setMonth] = useState(now.getMonth() + 1) // 1-based
  const [year, setYear] = useState(now.getFullYear())
  const [subjectFilter, setSubjectFilter] = useState<string>("all")

  // Data
  const [sessions, setSessions] = useState<SessionRecord[]>([])
  const [makeupMap, setMakeupMap] = useState<Record<string, string>>({}) // sessionId → makeup date
  const [totalMakeupsOwed, setTotalMakeupsOwed] = useState(0)
  const [subjectOptions, setSubjectOptions] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(false)

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

  // Fetch subject options for selected student (all-time, not month-scoped)
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
    let query = supabase
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

    const { data, error } = await query

    if (error) {
      toast({ title: "Error", description: "Failed to load attendance data", variant: "destructive" })
      setLoading(false)
      return
    }

    // Sort client-side by date then start_time (PostgREST cannot order by nested FK columns)
    const records = ((data || []) as unknown as SessionRecord[]).sort((a, b) => {
      const dateA = a.class_sessions.date
      const dateB = b.class_sessions.date
      if (dateA !== dateB) return dateA.localeCompare(dateB)
      return a.class_sessions.start_time.localeCompare(b.class_sessions.start_time)
    })
    setSessions(records)

    // Makeup lookup: find makeup sessions for cancelled records
    const cancelledSessionIds = records
      .filter((r) => r.attendance_status === "cancelled")
      .map((r) => (r.class_sessions as unknown as { id: string }).id)

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

    // Running total of makeups owed (all-time, not month-scoped)
    const { data: allCancelled } = await supabase
      .from("session_students")
      .select("session_id, class_sessions!inner(id)")
      .eq("student_id", selectedStudentId)
      .eq("attendance_status", "cancelled")

    if (allCancelled) {
      const allCancelledIds = allCancelled.map(
        (r) => (r.class_sessions as unknown as { id: string }).id
      )

      if (allCancelledIds.length > 0) {
        const { data: allMakeups } = await supabase
          .from("class_sessions")
          .select("makeup_for_session_id")
          .in("makeup_for_session_id", allCancelledIds)

        const madeUpIds = new Set((allMakeups || []).map((m) => m.makeup_for_session_id))
        setTotalMakeupsOwed(allCancelledIds.filter((id) => !madeUpIds.has(id)).length)
      } else {
        setTotalMakeupsOwed(0)
      }
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
      (s) => (s.class_sessions as unknown as { subject_id: string }).subject_id === subjectFilter
    )
  }, [sessions, subjectFilter])

  // Summary counts (from filtered sessions)
  const counts = useMemo(() => {
    const total = filteredSessions.length
    const attended = filteredSessions.filter((s) => s.attendance_status === "attended").length
    const absent = filteredSessions.filter((s) => s.attendance_status === "absent").length
    return { total, attended, absent }
  }, [filteredSessions])

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
        {/* Student selector */}
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

        {/* Month/Year navigation */}
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

        {/* Subject filter */}
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

      {/* Content area — only show if student selected */}
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
                    const cs = record.class_sessions as unknown as SessionRecord["class_sessions"]
                    const style = STATUS_STYLES[record.attendance_status] || STATUS_STYLES.pending
                    const sessionId = cs.id
                    const makeupDate = makeupMap[sessionId]

                    return (
                      <TableRow key={record.id}>
                        <TableCell className="whitespace-nowrap">
                          {formatSessionDate(cs.date)}
                        </TableCell>
                        <TableCell>{cs.subjects?.name ?? "—"}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatTime(cs.start_time)}–{formatTime(cs.end_time)}
                        </TableCell>
                        <TableCell>{cs.class_types?.name ?? "—"}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`${style.bg} ${style.text} border-0 text-xs`}
                          >
                            {style.label}
                          </Badge>
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/attendance/attendance-viewer.tsx
git commit -m "feat: create AttendanceViewer component with filters, summary cards, and table"
```

---

### Task 11: Create the Attendance Page Route

**Files:**
- Create: `src/app/(dashboard)/attendance/page.tsx`

- [ ] **Step 1: Create the page**

```typescript
"use client"

import { AttendanceViewer } from "@/components/attendance/attendance-viewer"

export default function AttendancePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Attendance</h1>
        <p className="text-sm text-muted-foreground">
          View student attendance and track makeup lessons.
        </p>
      </div>
      <AttendanceViewer />
    </div>
  )
}
```

- [ ] **Step 2: Verify the page loads**

Run: `npm run dev`

Navigate to `http://localhost:3000/attendance` — should show:
- Page title "Attendance"
- Student selector dropdown
- Month/year navigation
- "Select a student to view their attendance" placeholder

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/attendance/page.tsx
git commit -m "feat: add /attendance page route"
```

---

### Task 12: Manual Smoke Test

- [ ] **Step 1: Apply the migration to local Supabase**

Run: `npx supabase db push` or apply the migration manually via the Supabase dashboard SQL editor.

Expected: Migration succeeds. `session_students` table now has `attendance_status` column, `attended` column is gone.

- [ ] **Step 2: Test existing pages still work**

Navigate to each page and verify no errors:
- `/` — Dashboard: TodaysClasses widget loads
- `/schedule` — Calendar loads, session cards render, clicking a session opens detail sheet
- `/schedule` → click a session → AttendanceSheet shows 3 status buttons instead of checkboxes
- `/schedule` → All Classes tab loads

- [ ] **Step 3: Test the attendance viewer**

Navigate to `/attendance`:
1. Select a student from the dropdown
2. Summary cards show correct counts
3. Table shows sessions sorted by date
4. Status badges display correctly (green/orange/red/grey)
5. Makeup column shows "⏳ Pending" for cancelled sessions without makeup, "✓ [date]" for those with
6. Month navigation works
7. Subject filter works

- [ ] **Step 4: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: address smoke test issues in attendance viewer"
```
