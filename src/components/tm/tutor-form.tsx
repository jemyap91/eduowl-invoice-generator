"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DialogFooter } from "@/components/ui/dialog"
import { TUTOR_STATUS_LABELS, type TmTutorStatus } from "@/lib/tm/types"

export interface TutorFormValues {
  name: string
  phone: string
  status: TmTutorStatus
}

interface TutorFormProps {
  onSubmit: (values: TutorFormValues) => Promise<void>
  onCancel: () => void
  defaultValues?: Partial<TutorFormValues>
  isLoading?: boolean
}

export function TutorForm({ onSubmit, onCancel, defaultValues, isLoading }: TutorFormProps) {
  const [name, setName] = useState(defaultValues?.name || "")
  const [phone, setPhone] = useState(defaultValues?.phone || "")
  const [status, setStatus] = useState<TmTutorStatus>(defaultValues?.status || "active")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    await onSubmit({ name: name.trim(), phone: phone.trim(), status })
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="tm-tutor-name">Name *</Label>
          <Input id="tm-tutor-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Guan Wen" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tm-tutor-phone">Phone</Label>
          <Input id="tm-tutor-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 9634 2496" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tm-tutor-status">Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as TmTutorStatus)}>
            <SelectTrigger id="tm-tutor-status"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(TUTOR_STATUS_LABELS) as TmTutorStatus[]).map((s) => (
                <SelectItem key={s} value={s}>{TUTOR_STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={isLoading || !name.trim()}>{isLoading ? "Saving..." : "Save"}</Button>
      </DialogFooter>
    </form>
  )
}
