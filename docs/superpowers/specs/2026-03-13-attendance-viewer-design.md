# Attendance Viewer — Design Spec

## Overview

A new top-level "Attendance" page providing a student-centric, read-only view of session attendance with makeup tracking status. Includes a database migration to replace the boolean `attended` column with a richer `attendance_status` enum.

## Requirements

1. Student-centric attendance viewer — pick a student, see all their sessions with attendance statuses
2. Three attendance statuses: **attended**, **absent** (no show/late notice, lesson consumed), **cancelled** (with notice, eligible for makeup)
3. Plus a **pending** status for sessions that haven't happened yet
4. Makeup tracking column showing whether cancelled sessions have been made up (linked via existing `makeup_for_session_id` on `class_sessions`)
5. Read-only viewer — attendance changes happen through the existing session detail sheet
6. Summary cards showing counts: total sessions, attended, absent, cancelled (makeups owed)
7. Filters: student selector, month/year, subject (optional)

## Database Changes

### Migration: Replace `attended` boolean with `attendance_status` enum

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

**No other schema changes required** — `makeup_for_session_id` FK on `class_sessions` already exists.

## Page Structure

### Route

`/attendance` — new top-level page, added to sidebar navigation between Schedule and Invoices.

### Layout

```
┌─ Page Header ──────────────────────────────────────────┐
│  Attendance                                             │
├─ Filters ──────────────────────────────────────────────┤
│  [Student selector ▼]  [Month/Year ▼]  [Subject ▼]    │
├─ Summary Cards ────────────────────────────────────────┤
│  Total Sessions │ Attended │ Absent │ Makeups Owed     │
│       8         │    5     │   1    │      2           │
├─ Sessions Table ───────────────────────────────────────┤
│  Date      │ Subject     │ Time        │ Type  │ Status    │ Makeup       │
│  Mon 3 Mar │ Mathematics │ 3:00–5:00pm │ Group │ Attended  │ —            │
│  Wed 5 Mar │ English     │ 4:00–6:00pm │ 1-to-1│ Cancelled │ ⏳ Pending   │
│  Mon 10 Mar│ Mathematics │ 3:00–5:00pm │ Group │ Attended  │ —            │
│  Wed 12 Mar│ English     │ 4:00–6:00pm │ 1-to-1│ Absent    │ —            │
│  Mon 17 Mar│ Mathematics │ 3:00–5:00pm │ Group │ Attended  │ —            │
│  Sat 22 Mar│ English     │ 2:00–4:00pm │ 1-to-1│ Cancelled │ ✓ Sat 29 Mar│
└────────────────────────────────────────────────────────┘
```

### Student Selector

- Searchable combobox listing all students
- Shows student name and stream (e.g., "Johnny Tan — Primary 4"). If student has no stream, show name only.
- On selection, loads that student's session data for the selected month

### Filters

- **Month/Year picker**: Defaults to current month. Navigation arrows or dropdown.
- **Subject filter**: Optional. Dropdown derived from subjects appearing in the student's sessions across all time (not just the selected month). Defaults to "All Subjects".

### Summary Cards

Four cards at the top:

| Card | Color | Value |
|------|-------|-------|
| Total Sessions | Teal (#54ABA7) bg | Count of all sessions in selected period |
| Attended | Green (#e8f5e9) bg | Count where `attendance_status = 'attended'` |
| Absent | Amber (#fff3e0) bg | Count where `attendance_status = 'absent'` |
| Makeups Owed | Red (#fce4ec) bg | **Running total across all time** — count where `attendance_status = 'cancelled'` AND no linked makeup session exists |

"Makeups Owed" is a running total across all months (not scoped to the selected period), so the client always sees the full picture of outstanding makeups. The other three cards are scoped to the selected month/filters.

### Sessions Table

**Columns:**

| Column | Source |
|--------|--------|
| Date | `class_sessions.date` — formatted as "Mon, 3 Mar" |
| Subject | `subjects.name` via `class_sessions.subject_id` |
| Time | `class_sessions.start_time` – `class_sessions.end_time` — formatted as "3:00–5:00pm" |
| Type | `class_types.name` via `class_sessions.class_type_id` |
| Status | `session_students.attendance_status` — displayed as color-coded badge |
| Makeup | Derived from checking if any `class_sessions.makeup_for_session_id` links to this session |

**Status badges:**

| Status | Badge Color | Text |
|--------|-------------|------|
| `pending` | Grey (#f5f5f5 bg, #999 text) | Pending |
| `attended` | Green (#e8f5e9 bg, #2e7d32 text) | Attended |
| `absent` | Amber (#fff3e0 bg, #e65100 text) | Absent |
| `cancelled` | Red (#fce4ec bg, #c62828 text) | Cancelled |

**Makeup column values:**

| Scenario | Display |
|----------|---------|
| Status is not `cancelled` | `—` (grey dash) |
| Cancelled, no makeup session linked | `⏳ Pending` (orange badge) |
| Cancelled, makeup session exists | `✓ [makeup date]` (green badge) |

**Sorting:** By date ascending (chronological order).

**Empty state:** "No sessions found for [Student Name] in [Month Year]" with suggestion to check the schedule.

**Loading state:** Skeleton loader matching the table layout (consistent with existing patterns using `Loader2` spinner).

**Error state:** Toast notification on query failure (consistent with existing error handling patterns).

## Data Query

The attendance viewer fetches data with a single query joining:

```
session_students
  → class_sessions (date, start_time, end_time, status, subject_id, class_type_id)
    → subjects (name)
    → class_types (name)
```

Filter by:
- `session_students.student_id` = selected student
- `class_sessions.date` within selected month/year
- Optionally `class_sessions.subject_id` = selected subject

For makeup status, use a two-query approach (following the existing pattern in `class-series-list.tsx`):
1. Collect all session IDs from the main query results where `attendance_status = 'cancelled'`
2. Query: `supabase.from('class_sessions').select('makeup_for_session_id, date').in('makeup_for_session_id', cancelledSessionIds)`
3. Build a lookup map: `{ originalSessionId → makeupDate }`

For the "Makeups Owed" running total, a separate unfiltered query counts cancelled `session_students` for the selected student where no makeup link exists.

## Component Changes to Existing Code

### AttendanceSheet (`src/components/schedule/attendance-sheet.tsx`)

Replace boolean checkbox with a 3-option selector per student:
- **Attended** / **Absent** / **Cancelled**
- Default for future sessions: `pending`
- When saving, update `session_students.attendance_status` instead of `attended`

### Dashboard — TodaysClasses (`src/components/dashboard/todays-classes.tsx`)

- Query `attendance_status` instead of `attended`
- Count attended: `attendance_status = 'attended'`
- Display format stays the same ("3/5 attended")

### AttendanceBadge (`src/components/schedule/attendance-badge.tsx`)

- Read `attendance_status` instead of `attended`
- Count attended as `attendance_status = 'attended'`

### SessionCard (`src/components/schedule/session-card.tsx`)

- Update `SessionData` interface: replace `attended: boolean` in `session_students` type with `attendance_status: string`
- This interface is shared by multiple components, so this change propagates to `SessionEditForm`, `SessionDetailSheet`, etc.

### CalendarView & AllClassesList

- Update queries: select `attendance_status` instead of `attended` from `session_students`

### SessionEditForm & AdhocSessionForm

- When inserting new `session_students` records, use `attendance_status: 'pending'` instead of `attended: false`

### ClassSeriesList

- When adding students to sessions, use `attendance_status: 'pending'` instead of `attended: false`

### Sidebar Navigation (`src/components/layout/sidebar.tsx`)

- Add "Attendance" link between Schedule and Invoices
- Icon: ClipboardCheck or similar from Lucide

## New Files

| File | Purpose |
|------|---------|
| `src/app/(dashboard)/attendance/page.tsx` | Attendance page (client component) |
| `src/components/attendance/attendance-viewer.tsx` | Main viewer component with filters, summary cards, and table |
| `supabase/migrations/[timestamp]_attendance_status_enum.sql` | Migration to replace `attended` with `attendance_status` |

## Session-Level vs Student-Level Cancellation

There are two cancellation concepts in the system:
- **`class_sessions.status = 'cancelled'`** — the entire session was cancelled (e.g., holiday, tutor sick). All students in that session should have `attendance_status = 'cancelled'`.
- **`session_students.attendance_status = 'cancelled'`** — one student cancelled from a session that still ran.

In the attendance viewer, both appear the same way (as "Cancelled" with makeup tracking). The migration handles existing whole-session cancellations by setting student records to `cancelled` for any session where `class_sessions.status = 'cancelled'`.

When a session is cancelled via the session detail sheet going forward, the existing flow should also set all `session_students.attendance_status = 'cancelled'` for that session.

## What This Does NOT Include

- Invoice calculation changes (already implemented)
- Makeup session creation/linking workflow (already implemented)
- Editing attendance from the viewer (read-only by design)
- Attendance reporting/export features
