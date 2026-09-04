export interface InvoiceLineItem {
  description: string
  hours: number
  hourlyRate: number
  total: number
  isAdhoc: boolean
  datesAttended?: string
}

export async function calculateInvoiceItems(
  studentId: string,
  month: number,
  year: number,
  supabase: ReturnType<typeof import("@/lib/supabase/client").createClient>
): Promise<InvoiceLineItem[]> {
  // 1. Get the first and last day of the month
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const endDate = `${year}-${String(month).padStart(2, "0")}-${lastDay}`

  // 2. Get all sessions in the date range, then filter by student enrollment
  // (querying from class_sessions directly for reliable date filtering —
  //  PostgREST embedded filters on date ranges can be unreliable)
  const { data: sessions } = await supabase
    .from("class_sessions")
    .select(
      `
      id, date, start_time, end_time, status, series_id,
      class_types(name, hourly_rate),
      subjects(name),
      class_series(is_recurring),
      session_students!inner(student_id, attendance_status)
    `
    )
    .gte("date", startDate)
    .lte("date", endDate)
    .neq("status", "cancelled")
    .eq("session_students.student_id", studentId)
    .neq("session_students.attendance_status", "cancelled")

  if (!sessions || sessions.length === 0) return []

  // 3. Get student name
  const { data: student } = await supabase
    .from("students")
    .select("name")
    .eq("id", studentId)
    .single()

  const studentName = student?.name || "Unknown"

  // 4. Group by class_type + subject + source (bootcamp vs regular) and sum hours
  const groups: Record<
    string,
    {
      subjectName: string
      classTypeName: string
      hourlyRate: number
      totalHours: number
      dates: string[]
      isBootcamp: boolean
    }
  > = {}

  for (const session of sessions) {
    const classType = session.class_types as any
    const subject = session.subjects as any
    const isBootcamp = session.series_id && (session.class_series as any)?.is_recurring === false

    // Calculate hours from start_time/end_time
    const [sh, sm] = session.start_time.split(":").map(Number)
    const [eh, em] = session.end_time.split(":").map(Number)
    const hours = (eh * 60 + em - sh * 60 - sm) / 60

    const key = `${classType?.name}|${subject?.name}|${isBootcamp ? "bootcamp" : "regular"}`
    if (!groups[key]) {
      groups[key] = {
        subjectName: subject?.name || "Lesson",
        classTypeName: classType?.name || "Class",
        hourlyRate: parseFloat(classType?.hourly_rate || "0"),
        totalHours: 0,
        dates: [],
        isBootcamp: !!isBootcamp,
      }
    }
    groups[key].totalHours += hours
    if (session.date) {
      groups[key].dates.push(session.date)
    }
  }

  // 5. Convert to line items
  return Object.values(groups).map((g) => {
    // Sort dates and format as "1, 5, 12, 19 Mar" style
    const sortedDates = g.dates.sort()
    const formatted = sortedDates.map((d) => {
      const dt = new Date(d + "T00:00:00")
      return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
    })

    const label = g.isBootcamp
      ? `${studentName} - ${g.subjectName} Bootcamp (${g.classTypeName})`
      : `${studentName} - ${g.subjectName} (${g.classTypeName})`

    return {
      description: label,
      hours: Math.round(g.totalHours * 100) / 100,
      hourlyRate: g.hourlyRate,
      total: Math.round(g.totalHours * g.hourlyRate * 100) / 100,
      isAdhoc: false,
      datesAttended: formatted.join(", "),
    }
  })
}
