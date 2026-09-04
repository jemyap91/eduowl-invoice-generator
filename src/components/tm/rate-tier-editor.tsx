"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2 } from "lucide-react"
import { newDraft, type RateTierDraft } from "@/lib/tm/rate-tiers"

interface RateTierEditorProps {
  value: RateTierDraft[]
  onChange: (next: RateTierDraft[]) => void
  idPrefix?: string
}

export function RateTierEditor({ value, onChange, idPrefix = "tier" }: RateTierEditorProps) {
  function update(key: string, patch: Partial<RateTierDraft>) {
    onChange(value.map((d) => (d.key === key ? { ...d, ...patch } : d)))
  }
  function remove(key: string) {
    onChange(value.filter((d) => d.key !== key))
  }
  function add() {
    onChange([...value, newDraft()])
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_110px_110px_40px] gap-2 text-xs font-medium text-muted-foreground px-1">
        <span>Label</span>
        <span>Parent $/hr</span>
        <span>Tutor $/hr</span>
        <span />
      </div>
      {value.length === 0 && (
        <p className="text-sm text-muted-foreground px-1">No tiers yet.</p>
      )}
      {value.map((d, i) => (
        <div key={d.key} className="grid grid-cols-[1fr_110px_110px_40px] gap-2 items-center">
          <div>
            <Label htmlFor={`${idPrefix}-label-${i}`} className="sr-only">Tier label</Label>
            <Input
              id={`${idPrefix}-label-${i}`}
              value={d.label}
              placeholder="e.g. 1 to 1"
              onChange={(e) => update(d.key, { label: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor={`${idPrefix}-parent-${i}`} className="sr-only">Parent rate</Label>
            <Input
              id={`${idPrefix}-parent-${i}`}
              inputMode="decimal"
              value={d.parent_rate}
              placeholder="0"
              onChange={(e) => update(d.key, { parent_rate: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor={`${idPrefix}-tutor-${i}`} className="sr-only">Tutor rate</Label>
            <Input
              id={`${idPrefix}-tutor-${i}`}
              inputMode="decimal"
              value={d.tutor_rate}
              placeholder="0"
              onChange={(e) => update(d.key, { tutor_rate: e.target.value })}
            />
          </div>
          <Button type="button" variant="ghost" size="icon" aria-label={`Remove tier ${i + 1}`} onClick={() => remove(d.key)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus className="mr-2 h-4 w-4" />
        Add tier
      </Button>
    </div>
  )
}
