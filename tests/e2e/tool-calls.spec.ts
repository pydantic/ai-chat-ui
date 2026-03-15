import { test, expect } from '@playwright/test'
import { sendMessage } from './helpers'

test.describe('tool calls', () => {
  test('shows tool call UI with tool name', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'tool', 'What is the weather?')
    await expect(page.getByText('get_weather')).toBeVisible({ timeout: 15_000 })
  })

  test('shows completed status for tool call', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'tool', 'weather')
    const toolCard = page.locator('.rounded-md.border').filter({ hasText: 'get_weather' })
    await expect(toolCard.getByText('Completed')).toBeVisible({ timeout: 15_000 })
  })

  test('shows final text after tool execution', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'tool', 'weather')
    await expect(page.getByText('Tool result')).toBeVisible({ timeout: 15_000 })
  })
})
