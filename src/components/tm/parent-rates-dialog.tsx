"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency } from "@/lib/format"
import { toNumber } from "@/lib/tm/types"

interface TierRow {
  id: string
  label: string
  tutor_rate: number
  parent_rate: string
  original: number | null
}

interface Props {
  assignmentId: string | null
  title: string
  onClose: () => void
  onSaved: () => void
}

/** Admin sets the parent rate on each of an assignment's tiers. Sessions waiting on a rate pick it up. */
export function ParentRatesDialog({ assignmentId, title, onClose, onSaved }: Props) {
  const { toast } = useToast()
  const [rows, setRows] = useState<TierRow[] | null>(null)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!assignmentId) return
    let cancelled = false
    setRows(null)
    setError("")
    createClient()
      .from("tm_rate_tiers")
      .select("id, label, parent_rate, tutor_rate, sort_order")
      .eq("assignment_id", assignmentId)
      .order("sort_order")
      .then(({ data, error: loadError }) => {
        if (cancelled) return
        if (loadError) { setError(loadError.message); setRows([]); return }
        setRows((data ?? []).map((t) => {
          const parent = toNumber(t.parent_rate)
          return { id: t.id, label: t.label, tutor_rate: toNumber(t.tutor_rate) ?? 0, parent_rate: parent == null ? "" : String(parent), original: parent }
        }))
      })
    return () => { cancelled = true }
  }, [assignmentId])

  async function handleSave() {
    if (!rows) return
    setError("")
    const changes: { id: string; parent_rate: number }[] = []
    for (const r of rows) {
      const raw = r.parent_rate.trim()
      if (raw === "") {
        if (r.original != null) { setError(`Enter a parent rate for "${r.label}".`); return }
        continue
      }
      if (!/^\d+(\.\d+)?$/.test(raw)) { setError(`Parent rate for "${r.label}" must be a number of 0 or more.`); return }
      const value = Math.round(parseFloat(raw) * 100) / 100
      if (value !== r.original) changes.push({ id: r.id, parent_rate: value })
    }
    setSaving(true)
    const supabase = createClient()
    for (const c of changes) {
      const { error: saveError } = await supabase.from("tm_rate_tiers").update({ parent_rate: c.parent_rate }).eq("id", c.id)
      if (saveError) {
        setSaving(false)
        setError(saveError.message)
        return
      }
    }
    setSaving(false)
    toast({ title: "Parent rates saved" })
    onSaved()
    onClose()
  }

  return (
    <Dialog open={assignmentId !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Parent rates · {title}</DialogTitle>
          <DialogDescription>What the parent is charged per hour. The tutor does not see these.</DialogDescription>
        </DialogHeader>
        {rows === null ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : (
          <div className="space-y-3">
            {rows.map((r, i) => (
              <div key={r.id} className="grid grid-cols-[1fr_120px] items-center gap-3">
                <Label htmlFor={`parent-rate-${i}`} className="text-sm">
                  {r.label}
                  <span className="block text-xs font-normal text-muted-foreground">Tutor pay {formatCurrency(r.tutor_rate)}/hr</span>
                </Label>
                <Input
                  id={`parent-rate-${i}`}
                  aria-label={`Parent rate for ${r.label}`}
                  inputMode="decimal"
                  placeholder="Not set"
                  value={r.parent_rate}
                  onChange={(e) => setRows((prev) => prev && prev.map((x) => (x.id === r.id ? { ...x, parent_rate: e.target.value } : x)))}
                />
              </div>
            ))}
            {rows.length === 0 && !error && <p className="text-sm text-muted-foreground">This assignment has no rate tiers.</p>}
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || rows === null}>{saving ? "Saving..." : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
