export const WORKSPACE_COOKIE = "workspace"
export type Workspace = "academy" | "tm"

export function isWorkspace(value: unknown): value is Workspace {
  return value === "academy" || value === "tm"
}
