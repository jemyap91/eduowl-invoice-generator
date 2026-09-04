"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { UserPlus, Link2, UserX } from "lucide-react"
import { rejectSignup } from "@/app/(dashboard)/tm/tutors/actions"
import type { TmTutor } from "@/lib/tm/types"

interface PendingProfile {
  id: string
  email: string
  full_name: string | null
  created_at: string
}

type Mode = { kind: "create"; profile: PendingProfile } | { kind: "link"; profile: PendingProfile } | { kind: "reject"; profile: PendingProfile } | null

export function PendingSignups({ onChanged }: { onChanged: () => void }) {
  const [pending, setPending] = useState<PendingProfile[]>([])
  const [unlinkedTutors, setUnlinkedTutors] = useState<TmTutor[]>([])
  const [mode, setMode] = useState<Mode>(null)
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [tutorId, setTutorId] = useState("")
  const [busy, setBusy] = useState(false)
  const { toast } = useToast()

  const load = useCallback(async () => {
    const supabase = createClient()
    const [profilesRes, tutorsRes] = await Promise.all([
      supabase.from("profiles").select("id, email, full_name, created_at").eq("role", "pending").order("created_at"),
      supabase.from("tm_tutors").select("*").is("profile_id", null).order("name"),
    ])
    if (profilesRes.error || tutorsRes.error) {
      toast({ title: "Error", description: "Failed to load pending signups", variant: "destructive" })
      return
    }
    setPending((profilesRes.data as PendingProfile[]) || [])
    setUnlinkedTutors((tutorsRes.data as TmTutor[]) || [])
  }, [toast])

  useEffect(() => { load() }, [load])

  function openCreate(profile: PendingProfile) {
    setName(profile.full_name || "")
    setPhone("")
    setMode({ kind: "create", profile })
  }
  function openLink(profile: PendingProfile) {
    setTutorId("")
    setMode({ kind: "link", profile })
  }

  async function handleCreate() {
    if (mode?.kind !== "create" || !name.trim()) return
    setBusy(true)
    const supabase = createClient()
    const { error } = await supabase.rpc("tm_approve_signup", {
      p_profile_id: mode.profile.id,
      p_name: name.trim(),
      p_phone: phone.trim() || null,
    })
    setBusy(false)
    if (error) {
      toast({ title: "Error", description: error.message || "Failed to approve signup", variant: "destructive" })
      return
    }
    toast({ title: "Approved", description: `${name.trim()} can now use the tutor portal` })
    setMode(null)
    await load()
    onChanged()
  }

  async function handleLink() {
    if (mode?.kind !== "link" || !tutorId) return
    setBusy(true)
    const supabase = createClient()
    const { error } = await supabase.rpc("tm_approve_signup", {
      p_profile_id: mode.profile.id,
      p_tutor_id: tutorId,
    })
    setBusy(false)
    if (error) {
      toast({ title: "Error", description: error.message || "Failed to link signup", variant: "destructive" })
      return
    }
    toast({ title: "Linked", description: "Tutor account linked" })
    setMode(null)
    await load()
    onChanged()
  }

  async function handleReject() {
    if (mode?.kind !== "reject") return
    setBusy(true)
    const result = await rejectSignup(mode.profile.id)
    setBusy(false)
    if (result.error) {
      toast({ title: "Error", description: result.error, variant: "destructive" })
      return
    }
    toast({ title: "Rejected", description: `${mode.profile.email} was removed` })
    setMode(null)
    await load()
  }

  if (pending.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending signups</CardTitle>
        <CardDescription>People who signed in with Google and are waiting for approval.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Signed up</TableHead>
                <TableHead className="w-[320px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.full_name || "-"}</TableCell>
                  <TableCell>{p.email}</TableCell>
                  <TableCell>{new Date(p.created_at).toLocaleDateString("en-GB")}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => openCreate(p)}>
                        <UserPlus className="mr-2 h-4 w-4" />Create new tutor
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openLink(p)} disabled={unlinkedTutors.length === 0}>
                        <Link2 className="mr-2 h-4 w-4" />Link to existing
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setMode({ kind: "reject", profile: p })}>
                        <UserX className="mr-2 h-4 w-4" />Reject
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={mode?.kind === "create"} onOpenChange={(o) => !o && setMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create tutor</DialogTitle>
            <DialogDescription>A new tutor profile linked to {mode?.profile.email}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="signup-name">Name *</Label>
              <Input id="signup-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-phone">Phone</Label>
              <Input id="signup-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 9123 4567" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMode(null)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={busy || !name.trim()}>{busy ? "Saving..." : "Approve"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mode?.kind === "link"} onOpenChange={(o) => !o && setMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link to existing tutor</DialogTitle>
            <DialogDescription>Attach {mode?.profile.email} to a tutor that has no login yet.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="signup-tutor">Tutor</Label>
            <Select value={tutorId} onValueChange={setTutorId}>
              <SelectTrigger id="signup-tutor"><SelectValue placeholder="Choose a tutor" /></SelectTrigger>
              <SelectContent>
                {unlinkedTutors.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMode(null)}>Cancel</Button>
            <Button onClick={handleLink} disabled={busy || !tutorId}>{busy ? "Linking..." : "Link"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mode?.kind === "reject"} onOpenChange={(o) => !o && setMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject signup</DialogTitle>
            <DialogDescription>
              This deletes the Google account link for {mode?.profile.email}. They can sign up again later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMode(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={busy}>{busy ? "Rejecting..." : "Reject"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
