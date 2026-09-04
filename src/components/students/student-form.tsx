"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DialogFooter,
} from "@/components/ui/dialog"
import { useState, useMemo } from "react"

interface Stream {
  id: string
  name: string
  level_order: number
}

interface Subject {
  id: string
  name: string
  level: string
}

interface ParentOption {
  id: string
  name: string
}

interface StudentFormValues {
  name: string
  stream_id: string | null
  subjectIds: string[]
  parentIds: string[]
}

interface StudentFormProps {
  onSubmit: (values: StudentFormValues) => void
  onCancel: () => void
  defaultValues?: { name: string; stream_id: string | null }
  defaultSubjectIds?: string[]
  defaultParentIds?: string[]
  subjects: Subject[]
  streams: Stream[]
  parents: ParentOption[]
  saving?: boolean
}

function getStreamLevel(streams: Stream[], streamId: string): "primary" | "secondary" | null {
  const stream = streams.find((s) => s.id === streamId)
  if (!stream) return null
  return stream.name.toLowerCase().startsWith("primary") ? "primary" : "secondary"
}

export function StudentForm({ onSubmit, onCancel, defaultValues, defaultSubjectIds, defaultParentIds, subjects, streams, parents, saving }: StudentFormProps) {
  const [name, setName] = useState(defaultValues?.name ?? "")
  const [streamId, setStreamId] = useState(defaultValues?.stream_id ?? "")
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>(defaultSubjectIds || [])
  const [selectedParentIds, setSelectedParentIds] = useState<string[]>(defaultParentIds || [])

  const streamLevel = useMemo(() => getStreamLevel(streams, streamId), [streams, streamId])

  const filteredSubjects = useMemo(() => {
    if (!streamLevel) return subjects
    return subjects.filter(
      (s) => s.level === "all" || s.level === streamLevel
    )
  }, [subjects, streamLevel])

  // When stream changes, remove any selected subjects that are no longer valid
  function handleStreamChange(newStreamId: string) {
    setStreamId(newStreamId)
    const level = getStreamLevel(streams, newStreamId)
    if (level) {
      setSelectedSubjectIds((prev) =>
        prev.filter((id) => {
          const subject = subjects.find((s) => s.id === id)
          return subject && (subject.level === "all" || subject.level === level)
        })
      )
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    onSubmit({
      name: name.trim(),
      stream_id: streamId || null,
      subjectIds: selectedSubjectIds,
      parentIds: selectedParentIds,
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="student-name">Name *</Label>
          <Input
            id="student-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. John Doe"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="student-stream">Stream</Label>
          <Select value={streamId} onValueChange={handleStreamChange}>
            <SelectTrigger id="student-stream">
              <SelectValue placeholder="Select a stream" />
            </SelectTrigger>
            <SelectContent>
              {streams.map((stream) => (
                <SelectItem key={stream.id} value={stream.id}>
                  {stream.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Subjects {streamLevel && <span className="text-muted-foreground text-xs ml-1">({streamLevel})</span>}</Label>
          <div className="max-h-32 overflow-y-auto space-y-1 border rounded-md p-2">
            {filteredSubjects.length === 0 ? (
              <p className="text-sm text-muted-foreground py-1">Select a stream to see available subjects</p>
            ) : (
              filteredSubjects.map((subject) => (
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
              ))
            )}
          </div>
        </div>
        <div className="space-y-2">
          <Label>Parent(s)</Label>
          <div className="max-h-32 overflow-y-auto space-y-1 border rounded-md p-2">
            {parents.length === 0 ? (
              <p className="text-sm text-muted-foreground py-1">No parents added yet</p>
            ) : (
              parents.map((parent) => (
                <label key={parent.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
                  <Checkbox
                    checked={selectedParentIds.includes(parent.id)}
                    onCheckedChange={(checked) => {
                      if (checked) setSelectedParentIds(prev => [...prev, parent.id])
                      else setSelectedParentIds(prev => prev.filter(id => id !== parent.id))
                    }}
                  />
                  {parent.name}
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
