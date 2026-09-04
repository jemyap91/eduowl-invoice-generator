"use client"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
export interface SessionData {
  id: string
  series_id: string | null
  subject_id: string
  tutor_id: string
  classroom_id: string
  class_type_id: string
  stream_id: string | null
  date: string
  start_time: string
  end_time: string
  status: string
  notes: string | null
  is_adhoc: boolean
  makeup_for_session_id: string | null
  subjects: { name: string } | null
  tutors: { name: string } | null
  classrooms: { name: string } | null
  class_types: { name: string } | null
  streams: { name: string } | null
  class_series: { is_recurring: boolean } | null
  session_students: { student_id: string; attendance_status: string; students: { name: string } | null }[]
}

interface SessionCardProps {
  session: SessionData
  compact?: boolean
  height?: number
  onClick?: () => void
}

// Re-export for components that import formatTime from here
export { formatTime } from "@/lib/format"

function formatTimeShort(time: string): string {
  const [h, m] = time.split(":")
  const hour = parseInt(h)
  const ampm = hour >= 12 ? "p" : "a"
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  if (m === "00") return `${hour12}${ampm}`
  return `${hour12}:${m}${ampm}`
}

function getClassroomStyles(classroomName: string | undefined): string {
  if (!classroomName) return "bg-muted border-muted-foreground/20"
  const lower = classroomName.toLowerCase()
  if (lower.includes("1")) return "bg-primary/10 border-primary"
  if (lower.includes("2")) return "bg-secondary/20 border-secondary"
  if (lower.includes("3")) return "bg-accent/30 border-accent"
  return "bg-muted border-muted-foreground/20"
}

export function SessionCard({ session, compact = false, height, onClick }: SessionCardProps) {
  const isCancelled = session.status === "cancelled"
  const classroomStyles = getClassroomStyles(session.classrooms?.name)
  const studentCount = session.session_students?.length || 0
  const isShort = height !== undefined && height <= 64

  if (compact) {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onClick}
              className={cn(
                "w-full text-left text-xs px-1.5 py-0.5 rounded border truncate",
                classroomStyles,
                isCancelled && "opacity-50",
                "hover:opacity-80 transition-opacity cursor-pointer"
              )}
            >
              <span className={cn(isCancelled && "line-through")}>
                {formatTimeShort(session.start_time)}{" "}
                {session.subjects?.name || "Untitled"}
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" align="start" className="p-0 w-[220px] overflow-hidden rounded-lg border shadow-lg">
            <div className={cn("px-3 py-2", isCancelled ? "bg-destructive/10" : "bg-primary/10")}>
              <p className="font-semibold text-sm">{session.subjects?.name || "Untitled"}</p>
              <p className="text-xs text-muted-foreground">{formatTimeShort(session.start_time)} - {formatTimeShort(session.end_time)}</p>
            </div>
            <div className="px-3 py-2 space-y-1.5 text-xs">
              {session.tutors?.name && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-14 shrink-0">Tutor</span>
                  <span className="font-medium truncate">{session.tutors.name}</span>
                </div>
              )}
              {session.classrooms?.name && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-14 shrink-0">Room</span>
                  <span className="font-medium">{session.classrooms.name}</span>
                </div>
              )}
              {session.streams?.name && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-14 shrink-0">Stream</span>
                  <span className="font-medium">{session.streams.name}</span>
                </div>
              )}
              {session.class_types?.name && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-14 shrink-0">Type</span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{session.class_types.name}</Badge>
                </div>
              )}
              <div className="pt-1 border-t space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-14 shrink-0">Students</span>
                  <span className="font-medium">{studentCount}</span>
                </div>
                {studentCount > 0 && (
                  <div className="pl-[62px] space-y-0.5">
                    {session.session_students.map((ss) => (
                      <p key={ss.student_id} className="text-muted-foreground truncate">
                        {ss.students?.name || "Unknown"}
                      </p>
                    ))}
                  </div>
                )}
              </div>
              {isCancelled && (
                <div className="pt-1 border-t">
                  <Badge variant="destructive" className="text-[10px]">Cancelled</Badge>
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  if (isShort) {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onClick}
              className={cn(
                "w-full h-full text-left px-2 py-1 rounded-md border text-xs overflow-hidden",
                classroomStyles,
                isCancelled && "opacity-50",
                "hover:shadow-md transition-shadow cursor-pointer"
              )}
            >
              <div className={cn("font-semibold text-sm truncate", isCancelled && "line-through")}>
                {session.subjects?.name || "Untitled"}
              </div>
              <div className={cn("text-muted-foreground truncate", isCancelled && "line-through")}>
                {session.tutors?.name || "No tutor"}
              </div>
              <div className="text-muted-foreground truncate">
                {formatTimeShort(session.start_time)}-{formatTimeShort(session.end_time)}
              </div>
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" align="start" className="p-0 w-[220px] overflow-hidden rounded-lg border shadow-lg">
            <div className={cn("px-3 py-2", isCancelled ? "bg-destructive/10" : "bg-primary/10")}>
              <p className="font-semibold text-sm">{session.subjects?.name || "Untitled"}</p>
              <p className="text-xs text-muted-foreground">{formatTimeShort(session.start_time)} - {formatTimeShort(session.end_time)}</p>
            </div>
            <div className="px-3 py-2 space-y-1.5 text-xs">
              {session.tutors?.name && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-14 shrink-0">Tutor</span>
                  <span className="font-medium truncate">{session.tutors.name}</span>
                </div>
              )}
              {session.classrooms?.name && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-14 shrink-0">Room</span>
                  <span className="font-medium">{session.classrooms.name}</span>
                </div>
              )}
              {session.class_types?.name && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-14 shrink-0">Type</span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{session.class_types.name}</Badge>
                </div>
              )}
              <div className="pt-1 border-t">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-14 shrink-0">Students</span>
                  <span className="font-medium">
                    {studentCount > 0
                      ? session.session_students.map((ss) => ss.students?.name || "Unknown").join(", ")
                      : "None"}
                  </span>
                </div>
              </div>
              {isCancelled && (
                <div className="pt-1 border-t">
                  <Badge variant="destructive" className="text-[10px]">Cancelled</Badge>
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full h-full text-left p-2 rounded-md border text-xs space-y-1 overflow-hidden",
        classroomStyles,
        isCancelled && "opacity-50",
        "hover:shadow-md transition-shadow cursor-pointer"
      )}
    >
      <div className={cn("font-semibold text-sm truncate", isCancelled && "line-through")}>
        {session.subjects?.name || "Untitled"}
      </div>
      <div className={cn("text-muted-foreground truncate", isCancelled && "line-through")}>
        {session.tutors?.name || "No tutor"}
      </div>
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-muted-foreground">
          {formatTimeShort(session.start_time)}-{formatTimeShort(session.end_time)}
        </span>
      </div>
      <div className="flex items-center gap-1 flex-wrap">
        {session.classrooms?.name && (
          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
            {session.classrooms.name}
          </Badge>
        )}
        {session.class_types?.name && (
          <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
            {session.class_types.name}
          </Badge>
        )}
      </div>
      <div className="text-muted-foreground">
        {studentCount > 0
          ? session.session_students.map((ss) => ss.students?.name || "Unknown").join(", ")
          : "No students"}
      </div>
    </button>
  )
}

export { formatTimeShort, getClassroomStyles }
