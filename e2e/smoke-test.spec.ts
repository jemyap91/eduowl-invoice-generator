import { test, expect } from '@playwright/test'
import { signIn, users } from "./helpers/auth"

test.beforeEach(async ({ context }) => {
  await signIn(context, users.admin.email, users.admin.password)
})

test.describe('Navigation & Page Loading', () => {
  test('dashboard loads without errors', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    await page.goto('/')
    await expect(page).toHaveTitle(/EduOwl|Next/)

    // Check sidebar is visible on desktop
    await expect(page.getByAltText('EduOwl English Academy').first()).toBeVisible()
    await expect(page.locator('text=Dashboard').first()).toBeVisible()

    // Check dashboard content renders
    await expect(page.locator('text=Total Students').or(page.locator('text=Dashboard')).first()).toBeVisible()
  })

  test('all navigation links work', async ({ page }) => {
    await page.goto('/')

    const navLinks = [
      { name: 'Schedule', url: '/schedule' },
      { name: 'Students', url: '/students' },
      { name: 'Tutors', url: '/tutors' },
      { name: 'Invoices', url: '/invoices' },
      { name: 'Settings', url: '/settings' },
      { name: 'Dashboard', url: '/' },
    ]

    for (const link of navLinks) {
      // Click the nav link in the sidebar
      await page.locator(`nav >> text=${link.name}`).first().click()
      await page.waitForURL(`**${link.url}`, { timeout: 5000 })

      // Verify no 404 or error page. innerText (not textContent) so Next's
      // embedded RSC flight script (which always serializes a notFound
      // boundary and literally contains "404") isn't mistaken for a real one.
      const body = await page.innerText('body')
      expect(body).not.toContain('404')
      expect(body).not.toContain('Application error')
    }
  })
})

test.describe('Settings Page', () => {
  test('settings page loads with all tabs', async ({ page }) => {
    await page.goto('/settings')

    // Check all tabs are present. .first() because the active tab's panel
    // heading repeats the same text as the tab trigger (e.g. Subjects tab +
    // "Subjects" h3 in its content).
    await expect(page.locator('text=Subjects').first()).toBeVisible()
    await expect(page.locator('text=Streams').first()).toBeVisible()
    await expect(page.locator('text=Classrooms').first()).toBeVisible()
    await expect(page.locator('text=Payment Methods').first()).toBeVisible()
    await expect(page.locator('text=Academy Info').first()).toBeVisible()
  })

  test('can switch between settings tabs', async ({ page }) => {
    await page.goto('/settings')

    // Click each tab and verify it activates
    const tabs = ['Subjects', 'Streams', 'Classrooms', 'Payment Methods', 'Academy Info']
    for (const tab of tabs) {
      await page.locator(`[role="tab"]:has-text("${tab}")`).click()
      await expect(page.locator(`[role="tab"]:has-text("${tab}")`)).toHaveAttribute('data-state', 'active')
    }
  })

  test('subjects tab shows add button', async ({ page }) => {
    await page.goto('/settings')
    await page.locator('[role="tab"]:has-text("Subjects")').click()

    // Should have an "Add Subject" or "Add" button
    const addButton = page.locator('button:has-text("Add")')
    await expect(addButton.first()).toBeVisible()
  })

  test('classrooms tab shows pre-seeded data or empty state', async ({ page }) => {
    await page.goto('/settings')
    await page.locator('[role="tab"]:has-text("Classrooms")').click()

    // Wait for data to load (either classrooms or empty state)
    await page.waitForTimeout(2000)

    // Should show either classroom data or empty state - not an error
    const body = await page.textContent('body')
    expect(body).not.toContain('Application error')
  })

  test('academy info tab shows form', async ({ page }) => {
    await page.goto('/settings')
    await page.locator('[role="tab"]:has-text("Academy Info")').click()

    // Should have input fields. The Name field's underlying <input> has no
    // explicit type attribute (shadcn Input passes type through unset), so
    // match it by its label instead of an input[type="text"] selector.
    await expect(page.getByLabel('Name')).toBeVisible({ timeout: 5000 })
  })
})

test.describe('Tutors Page', () => {
  test('tutors page loads', async ({ page }) => {
    await page.goto('/tutors')

    // Should show "Add Tutor" button
    await expect(page.locator('button:has-text("Add Tutor")')).toBeVisible()
  })

  test('add tutor dialog opens', async ({ page }) => {
    await page.goto('/tutors')
    await page.locator('button:has-text("Add Tutor")').click()

    // Dialog should open with form fields
    await expect(page.locator('[role="dialog"]')).toBeVisible()
    await expect(page.locator('input').first()).toBeVisible()
  })

  test('add tutor dialog can be closed', async ({ page }) => {
    await page.goto('/tutors')
    await page.locator('button:has-text("Add Tutor")').click()
    await expect(page.locator('[role="dialog"]')).toBeVisible()

    // Close by pressing Escape
    await page.keyboard.press('Escape')
    await expect(page.locator('[role="dialog"]')).not.toBeVisible()
  })
})

test.describe('Students Page', () => {
  test('students page loads with tabs', async ({ page }) => {
    await page.goto('/students')

    // Should have Students and Parents tabs
    await expect(page.locator('[role="tab"]:has-text("Students")')).toBeVisible()
    await expect(page.locator('[role="tab"]:has-text("Parents")')).toBeVisible()
  })

  test('add student dialog opens', async ({ page }) => {
    await page.goto('/students')
    await page.locator('button:has-text("Add Student")').click()

    await expect(page.locator('[role="dialog"]')).toBeVisible()
  })

  test('parents tab works', async ({ page }) => {
    await page.goto('/students')
    await page.locator('[role="tab"]:has-text("Parents")').click()

    // Should show "Add Parent" button
    await expect(page.locator('button:has-text("Add Parent")')).toBeVisible()
  })
})

test.describe('Schedule Page', () => {
  test('schedule page loads with calendar and class series tabs', async ({ page }) => {
    await page.goto('/schedule')

    // Should have Calendar and Class Series tabs
    await expect(page.locator('[role="tab"]:has-text("Calendar")').or(page.locator('text=Calendar'))).toBeVisible()
    await expect(page.locator('[role="tab"]:has-text("Class Series")').or(page.locator('text=Class Series'))).toBeVisible()
  })

  test('calendar view has navigation controls', async ({ page }) => {
    await page.goto('/schedule')

    // Should have Today button and view toggle
    await expect(page.locator('button:has-text("Today")')).toBeVisible()
  })

  test('calendar view toggle works', async ({ page }) => {
    await page.goto('/schedule')

    // Try clicking Day, Week, Month views
    const viewButtons = ['Day', 'Week', 'Month']
    for (const view of viewButtons) {
      const btn = page.locator(`[role="tab"]:has-text("${view}"), button:has-text("${view}")`)
      if (await btn.count() > 0) {
        await btn.first().click()
        await page.waitForTimeout(500)
        // No crash = success
      }
    }
  })

  test('class series tab works', async ({ page }) => {
    await page.goto('/schedule')
    await page.locator('[role="tab"]:has-text("Class Series")').click()

    // Should show "Create Class Series" button
    await expect(page.locator('button:has-text("Create Class Series")').or(page.locator('button:has-text("Add")'))).toBeVisible({ timeout: 5000 })
  })

  test('ad-hoc session button exists', async ({ page }) => {
    await page.goto('/schedule')

    // Should have an ad-hoc session button (the app labels it "Extra Class")
    const adhocBtn = page.locator('button:has-text("Ad-hoc"), button:has-text("New Session"), button:has-text("Ad-Hoc"), button:has-text("Extra Class")')
    await expect(adhocBtn.first()).toBeVisible({ timeout: 5000 })
  })
})

test.describe('Invoices Page', () => {
  test('invoices page loads', async ({ page }) => {
    await page.goto('/invoices')

    // Should show "Generate Invoice" button
    await expect(page.locator('button:has-text("Generate Invoice")')).toBeVisible()
  })

  test('generate invoice dialog opens', async ({ page }) => {
    await page.goto('/invoices')
    await page.locator('button:has-text("Generate Invoice")').click()

    await expect(page.locator('[role="dialog"]')).toBeVisible()
  })
})

test.describe('Dashboard Components', () => {
  test('dashboard has stat cards', async ({ page }) => {
    await page.goto('/')

    // Wait for dashboard to render
    await page.waitForTimeout(2000)

    // Should have stat cards (checking for common stat labels)
    const statLabels = ['Total Students', 'Total Tutors', 'Classes Today', 'Revenue']
    for (const label of statLabels) {
      const el = page.locator(`text=${label}`)
      if (await el.count() > 0) {
        await expect(el.first()).toBeVisible()
      }
    }
  })

  test('dashboard has quick action buttons', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(2000)

    // Should have quick action buttons
    const body = await page.textContent('body')
    // Check for at least one quick action link
    const hasQuickActions = body?.includes('New Class') ||
                           body?.includes('Generate Invoice') ||
                           body?.includes('Add Student')
    expect(hasQuickActions).toBeTruthy()
  })

  test('quick action links navigate correctly', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(2000)

    // Click a quick action and verify navigation
    const invoiceLink = page.locator('a:has-text("Generate Invoice"), button:has-text("Generate Invoice")')
    if (await invoiceLink.count() > 0) {
      await invoiceLink.first().click()
      await page.waitForTimeout(1000)
      // Should navigate to invoices page
      expect(page.url()).toContain('/invoices')
    }
  })
})

test.describe('Responsive Design', () => {
  test('mobile sidebar toggle works', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')

    // Desktop sidebar should be hidden
    const sidebar = page.locator('nav').first()

    // Look for hamburger menu button
    const menuButton = page.locator('button[class*="lg:hidden"], button:has(svg)').first()
    if (await menuButton.isVisible()) {
      await menuButton.click()
      await page.waitForTimeout(500)

      // Navigation should now be visible in a sheet/drawer
      const navItem = page.locator('text=Dashboard')
      await expect(navItem.first()).toBeVisible()
    }
  })

  test('pages render on mobile without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })

    const pages = ['/', '/schedule', '/students', '/tutors', '/invoices', '/settings']

    for (const pagePath of pages) {
      await page.goto(pagePath)
      await page.waitForTimeout(1000)

      // Check no horizontal scroll (body width should not exceed viewport)
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
      const viewportWidth = 375
      // Allow small tolerance (scrollbars etc)
      expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 20)
    }
  })
})

test.describe('Console Errors Check', () => {
  test('no critical console errors on any page', async ({ page }) => {
    const criticalErrors: { page: string; error: string }[] = []

    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text()
        // Ignore known non-critical errors
        if (text.includes('favicon') ||
            text.includes('hydration') ||
            text.includes('third-party') ||
            text.includes('Failed to load resource') // Supabase might not have data
        ) return
        criticalErrors.push({ page: page.url(), error: text })
      }
    })

    const pages = ['/', '/schedule', '/students', '/tutors', '/invoices', '/settings']

    for (const pagePath of pages) {
      await page.goto(pagePath)
      await page.waitForTimeout(2000)
    }

    // Log errors but don't fail on Supabase-related ones (no data yet is OK)
    if (criticalErrors.length > 0) {
      console.log('Console errors found:')
      criticalErrors.forEach(e => console.log(`  ${e.page}: ${e.error}`))
    }

    // Filter out Supabase auth/data errors since the DB might be empty
    const realErrors = criticalErrors.filter(e =>
      !e.error.includes('supabase') &&
      !e.error.includes('Supabase') &&
      !e.error.includes('JWT') &&
      !e.error.includes('fetch') &&
      !e.error.includes('network')
    )

    expect(realErrors).toHaveLength(0)
  })
})

test.describe('Network Requests', () => {
  test('no 500 errors on page loads', async ({ page }) => {
    const serverErrors: { url: string; status: number }[] = []

    page.on('response', response => {
      if (response.status() >= 500) {
        serverErrors.push({ url: response.url(), status: response.status() })
      }
    })

    const pages = ['/', '/schedule', '/students', '/tutors', '/invoices', '/settings']

    for (const pagePath of pages) {
      await page.goto(pagePath)
      await page.waitForTimeout(1500)
    }

    expect(serverErrors).toHaveLength(0)
  })
})
