"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { X } from "lucide-react"

interface Student {
  id: string
  name: string
}

interface LinkedStudent {
  id: string
  name: string
}

interface LinkStudentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  parentId: string
  parentName: string
  linkedStudents: LinkedStudent[]
  allStudents: Student[]
  onLinksChanged: () => void
}

export function LinkStudentDialog({
  open,
  onOpenChange,
  parentId,
  parentName,
  linkedStudents,
  allStudents,
  onLinksChanged,
}: LinkStudentDialogProps) {
  const [selectedStudentId, setSelectedStudentId] = useState("")
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const linkedIds = new Set(linkedStudents.map((s) => s.id))
  const availableStudents = allStudents.filter((s) => !linkedIds.has(s.id))

  async function handleLink() {
    if (!selectedStudentId) return
    setSaving(true)
    const supabase = createClient()

    const { error } = await supabase
      .from("parent_students")
      .insert({ parent_id: parentId, student_id: selectedStudentId })

    if (error) {
      toast({ title: "Error", description: "Failed to link student", variant: "destructive" })
    } else {
      toast({ title: "Success", description: "Student linked successfully" })
      setSelectedStudentId("")
      onLinksChanged()
    }
    setSaving(false)
  }

  async function handleUnlink(studentId: string) {
    setSaving(true)
    const supabase = createClient()

    const { error } = await supabase
      .from("parent_students")
      .delete()
      .eq("parent_id", parentId)
      .eq("student_id", studentId)

    if (error) {
      toast({ title: "Error", description: "Failed to unlink student", variant: "destructive" })
    } else {
      toast({ title: "Success", description: "Student unlinked successfully" })
      onLinksChanged()
    }
    setSaving(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link Students to {parentName}</DialogTitle>
          <DialogDescription>
            Manage which students are linked to this parent.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {linkedStudents.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Currently linked:</p>
              <div className="flex flex-wrap gap-2">
                {linkedStudents.map((student) => (
                  <Badge key={student.id} variant="secondary" className="gap-1">
                    {student.name}
                    <button
                      type="button"
                      onClick={() => handleUnlink(student.id)}
                      disabled={saving}
                      className="ml-1 rounded-full hover:bg-muted-foreground/20"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {availableStudents.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">Link a student:</p>
              <div className="flex gap-2">
                <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select a student" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableStudents.map((student) => (
                      <SelectItem key={student.id} value={student.id}>
                        {student.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleLink} disabled={saving || !selectedStudentId}>
                  {saving ? "Linking..." : "Link"}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {allStudents.length === 0
                ? "No students exist yet. Add students first."
                : "All students are already linked to this parent."}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
