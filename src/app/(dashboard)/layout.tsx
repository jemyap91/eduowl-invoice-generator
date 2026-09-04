"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar, MobileSidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { workspaceFromPathname } from "@/lib/workspace";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const workspace = workspaceFromPathname(pathname);

  return (
    <div className="flex h-screen" data-workspace={workspace}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <MobileSidebar open={mobileOpen} onOpenChange={setMobileOpen} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-auto p-4 sm:p-6 bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  );
}
