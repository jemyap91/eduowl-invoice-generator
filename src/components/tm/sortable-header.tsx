"use client"

import { TableHead } from "@/components/ui/table"
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import type { SortDir } from "@/lib/tm/master-list"

interface SortableHeaderProps<K extends string> {
  column: K
  label: string
  sortKey: K | null
  sortDir: SortDir
  onSort: (column: K) => void
  className?: string
  align?: "left" | "right"
}

export function SortableHeader<K extends string>({ column, label, sortKey, sortDir, onSort, className, align = "left" }: SortableHeaderProps<K>) {
  const active = sortKey === column
  const Icon = !active ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown
  return (
    <TableHead
      className={cn("whitespace-nowrap", align === "right" && "text-right", className)}
      aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn("inline-flex items-center gap-1 hover:text-foreground", active && "text-foreground font-semibold")}
      >
        {label}
        <Icon className="h-3 w-3" />
      </button>
    </TableHead>
  )
}
