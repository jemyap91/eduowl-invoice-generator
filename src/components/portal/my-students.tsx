"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { Pencil, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/format"
import { StudentForm, type StudentFormValues } from "@/components/tm/student-form"
import { newDraft, type RateTierDraft } from "@/lib/tm/rate-tiers"
import { ASSIGNMENT_STATUS_LABELS, toNumber, type TmAssignmentStatus, type TmStudent } from "@/lib/tm/types"
import { TutorAssignmentForm, type TutorAssignmentValues } from "./tutor-assignment-form"

interface Tier {
  id: string
  label: string
  tutor_rate: number
  sort_order: number
}

interface Assignment {
  id: string
  code: string
  student_id: string
  subject: string
  timeslot: string | null
  status: TmAssignmentStatus
  tiers: Tier[]
}

type Student = Pick<TmStudent, "id" | "name" | "parent_name" | "parent_phone" | "contact_preference" | "address" | "remarks" | "created_by_tutor_id">

type StudentTarget = { student: Student | null } | null
type AssignmentTarget = { student: Student; assignment: Assignment | null } | null

const STATUS_ORDER: Record<TmAssignmentStatus, number> = { active: 0, paused: 1, stopping: 2, stopped: 3, moved_to_academy: 4 }

export function MyStudents() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tutorId, setTutorId] = useState<string | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [studentTarget, setStudentTarget] = useState<StudentTarget>(null)
  const [assignmentTarget, setAssignmentTarget] = useState<AssignmentTarget>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError("You are not signed in."); setLoading(false); return }
    const { data: tutor, error: tutorError } = await supabase.from("tm_tutors").select("id").eq("profile_id", user.id).maybeSingle()
    if (tutorError || !tutor) {
      setError(tutorError ? "Could not load your tutor profile." : "No tutor profile is linked to your account yet. Ask EduOwl to link it.")
      setLoading(false)
      return
    }
    const [studentsRes, assignmentsRes] = await Promise.all([
      supabase.from("tm_students")
        .select("id, name, parent_name, parent_phone, contact_preference, address, remarks, created_by_tutor_id")
        .order("name"),
      supabase.from("tm_assignments").select("id, code, student_id, subject, timeslot, status").eq("tutor_id", tutor.id).order("code"),
    ])
    if (studentsRes.error || assignmentsRes.error) { setError("Could not load your students."); setLoading(false); return }
    const ids = (assignmentsRes.data ?? []).map((a) => a.id)
    const { data: tiers, error: tierError } = ids.length
      ? await supabase.from("tm_rate_tiers_tutor_view").select("id, assignment_id, label, tutor_rate, sort_order").in("assignment_id", ids)
      : { data: [], error: null }
    if (tierError) { setError("Could not load your rates."); setLoading(false); return }

    const byAssignment = new Map<string, Tier[]>()
    for (const t of tiers ?? []) {
      if (!t.id || !t.assignment_id || !t.label) continue
      const list = byAssignment.get(t.assignment_id) ?? []
      list.push({ id: t.id, label: t.label, tutor_rate: toNumber(t.tutor_rate) ?? 0, sort_order: t.sort_order ?? 0 })
      byAssignment.set(t.assignment_id, list)
    }
    for (const list of byAssignment.values()) list.sort((a, b) => a.sort_order - b.sort_order)

    setTutorId(tutor.id)
    setStudents(studentsRes.data ?? [])
    setAssignments((assignmentsRes.data ?? []).map((a) => ({ ...a, status: a.status as TmAssignmentStatus, tiers: byAssignment.get(a.id) ?? [] })))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function saveStudent(values: StudentFormValues) {
    if (!studentTarget) return
    const existing = studentTarget.student
    setSaving(true)
    const supabase = createClient()
    const payload = {
      name: values.name,
      parent_name: values.parent_name || null,
      parent_phone: values.parent_phone || null,
      contact_preference: values.contact_preference || null,
      address: values.address || null,
      remarks: values.remarks || null,
    }
    const result = existing
      ? await supabase.from("tm_students").update(payload).eq("id", existing.id).select("id, name, parent_name, parent_phone, contact_preference, address, remarks, created_by_tutor_id").single()
      : await supabase.from("tm_students").insert(payload).select("id, name, parent_name, parent_phone, contact_preference, address, remarks, created_by_tutor_id").single()
    setSaving(false)
    if (result.error || !result.data) {
      toast({ title: "Could not save the student", description: result.error?.message, variant: "destructive" })
      return
    }
    setStudentTarget(null)
    await load()
    if (existing) {
      toast({ title: "Student updated" })
    } else {
      toast({ title: `${values.name} added`, description: "Now add the subject you teach and your hourly pay." })
      setAssignmentTarget({ student: result.data, assignment: null })
    }
  }

  async function saveAssignment(values: TutorAssignmentValues) {
    if (!assignmentTarget) return
    const { student, assignment } = assignmentTarget
    setSaving(true)
    const { error: saveError } = await createClient().rpc("tm_tutor_save_assignment", {
      p_assignment: assignment
        ? { subject: values.subject, timeslot: values.timeslot, status: values.status }
        : { student_id: student.id, subject: values.subject, timeslot: values.timeslot },
      p_tiers: values.tiers,
      p_id: assignment?.id,
    })
    setSaving(false)
    if (saveError) {
      toast({ title: "Could not save the subject", description: saveError.message, variant: "destructive" })
      return
    }
    toast({ title: assignment ? "Subject updated" : `${values.subject} added for ${student.name}` })
    setAssignmentTarget(null)
    load()
  }

  if (loading) return <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-28 w-full" />)}</div>
  if (error) return <Card><CardContent className="py-6 text-sm text-destructive">{error}</CardContent></Card>

  const byStudent = new Map<string, Assignment[]>()
  for (const a of assignments) {
    const list = byStudent.get(a.student_id) ?? []
    list.push(a)
    byStudent.set(a.student_id, list)
  }
  for (const list of byStudent.values()) list.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])

  const editingAssignment = assignmentTarget?.assignment ?? null
  const initialTiers: RateTierDraft[] = editingAssignment
    ? editingAssignment.tiers.map((t) => newDraft({ id: t.id, label: t.label, tutor_rate: String(t.tutor_rate) }))
    : [newDraft({ label: "1 to 1" })]

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">My Students</h1>
          <p className="text-sm text-muted-foreground">Add your students, the subjects you teach them, and your hourly pay.</p>
        </div>
        <Button size="sm" onClick={() => setStudentTarget({ student: null })}><Plus className="mr-1 h-4 w-4" />Add student</Button>
      </div>

      {students.length === 0 && (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">No students yet. Tap <span className="font-medium text-foreground">Add student</span> to get started.</CardContent>
        </Card>
      )}

      {students.map((s) => {
        const list = byStudent.get(s.id) ?? []
        const own = s.created_by_tutor_id === tutorId
        return (
          <Card key={s.id} data-testid="portal-student">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{s.name}</CardTitle>
                  <CardDescription>
                    {[s.parent_name, s.parent_phone, s.contact_preference].filter(Boolean).join(" · ") || "No parent details"}
                  </CardDescription>
                </div>
                <div className="flex shrink-0 gap-1">
                  {own && (
                    <Button variant="ghost" size="icon" aria-label={`Edit ${s.name}`} onClick={() => setStudentTarget({ student: s })}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setAssignmentTarget({ student: s, assignment: null })}>
                    <Plus className="mr-1 h-4 w-4" />Add subject
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {list.length === 0 && <p className="text-sm text-muted-foreground">No subjects yet. Add one to start logging sessions.</p>}
              {list.map((a) => (
                <div key={a.id} className={cn("flex flex-wrap items-center justify-between gap-2 rounded-md border bg-white px-3 py-2", a.status !== "active" && "opacity-70")}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {a.subject}
                      {a.timeslot ? <span className="font-normal text-muted-foreground"> · {a.timeslot}</span> : null}
                      <span className="ml-2 font-mono text-xs text-muted-foreground">{a.code}</span>
                      {a.status !== "active" && <Badge variant="outline" className="ml-2">{ASSIGNMENT_STATUS_LABELS[a.status]}</Badge>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {a.tiers.length ? a.tiers.map((t) => `${t.label}: ${formatCurrency(t.tutor_rate)}/hr`).join(" · ") : "No rates set yet"}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {(a.status === "active" || a.status === "paused") && (
                      <Button variant="ghost" size="icon" aria-label={`Edit ${a.subject} for ${s.name}`} onClick={() => setAssignmentTarget({ student: s, assignment: a })}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {a.status === "active" && (
                      <Button asChild size="sm">
                        <Link href={`/portal/log?assignment=${a.id}`}><Plus className="mr-1 h-4 w-4" />Log session</Link>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )
      })}

      <Dialog open={studentTarget !== null} onOpenChange={(o) => !o && setStudentTarget(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{studentTarget?.student ? "Edit student" : "Add student"}</DialogTitle>
            <DialogDescription>Student and parent contact details. EduOwl uses these for the monthly invoice.</DialogDescription>
          </DialogHeader>
          {studentTarget && (
            <StudentForm
              key={studentTarget.student?.id ?? "new"}
              onSubmit={saveStudent}
              onCancel={() => setStudentTarget(null)}
              defaultValues={studentTarget.student ? {
                name: studentTarget.student.name,
                parent_name: studentTarget.student.parent_name ?? "",
                parent_phone: studentTarget.student.parent_phone ?? "",
                contact_preference: studentTarget.student.contact_preference ?? "",
                address: studentTarget.student.address ?? "",
                remarks: studentTarget.student.remarks ?? "",
              } : undefined}
              isLoading={saving}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={assignmentTarget !== null} onOpenChange={(o) => !o && setAssignmentTarget(null)}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAssignment ? `Edit ${editingAssignment.subject}` : "Add subject"}</DialogTitle>
            <DialogDescription>What you teach this student and what you are paid per hour.</DialogDescription>
          </DialogHeader>
          {assignmentTarget && (
            <TutorAssignmentForm
              key={editingAssignment?.id ?? `new-${assignmentTarget.student.id}`}
              studentName={assignmentTarget.student.name}
              initialTiers={initialTiers}
              defaultValues={editingAssignment ? {
                subject: editingAssignment.subject,
                timeslot: editingAssignment.timeslot ?? "",
                status: editingAssignment.status,
              } : undefined}
              onSubmit={saveAssignment}
              onCancel={() => setAssignmentTarget(null)}
              isLoading={saving}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
