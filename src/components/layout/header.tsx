"use client";

import { usePathname, useRouter } from "next/navigation";
import { format } from "date-fns";
import { Menu, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { pageTitle } from "@/lib/workspace";

export function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const title = pageTitle(pathname);
  const today = format(new Date(), "EEEE, d MMMM yyyy");

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border/50 bg-white px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden sm:inline text-sm text-muted-foreground/70">{today}</span>
        <Button variant="ghost" size="icon" onClick={handleLogout} title="Sign out">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
