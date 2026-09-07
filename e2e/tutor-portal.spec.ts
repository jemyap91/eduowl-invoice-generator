import { test, expect } from "@playwright/test"
import { signIn, users } from "./helpers/auth"
import { createAssignmentForTutor, deleteAssignmentData } from "./helpers/admin"

const stamp = Date.now().toString(36)
const student = `E2E Portal Student ${stamp}`
const code = `EP${stamp.slice(-2).toUpperCase()}`

test.describe.serial("tutor portal", () => {
  test.beforeAll(async () => {
    await createAssignmentForTutor("E2E Tutor", student, code)
  })
  test.afterAll(async () => {
    await deleteAssignmentData(student)
  })
  test.beforeEach(async ({ context }) => signIn(context, users.tutor.email, users.tutor.password))

  test("My Students shows the assignment with the tutor rate only", async ({ page }) => {
    await page.goto("/portal")
    const card = page.locator("div", { has: page.getByText(student, { exact: true }) }).last()
    await expect(page.getByText(student, { exact: true })).toBeVisible()
    await expect(page.getByText("1 to 1: $50.00/hr")).toBeVisible()
    await expect(page.getByText("$70")).toHaveCount(0)
    await expect(card).toBeVisible()
  })

  test("logs a session with start and end times", async ({ page }) => {
    await page.goto("/portal")
    await page.getByRole("link", { name: "Log session" }).first().click()
    await expect(page).toHaveURL(/\/portal\/log\?assignment=/)
    await page.getByLabel("Start time").fill("14:00")
    await page.getByLabel("End time").fill("15:30")
    await expect(page.getByText("1.50 hours")).toBeVisible()
    await page.getByLabel("Note").fill("E2E session")
    await page.getByRole("button", { name: "Save session" }).click()
    await expect(page.getByText("Session logged", { exact: true }).first()).toBeVisible()
    await expect(page).toHaveURL(/\/portal\/timesheet\?month=\d{4}-\d{2}/)
    const row = page.getByRole("row", { name: /E2E session/ })
    await expect(row).toContainText("1.50")
    await expect(row).toContainText("$75.00")
    await expect(page.locator("p").filter({ hasText: "Total:" })).toContainText("1.50 h · $75.00")
  })

  test("edits the session hours", async ({ page }) => {
    await page.goto("/portal/timesheet")
    await page.getByRole("button", { name: /^Edit session on / }).first().click()
    await page.getByLabel("Start time").fill("")
    await page.getByLabel("End time").fill("")
    await page.getByLabel("Or hours").fill("2")
    await page.getByRole("button", { name: "Save changes" }).click()
    await expect(page.getByText("Session updated", { exact: true }).first()).toBeVisible()
    await expect(page.getByRole("row", { name: /E2E session/ })).toContainText("2.00")
  })

  test("submits the month and the month locks", async ({ page }) => {
    await page.goto("/portal/timesheet")
    await page.getByRole("button", { name: "Submit for approval" }).click()
    await page.getByRole("dialog").getByRole("button", { name: "Submit", exact: true }).click()
    await expect(page.getByText("Submitted, waiting for approval").first()).toBeVisible()
    await expect(page.getByRole("button", { name: /^Edit session on / })).toHaveCount(0)

    await page.goto("/portal/log")
    await page.getByLabel("Or hours").fill("1")
    await page.getByRole("button", { name: "Save session" }).click()
    await expect(page.getByText("This month has already been submitted for approval").first()).toBeVisible()
  })
})
