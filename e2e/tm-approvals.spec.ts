import { test, expect } from "@playwright/test"
import { signIn, users } from "./helpers/auth"
import { createSubmittedMonth, deleteAssignmentData, findGeneratedInvoice } from "./helpers/admin"

const stamp = Date.now().toString(36)
const student = `E2E Approval Student ${stamp}`
const code = `EA${stamp.slice(-2).toUpperCase()}`
let assignmentId = ""

test.describe.serial("tutor matching approvals", () => {
  test.beforeAll(async () => {
    const ids = await createSubmittedMonth("E2E Tutor", student, code)
    assignmentId = ids.assignmentId
  })
  test.afterAll(async () => {
    await deleteAssignmentData(student)
  })

  test("the queue lists the submitted month with its totals", async ({ context, page }) => {
    await signIn(context, users.admin.email, users.admin.password)
    await page.goto("/tm/approvals")
    const row = page.getByRole("row", { name: new RegExp(code) })
    await expect(row).toBeVisible()
    // 1.5 h + 2 h at $70 / $50
    await expect(row).toContainText("3.50")
    await expect(row).toContainText("$245.00")
    await expect(row).toContainText("$175.00")
    await expect(row).toContainText("$70.00")
  })

  test("review shows the sessions and an edit leaves a trail", async ({ context, page }) => {
    await signIn(context, users.admin.email, users.admin.password)
    await page.goto("/tm/approvals")
    await page.getByRole("button", { name: new RegExp(`^Review ${code} `) }).click()
    await expect(page).toHaveURL(/\/tm\/approvals\?submission=/)
    await expect(page.getByRole("row", { name: /E2E first session/ })).toContainText("$105.00")

    await page.getByRole("button", { name: /^Edit session on / }).first().click()
    await page.getByLabel("Or hours").fill("1")
    await page.getByRole("button", { name: "Save changes" }).click()
    await expect(page.getByText("Session updated", { exact: true }).first()).toBeVisible()
    const edited = page.getByRole("row", { name: /E2E first session/ })
    await expect(edited).toContainText("1.00")
    await expect(edited).toContainText("Edited")
    await edited.getByRole("button", { name: /previous version/ }).click()
    await expect(page.getByText("Hours: 1.50")).toBeVisible()
    await expect(page.getByTestId("review-totals")).toContainText("3.00 h")
  })

  test("send back returns the month to the tutor", async ({ context, page }) => {
    await signIn(context, users.admin.email, users.admin.password)
    await page.goto("/tm/approvals")
    await page.getByRole("button", { name: new RegExp(`^Review ${code} `) }).click()
    await page.getByRole("button", { name: "Send back" }).click()
    const dialog = page.getByRole("dialog")
    await expect(dialog.getByRole("button", { name: "Send back" })).toBeDisabled()
    await dialog.getByLabel("Reason").fill("E2E please check the second session")
    await dialog.getByRole("button", { name: "Send back" }).click()
    await expect(page.getByText("Sent back to E2E Tutor", { exact: true }).first()).toBeVisible()
    await expect(page).toHaveURL(/\/tm\/approvals$/)
    await expect(page.getByText("Returned, awaiting resubmission")).toBeVisible()
    await expect(page.getByRole("row", { name: new RegExp(code) })).toContainText("E2E please check the second session")
  })

  test("the tutor sees the reason and resubmits", async ({ context, page }) => {
    await signIn(context, users.tutor.email, users.tutor.password)
    await page.goto("/portal/timesheet")
    await expect(page.getByText("Returned: E2E please check the second session").first()).toBeVisible()
    await page.getByRole("button", { name: "Resubmit" }).click()
    await page.getByRole("dialog").getByRole("button", { name: "Submit", exact: true }).click()
    await expect(page.getByText("Submitted, waiting for approval").first()).toBeVisible()
  })

  test("approve creates the invoice", async ({ context, page }) => {
    await signIn(context, users.admin.email, users.admin.password)
    await page.goto("/tm/approvals")
    await expect(page.getByText("Returned, awaiting resubmission")).toHaveCount(0)
    await page.getByRole("button", { name: new RegExp(`^Review ${code} `) }).click()
    await page.getByRole("button", { name: "Approve" }).click()
    await page.getByRole("dialog").getByRole("button", { name: "Approve" }).click()
    await expect(page.getByText(/^Invoice TM-\d{6}-\d{3} created\.$/).first()).toBeVisible()
    await expect(page).toHaveURL(/\/tm\/approvals$/)
    await expect(page.getByText("Nothing is waiting for approval.")).toBeVisible()

    const invoice = await findGeneratedInvoice(assignmentId)
    expect(invoice).not.toBeNull()
    // 1.0 h + 2 h at $70 / $50 after the edit
    expect(Number(invoice!.total_hours)).toBe(3)
    expect(Number(invoice!.invoice_amount)).toBe(210)
    expect(Number(invoice!.tutor_payout)).toBe(150)
  })
})
