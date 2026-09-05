"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatCurrency } from "@/lib/format"
import { computeHours, todayIso, validateSession, type SessionInput, type SessionPayload } from "@/lib/portal/sessions"
import type { PortalAssignment } from "./use-portal-context"

interface SessionFormProps {
  assignments: PortalAssignment[]
  defaultAssignmentId?: string
  initial?: Partial<SessionInput>
  lockAssignment?: boolean
  onSubmit: (payload: SessionPayload) => Promise<void>
  onCancel?: () => void
  submitLabel?: string
  isLoading?: boolean
}

export function SessionForm({
  assignments, defaultAssignmentId, initial, lockAssignment = false, onSubmit, onCancel, submitLabel = "Save session", isLoading,
}: SessionFormProps) {
  const today = todayIso()
  const [assignmentId, setAssignmentId] = useState(initial?.assignmentId ?? defaultAssignmentId ?? (assignments.length === 1 ? assignments[0].id : ""))
  const [date, setDate] = useState(initial?.date ?? today)
  const [start, setStart] = useState(initial?.start ?? "")
  const [end, setEnd] = useState(initial?.end ?? "")
  const [hours, setHours] = useState(initial?.hours ?? "")
  const [rateTierId, setRateTierId] = useState(initial?.rateTierId ?? "")
  const [note, setNote] = useState(initial?.note ?? "")
  const [error, setError] = useState("")

  const assignment = useMemo(() => assignments.find((a) => a.id === assignmentId), [assignments, assignmentId])
  const tiers = assignment?.tiers ?? []
  const effectiveTier = rateTierId || (tiers.length === 1 ? tiers[0].id : "")
  const previewHours = start && end ? computeHours(start, end) : hours ? Number(hours) : null

  function chooseAssignment(id: string) {
    setAssignmentId(id)
    setRateTierId("")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    const result = validateSession({ assignmentId, date, start, end, hours, rateTierId: effectiveTier, note }, today)
    if (!result.ok) { setError(result.error); return }
    await onSubmit(result.payload)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="session-assignment">Student</Label>
        <Select value={assignmentId} onValueChange={chooseAssignment} disabled={lockAssignment}>
          <SelectTrigger id="session-assignment"><SelectValue placeholder="Choose a student" /></SelectTrigger>
          <SelectContent>
            {assignments.map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.studentName} · {a.subject}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="session-date">Date</Label>
        <Input id="session-date" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} required />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="session-start">Start time</Label>
          <Input id="session-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="session-end">End time</Label>
          <Input id="session-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="session-hours">Or hours</Label>
        <Input id="session-hours" inputMode="decimal" placeholder="e.g. 1.5" value={hours} onChange={(e) => setHours(e.target.value)} disabled={Boolean(start || end)} />
        {previewHours !== null && Number.isFinite(previewHours) && previewHours > 0 && (
          <p className="text-xs text-muted-foreground">{previewHours.toFixed(2)} hours</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="session-tier">Rate tier</Label>
        <Select value={effectiveTier} onValueChange={setRateTierId} disabled={tiers.length === 0}>
          <SelectTrigger id="session-tier"><SelectValue placeholder={tiers.length === 0 ? "No rates on this assignment" : "Choose a rate tier"} /></SelectTrigger>
          <SelectContent>
            {tiers.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.label} · {formatCurrency(t.tutor_rate)}/hr</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="session-note">Note</Label>
        <Textarea id="session-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional, e.g. Revised chapter 3" />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-2">
        {onCancel && <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>}
        <Button type="submit" disabled={isLoading}>{isLoading ? "Saving..." : submitLabel}</Button>
      </div>
    </form>
  )
}
