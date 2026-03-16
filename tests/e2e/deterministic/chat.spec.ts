import { test, expect } from '@playwright/test'
import { sendMessage } from '../conversation'

test.describe('chat', () => {
  test('sends a message and receives a response', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'text', 'Hello')
    await expect(page.getByText('Hello from the test server')).toBeVisible()
  })

  test('displays user message immediately', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'text', 'My test message')
    await expect(page.getByRole('paragraph').filter({ hasText: 'My test message' })).toBeVisible()
  })

  test('clears input after sending', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'text', 'Hello')
    const input = page.getByPlaceholder('What would you like to know?')
    await expect(input).toHaveValue('')
  })
})
