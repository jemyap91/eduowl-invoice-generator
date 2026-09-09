import { describe, it, expect } from "vitest"
import { workspaceFromPathname, pageTitle, NAV_ITEMS, WORKSPACES } from "./workspace"

describe("workspaceFromPathname", () => {
  it("treats /tm and /tm/* as the tutor matching workspace", () => {
    expect(workspaceFromPathname("/tm")).toBe("tm")
    expect(workspaceFromPathname("/tm/invoices")).toBe("tm")
  })
  it("treats everything else as the academy", () => {
    expect(workspaceFromPathname("/")).toBe("academy")
    expect(workspaceFromPathname("/invoices")).toBe("academy")
    expect(workspaceFromPathname("/tmx")).toBe("academy")
  })
})

describe("pageTitle", () => {
  it("knows academy pages", () => {
    expect(pageTitle("/")).toBe("Dashboard")
    expect(pageTitle("/students")).toBe("Students & Parents")
  })
  it("knows tutor matching pages", () => {
    expect(pageTitle("/tm")).toBe("Dashboard")
  })
  it("falls back to the workspace label", () => {
    expect(pageTitle("/tm/whatever")).toBe("Tutor Matching")
    expect(pageTitle("/whatever")).toBe("EduOwl English Academy")
  })
})

describe("NAV_ITEMS", () => {
  it("has a dashboard entry at each workspace home", () => {
    for (const ws of WORKSPACES) {
      expect(NAV_ITEMS[ws.id][0]).toMatchObject({ label: "Dashboard", href: ws.home })
    }
  })
  it("lists the tutor matching admin screens in order", () => {
    expect(NAV_ITEMS.tm.map((i) => [i.label, i.href])).toEqual([
      ["Dashboard", "/tm"],
      ["Pending Timesheets", "/tm/approvals"],
      ["Invoices", "/tm/invoices"],
      ["Tutors", "/tm/tutors"],
      ["Students & Assignments", "/tm/students"],
      ["Master List", "/tm/master-list"],
      ["Settings", "/tm/settings"],
    ])
  })
})
