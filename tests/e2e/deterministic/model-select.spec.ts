import { test, expect } from '@playwright/test'
import { sendMessage } from '../conversation'

test.describe('model selector', () => {
  test('shows available models from server', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('combobox').click()
    await expect(page.getByRole('option', { name: 'text' })).toBeVisible()
    await expect(page.getByRole('option', { name: 'tool', exact: true })).toBeVisible()
    await expect(page.getByRole('option', { name: 'multi-tool' })).toBeVisible()
  })

  test('can select a model and send a message', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'text', 'hello')

    await expect(page.getByText('Hello from the test server')).toBeVisible()
  })
})
