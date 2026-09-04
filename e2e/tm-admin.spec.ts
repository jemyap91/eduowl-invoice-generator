import { test, expect } from "@playwright/test"
import { signIn, users } from "./helpers/auth"
import { createPendingUser, deleteUserByEmail, deleteTutorByName, findUserByEmail } from "./helpers/admin"

const stamp = Date.now().toString(36)

test.describe("tutor matching admin", () => {
  test.beforeEach(async ({ context }) => signIn(context, users.admin.email, users.admin.password))

  test("settings save and reload", async ({ page }) => {
    await page.goto("/tm/settings")
    const uen = page.getByLabel("PayNow UEN")
    const original = await uen.inputValue()
    await uen.fill("202411710M-E2E")
    await page.getByRole("button", { name: "Save settings" }).click()
    await expect(page.getByText("Tutor Matching settings updated", { exact: true })).toBeVisible()
    await page.reload()
    await expect(page.getByLabel("PayNow UEN")).toHaveValue("202411710M-E2E")
    await page.getByLabel("PayNow UEN").fill(original)
    await page.getByRole("button", { name: "Save settings" }).click()
    await expect(page.getByText("Tutor Matching settings updated", { exact: true })).toBeVisible()
  })

  test("add a tutor", async ({ page }) => {
    const name = `E2E Tutor ${stamp}`
    await page.goto("/tm/tutors")
    await page.getByRole("button", { name: "Add Tutor" }).click()
    await page.getByLabel("Name *").fill(name)
    await page.getByLabel("Phone").fill("9000 0000")
    await page.getByRole("button", { name: "Save" }).click()
    await expect(page.getByRole("cell", { name, exact: true })).toBeVisible()
    await expect(page.getByRole("row", { name: new RegExp(name) })).toContainText("Not linked")
  })

  test("approve a pending signup as a new tutor", async ({ page }) => {
    const email = `approve.${stamp}@example.com`
    const name = `Approved ${stamp}`
    await createPendingUser(email, name)
    try {
      await page.goto("/tm/tutors")
      const row = page.getByRole("row", { name: new RegExp(email) })
      await expect(row).toBeVisible()
      await row.getByRole("button", { name: "Create new tutor" }).click()
      await expect(page.getByLabel("Name *")).toHaveValue(name)
      await page.getByRole("button", { name: "Approve" }).click()
      await expect(page.getByText(`${name} can now use the tutor portal`, { exact: true })).toBeVisible()
      await expect(page.getByRole("row", { name: new RegExp(name) })).toContainText(email)
    } finally {
      await deleteUserByEmail(email)
      await deleteTutorByName(name)
    }
  })

  test("reject a pending signup deletes the account", async ({ page }) => {
    const email = `reject.${stamp}@example.com`
    await createPendingUser(email, "Reject Me")
    try {
      await page.goto("/tm/tutors")
      const row = page.getByRole("row", { name: new RegExp(email) })
      await row.getByRole("button", { name: "Reject" }).click()
      await page.getByRole("dialog").getByRole("button", { name: "Reject" }).click()
      await expect(page.getByText(`${email} was removed`, { exact: true })).toBeVisible()
      await expect(page.getByRole("row", { name: new RegExp(email) })).toHaveCount(0)
      expect(await findUserByEmail(email)).toBeNull()
    } finally {
      await deleteUserByEmail(email)
    }
  })

  test("add a student, an assignment with tiers, and see it in the master list", async ({ page }) => {
    const student = `E2E Student ${stamp}`
    await page.goto("/tm/students")
    await page.getByRole("button", { name: "Add Student" }).click()
    await page.getByLabel("Student name *").fill(student)
    await page.getByLabel("Parent name").fill("E2E Parent")
    await page.getByRole("button", { name: "Save" }).click()
    await expect(page.getByRole("cell", { name: student, exact: true })).toBeVisible()

    await page.getByRole("button", { name: `Expand ${student}` }).click()
    await page.getByRole("button", { name: "Add assignment" }).click()
    const code = await page.getByLabel("Code *").inputValue()
    expect(code).toMatch(/^[A-Z]{2}\d{2}$/)
    await page.getByLabel("Tutor *").click()
    await page.getByRole("option").first().click()
    await page.getByLabel("Subject *").fill("E2E Subject")
    // Ensure at least one tier row exists and fill the first one
    if ((await page.getByLabel("Tier label").count()) === 0) {
      await page.getByRole("button", { name: "Add tier" }).click()
    }
    await page.getByLabel("Tier label").first().fill("1 to 1")
    await page.getByLabel("Parent rate").first().fill("70")
    await page.getByLabel("Tutor rate").first().fill("50")
    await page.getByRole("button", { name: "Save" }).click()
    await expect(page.getByText(`Assignment ${code} added`, { exact: true })).toBeVisible()
    await expect(page.getByRole("cell", { name: code, exact: true })).toBeVisible()

    await page.goto("/tm/master-list")
    await expect(page.getByRole("cell", { name: code, exact: true })).toBeVisible()
    await expect(page.getByRole("row", { name: new RegExp(code) })).toContainText("1 to 1 $70")

    const download = page.waitForEvent("download")
    await page.getByRole("button", { name: "Export CSV" }).click()
    expect((await download).suggestedFilename()).toMatch(/^master-list-assignments-\d{4}-\d{2}\.csv$/)

    await page.getByRole("tab", { name: "Monthly History" }).click()
    await expect(page.getByRole("button", { name: "Export CSV" })).toBeVisible()
  })
})
