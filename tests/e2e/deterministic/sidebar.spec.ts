import { test, expect } from '@playwright/test'
import { sendMessage } from '../conversation'
import { sidebar } from '../sidebar'

test.describe('sidebar', () => {
  test('new conversation appears in sidebar after sending message', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'text', 'Sidebar test message')
    await expect(page.getByText('Hello from the test server')).toBeVisible()

    await expect(sidebar(page).getByText('Sidebar test message')).toBeVisible()
  })

  test('URL changes to conversation ID after sending', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'text', 'URL test')
    await expect(page).not.toHaveURL('/')
  })
})
