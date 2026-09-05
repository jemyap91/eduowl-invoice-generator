"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { toNumber } from "@/lib/tm/types"

export interface PortalTier {
  id: string
  assignment_id: string
  label: string
  tutor_rate: number
  sort_order: number
}

export interface PortalAssignment {
  id: string
  code: string
  subject: string
  timeslot: string | null
  studentName: string
  tiers: PortalTier[]
}

export interface PortalContext {
  loading: boolean
  error: string | null
  tutor: { id: string; name: string } | null
  assignments: PortalAssignment[]
  reload: () => void
}

export function usePortalContext(): PortalContext {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tutor, setTutor] = useState<{ id: string; name: string } | null>(null)
  const [assignments, setAssignments] = useState<PortalAssignment[]>([])
  const [tick, setTick] = useState(0)

  const reload = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        if (!cancelled) { setError("You are not signed in."); setLoading(false) }
        return
      }
      const { data: tutorRow, error: tutorError } = await supabase
        .from("tm_tutors").select("id, name").eq("profile_id", user.id).maybeSingle()
      if (tutorError || !tutorRow) {
        if (!cancelled) {
          setTutor(null)
          setAssignments([])
          setError(tutorError ? "Could not load your tutor profile." : "No tutor profile is linked to your account yet. Ask EduOwl to link it.")
          setLoading(false)
        }
        return
      }
      const { data: rows, error: aError } = await supabase
        .from("tm_assignments")
        .select("id, code, subject, timeslot, tm_students(name)")
        .eq("tutor_id", tutorRow.id)
        .eq("status", "active")
        .order("code")
      if (aError) {
        if (!cancelled) { setError("Could not load your students."); setLoading(false) }
        return
      }
      const ids = (rows ?? []).map((r) => r.id)
      const { data: tiers, error: tError } = ids.length
        ? await supabase.from("tm_rate_tiers_tutor_view").select("*").in("assignment_id", ids)
        : { data: [], error: null }
      if (tError) {
        if (!cancelled) { setError("Could not load your rates."); setLoading(false) }
        return
      }
      const tiersByAssignment = new Map<string, PortalTier[]>()
      for (const t of tiers ?? []) {
        if (!t.id || !t.assignment_id || !t.label) continue
        const list = tiersByAssignment.get(t.assignment_id) ?? []
        list.push({ id: t.id, assignment_id: t.assignment_id, label: t.label, tutor_rate: toNumber(t.tutor_rate) ?? 0, sort_order: t.sort_order ?? 0 })
        tiersByAssignment.set(t.assignment_id, list)
      }
      for (const list of tiersByAssignment.values()) list.sort((a, b) => a.sort_order - b.sort_order)
      if (!cancelled) {
        setTutor({ id: tutorRow.id, name: tutorRow.name })
        setAssignments((rows ?? []).map((r) => ({
          id: r.id,
          code: r.code,
          subject: r.subject,
          timeslot: r.timeslot,
          studentName: (r.tm_students as { name: string } | null)?.name ?? "",
          tiers: tiersByAssignment.get(r.id) ?? [],
        })))
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [tick])

  return { loading, error, tutor, assignments, reload }
}
