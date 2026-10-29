import { test, expect } from "@playwright/test"
import { signIn, users } from "./helpers/auth"
import { deleteAssignmentData } from "./helpers/admin"

const stamp = Date.now().toString(36)
const student = `E2E Self Student ${stamp}`

test.describe.serial("tutor self-service", () => {
  test.afterAll(async () => {
    await deleteAssignmentData(student)
  })

  test("the tutor adds a student and a subject with their own pay", async ({ context, page }) => {
    await signIn(context, users.tutor.email, users.tutor.password)
    await page.goto("/portal")
    await page.getByRole("button", { name: "Add student" }).click()
    let dialog = page.getByRole("dialog")
    await dialog.getByLabel("Student name *").fill(student)
    await dialog.getByLabel("Parent name").fill("E2E Self Parent")
    await dialog.getByRole("button", { name: "Save" }).click()

    // Adding a student goes straight on to adding a subject
    dialog = page.getByRole("dialog")
    await expect(dialog.getByRole("heading", { name: "Add subject" })).toBeVisible()
    await expect(dialog.getByLabel("Parent rate")).toHaveCount(0)
    await dialog.getByLabel("Subject *").fill("E2E Self Subject")
    await dialog.getByLabel("Your pay").first().fill("45")
    await dialog.getByRole("button", { name: "Save" }).click()

    const card = page.getByTestId("portal-student").filter({ hasText: student })
    await expect(card).toContainText("E2E Self Subject")
    await expect(card).toContainText("1 to 1: $45.00/hr")
  })

  test("the tutor logs a session and submits the month", async ({ context, page }) => {
    await signIn(context, users.tutor.email, users.tutor.password)
    await page.goto("/portal")
    await page.getByTestId("portal-student").filter({ hasText: student }).getByRole("link", { name: "Log session" }).click()
    await page.getByLabel("Or hours").fill("2")
    await page.getByLabel("Note").fill("E2E self session")
    await page.getByRole("button", { name: "Save session" }).click()
    await expect(page.getByText("Session logged", { exact: true }).first()).toBeVisible()
    await expect(page.getByRole("row", { name: /E2E self session/ })).toContainText("$90.00")

    const section = page.locator("section, div").filter({ has: page.getByText("E2E Self Subject") }).filter({ has: page.getByRole("button", { name: "Submit for approval" }) }).last()
    await section.getByRole("button", { name: "Submit for approval" }).click()
    await page.getByRole("dialog").getByRole("button", { name: "Submit", exact: true }).click()
    await expect(page.getByText("Submitted, waiting for approval").first()).toBeVisible()
  })

  test("admin must set the parent rate before approving", async ({ context, page }) => {
    await signIn(context, users.admin.email, users.admin.password)
    await page.goto("/tm/approvals")
    const row = page.getByRole("row", { name: new RegExp(student) })
    await expect(row).toContainText("Parent rate needed")
    await row.getByRole("button", { name: /^Review / }).click()

    await expect(page.getByRole("alert").filter({ hasText: "Set the parent rate for 1 to 1 before approving" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Approve" })).toBeDisabled()

    await page.getByRole("button", { name: "Set parent rates" }).click()
    const dialog = page.getByRole("dialog")
    await expect(dialog).toContainText("Tutor pay $45.00/hr")
    await dialog.getByLabel("Parent rate for 1 to 1").fill("80")
    await dialog.getByRole("button", { name: "Save" }).click()
    await expect(page.getByText("Parent rates saved", { exact: true }).first()).toBeVisible()

    await expect(page.getByTestId("review-totals")).toContainText("Invoice $160.00 · Payout $90.00 · Profit $70.00")
    await page.getByRole("button", { name: "Approve" }).click()
    await page.getByRole("dialog").getByRole("button", { name: "Approve" }).click()
    await expect(page.getByText("Approved", { exact: true }).first()).toBeVisible()
  })

  test("the admin student list shows who added the student", async ({ context, page }) => {
    await signIn(context, users.admin.email, users.admin.password)
    await page.goto("/tm/students")
    await expect(page.getByRole("row", { name: new RegExp(student) })).toContainText("Added by E2E Tutor")
  })
})
