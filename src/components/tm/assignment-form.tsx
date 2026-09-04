"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DialogFooter } from "@/components/ui/dialog"
import { RateTierEditor } from "./rate-tier-editor"
import { validateTiers, type RateTierDraft, type RateTierValue } from "@/lib/tm/rate-tiers"
import {
  ASSIGNMENT_STATUS_LABELS, DEPOSIT_STATUS_LABELS,
  type TmAssignmentStatus, type TmDepositStatus, type TmTutor,
} from "@/lib/tm/types"

export interface AssignmentFormValues {
  code: string
  tutor_id: string
  subject: string
  timeslot: string
  status: TmAssignmentStatus
  deposit_amount: number | null
  deposit_status: TmDepositStatus
  curriculum_briefed: boolean
  group_chat_created: boolean
  post_trial_checkin_done: boolean
  monthly_est_profit: number | null
  additional_materials: string
  remarks: string
  tiers: RateTierValue[]
}

interface AssignmentFormProps {
  studentName: string
  tutors: TmTutor[]
  subjectOptions: string[]
  initialTiers: RateTierDraft[]
  defaultValues?: Partial<Omit<AssignmentFormValues, "tiers">>
  onSubmit: (values: AssignmentFormValues) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
}

function parseMoney(raw: string): number | null | "invalid" {
  const t = raw.trim()
  if (!t) return null
  if (!/^\d+(\.\d+)?$/.test(t)) return "invalid"
  return Math.round(parseFloat(t) * 100) / 100
}

export function AssignmentForm({
  studentName, tutors, subjectOptions, initialTiers, defaultValues, onSubmit, onCancel, isLoading,
}: AssignmentFormProps) {
  const d = defaultValues
  const [code, setCode] = useState(d?.code || "")
  const [tutorId, setTutorId] = useState(d?.tutor_id || "")
  const [subject, setSubject] = useState(d?.subject || "")
  const [timeslot, setTimeslot] = useState(d?.timeslot || "")
  const [status, setStatus] = useState<TmAssignmentStatus>(d?.status || "active")
  const [depositAmount, setDepositAmount] = useState(d?.deposit_amount != null ? String(d.deposit_amount) : "")
  const [depositStatus, setDepositStatus] = useState<TmDepositStatus>(d?.deposit_status || "none")
  const [briefed, setBriefed] = useState(Boolean(d?.curriculum_briefed))
  const [chat, setChat] = useState(Boolean(d?.group_chat_created))
  const [trial, setTrial] = useState(Boolean(d?.post_trial_checkin_done))
  const [estProfit, setEstProfit] = useState(d?.monthly_est_profit != null ? String(d.monthly_est_profit) : "")
  const [materials, setMaterials] = useState(d?.additional_materials || "")
  const [remarks, setRemarks] = useState(d?.remarks || "")
  const [tiers, setTiers] = useState<RateTierDraft[]>(initialTiers)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!code.trim() || !tutorId || !subject.trim()) {
      setError("Code, tutor and subject are required.")
      return
    }
    const deposit = parseMoney(depositAmount)
    if (deposit === "invalid") { setError("Deposit must be a number."); return }
    const profit = parseMoney(estProfit)
    if (profit === "invalid") { setError("Monthly estimated profit must be a number."); return }
    const validated = validateTiers(tiers)
    if (!validated.ok) { setError(validated.error); return }
    await onSubmit({
      code: code.trim().toUpperCase(),
      tutor_id: tutorId,
      subject: subject.trim(),
      timeslot: timeslot.trim(),
      status,
      deposit_amount: deposit,
      deposit_status: deposit === null ? "none" : depositStatus === "none" ? "collected" : depositStatus,
      curriculum_briefed: briefed,
      group_chat_created: chat,
      post_trial_checkin_done: trial,
      monthly_est_profit: profit,
      additional_materials: materials.trim(),
      remarks: remarks.trim(),
      tiers: validated.tiers,
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid gap-4 py-4 sm:grid-cols-2">
        <p className="sm:col-span-2 text-sm text-muted-foreground">Student: <span className="font-medium text-foreground">{studentName}</span></p>

        <div className="space-y-2">
          <Label htmlFor="tm-asg-code">Code *</Label>
          <Input id="tm-asg-code" value={code} onChange={(e) => setCode(e.target.value)} className="font-mono uppercase" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tm-asg-tutor">Tutor *</Label>
          <Select value={tutorId} onValueChange={setTutorId}>
            <SelectTrigger id="tm-asg-tutor"><SelectValue placeholder="Choose a tutor" /></SelectTrigger>
            <SelectContent>
              {tutors.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}{t.status === "inactive" ? " (inactive)" : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="tm-asg-subject">Subject *</Label>
          <Input id="tm-asg-subject" list="tm-subject-options" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. S4 G2 English" required />
          <datalist id="tm-subject-options">
            {subjectOptions.map((s) => <option key={s} value={s} />)}
          </datalist>
        </div>
        <div className="space-y-2">
          <Label htmlFor="tm-asg-timeslot">Timeslot</Label>
          <Input id="tm-asg-timeslot" value={timeslot} onChange={(e) => setTimeslot(e.target.value)} placeholder="e.g. Sat 2-4pm" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tm-asg-status">Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as TmAssignmentStatus)}>
            <SelectTrigger id="tm-asg-status"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(ASSIGNMENT_STATUS_LABELS) as TmAssignmentStatus[]).map((s) => (
                <SelectItem key={s} value={s}>{ASSIGNMENT_STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="tm-asg-profit">Monthly est. profit ($)</Label>
          <Input id="tm-asg-profit" inputMode="decimal" value={estProfit} onChange={(e) => setEstProfit(e.target.value)} placeholder="e.g. 160" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tm-asg-deposit">Deposit ($)</Label>
          <Input id="tm-asg-deposit" inputMode="decimal" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder="Leave blank for none" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tm-asg-deposit-status">Deposit status</Label>
          <Select value={depositStatus} onValueChange={(v) => setDepositStatus(v as TmDepositStatus)} disabled={!depositAmount.trim()}>
            <SelectTrigger id="tm-asg-deposit-status"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(["not_collected", "collected"] as TmDepositStatus[]).map((s) => (
                <SelectItem key={s} value={s}>{DEPOSIT_STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <fieldset className="sm:col-span-2 space-y-2">
          <legend className="text-sm font-medium">Onboarding checklist</legend>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={briefed} onCheckedChange={(c) => setBriefed(c === true)} />Curriculum briefed</label>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={chat} onCheckedChange={(c) => setChat(c === true)} />Group chat created</label>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={trial} onCheckedChange={(c) => setTrial(c === true)} />Checked in after trial</label>
          </div>
        </fieldset>

        <div className="sm:col-span-2 space-y-2">
          <Label>Rate tiers *</Label>
          <RateTierEditor value={tiers} onChange={setTiers} idPrefix="asg-tier" />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="tm-asg-materials">Additional materials</Label>
          <Input id="tm-asg-materials" value={materials} onChange={(e) => setMaterials(e.target.value)} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="tm-asg-remarks">Remarks</Label>
          <Textarea id="tm-asg-remarks" rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder='e.g. "Contact via WeChat"' />
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
