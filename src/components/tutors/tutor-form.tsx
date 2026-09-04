"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { DialogFooter } from "@/components/ui/dialog"

interface TutorFormValues {
  name: string
  email: string
  phone: string
  subjectIds: string[]
  streamIds: string[]
}

interface TutorFormProps {
  onSubmit: (values: TutorFormValues) => Promise<void>
  onCancel: () => void
  defaultValues?: Partial<{ name: string; email: string; phone: string }>
  defaultSubjectIds?: string[]
  defaultStreamIds?: string[]
  subjects: { id: string; name: string }[]
  streams: { id: string; name: string }[]
  isLoading?: boolean
}

export function TutorForm({
  onSubmit,
  onCancel,
  defaultValues,
  defaultSubjectIds,
  defaultStreamIds,
  subjects,
  streams,
  isLoading,
}: TutorFormProps) {
  const [name, setName] = useState(defaultValues?.name || "")
  const [email, setEmail] = useState(defaultValues?.email || "")
  const [phone, setPhone] = useState(defaultValues?.phone || "")
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>(defaultSubjectIds || [])
  const [selectedStreamIds, setSelectedStreamIds] = useState<string[]>(defaultStreamIds || [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    await onSubmit({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      subjectIds: selectedSubjectIds,
      streamIds: selectedStreamIds,
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="tutor-name">Name *</Label>
          <Input
            id="tutor-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. John Smith"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tutor-email">Email</Label>
          <Input
            id="tutor-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. john@example.com"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tutor-phone">Phone</Label>
          <Input
            id="tutor-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. 012-345 6789"
          />
        </div>
        <div className="space-y-2">
          <Label>Subjects</Label>
          <div className="max-h-32 overflow-y-auto space-y-1 border rounded-md p-2">
            {subjects.map((subject) => (
              <label key={subject.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
                <Checkbox
                  checked={selectedSubjectIds.includes(subject.id)}
                  onCheckedChange={(checked) => {
                    if (checked) setSelectedSubjectIds(prev => [...prev, subject.id])
                    else setSelectedSubjectIds(prev => prev.filter(id => id !== subject.id))
                  }}
                />
                {subject.name}
              </label>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label>Levels</Label>
          <div className="max-h-32 overflow-y-auto space-y-1 border rounded-md p-2">
            {streams.map((stream) => (
              <label key={stream.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
                <Checkbox
                  checked={selectedStreamIds.includes(stream.id)}
                  onCheckedChange={(checked) => {
                    if (checked) setSelectedStreamIds(prev => [...prev, stream.id])
                    else setSelectedStreamIds(prev => prev.filter(id => id !== stream.id))
                  }}
                />
                {stream.name}
              </label>
            ))}
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading || !name.trim()}>
          {isLoading ? "Saving..." : "Save"}
        </Button>
      </DialogFooter>
    </form>
  )
}
