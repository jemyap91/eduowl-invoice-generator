"use client"

import { useCallback, useEffect, useState } from "react"
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  addMonths,
  subMonths,
} from "date-fns"
import { ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { WeekView } from "./week-view"
import { DayView } from "./day-view"
import { MonthView } from "./month-view"
import { SessionDetailSheet } from "./session-detail-sheet"
import { AdhocSessionForm } from "./adhoc-session-form"
import type { SessionData } from "./session-card"

type CalendarViewType = "week" | "day" | "month"

function getDateRange(date: Date, view: CalendarViewType) {
  switch (view) {
    case "week": {
      const start = startOfWeek(date, { weekStartsOn: 1 })
      const end = endOfWeek(date, { weekStartsOn: 1 })
      return { start, end }
    }
    case "day":
      return { start: date, end: date }
    case "month": {
      // Fetch the full calendar grid range (may include days from adjacent months)
      const monthStart = startOfMonth(date)
      const monthEnd = endOfMonth(date)
      const start = startOfWeek(monthStart, { weekStartsOn: 1 })
      const end = endOfWeek(monthEnd, { weekStartsOn: 1 })
      return { start, end }
    }
  }
}

function getDateLabel(date: Date, view: CalendarViewType): string {
  switch (view) {
    case "week": {
      const start = startOfWeek(date, { weekStartsOn: 1 })
      const end = endOfWeek(date, { weekStartsOn: 1 })
      if (start.getMonth() === end.getMonth()) {
        return `${format(start, "MMM d")}-${format(end, "d, yyyy")}`
      }
      return `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`
    }
    case "day":
      return format(date, "EEEE, MMMM d, yyyy")
    case "month":
      return format(date, "MMMM yyyy")
  }
}

function getInitialView(): CalendarViewType {
  if (typeof window !== "undefined" && window.innerWidth < 1024) {
    return "day"
  }
  return "week"
}

export function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<CalendarViewType>(getInitialView)
  const [sessions, setSessions] = useState<SessionData[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSession, setSelectedSession] = useState<SessionData | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [adhocOpen, setAdhocOpen] = useState(false)

  const fetchSessions = useCallback(async () => {
    setLoading(true)
    const { start, end } = getDateRange(currentDate, view)
    const startDate = format(start, "yyyy-MM-dd")
    const endDate = format(end, "yyyy-MM-dd")

    const supabase = createClient()
    const { data, error } = await supabase
      .from("class_sessions")
      .select(
        `
        *,
        subjects(name),
        tutors(name),
        classrooms(name),
        class_types(name),
        streams(name),
        session_students(student_id, attendance_status, students(name))
      `
      )
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date")
      .order("start_time")

    if (!error && data) {
      setSessions(data as unknown as SessionData[])
    } else {
      setSessions([])
    }
    setLoading(false)
  }, [currentDate, view])

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  function navigatePrev() {
    switch (view) {
      case "week":
        setCurrentDate((d) => subWeeks(d, 1))
        break
      case "day":
        setCurrentDate((d) => subDays(d, 1))
        break
      case "month":
        setCurrentDate((d) => subMonths(d, 1))
        break
    }
  }

  function navigateNext() {
    switch (view) {
      case "week":
        setCurrentDate((d) => addWeeks(d, 1))
        break
      case "day":
        setCurrentDate((d) => addDays(d, 1))
        break
      case "month":
        setCurrentDate((d) => addMonths(d, 1))
        break
    }
  }

  function goToToday() {
    setCurrentDate(new Date())
  }

  function handleDayClick(date: Date) {
    setCurrentDate(date)
    setView("day")
  }

  function handleViewChange(newView: string) {
    setView(newView as CalendarViewType)
  }

  function handleSessionClick(session: SessionData) {
    setSelectedSession(session)
    setDetailOpen(true)
  }

  function handleSessionUpdated() {
    fetchSessions()
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        {/* Date navigation */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={navigatePrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={navigateNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold ml-2">
            {getDateLabel(currentDate, view)}
          </h2>
        </div>

        {/* View toggle & actions */}
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setAdhocOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Extra Class
          </Button>
          <Tabs value={view} onValueChange={handleViewChange}>
            <TabsList>
              <TabsTrigger value="day">Day</TabsTrigger>
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="month">Month</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Calendar content */}
      <div className="border rounded-lg overflow-hidden bg-background">
        {loading ? (
          <div className="p-8 space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <>
            {view === "week" && (
              <WeekView
                currentDate={currentDate}
                sessions={sessions}
                onDayClick={handleDayClick}
                onSessionClick={handleSessionClick}
              />
            )}
            {view === "day" && (
              <DayView
                currentDate={currentDate}
                sessions={sessions}
                onSessionClick={handleSessionClick}
              />
            )}
            {view === "month" && (
              <MonthView
                currentDate={currentDate}
                sessions={sessions}
                onDayClick={handleDayClick}
                onSessionClick={handleSessionClick}
              />
            )}
          </>
        )}
      </div>

      {/* Session Detail Sheet */}
      <SessionDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        session={selectedSession}
        onUpdated={handleSessionUpdated}
      />

      {/* Extra Class Form */}
      <AdhocSessionForm
        open={adhocOpen}
        onOpenChange={setAdhocOpen}
        onCreated={handleSessionUpdated}
      />
    </div>
  )
}
