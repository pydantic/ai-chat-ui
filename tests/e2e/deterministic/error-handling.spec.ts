import { test, expect } from '@playwright/test'
import { sendMessage } from '../conversation'
import { toolCard } from '../tools'

test.describe('error handling', () => {
  test('shows error dialog with error details', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'error', 'What is the weather?')
    const card = toolCard(page, 'get_weather')
    await expect(card.getByText('Error')).toBeVisible()

    await card
      .getByRole('button', { name: /get_weather|Error/ })
      .first()
      .click()

    await card.getByRole('button', { name: 'View Error' }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Tool Error')).toBeVisible()
    await expect(dialog.locator('pre')).toContainText('City name is required')
  })

  test('shows final text after error recovery', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'error', 'What is the weather?')
    await expect(page.getByText('The tool encountered an error.')).toBeVisible()
  })
})
