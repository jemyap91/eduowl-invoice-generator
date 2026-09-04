"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Calendar, ClipboardCheck, GraduationCap, Users, FileText, Settings,
  ChevronsLeft, ChevronsRight, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { NAV_ITEMS, WORKSPACES, workspaceFromPathname, isNavActive } from "@/lib/workspace";
import { WorkspaceSwitcher } from "./workspace-switcher";

const ICONS: Record<string, LucideIcon> = {
  Dashboard: LayoutDashboard,
  Schedule: Calendar,
  Attendance: ClipboardCheck,
  "Students & Parents": GraduationCap,
  Tutors: Users,
  Invoices: FileText,
  Settings: Settings,
};

function SidebarContent({ onNavClick, collapsed }: { onNavClick?: () => void; collapsed?: boolean }) {
  const pathname = usePathname();
  const workspace = workspaceFromPathname(pathname);
  const info = WORKSPACES.find((w) => w.id === workspace)!;
  const navItems = NAV_ITEMS[workspace];

  return (
    <>
      {/* Logo area */}
      <div className={cn("flex flex-col items-center gap-2 py-6", collapsed ? "px-2" : "px-4")}>
        <Image
          src={info.logo}
          alt={info.label}
          width={collapsed ? 44 : info.logoWidth}
          height={collapsed ? 44 : info.logoHeight}
          priority
        />
        <div className="w-full pt-2">
          <WorkspaceSwitcher current={workspace} collapsed={collapsed} />
        </div>
      </div>

      {/* Navigation */}
      <nav className={cn("flex-1", collapsed ? "px-2" : "px-3")}>
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = isNavActive(item.href, pathname);
            const Icon = ICONS[item.label] ?? LayoutDashboard;

            const linkContent = (
              <Link
                href={item.href}
                onClick={onNavClick}
                className={cn(
                  "flex items-center rounded-lg text-sm font-medium transition-all duration-200",
                  "hover:bg-primary/5 hover:text-primary",
                  collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5",
                  isActive
                    ? "border-l-[3px] border-primary bg-primary/10 text-primary font-semibold"
                    : "border-l-[3px] border-transparent text-muted-foreground"
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!collapsed && item.label}
              </Link>
            );

            if (collapsed) {
              return (
                <li key={item.href}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      {linkContent}
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                </li>
              );
            }

            return <li key={item.href}>{linkContent}</li>;
          })}
        </ul>
      </nav>
    </>
  );
}

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "hidden lg:flex h-screen flex-col border-r bg-gradient-to-b from-white to-[hsl(165,20%,98%)] transition-all duration-300 relative",
          collapsed ? "w-[64px]" : "w-[260px]"
        )}
        style={{ boxShadow: '2px 0 8px rgba(0,0,0,0.04)' }}
      >
        <SidebarContent collapsed={collapsed} />
        <button
          onClick={onToggle}
          className="absolute -right-3 top-20 z-10 flex h-6 w-6 items-center justify-center rounded-full border bg-white shadow-sm hover:bg-muted transition-colors"
        >
          {collapsed ? (
            <ChevronsRight className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronsLeft className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>
      </aside>
    </TooltipProvider>
  );
}

export function MobileSidebar({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[260px] p-0 bg-gradient-to-b from-white to-[hsl(165,20%,98%)]">
        <div className="flex h-full flex-col">
          <SidebarContent onNavClick={() => onOpenChange(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
