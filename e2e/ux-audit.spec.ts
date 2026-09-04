import { test, expect } from '@playwright/test'

// Bypass auth by setting the demo_auth cookie
test.beforeEach(async ({ page }) => {
  // Set demo cookie to bypass login gate
  await page.context().addCookies([{
    name: 'demo_auth',
    value: 'true',
    domain: 'localhost',
    path: '/',
  }])
})

test.describe('UX Audit - Tuition Center Admin Perspective', () => {

  test('1. Dashboard overview', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    await page.screenshot({ path: 'test-results/01-dashboard.png', fullPage: true })
  })

  test('2. Dashboard - mobile view', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    await page.screenshot({ path: 'test-results/02-dashboard-mobile.png', fullPage: true })

    // Test mobile menu
    const menuButton = page.locator('button:has(> .lucide-menu)')
    if (await menuButton.isVisible()) {
      await menuButton.click()
      await page.waitForTimeout(500)
      await page.screenshot({ path: 'test-results/02b-mobile-menu.png', fullPage: true })
    }
  })

  test('3. Students page - list view', async ({ page }) => {
    await page.goto('/students')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    await page.screenshot({ path: 'test-results/03-students-list.png', fullPage: true })
  })

  test('4. Students - add student dialog', async ({ page }) => {
    await page.goto('/students')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // Click "Add Student" button
    const addBtn = page.locator('button:has-text("Add Student")')
    if (await addBtn.isVisible()) {
      await addBtn.click()
      await page.waitForTimeout(500)
      await page.screenshot({ path: 'test-results/04-add-student-dialog.png', fullPage: true })

      // Try selecting a stream to test subject filtering
      const streamSelect = page.locator('#student-stream')
      if (await streamSelect.isVisible()) {
        await streamSelect.click()
        await page.waitForTimeout(300)
        await page.screenshot({ path: 'test-results/04b-stream-dropdown.png', fullPage: true })

        // Select first stream option
        const firstOption = page.locator('[role="option"]').first()
        if (await firstOption.isVisible()) {
          await firstOption.click()
          await page.waitForTimeout(300)
          await page.screenshot({ path: 'test-results/04c-subjects-filtered.png', fullPage: true })
        }
      }
    }
  })

  test('5. Students - Parents tab', async ({ page }) => {
    await page.goto('/students')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // Click Parents tab
    const parentsTab = page.locator('[role="tab"]:has-text("Parents")')
    if (await parentsTab.isVisible()) {
      await parentsTab.click()
      await page.waitForTimeout(1000)
      await page.screenshot({ path: 'test-results/05-parents-list.png', fullPage: true })
    }

    // Try add parent
    const addBtn = page.locator('button:has-text("Add Parent")')
    if (await addBtn.isVisible()) {
      await addBtn.click()
      await page.waitForTimeout(500)
      await page.screenshot({ path: 'test-results/05b-add-parent-dialog.png', fullPage: true })
    }
  })

  test('6. Tutors page', async ({ page }) => {
    await page.goto('/tutors')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    await page.screenshot({ path: 'test-results/06-tutors-list.png', fullPage: true })

    // Try add tutor
    const addBtn = page.locator('button:has-text("Add Tutor")')
    if (await addBtn.isVisible()) {
      await addBtn.click()
      await page.waitForTimeout(500)
      await page.screenshot({ path: 'test-results/06b-add-tutor-dialog.png', fullPage: true })
    }
  })

  test('7. Schedule - Month view', async ({ page }) => {
    await page.goto('/schedule')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    await page.screenshot({ path: 'test-results/07-schedule-month.png', fullPage: true })
  })

  test('8. Schedule - Week view', async ({ page }) => {
    await page.goto('/schedule')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    const weekBtn = page.locator('button:has-text("Week")')
    if (await weekBtn.isVisible()) {
      await weekBtn.click()
      await page.waitForTimeout(1500)
      await page.screenshot({ path: 'test-results/08-schedule-week.png', fullPage: true })
    }
  })

  test('9. Schedule - Day view', async ({ page }) => {
    await page.goto('/schedule')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    const dayBtn = page.locator('button:has-text("Day")')
    if (await dayBtn.isVisible()) {
      await dayBtn.click()
      await page.waitForTimeout(1500)
      await page.screenshot({ path: 'test-results/09-schedule-day.png', fullPage: true })
    }
  })

  test('10. Schedule - click on session detail', async ({ page }) => {
    await page.goto('/schedule')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)

    // Try clicking a session card
    const sessionCard = page.locator('button:has-text("English"), button:has-text("Mathematics"), button:has-text("Additional")').first()
    if (await sessionCard.isVisible()) {
      await sessionCard.click()
      await page.waitForTimeout(1000)
      await page.screenshot({ path: 'test-results/10-session-detail.png', fullPage: true })
    }
  })

  test('11. Schedule - Ad-hoc session dialog', async ({ page }) => {
    await page.goto('/schedule')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    const adhocBtn = page.locator('button:has-text("Ad-hoc Session")')
    if (await adhocBtn.isVisible()) {
      await adhocBtn.click()
      await page.waitForTimeout(500)
      await page.screenshot({ path: 'test-results/11-adhoc-session.png', fullPage: true })
    }
  })

  test('12. Invoices page', async ({ page }) => {
    await page.goto('/invoices')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    await page.screenshot({ path: 'test-results/12-invoices-list.png', fullPage: true })
  })

  test('13. Invoices - Generate Invoice dialog', async ({ page }) => {
    await page.goto('/invoices')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    const generateBtn = page.locator('button:has-text("Generate Invoice")')
    if (await generateBtn.isVisible()) {
      await generateBtn.click()
      await page.waitForTimeout(500)
      await page.screenshot({ path: 'test-results/13-generate-invoice.png', fullPage: true })
    }
  })

  test('14. Invoices - View invoice detail', async ({ page }) => {
    await page.goto('/invoices')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)

    // Click the view (eye) icon on first invoice
    const viewBtn = page.locator('button[title="View"], button:has(.lucide-eye)').first()
    if (await viewBtn.isVisible()) {
      await viewBtn.click()
      await page.waitForTimeout(1000)
      await page.screenshot({ path: 'test-results/14-invoice-detail.png', fullPage: true })
    }
  })

  test('15. Settings page', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    await page.screenshot({ path: 'test-results/15-settings.png', fullPage: true })
  })

  test('16. Settings - all tabs', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    const tabs = ['Subjects', 'Streams', 'Classrooms', 'Class Types', 'Payment Methods']
    for (let i = 0; i < tabs.length; i++) {
      const tab = page.locator(`[role="tab"]:has-text("${tabs[i]}")`)
      if (await tab.isVisible()) {
        await tab.click()
        await page.waitForTimeout(800)
        await page.screenshot({ path: `test-results/16${String.fromCharCode(97 + i)}-settings-${tabs[i].toLowerCase().replace(/\s+/g, '-')}.png`, fullPage: true })
      }
    }
  })

  test('17. Login page', async ({ context, page }) => {
    // Clear cookies to see login page
    await context.clearCookies()
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)
    await page.screenshot({ path: 'test-results/17-login.png', fullPage: true })
  })

  test('18. Login page - mobile', async ({ context, page }) => {
    await context.clearCookies()
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)
    await page.screenshot({ path: 'test-results/18-login-mobile.png', fullPage: true })
  })
})
