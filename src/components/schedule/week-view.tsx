"use client"

import { format, eachDayOfInterval, startOfWeek, endOfWeek, isSameDay, parseISO } from "date-fns"
import { cn } from "@/lib/utils"
import { SessionCard, type SessionData } from "./session-card"

interface WeekViewProps {
  currentDate: Date
  sessions: SessionData[]
  onSessionClick?: (session: SessionData) => void
  onDayClick?: (date: Date) => void
}

const HOUR_HEIGHT = 64 // px per hour
const START_HOUR = 8
const END_HOUR = 21 // 9 PM
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
    height: Math.max((duration / 60) * HOUR_HEIGHT - 2, HOUR_HEIGHT / 2), // minimum half-hour height
  }
}

// Detect overlapping sessions and assign column positions
function layoutSessions(daySessions: SessionData[]) {
  if (daySessions.length === 0) return []

  const items = daySessions.map((session) => ({
    session,
    startMin: timeToMinutes(session.start_time),
    endMin: timeToMinutes(session.end_time),
    col: 0,
    totalCols: 1,
  }))

  // Sort by start time, then by longer duration first
  items.sort((a, b) => a.startMin - b.startMin || (b.endMin - b.startMin) - (a.endMin - a.startMin))

  // Group into overlap clusters
  const clusters: (typeof items)[] = []
  let currentCluster: typeof items = []

  for (const item of items) {
    if (currentCluster.length === 0 || item.startMin <= Math.max(...currentCluster.map((c) => c.endMin))) {
      currentCluster.push(item)
    } else {
      clusters.push(currentCluster)
      currentCluster = [item]
    }
  }
  if (currentCluster.length > 0) clusters.push(currentCluster)

  // Assign columns within each cluster
  for (const cluster of clusters) {
    const columns: (typeof items[0])[][] = []
    for (const item of cluster) {
      let placed = false
      for (let c = 0; c < columns.length; c++) {
        const lastInCol = columns[c][columns[c].length - 1]
        if (item.startMin >= lastInCol.endMin) {
          columns[c].push(item)
          item.col = c
          placed = true
          break
        }
      }
      if (!placed) {
        item.col = columns.length
        columns.push([item])
      }
    }
    const totalCols = columns.length
    for (const item of cluster) {
      item.totalCols = totalCols
    }
  }

  return items
}

export function WeekView({ currentDate, sessions, onSessionClick, onDayClick }: WeekViewProps) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }) // Monday
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd })

  const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => START_HOUR + i)

  function getSessionsForDay(day: Date): SessionData[] {
    return sessions.filter((s) => isSameDay(parseISO(s.date), day))
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[800px]">
        {/* Day headers */}
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b sticky top-0 bg-background z-10">
          <div className="p-2 text-xs text-muted-foreground" />
          {days.map((day) => {
            const isToday = isSameDay(day, new Date())
            return (
              <button
                key={day.toISOString()}
                onClick={() => onDayClick?.(day)}
                className={cn(
                  "p-2 text-center border-l cursor-pointer hover:bg-muted/50 transition-colors",
                  isToday && "bg-primary/5"
                )}
              >
                <div className="text-xs text-muted-foreground">
                  {format(day, "EEE")}
                </div>
                <div
                  className={cn(
                    "text-sm font-medium",
                    isToday &&
                      "bg-primary text-primary-foreground rounded-full w-7 h-7 flex items-center justify-center mx-auto"
                  )}
                >
                  {format(day, "d")}
                </div>
              </button>
            )
          })}
        </div>

        {/* Time grid */}
        <div className="grid grid-cols-[60px_repeat(7,1fr)] relative pt-2">
          {/* Time labels */}
          <div>
            {hours.map((hour) => (
              <div
                key={hour}
                className="text-xs text-muted-foreground text-right pr-2 relative"
                style={{ height: HOUR_HEIGHT }}
              >
                <span className="absolute -top-2 right-2">
                  {hour === 0 ? "12 AM" : hour < 12 ? `${hour} AM` : hour === 12 ? "12 PM" : `${hour - 12} PM`}
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day) => {
            const daySessions = getSessionsForDay(day)
            const isToday = isSameDay(day, new Date())

            return (
              <div
                key={day.toISOString()}
                className={cn("border-l relative", isToday && "bg-primary/5")}
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
                {layoutSessions(daySessions).map(({ session, col, totalCols }) => {
                  const { top, height } = getSessionPosition(
                    session.start_time,
                    session.end_time
                  )
                  const widthPct = 100 / totalCols
                  const leftPct = col * widthPct

                  return (
                    <div
                      key={session.id}
                      className="absolute z-[1] px-0.5"
                      style={{ top, height, left: `${leftPct}%`, width: `${widthPct}%` }}
                    >
                      <SessionCard
                        session={session}
                        compact={totalCols > 1}
                        height={height}
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
