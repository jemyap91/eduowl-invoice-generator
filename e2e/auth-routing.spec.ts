import { test, expect } from "@playwright/test"
import { signIn, users } from "./helpers/auth"

test.describe("anonymous", () => {
  test("is sent to login and sees the Google button", async ({ page }) => {
    await page.goto("/")
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole("button", { name: /continue with google/i })).toBeVisible()
  })
  test("cannot reach the portal or tutor matching", async ({ page }) => {
    await page.goto("/portal")
    await expect(page).toHaveURL(/\/login$/)
    await page.goto("/tm")
    await expect(page).toHaveURL(/\/login$/)
  })
})

test.describe("pending user", () => {
  test.beforeEach(async ({ context }) => signIn(context, users.pending.email, users.pending.password))
  test("only sees the holding page", async ({ page }) => {
    await page.goto("/")
    await expect(page).toHaveURL(/\/pending$/)
    await expect(page.getByText("Thanks for signing up")).toBeVisible()
    await page.goto("/portal")
    await expect(page).toHaveURL(/\/pending$/)
  })
})

test.describe("tutor", () => {
  test.beforeEach(async ({ context }) => signIn(context, users.tutor.email, users.tutor.password))
  test("lands in the portal and cannot leave it", async ({ page }) => {
    await page.goto("/")
    await expect(page).toHaveURL(/\/portal$/)
    await expect(page.getByText("EduOwl Tutor Matching")).toBeVisible()
    await expect(page.getByText("E2E Tutor")).toBeVisible()
    await page.goto("/tm")
    await expect(page).toHaveURL(/\/portal$/)
    await page.goto("/invoices")
    await expect(page).toHaveURL(/\/portal$/)
  })
  test("can move between portal tabs", async ({ page }) => {
    await page.goto("/portal")
    await page.getByRole("link", { name: "My Timesheet" }).click()
    await expect(page).toHaveURL(/\/portal\/timesheet$/)
    await expect(page.locator("main").getByText("My Timesheet", { exact: true })).toBeVisible()
  })
})

test.describe("admin", () => {
  test.beforeEach(async ({ context }) => signIn(context, users.admin.email, users.admin.password))
  test("lands on the academy dashboard and is bounced off login", async ({ page }) => {
    await page.goto("/login")
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByAltText("EduOwl English Academy").first()).toBeVisible()
  })
  test("switches workspaces and the choice is remembered", async ({ page }) => {
    await page.goto("/")
    await page.getByLabel("Switch workspace").click()
    await page.getByRole("menuitem", { name: "Tutor Matching" }).click()
    await expect(page).toHaveURL(/\/tm$/)
    await expect(page.getByAltText("Tutor Matching").first()).toBeVisible()
    await page.goto("/")
    await expect(page).toHaveURL(/\/tm$/)
    await page.getByLabel("Switch workspace").click()
    await page.getByRole("menuitem", { name: "EduOwl English Academy" }).click()
    await expect(page).toHaveURL(/\/$/)
    await page.goto("/")
    await expect(page).toHaveURL(/\/$/)
  })
  test("can open the tutor portal", async ({ page }) => {
    await page.goto("/portal")
    await expect(page).toHaveURL(/\/portal$/)
  })
  test("demo login route is gone", async ({ page }) => {
    // page.request shares the signed-in cookies, so this is not a login redirect
    const res = await page.request.post("/api/demo-login", { maxRedirects: 0 })
    expect(res.status()).toBe(404)
  })
})
