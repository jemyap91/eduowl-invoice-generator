"use client"

import { useRouter } from "next/navigation"
import { ChevronsUpDown, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { WORKSPACES, rememberWorkspace, type Workspace } from "@/lib/workspace"

export function WorkspaceSwitcher({ current, collapsed, showPortal = false }: { current: Workspace; collapsed?: boolean; showPortal?: boolean }) {
  const router = useRouter()
  const active = WORKSPACES.find((w) => w.id === current)!

  function switchTo(id: Workspace) {
    if (id === current) return
    rememberWorkspace(id)
    router.push(WORKSPACES.find((w) => w.id === id)!.home)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Switch workspace"
        className={cn(
          "flex w-full items-center justify-between rounded-lg border bg-white text-sm font-medium transition-colors hover:bg-muted",
          collapsed ? "justify-center px-2 py-2" : "px-3 py-2"
        )}
      >
        {!collapsed && <span className="truncate">{active.label}</span>}
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {WORKSPACES.map((w) => (
          <DropdownMenuItem key={w.id} onSelect={() => switchTo(w.id)} className="flex items-center justify-between">
            {w.label}
            {w.id === current && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
        {showPortal && (
          <DropdownMenuItem onSelect={() => router.push("/portal")}>
            Tutor portal
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
