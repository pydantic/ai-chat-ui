import { test, expect } from '@playwright/test'
import { sendMessage } from './helpers'

test.describe('sidebar', () => {
  test('new conversation appears in sidebar after sending message', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'text', 'Sidebar test message')
    await expect(page.getByText('Hello from the test server')).toBeVisible({ timeout: 15_000 })

    const sidebar = page.locator('[data-slot="sidebar"]')
    await expect(sidebar.getByText('Sidebar test message')).toBeVisible()
  })

  test('URL changes to conversation ID after sending', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'text', 'URL test')
    await expect(page).not.toHaveURL('/')
  })
})
