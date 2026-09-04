"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DialogFooter,
} from "@/components/ui/dialog"
import { useState } from "react"

interface StudentOption {
  id: string
  name: string
}

interface ParentFormValues {
  name: string
  email: string
  phone: string
  studentIds: string[]
}

interface ParentFormProps {
  onSubmit: (values: ParentFormValues) => void
  onCancel: () => void
  defaultValues?: { name: string; email: string; phone: string }
  defaultStudentIds?: string[]
  students: StudentOption[]
  saving?: boolean
}

export function ParentForm({ onSubmit, onCancel, defaultValues, defaultStudentIds, students, saving }: ParentFormProps) {
  const [name, setName] = useState(defaultValues?.name ?? "")
  const [email, setEmail] = useState(defaultValues?.email ?? "")
  const [phone, setPhone] = useState(defaultValues?.phone ?? "")
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>(defaultStudentIds || [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    onSubmit({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      studentIds: selectedStudentIds,
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="parent-name">Name *</Label>
          <Input
            id="parent-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Jane Doe"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="parent-email">Email</Label>
          <Input
            id="parent-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. jane@example.com"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="parent-phone">Phone</Label>
          <Input
            id="parent-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. +65 9123 4567"
          />
        </div>
        <div className="space-y-2">
          <Label>Children</Label>
          <div className="max-h-32 overflow-y-auto space-y-1 border rounded-md p-2">
            {students.length === 0 ? (
              <p className="text-sm text-muted-foreground py-1">No students added yet</p>
            ) : (
              students.map((student) => (
                <label key={student.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
                  <Checkbox
                    checked={selectedStudentIds.includes(student.id)}
                    onCheckedChange={(checked) => {
                      if (checked) setSelectedStudentIds(prev => [...prev, student.id])
                      else setSelectedStudentIds(prev => prev.filter(id => id !== student.id))
                    }}
                  />
                  {student.name}
                </label>
              ))
            )}
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || !name.trim()}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </DialogFooter>
    </form>
  )
}
