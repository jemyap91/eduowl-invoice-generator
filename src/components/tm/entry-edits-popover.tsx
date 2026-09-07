"use client"

import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { describeEdit, type EntryEdit } from "@/lib/tm/approvals"

function when(iso: string): string {
  return iso.replace("T", " ").slice(0, 16)
}

export function EntryEditsBadge({ edits }: { edits: EntryEdit[] }) {
  if (edits.length === 0) return null
  const newestFirst = [...edits].sort((a, b) => b.edited_at.localeCompare(a.edited_at))
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label={`Show ${edits.length} previous ${edits.length === 1 ? "version" : "versions"}`}>
          <Badge variant="secondary">Edited</Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3 text-sm">
        {newestFirst.map((e) => (
          <div key={e.id} className="space-y-1">
            <p className="text-xs text-muted-foreground">Before the edit at {when(e.edited_at)}</p>
            <ul className="space-y-0.5">
              {describeEdit(e.previous).map((line) => <li key={line}>{line}</li>)}
            </ul>
          </div>
        ))}
      </PopoverContent>
    </Popover>
  )
}
