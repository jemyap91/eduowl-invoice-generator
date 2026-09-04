"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { fetchAll } from "@/lib/supabase/fetch-all"
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
      fetchAll<{ code: string; subject: string }>(() => supabase.from("tm_assignments").select("code, subject").order("code")),
      supabase.from("tm_settings").select("default_rate_tiers").limit(1).maybeSingle(),
    ])
    setTutors((tutorsRes.data as TmTutor[]) || [])
    const rows = assignmentsRes.data
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

    const { data, error } = await supabase.rpc("tm_save_assignment", {
      p_id: target.assignment?.id ?? null,
      p_assignment: payload,
      p_tiers: values.tiers,
    })
    setSaving(false)
    if (error) {
      toast({
        title: "Error",
        description: error.code === "23505" ? "That code is already in use." : error.message || "Failed to save assignment",
        variant: "destructive",
      })
      return
    }
    void data
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
