"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { Plus, Pencil, Search, GraduationCap, ChevronDown, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { StudentForm, type StudentFormValues } from "./student-form"
import {
  ASSIGNMENT_STATUS_LABELS, toNumber,
  type TmAssignment, type TmRateTier, type TmStudent,
} from "@/lib/tm/types"

export interface AssignmentWithTiers extends TmAssignment {
  tm_tutors: { id: string; name: string } | null
  tm_rate_tiers: TmRateTier[]
}

export interface StudentWithAssignments extends TmStudent {
  assignments: AssignmentWithTiers[]
}

export function formatTierSummary(tiers: TmRateTier[]): string {
  return [...tiers]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((t) => `${t.label} $${t.parent_rate}/$${t.tutor_rate}`)
    .join(" · ")
}

interface StudentListProps {
  onAddAssignment?: (student: StudentWithAssignments) => void
  onEditAssignment?: (assignment: AssignmentWithTiers, student: StudentWithAssignments) => void
  refreshKey?: number
}

export function StudentList({ onAddAssignment, onEditAssignment, refreshKey = 0 }: StudentListProps) {
  const [students, setStudents] = useState<StudentWithAssignments[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<StudentWithAssignments | null>(null)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const [studentsRes, assignmentsRes] = await Promise.all([
      supabase.from("tm_students").select("*").order("name"),
      supabase.from("tm_assignments").select("*, tm_tutors(id, name), tm_rate_tiers(*)").order("code"),
    ])
    if (studentsRes.error || assignmentsRes.error) {
      toast({ title: "Error", description: "Failed to load students", variant: "destructive" })
      setLoading(false)
      return
    }
    const byStudent = new Map<string, AssignmentWithTiers[]>()
    for (const raw of (assignmentsRes.data as unknown as AssignmentWithTiers[]) || []) {
      const a: AssignmentWithTiers = {
        ...raw,
        deposit_amount: toNumber(raw.deposit_amount as unknown as string),
        monthly_est_profit: toNumber(raw.monthly_est_profit as unknown as string),
        tm_rate_tiers: (raw.tm_rate_tiers || []).map((t) => ({
          ...t,
          parent_rate: toNumber(t.parent_rate as unknown as string) ?? 0,
          tutor_rate: toNumber(t.tutor_rate as unknown as string) ?? 0,
        })),
      }
      const list = byStudent.get(a.student_id) || []
      list.push(a)
      byStudent.set(a.student_id, list)
    }
    setStudents(((studentsRes.data as TmStudent[]) || []).map((s) => ({ ...s, assignments: byStudent.get(s.id) || [] })))
    setLoading(false)
  }, [toast])

  useEffect(() => { load() }, [load, refreshKey])

  const filtered = students.filter((s) => {
    const q = search.toLowerCase()
    return s.name.toLowerCase().includes(q) || (s.parent_name || "").toLowerCase().includes(q)
      || s.assignments.some((a) => a.code.toLowerCase().includes(q))
  })

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSave(values: StudentFormValues) {
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
    const { error } = editing
      ? await supabase.from("tm_students").update(payload).eq("id", editing.id)
      : await supabase.from("tm_students").insert(payload)
    setSaving(false)
    if (error) {
      toast({ title: "Error", description: editing ? "Failed to update student" : "Failed to add student", variant: "destructive" })
      return
    }
    toast({ title: "Success", description: editing ? "Student updated" : "Student added" })
    setDialogOpen(false)
    setEditing(null)
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search students, parents, codes..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true) }}>
          <Plus className="mr-2 h-4 w-4" />Add Student
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]" />
              <TableHead>Student</TableHead>
              <TableHead>Parent</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead className="text-right">Assignments</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-24" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center">
                  <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                    <GraduationCap className="h-8 w-8" />
                    <p>{search ? `Nothing matching "${search}"` : "No students yet."}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((s) => {
                const open = expanded.has(s.id)
                return [
                  <TableRow key={s.id} className={cn(open && "bg-muted/40")}>
                    <TableCell>
                      <Button variant="ghost" size="icon" aria-label={open ? `Collapse ${s.name}` : `Expand ${s.name}`} aria-expanded={open} onClick={() => toggle(s.id)}>
                        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </Button>
                    </TableCell>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.parent_name || "-"}</TableCell>
                    <TableCell>
                      {s.parent_phone || "-"}
                      {s.contact_preference && <span className="ml-2 text-xs text-muted-foreground">({s.contact_preference})</span>}
                    </TableCell>
                    <TableCell className="text-right">{s.assignments.length}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" aria-label={`Edit ${s.name}`} onClick={() => { setEditing(s); setDialogOpen(true) }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>,
                  open ? (
                    <TableRow key={`${s.id}-assignments`}>
                      <TableCell colSpan={6} className="bg-muted/20 p-0">
                        <AssignmentsTable
                          student={s}
                          onAdd={onAddAssignment}
                          onEdit={onEditAssignment}
                        />
                      </TableCell>
                    </TableRow>
                  ) : null,
                ]
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null) }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Student" : "Add Student"}</DialogTitle>
            <DialogDescription>{editing ? "Update the student and parent details." : "Student and parent contact details."}</DialogDescription>
          </DialogHeader>
          <StudentForm
            key={editing?.id || "new"}
            onSubmit={handleSave}
            onCancel={() => setDialogOpen(false)}
            defaultValues={editing ? {
              name: editing.name,
              parent_name: editing.parent_name || "",
              parent_phone: editing.parent_phone || "",
              contact_preference: editing.contact_preference || "",
              address: editing.address || "",
              remarks: editing.remarks || "",
            } : undefined}
            isLoading={saving}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AssignmentsTable({
  student, onAdd, onEdit,
}: {
  student: StudentWithAssignments
  onAdd?: (student: StudentWithAssignments) => void
  onEdit?: (assignment: AssignmentWithTiers, student: StudentWithAssignments) => void
}) {
  return (
    <div className="px-4 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Assignments</span>
        <Button size="sm" variant="outline" onClick={() => onAdd?.(student)} disabled={!onAdd} title={onAdd ? undefined : "Coming in the next task"}>
          <Plus className="mr-2 h-4 w-4" />Add assignment
        </Button>
      </div>
      {student.assignments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No assignments yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Tutor</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Timeslot</TableHead>
              <TableHead>Rates (parent/tutor)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {student.assignments.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-mono text-xs">{a.code}</TableCell>
                <TableCell>{a.tm_tutors?.name || "-"}</TableCell>
                <TableCell>{a.subject}</TableCell>
                <TableCell>{a.timeslot || "-"}</TableCell>
                <TableCell className="text-xs">{formatTierSummary(a.tm_rate_tiers) || "-"}</TableCell>
                <TableCell><Badge variant={a.status === "active" ? "secondary" : "outline"}>{ASSIGNMENT_STATUS_LABELS[a.status]}</Badge></TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" aria-label={`Edit assignment ${a.code}`} onClick={() => onEdit?.(a, student)} disabled={!onEdit}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
