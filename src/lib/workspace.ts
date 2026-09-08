export const WORKSPACE_COOKIE = "workspace"
export type Workspace = "academy" | "tm"

export function isWorkspace(value: unknown): value is Workspace {
  return value === "academy" || value === "tm"
}

export interface WorkspaceInfo {
  id: Workspace
  label: string
  home: string
  logo: string
  logoWidth: number
  logoHeight: number
}

export const WORKSPACES: WorkspaceInfo[] = [
  { id: "academy", label: "EduOwl English Academy", home: "/", logo: "/academy/logo.png", logoWidth: 200, logoHeight: 113 },
  { id: "tm", label: "Tutor Matching", home: "/tm", logo: "/tm/logo.png", logoWidth: 110, logoHeight: 110 },
]

export function workspaceInfo(id: Workspace): WorkspaceInfo {
  return WORKSPACES.find((w) => w.id === id)!
}

export function workspaceFromPathname(pathname: string): Workspace {
  return pathname === "/tm" || pathname.startsWith("/tm/") ? "tm" : "academy"
}

export interface NavItem {
  label: string
  href: string
}

export const NAV_ITEMS: Record<Workspace, NavItem[]> = {
  academy: [
    { label: "Dashboard", href: "/" },
    { label: "Schedule", href: "/schedule" },
    { label: "Attendance", href: "/attendance" },
    { label: "Students & Parents", href: "/students" },
    { label: "Tutors", href: "/tutors" },
    { label: "Invoices", href: "/invoices" },
    { label: "Settings", href: "/settings" },
  ],
  tm: [
    { label: "Dashboard", href: "/tm" },
    { label: "Pending Approvals", href: "/tm/approvals" },
    { label: "Invoices", href: "/tm/invoices" },
    { label: "Tutors", href: "/tm/tutors" },
    { label: "Students & Assignments", href: "/tm/students" },
    { label: "Master List", href: "/tm/master-list" },
    { label: "Settings", href: "/tm/settings" },
  ],
}

export function isNavActive(href: string, pathname: string): boolean {
  if (href === "/" || href === "/tm") return pathname === href
  return pathname === href || pathname.startsWith(href + "/")
}

export function pageTitle(pathname: string): string {
  const ws = workspaceFromPathname(pathname)
  const match = NAV_ITEMS[ws].find((item) => item.href === pathname)
  return match?.label ?? workspaceInfo(ws).label
}

/** Sets the workspace cookie for a year. Client-side only. */
export function rememberWorkspace(id: Workspace) {
  document.cookie = `${WORKSPACE_COOKIE}=${id}; path=/; max-age=31536000; SameSite=Lax`
}
