"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { StudentList, type AssignmentWithTiers, type StudentWithAssignments } from "@/components/tm/student-list"
import { AssignmentForm, type AssignmentFormValues } from "@/components/tm/assignment-form"
import { draftsFromTiers, draftsFromValues, parseDefaultTiers, type RateTierDraft } from "@/lib/tm/rate-tiers"
import { suggestAssignmentCode } from "@/lib/tm/assignments"
import type { TmTutor } from "@/lib/tm/types"

type Target = { student: StudentWithAssignments; assignment: AssignmentWithTiers | null } | null

export default function TmStudentsPage() {
  const [target, setTarget] = useState<Target>(null)
  const [tutors, setTutors] = useState<TmTutor[]>([])
  const [subjects, setSubjects] = useState<string[]>([])
  const [allCodes, setAllCodes] = useState<string[]>([])
  const [defaultTiers, setDefaultTiers] = useState<RateTierDraft[]>([])
  const [saving, setSaving] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const { toast } = useToast()

  const loadLookups = useCallback(async () => {
    const supabase = createClient()
    const [tutorsRes, assignmentsRes, settingsRes] = await Promise.all([
      supabase.from("tm_tutors").select("*").order("name"),
      supabase.from("tm_assignments").select("code, subject"),
      supabase.from("tm_settings").select("default_rate_tiers").limit(1).maybeSingle(),
    ])
    setTutors((tutorsRes.data as TmTutor[]) || [])
    const rows = assignmentsRes.data || []
    setAllCodes(rows.map((r) => r.code))
    setSubjects(Array.from(new Set(rows.map((r) => r.subject))).sort())
    setDefaultTiers(draftsFromValues(parseDefaultTiers(settingsRes.data?.default_rate_tiers)))
  }, [])

  useEffect(() => { loadLookups() }, [loadLookups, refreshKey])

  function openAdd(student: StudentWithAssignments) {
    setTarget({ student, assignment: null })
  }
  function openEdit(assignment: AssignmentWithTiers, student: StudentWithAssignments) {
    setTarget({ student, assignment })
  }

  async function handleSave(values: AssignmentFormValues) {
    if (!target) return
    setSaving(true)
    const supabase = createClient()
    const payload = {
      code: values.code,
      tutor_id: values.tutor_id,
      student_id: target.student.id,
      subject: values.subject,
      timeslot: values.timeslot || null,
      status: values.status,
      deposit_amount: values.deposit_amount,
      deposit_status: values.deposit_status,
      curriculum_briefed: values.curriculum_briefed,
      group_chat_created: values.group_chat_created,
      post_trial_checkin_done: values.post_trial_checkin_done,
      monthly_est_profit: values.monthly_est_profit,
      additional_materials: values.additional_materials || null,
      remarks: values.remarks || null,
    }

    let assignmentId: string
    if (target.assignment) {
      const { error } = await supabase.from("tm_assignments").update(payload).eq("id", target.assignment.id)
      if (error) {
        setSaving(false)
        toast({ title: "Error", description: error.code === "23505" ? "That code is already in use." : "Failed to update assignment", variant: "destructive" })
        return
      }
      assignmentId = target.assignment.id
    } else {
      const { data, error } = await supabase.from("tm_assignments").insert(payload).select("id").single()
      if (error || !data) {
        setSaving(false)
        toast({ title: "Error", description: error?.code === "23505" ? "That code is already in use." : "Failed to add assignment", variant: "destructive" })
        return
      }
      assignmentId = data.id
    }

    // Tiers: upsert by (assignment_id, label) so unchanged labels keep their ids, then drop removed labels.
    const { error: tierError } = await supabase
      .from("tm_rate_tiers")
      .upsert(values.tiers.map((t) => ({ ...t, assignment_id: assignmentId })), { onConflict: "assignment_id,label" })
    if (tierError) {
      setSaving(false)
      toast({ title: "Error", description: "Assignment saved but rate tiers failed", variant: "destructive" })
      return
    }
    const keepLabels = values.tiers.map((t) => t.label)
    const { error: pruneError } = await supabase
      .from("tm_rate_tiers")
      .delete()
      .eq("assignment_id", assignmentId)
      .not("label", "in", `(${keepLabels.map((l) => `"${l.replace(/"/g, '\\"')}"`).join(",")})`)
    setSaving(false)
    if (pruneError) {
      toast({ title: "Error", description: "Assignment saved but an old rate tier could not be removed", variant: "destructive" })
      return
    }
    toast({ title: "Success", description: target.assignment ? "Assignment updated" : `Assignment ${values.code} added` })
    setTarget(null)
    setRefreshKey((k) => k + 1)
  }

  const editing = target?.assignment ?? null

  return (
    <div className="space-y-6">
      <StudentList onAddAssignment={openAdd} onEditAssignment={openEdit} refreshKey={refreshKey} />

      <Dialog open={target !== null} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.code}` : "Add Assignment"}</DialogTitle>
            <DialogDescription>{editing ? "Change the tutor, rates, status or notes." : "A tutor, a subject and the rate tiers for this student."}</DialogDescription>
          </DialogHeader>
          {target && (
            <AssignmentForm
              key={editing?.id || `new-${target.student.id}`}
              studentName={target.student.name}
              tutors={tutors}
              subjectOptions={subjects}
              initialTiers={editing ? draftsFromTiers(editing.tm_rate_tiers) : defaultTiers}
              defaultValues={editing ? {
                code: editing.code,
                tutor_id: editing.tutor_id,
                subject: editing.subject,
                timeslot: editing.timeslot || "",
                status: editing.status,
                deposit_amount: editing.deposit_amount,
                deposit_status: editing.deposit_status,
                curriculum_briefed: editing.curriculum_briefed,
                group_chat_created: editing.group_chat_created,
                post_trial_checkin_done: editing.post_trial_checkin_done,
                monthly_est_profit: editing.monthly_est_profit,
                additional_materials: editing.additional_materials || "",
                remarks: editing.remarks || "",
              } : { code: suggestAssignmentCode(target.student.name, allCodes) }}
              onSubmit={handleSave}
              onCancel={() => setTarget(null)}
              isLoading={saving}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
