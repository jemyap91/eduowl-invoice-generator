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
