"use client"

import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  parseISO,
  isToday,
} from "date-fns"
import { cn } from "@/lib/utils"
import { SessionCard, type SessionData } from "./session-card"

interface MonthViewProps {
  currentDate: Date
  sessions: SessionData[]
  onSessionClick?: (session: SessionData) => void
  onDayClick?: (date: Date) => void
}

const MAX_VISIBLE_SESSIONS = 3
const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

export function MonthView({
  currentDate,
  sessions,
  onSessionClick,
  onDayClick,
}: MonthViewProps) {
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const allDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  // Group days into weeks
  const weeks: Date[][] = []
  for (let i = 0; i < allDays.length; i += 7) {
    weeks.push(allDays.slice(i, i + 7))
  }

  function getSessionsForDay(day: Date): SessionData[] {
    return sessions.filter((s) => isSameDay(parseISO(s.date), day))
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[700px]">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b">
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              className="p-2 text-center text-xs font-medium text-muted-foreground"
            >
              {label}
            </div>
          ))}
        </div>

        {/* Week rows */}
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7 border-b">
            {week.map((day) => {
              const daySessions = getSessionsForDay(day)
              const inCurrentMonth = isSameMonth(day, currentDate)
              const today = isToday(day)
              const extraCount = Math.max(0, daySessions.length - MAX_VISIBLE_SESSIONS)

              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "border-l first:border-l-0 min-h-[100px] p-1",
                    !inCurrentMonth && "bg-muted/30",
                    today && "bg-primary/5"
                  )}
                >
                  {/* Day number */}
                  <button
                    onClick={() => onDayClick?.(day)}
                    className={cn(
                      "text-sm mb-1 w-7 h-7 flex items-center justify-center rounded-full hover:bg-muted transition-colors cursor-pointer",
                      !inCurrentMonth && "text-muted-foreground",
                      today &&
                        "bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                    )}
                  >
                    {format(day, "d")}
                  </button>

                  {/* Session list */}
                  <div className="space-y-0.5">
                    {daySessions.slice(0, MAX_VISIBLE_SESSIONS).map((session) => (
                      <SessionCard
                        key={session.id}
                        session={session}
                        compact
                        onClick={() => onSessionClick?.(session)}
                      />
                    ))}
                    {extraCount > 0 && (
                      <button
                        onClick={() => onDayClick?.(day)}
                        className="w-full text-left text-xs text-muted-foreground px-1.5 py-0.5 hover:text-foreground transition-colors cursor-pointer"
                      >
                        +{extraCount} more
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
