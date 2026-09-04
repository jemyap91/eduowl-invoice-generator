"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { Plus, Pencil, Search, Users } from "lucide-react"
import { TutorForm, type TutorFormValues } from "./tutor-form"
import { TUTOR_STATUS_LABELS, type TmTutor } from "@/lib/tm/types"

interface TutorRow extends TmTutor {
  profiles: { email: string } | null
  activeAssignments: number
}

export function TutorList({ refreshKey = 0 }: { refreshKey?: number }) {
  const [tutors, setTutors] = useState<TutorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<TutorRow | null>(null)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const [tutorsRes, assignmentsRes] = await Promise.all([
      supabase.from("tm_tutors").select("*, profiles(email)").order("name"),
      supabase.from("tm_assignments").select("tutor_id").eq("status", "active"),
    ])
    if (tutorsRes.error || assignmentsRes.error) {
      toast({ title: "Error", description: "Failed to load tutors", variant: "destructive" })
      setLoading(false)
      return
    }
    const counts = new Map<string, number>()
    for (const a of assignmentsRes.data || []) counts.set(a.tutor_id, (counts.get(a.tutor_id) || 0) + 1)
    const rows = ((tutorsRes.data as unknown as (TmTutor & { profiles: { email: string } | null })[]) || []).map((t) => ({
      ...t,
      activeAssignments: counts.get(t.id) || 0,
    }))
    setTutors(rows)
    setLoading(false)
  }, [toast])

  useEffect(() => { load() }, [load, refreshKey])

  const filtered = tutors.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))

  async function handleSave(values: TutorFormValues) {
    setSaving(true)
    const supabase = createClient()
    const payload = { name: values.name, phone: values.phone || null, status: values.status }
    const { error } = editing
      ? await supabase.from("tm_tutors").update(payload).eq("id", editing.id)
      : await supabase.from("tm_tutors").insert(payload)
    setSaving(false)
    if (error) {
      toast({ title: "Error", description: editing ? "Failed to update tutor" : "Failed to add tutor", variant: "destructive" })
      return
    }
    toast({ title: "Success", description: editing ? "Tutor updated" : "Tutor added" })
    setDialogOpen(false)
    setEditing(null)
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search tutors..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true) }}>
          <Plus className="mr-2 h-4 w-4" />Add Tutor
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Login</TableHead>
              <TableHead className="text-right">Active assignments</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-24" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center">
                  <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                    <Users className="h-8 w-8" />
                    <p>{search ? `No tutors matching "${search}"` : "No tutors yet. Add one or approve a signup."}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell>{t.phone || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={t.status === "active" ? "secondary" : "outline"}>{TUTOR_STATUS_LABELS[t.status]}</Badge>
                  </TableCell>
                  <TableCell>
                    {t.profiles?.email ? t.profiles.email : <span className="text-muted-foreground">Not linked</span>}
                  </TableCell>
                  <TableCell className="text-right">{t.activeAssignments}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" aria-label={`Edit ${t.name}`} onClick={() => { setEditing(t); setDialogOpen(true) }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Tutor" : "Add Tutor"}</DialogTitle>
            <DialogDescription>{editing ? "Update the tutor's details." : "A tutor without a login yet; link one when they sign up."}</DialogDescription>
          </DialogHeader>
          <TutorForm
            key={editing?.id || "new"}
            onSubmit={handleSave}
            onCancel={() => setDialogOpen(false)}
            defaultValues={editing ? { name: editing.name, phone: editing.phone || "", status: editing.status } : undefined}
            isLoading={saving}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
