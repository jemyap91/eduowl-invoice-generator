"use client"

import { useEffect, useState } from "react"
import { format, isSameDay, parseISO } from "date-fns"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { SessionCard, type SessionData } from "./session-card"

interface DayViewProps {
  currentDate: Date
  sessions: SessionData[]
  onSessionClick?: (session: SessionData) => void
}

interface Classroom {
  id: string
  name: string
}

const HOUR_HEIGHT = 64
const START_HOUR = 8
const END_HOUR = 21
const TOTAL_HOURS = END_HOUR - START_HOUR

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number)
  return h * 60 + m
}

function getSessionPosition(startTime: string, endTime: string) {
  const startMinutes = timeToMinutes(startTime)
  const endMinutes = timeToMinutes(endTime)
  const startOffset = startMinutes - START_HOUR * 60
  const duration = endMinutes - startMinutes

  return {
    top: (startOffset / 60) * HOUR_HEIGHT,
    height: Math.max((duration / 60) * HOUR_HEIGHT - 2, HOUR_HEIGHT / 2),
  }
}

export function DayView({ currentDate, sessions, onSessionClick }: DayViewProps) {
  const [classrooms, setClassrooms] = useState<Classroom[]>([])

  useEffect(() => {
    async function fetchClassrooms() {
      const supabase = createClient()
      const { data } = await supabase
        .from("classrooms")
        .select("id, name")
        .order("name")

      if (data) setClassrooms(data)
    }
    fetchClassrooms()
  }, [])

  const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => START_HOUR + i)

  const daySessions = sessions.filter((s) => isSameDay(parseISO(s.date), currentDate))

  function getSessionsForClassroom(classroomId: string): SessionData[] {
    return daySessions.filter((s) => s.classroom_id === classroomId)
  }

  // Sessions not assigned to any known classroom
  const knownClassroomIds = new Set(classrooms.map((c) => c.id))
  const unassignedSessions = daySessions.filter((s) => !knownClassroomIds.has(s.classroom_id))

  const isToday = isSameDay(currentDate, new Date())

  const columns = classrooms.length > 0 ? classrooms : [{ id: "all", name: "All Sessions" }]

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[500px]">
        {/* Date header */}
        <div className="text-center py-2 border-b">
          <div className={cn("text-lg font-semibold", isToday && "text-primary")}>
            {format(currentDate, "EEEE, MMMM d, yyyy")}
          </div>
        </div>

        {/* Classroom column headers */}
        <div
          className="grid border-b sticky top-0 bg-background z-10"
          style={{
            gridTemplateColumns: `60px repeat(${columns.length}, 1fr)`,
          }}
        >
          <div className="p-2 text-xs text-muted-foreground" />
          {columns.map((classroom) => (
            <div
              key={classroom.id}
              className="p-2 text-center border-l font-medium text-sm"
            >
              {classroom.name}
            </div>
          ))}
        </div>

        {/* Time grid */}
        <div
          className="grid relative pt-2"
          style={{
            gridTemplateColumns: `60px repeat(${columns.length}, 1fr)`,
          }}
        >
          {/* Time labels */}
          <div>
            {hours.map((hour) => (
              <div
                key={hour}
                className="text-xs text-muted-foreground text-right pr-2 relative"
                style={{ height: HOUR_HEIGHT }}
              >
                <span className="absolute -top-2 right-2">
                  {hour === 0
                    ? "12 AM"
                    : hour < 12
                    ? `${hour} AM`
                    : hour === 12
                    ? "12 PM"
                    : `${hour - 12} PM`}
                </span>
              </div>
            ))}
          </div>

          {/* Classroom columns */}
          {columns.map((classroom) => {
            const colSessions =
              classroom.id === "all"
                ? daySessions
                : [
                    ...getSessionsForClassroom(classroom.id),
                    ...(classroom === columns[columns.length - 1]
                      ? unassignedSessions
                      : []),
                  ]

            return (
              <div
                key={classroom.id}
                className="border-l relative"
                style={{ height: TOTAL_HOURS * HOUR_HEIGHT }}
              >
                {/* Hour grid lines */}
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className="border-b border-dashed border-muted"
                    style={{ height: HOUR_HEIGHT }}
                  />
                ))}

                {/* Session blocks */}
                {colSessions.map((session) => {
                  const { top, height } = getSessionPosition(
                    session.start_time,
                    session.end_time
                  )

                  return (
                    <div
                      key={session.id}
                      className="absolute left-1 right-1 z-[1]"
                      style={{ top, height }}
                    >
                      <SessionCard
                        session={session}
                        onClick={() => onSessionClick?.(session)}
                      />
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
