"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DialogFooter } from "@/components/ui/dialog"
import { RateTierEditor } from "@/components/tm/rate-tier-editor"
import { validateTiers, type RateTierDraft } from "@/lib/tm/rate-tiers"
import { ASSIGNMENT_STATUS_LABELS, TUTOR_ASSIGNMENT_STATUSES, type TmAssignmentStatus } from "@/lib/tm/types"

export interface TutorAssignmentValues {
  subject: string
  timeslot: string
  status: TmAssignmentStatus
  tiers: { label: string; tutor_rate: number; sort_order: number }[]
}

interface Props {
  studentName: string
  initialTiers: RateTierDraft[]
  defaultValues?: { subject: string; timeslot: string; status: TmAssignmentStatus }
  onSubmit: (values: TutorAssignmentValues) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
}

export function TutorAssignmentForm({ studentName, initialTiers, defaultValues, onSubmit, onCancel, isLoading }: Props) {
  const editing = defaultValues !== undefined
  const [subject, setSubject] = useState(defaultValues?.subject ?? "")
  const [timeslot, setTimeslot] = useState(defaultValues?.timeslot ?? "")
  const [status, setStatus] = useState<TmAssignmentStatus>(defaultValues?.status ?? "active")
  const [tiers, setTiers] = useState<RateTierDraft[]>(initialTiers)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!subject.trim()) { setError("Enter the subject."); return }
    const validated = validateTiers(tiers, "none")
    if (!validated.ok) { setError(validated.error); return }
    await onSubmit({
      subject: subject.trim(),
      timeslot: timeslot.trim(),
      status,
      tiers: validated.tiers.map(({ label, tutor_rate, sort_order }) => ({ label, tutor_rate, sort_order })),
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid gap-4 py-4 sm:grid-cols-2">
        <p className="sm:col-span-2 text-sm text-muted-foreground">Student: <span className="font-medium text-foreground">{studentName}</span></p>
        <div className="space-y-2">
          <Label htmlFor="portal-asg-subject">Subject *</Label>
          <Input id="portal-asg-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. S4 G2 English" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="portal-asg-timeslot">Usual timeslot</Label>
          <Input id="portal-asg-timeslot" value={timeslot} onChange={(e) => setTimeslot(e.target.value)} placeholder="e.g. Sat 2-4pm" />
        </div>
        {editing && (
          <div className="space-y-2">
            {/* Only live assignments are editable; choosing Stopped ends it until EduOwl reopens it. */}
            <Label htmlFor="portal-asg-status">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as TmAssignmentStatus)}>
              <SelectTrigger id="portal-asg-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TUTOR_ASSIGNMENT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{ASSIGNMENT_STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="sm:col-span-2 space-y-2">
          <Label>Your hourly pay *</Label>
          <p className="text-xs text-muted-foreground">Add a rate for each way you teach this student, e.g. &quot;1 to 1&quot; and &quot;Zoom&quot;. You pick one each time you log a session.{editing ? " Changing your pay is sent to EduOwl to confirm before your next timesheet is approved." : ""}</p>
          <RateTierEditor value={tiers} onChange={setTiers} idPrefix="portal-tier" variant="tutor" />
        </div>
        {error && <p className="sm:col-span-2 text-sm text-destructive">{error}</p>}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={isLoading}>{isLoading ? "Saving..." : "Save"}</Button>
      </DialogFooter>
    </form>
  )
}
