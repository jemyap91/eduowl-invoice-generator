import type { Workspace } from "@/lib/workspace"

export type Role = "anon" | "pending" | "tutor" | "admin"

const PUBLIC_PATHS = ["/login", "/auth/callback"]

function under(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + "/")
}

export function homeFor(role: Role, workspace?: Workspace): string {
  switch (role) {
    case "admin":
      return workspace === "tm" ? "/tm" : "/"
    case "tutor":
      return "/portal"
    case "pending":
      return "/pending"
    default:
      return "/login"
  }
}

/**
 * Decide where a request should go. Returns a pathname to redirect to,
 * or null to let the request through.
 */
export function resolveRedirect(role: Role, pathname: string, workspace?: Workspace): string | null {
  const isPublic = PUBLIC_PATHS.some((p) => under(pathname, p))

  if (role === "anon") return isPublic ? null : "/login"

  const home = homeFor(role, workspace)
  if (isPublic) return home

  if (role === "pending") return pathname === "/pending" ? null : "/pending"

  if (role === "tutor") return under(pathname, "/portal") ? null : "/portal"

  // admin
  if (pathname === "/pending") return home
  if (pathname === "/" && workspace === "tm") return "/tm"
  return null
}
