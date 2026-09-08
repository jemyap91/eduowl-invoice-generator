import { test, expect } from "@playwright/test"
import { signIn, users } from "./helpers/auth"
import { createApprovedMonth, deleteAssignmentData } from "./helpers/admin"

const stamp = Date.now().toString(36)
const student = `E2E Invoice Student ${stamp}`
const code = `EI${stamp.slice(-2).toUpperCase()}`
let invoiceNumber = ""

test.use({ permissions: ["clipboard-read", "clipboard-write"] })

test.describe.serial("tutor matching invoices", () => {
  test.beforeAll(async () => {
    const ids = await createApprovedMonth("E2E Tutor", student, code)
    invoiceNumber = ids.invoiceNumber
  })
  test.afterAll(async () => {
    await deleteAssignmentData(student)
  })
  test.beforeEach(async ({ context }) => signIn(context, users.admin.email, users.admin.password))

  test("lists the invoice and copies the WhatsApp text", async ({ page }) => {
    await page.goto("/tm/invoices")
    const row = page.getByRole("row", { name: new RegExp(code) })
    await expect(row).toContainText("$245.00")
    await expect(row).toContainText("Unpaid")
    await row.getByRole("button", { name: `Actions for ${invoiceNumber}` }).click()
    await page.getByRole("menuitem", { name: "Copy WhatsApp text" }).click()
    await expect(page.getByText("WhatsApp text copied", { exact: true }).first()).toBeVisible()
    const text = await page.evaluate(() => navigator.clipboard.readText())
    expect(text.startsWith(`Hi E2E Parent, here's ${student}'s tuition invoice for`)).toBe(true)
    expect(text).toContain("Rate: $70.00/hr (1 to 1)")
    expect(text).toContain("Amount due: $245.00")
  })

  test("marks the parent paid, blocks delete, then clears it", async ({ page }) => {
    await page.goto("/tm/invoices")
    const row = page.getByRole("row", { name: new RegExp(code) })
    await row.getByRole("button", { name: `Actions for ${invoiceNumber}` }).click()
    await page.getByRole("menuitem", { name: "Mark parent paid" }).click()
    await page.getByRole("dialog").getByRole("button", { name: "Save" }).click()
    await expect(page.getByText("Parent payment recorded", { exact: true }).first()).toBeVisible()
    await expect(row).toContainText(/\d{4}-\d{2}-\d{2}/)

    await row.getByRole("button", { name: `Actions for ${invoiceNumber}` }).click()
    await expect(page.getByRole("menuitem", { name: "Delete" })).toHaveAttribute("aria-disabled", "true")
    await page.getByRole("menuitem", { name: "Edit parent paid date" }).click()
    await page.getByRole("dialog").getByRole("button", { name: "Clear" }).click()
    await expect(page.getByText("Parent payment cleared", { exact: true }).first()).toBeVisible()
    await expect(row).toContainText("Unpaid")
  })

  test("downloads the PDF and shows the detail view", async ({ page }) => {
    await page.goto("/tm/invoices")
    const row = page.getByRole("row", { name: new RegExp(code) })
    await row.getByRole("button", { name: `Actions for ${invoiceNumber}` }).click()
    const download = page.waitForEvent("download")
    await page.getByRole("menuitem", { name: "Download PDF" }).click()
    expect((await download).suggestedFilename()).toMatch(/ Invoice\.pdf$/)
    await expect(page.getByText("Invoice PDF downloaded", { exact: true }).first()).toBeVisible()

    await row.getByRole("link", { name: invoiceNumber }).click()
    await expect(page).toHaveURL(/invoice=/)
    await expect(page.getByRole("row", { name: /E2E first session|1 to 1/ }).first()).toBeVisible()
    await expect(page.getByTestId("invoice-total")).toContainText("Total $245.00")
    await page.getByLabel("Remarks").fill("E2E remark")
    await page.getByRole("button", { name: "Save remarks" }).click()
    await expect(page.getByText("Remarks saved", { exact: true }).first()).toBeVisible()
  })

  test("deleting the generated invoice re-opens the month", async ({ page }) => {
    await page.goto("/tm/invoices")
    const row = page.getByRole("row", { name: new RegExp(code) })
    await row.getByRole("button", { name: `Actions for ${invoiceNumber}` }).click()
    await page.getByRole("menuitem", { name: "Delete" }).click()
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click()
    await expect(page.getByText("Invoice deleted", { exact: true }).first()).toBeVisible()
    await expect(page.getByRole("row", { name: new RegExp(code) })).toHaveCount(0)

    await page.goto("/tm/approvals")
    await expect(page.getByRole("row", { name: new RegExp(code) })).toContainText("3.50")
  })

  test("creates a manual invoice", async ({ page }) => {
    await page.goto("/tm/invoices")
    await page.getByRole("button", { name: "New manual invoice" }).click()
    await page.getByLabel("Assignment").click()
    await page.getByRole("option", { name: new RegExp(`^${code} `) }).click()
    await page.getByLabel("Invoice amount").fill("100")
    await page.getByLabel("Tutor payout").fill("60")
    await page.getByLabel("Remarks").fill("E2E manual")
    await page.getByRole("dialog").getByRole("button", { name: "Save" }).click()
    await expect(page.getByText(/^Invoice TM-\d{6}-\d{3} created\.$/).first()).toBeVisible()
    const row = page.getByRole("row", { name: new RegExp(code) })
    await expect(row).toContainText("$100.00")
    await expect(row).toContainText("Manual")
  })

  test("the dashboard shows the pending month and links to unpaid payouts", async ({ page }) => {
    await page.goto("/tm")
    const pendingRow = page.getByRole("row", { name: new RegExp(code) })
    await expect(pendingRow).toBeVisible()
    await pendingRow.getByRole("link", { name: new RegExp(`^Review ${code} `) }).click()
    await expect(page).toHaveURL(/\/tm\/approvals\?submission=/)
    await expect(page.getByText(student, { exact: false }).first()).toBeVisible()

    await page.goto("/tm")
    await page.getByRole("link", { name: "Outstanding tutor payouts" }).click()
    await expect(page).toHaveURL(/\/tm\/invoices\?month=all&tutor_paid=unpaid$/)
    await expect(page.getByRole("row", { name: new RegExp(code) })).toContainText("$60.00")
  })
})
