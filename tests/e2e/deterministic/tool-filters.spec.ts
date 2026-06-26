import { test, expect } from '@playwright/test'
import { sendMessage } from '../conversation'
import { toolCard } from '../tools'

test.describe('tool filters', () => {
  test('hides a tool by name and reveals it inline', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'tool', 'What is the weather?')

    const card = toolCard(page, 'get_weather')
    await expect(card).toBeVisible()

    // Open the filter dialog and add a filter for get_weather.
    await page.getByRole('button', { name: 'Hidden tools' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByPlaceholder('Tool name or glob (e.g. set_*)').fill('get_weather')
    await dialog.getByRole('button', { name: 'Add', exact: true }).click()

    // Close the dialog (Escape) and assert the card collapsed into the hidden line.
    await page.keyboard.press('Escape')
    await expect(card).toBeHidden()
    const hiddenLine = page.getByText('1 tool hidden')
    await expect(hiddenLine).toBeVisible()

    // Reveal inline.
    await page.getByRole('button', { name: /1 tool hidden/ }).click()
    await expect(card).toBeVisible()
  })
})
