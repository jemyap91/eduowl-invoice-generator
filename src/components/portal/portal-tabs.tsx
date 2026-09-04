"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const TABS = [
  { label: "My Students", href: "/portal" },
  { label: "Log a Session", href: "/portal/log" },
  { label: "My Timesheet", href: "/portal/timesheet" },
]

export function PortalTabs() {
  const pathname = usePathname()
  return (
    <nav className="bg-white border-b">
      <ul className="flex max-w-3xl mx-auto">
        {TABS.map((tab) => {
          const active = tab.href === "/portal" ? pathname === "/portal" : pathname.startsWith(tab.href)
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                className={cn(
                  "block text-center text-sm py-3 border-b-2 transition-colors",
                  active ? "border-primary text-primary font-semibold" : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
