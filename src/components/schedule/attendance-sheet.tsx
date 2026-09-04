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
