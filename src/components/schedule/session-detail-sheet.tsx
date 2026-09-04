"use client"

import { useState } from "react"
import { format, parseISO } from "date-fns"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { Pencil, XCircle, Trash2, RotateCcw, CalendarPlus, Users, Clock, MapPin, BookOpen, Layers } from "lucide-react"
import { formatTime } from "./session-card"
import type { SessionData } from "./session-card"
import { SessionEditForm } from "./session-edit-form"
import { AttendanceSheet } from "./attendance-sheet"
import { AdhocSessionForm } from "./adhoc-session-form"

interface SessionDetailSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  session: SessionData | null
  onUpdated: () => void
}

function getStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "completed":
      return "default"
    case "cancelled":
      return "destructive"
    default:
      return "secondary"
  }
}

export function SessionDetailSheet({ open, onOpenChange, session, onUpdated }: SessionDetailSheetProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [makeupOpen, setMakeupOpen] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notes, setNotes] = useState("")
  const [notesEdited, setNotesEdited] = useState(false)
  const { toast } = useToast()

  // Reset notes state when session changes
  const sessionNotes = session?.notes || ""

  function handleOpenChange(isOpen: boolean) {
    if (isOpen && session) {
      setNotes(session.notes || "")
      setNotesEdited(false)
    }
    onOpenChange(isOpen)
  }

  async function saveNotes() {
    if (!session) return
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from("class_sessions")
      .update({ notes: notes || null })
      .eq("id", session.id)

    if (error) {
      toast({ title: "Error", description: "Failed to save notes", variant: "destructive" })
    } else {
      toast({ title: "Success", description: "Notes saved" })
      setNotesEdited(false)
      onUpdated()
    }
    setSaving(false)
  }

  async function updateStatus(newStatus: "cancelled" | "completed", openMakeup = false) {
    if (!session) return
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from("class_sessions")
      .update({ status: newStatus })
      .eq("id", session.id)

    if (error) {
      toast({
        title: "Error",
        description: `Failed to ${newStatus === "cancelled" ? "cancel" : "complete"} session`,
        variant: "destructive",
      })
    } else {
      // Propagate attendance_status when cancelling a session
      if (newStatus === "cancelled") {
        await supabase
          .from("session_students")
          .update({ attendance_status: "cancelled" })
          .eq("session_id", session.id)
      }
      setCancelDialogOpen(false)
      onUpdated()
      if (openMakeup) {
        toast({ title: "Session cancelled", description: "Now schedule the makeup session." })
        setMakeupOpen(true)
      } else {
        toast({
          title: "Success",
          description: `Session ${newStatus === "cancelled" ? "cancelled" : "marked as completed"}`,
        })
        onOpenChange(false)
        onUpdated()
      }
    }
    setSaving(false)
  }

  async function restoreSession() {
    if (!session) return
    setSaving(true)
    const supabase = createClient()

    // 1. Delete any makeup sessions linked to this cancelled session
    const { data: makeupSessions } = await supabase
      .from("class_sessions")
      .select("id")
      .eq("makeup_for_session_id", session.id)

    if (makeupSessions && makeupSessions.length > 0) {
      const makeupIds = makeupSessions.map((s: { id: string }) => s.id)
      await supabase.from("session_students").delete().in("session_id", makeupIds)
      await supabase.from("class_sessions").delete().in("id", makeupIds)
    }

    // 2. Restore session to scheduled
    const { error } = await supabase
      .from("class_sessions")
      .update({ status: "scheduled" })
      .eq("id", session.id)

    if (error) {
      toast({ title: "Error", description: "Failed to restore session", variant: "destructive" })
    } else {
      // Reset attendance_status when restoring a session
      await supabase
        .from("session_students")
        .update({ attendance_status: "pending" })
        .eq("session_id", session.id)

      const deletedCount = makeupSessions?.length || 0
      toast({
        title: "Success",
        description: deletedCount > 0
          ? `Session restored. ${deletedCount} makeup session${deletedCount > 1 ? "s" : ""} removed.`
          : "Session restored to scheduled.",
      })
      setRestoreDialogOpen(false)
      onOpenChange(false)
      onUpdated()
    }
    setSaving(false)
  }

  async function deleteSession() {
    if (!session) return
    setSaving(true)
    const supabase = createClient()

    await supabase.from("session_students").delete().eq("session_id", session.id)
    const { error } = await supabase
      .from("class_sessions")
      .delete()
      .eq("id", session.id)

    if (error) {
      toast({ title: "Error", description: "Failed to delete session", variant: "destructive" })
    } else {
      toast({ title: "Success", description: "Session deleted" })
      setDeleteDialogOpen(false)
      onOpenChange(false)
      onUpdated()
    }
    setSaving(false)
  }

  if (!session) return null

  const studentCount = session.session_students?.length || 0

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="pb-4">
            <SheetTitle className="text-xl">
              {session.subjects?.name || "Untitled Session"}
            </SheetTitle>
            <SheetDescription>
              {format(parseISO(session.date), "EEEE, MMMM d, yyyy")} | {formatTime(session.start_time)} - {formatTime(session.end_time)}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-6">
            {/* Status & Tags */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={getStatusVariant(session.status)}>
                {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
              </Badge>
              {session.is_adhoc && (
                <Badge variant="outline">Extra Class</Badge>
              )}
            </div>

            <Separator />

            {/* Details */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Tutor:</span>
                <span className="font-medium">{session.tutors?.name || "Not assigned"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Classroom:</span>
                <span className="font-medium">{session.classrooms?.name || "Not assigned"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Class Type:</span>
                <span className="font-medium">{session.class_types?.name || "-"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Layers className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Stream:</span>
                <span className="font-medium">{session.streams?.name || "-"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Time:</span>
                <span className="font-medium">
                  {formatTime(session.start_time)} - {formatTime(session.end_time)}
                </span>
              </div>
            </div>

            <Separator />

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={notesEdited ? notes : sessionNotes}
                onChange={(e) => {
                  setNotes(e.target.value)
                  setNotesEdited(true)
                }}
                placeholder="Add notes about this session..."
                rows={3}
              />
              {notesEdited && (
                <Button size="sm" onClick={saveNotes} disabled={saving}>
                  {saving ? "Saving..." : "Save Notes"}
                </Button>
              )}
            </div>

            <Separator />

            {/* Attendance */}
            <div className="space-y-2">
              <Label>Attendance</Label>
              <AttendanceSheet sessionId={session.id} sessionStatus={session.status} onUpdate={onUpdated} />
            </div>

            <Separator />

            {/* Actions */}
            <div className="flex flex-col gap-2">
              {session.status !== "cancelled" && !session.series_id && (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => setEditOpen(true)}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit Session
                </Button>
              )}
              {session.status === "scheduled" && session.series_id && (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => setCancelDialogOpen(true)}
                >
                  <CalendarPlus className="mr-2 h-4 w-4" />
                  Schedule Makeup
                </Button>
              )}
              {session.status === "scheduled" && !session.series_id && (
                <Button
                  variant="outline"
                  className="w-full justify-start text-destructive hover:text-destructive"
                  onClick={() => setCancelDialogOpen(true)}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Cancel Session
                </Button>
              )}
              {session.status === "cancelled" && (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => setRestoreDialogOpen(true)}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Restore Session
                </Button>
              )}
              {!session.series_id && (
                <Button
                  variant="outline"
                  className="w-full justify-start text-destructive hover:text-destructive"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Session
                </Button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Cancel / Schedule Makeup Confirmation Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{session.series_id ? "Schedule Makeup" : "Cancel Session"}</DialogTitle>
            <DialogDescription>
              {session.series_id
                ? "This will cancel the original session and open the makeup scheduling form. The cancelled session will be marked in the series view."
                : "Are you sure you want to cancel this session? This will mark the session as cancelled but will not delete it."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              Keep Session
            </Button>
            <Button
              variant={session.series_id ? "default" : "destructive"}
              onClick={() => updateStatus("cancelled", !!session.series_id)}
              disabled={saving}
            >
              {saving ? "Processing..." : session.series_id ? "Cancel & Schedule Makeup" : "Cancel Session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore Confirmation Dialog */}
      <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore Session</DialogTitle>
            <DialogDescription>
              This will restore the session back to &quot;Scheduled&quot; status.
              Any makeup sessions created for this cancellation will be automatically deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={restoreSession}
              disabled={saving}
            >
              {saving ? "Restoring..." : "Restore Session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Session</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete this session? This will remove all
              attendance records and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={deleteSession}
              disabled={saving}
            >
              {saving ? "Deleting..." : "Delete Session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Form */}
      {editOpen && (
        <SessionEditForm
          open={editOpen}
          onOpenChange={setEditOpen}
          session={session}
          onSaved={() => {
            onOpenChange(false)
            onUpdated()
          }}
        />
      )}

      {/* Makeup Session Form */}
      {makeupOpen && session && (
        <AdhocSessionForm
          open={makeupOpen}
          onOpenChange={setMakeupOpen}
          makeupForSessionId={session.id}
          defaultValues={{
            subject_id: session.subject_id,
            tutor_id: session.tutor_id,
            classroom_id: session.classroom_id,
            class_type_id: session.class_type_id,
            stream_id: session.stream_id || undefined,
            start_time: session.start_time,
            end_time: session.end_time,
            student_ids: session.session_students?.map((ss) => ss.student_id) || [],
          }}
          onCreated={() => {
            onOpenChange(false)
            onUpdated()
          }}
        />
      )}
    </>
  )
}
