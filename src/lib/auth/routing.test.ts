import { describe, it, expect } from "vitest"
import { resolveRedirect, homeFor } from "./routing"

describe("homeFor", () => {
  it("sends admin to the academy dashboard by default", () => {
    expect(homeFor("admin")).toBe("/")
  })
  it("sends admin to /tm when the workspace cookie is tm", () => {
    expect(homeFor("admin", "tm")).toBe("/tm")
  })
  it("sends tutor to the portal", () => {
    expect(homeFor("tutor")).toBe("/portal")
  })
  it("sends pending to the holding page", () => {
    expect(homeFor("pending")).toBe("/pending")
  })
  it("sends anonymous to login", () => {
    expect(homeFor("anon")).toBe("/login")
  })
})

describe("resolveRedirect: anonymous", () => {
  it("allows /login and /auth/callback", () => {
    expect(resolveRedirect("anon", "/login")).toBeNull()
    expect(resolveRedirect("anon", "/auth/callback")).toBeNull()
  })
  it("redirects everything else to /login", () => {
    expect(resolveRedirect("anon", "/")).toBe("/login")
    expect(resolveRedirect("anon", "/portal")).toBe("/login")
    expect(resolveRedirect("anon", "/tm/invoices")).toBe("/login")
  })
})

describe("resolveRedirect: pending", () => {
  it("allows only /pending", () => {
    expect(resolveRedirect("pending", "/pending")).toBeNull()
    expect(resolveRedirect("pending", "/")).toBe("/pending")
    expect(resolveRedirect("pending", "/portal")).toBe("/pending")
    expect(resolveRedirect("pending", "/login")).toBe("/pending")
  })
})

describe("resolveRedirect: tutor", () => {
  it("allows the portal and its sub-routes", () => {
    expect(resolveRedirect("tutor", "/portal")).toBeNull()
    expect(resolveRedirect("tutor", "/portal/timesheet")).toBeNull()
  })
  it("redirects everything else to /portal", () => {
    expect(resolveRedirect("tutor", "/")).toBe("/portal")
    expect(resolveRedirect("tutor", "/tm")).toBe("/portal")
    expect(resolveRedirect("tutor", "/login")).toBe("/portal")
    expect(resolveRedirect("tutor", "/pending")).toBe("/portal")
    expect(resolveRedirect("tutor", "/portalx")).toBe("/portal")
  })
})

describe("resolveRedirect: admin", () => {
  it("allows admin routes and the portal", () => {
    expect(resolveRedirect("admin", "/")).toBeNull()
    expect(resolveRedirect("admin", "/invoices")).toBeNull()
    expect(resolveRedirect("admin", "/tm/approvals")).toBeNull()
    expect(resolveRedirect("admin", "/portal")).toBeNull()
  })
  it("bounces admin off login and pending to their home", () => {
    expect(resolveRedirect("admin", "/login")).toBe("/")
    expect(resolveRedirect("admin", "/login", "tm")).toBe("/tm")
    expect(resolveRedirect("admin", "/pending")).toBe("/")
  })
  it("sends / to /tm when the workspace cookie is tm", () => {
    expect(resolveRedirect("admin", "/", "tm")).toBe("/tm")
    expect(resolveRedirect("admin", "/", "academy")).toBeNull()
    expect(resolveRedirect("admin", "/schedule", "tm")).toBeNull()
  })
})
