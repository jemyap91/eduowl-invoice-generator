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
