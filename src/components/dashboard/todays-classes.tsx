"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Calendar } from "lucide-react"

interface SessionRow {
  id: string
  start_time: string
  end_time: string
  status: string
  subjects: { name: string } | null
  tutors: { name: string } | null
  classrooms: { name: string } | null
  class_types: { name: string } | null
  streams: { name: string } | null
  session_students: { attendance_status: string }[]
}

import { formatTime } from "@/lib/format"

function statusVariant(status: string) {
  switch (status) {
    case "completed":
      return "default" as const
    case "cancelled":
      return "destructive" as const
    default:
      return "secondary" as const
  }
}

export function TodaysClasses() {
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchSessions() {
      try {
        const supabase = createClient()
        const today = new Date().toISOString().split("T")[0]

        const { data } = await supabase
          .from("class_sessions")
          .select(
            "id, start_time, end_time, status, subjects(name), tutors(name), classrooms(name), class_types(name), streams(name), session_students(attendance_status)"
          )
          .eq("date", today)
          .order("start_time")

        setSessions((data as unknown as SessionRow[]) ?? [])
      } catch (error) {
        console.error("Failed to fetch sessions:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchSessions()
  }, [])

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex flex-row items-center gap-2">
        <Calendar className="h-5 w-5 text-primary" />
        <CardTitle>Today&apos;s Classes</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-muted-foreground text-sm py-4 text-center">
            No classes scheduled for today.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Tutor</TableHead>
                <TableHead>Classroom</TableHead>
                <TableHead>Stream</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Students</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((session) => {
                const total = session.session_students.length
                const attended = session.session_students.filter(
                  (s) => s.attendance_status === "attended"
                ).length
                const hasAttendance = session.session_students.some(
                  (s) => s.attendance_status === "attended"
                )

                return (
                  <TableRow key={session.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatTime(session.start_time)} -{" "}
                      {formatTime(session.end_time)}
                    </TableCell>
                    <TableCell>{session.subjects?.name ?? "-"}</TableCell>
                    <TableCell>{session.tutors?.name ?? "-"}</TableCell>
                    <TableCell>{session.classrooms?.name ?? "-"}</TableCell>
                    <TableCell>{session.streams?.name ?? "-"}</TableCell>
                    <TableCell>{session.class_types?.name ?? "-"}</TableCell>
                    <TableCell>
                      {total === 0
                        ? "-"
                        : hasAttendance
                          ? `${attended}/${total} attended`
                          : `${total} enrolled`}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(session.status)}>
                        {session.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
