import { test, expect } from '@playwright/test'
import { sendMessage } from './helpers'

test.describe('tool approval', () => {
  test('tool approval accepted', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'approval', 'Send an email')

    const toolCard = page.locator('.rounded-md.border').filter({ hasText: 'send_email' })
    await expect(toolCard.getByText('Awaiting Approval')).toBeVisible({ timeout: 15_000 })

    await toolCard
      .getByRole('button', { name: /send_email|Awaiting/ })
      .first()
      .click()

    await expect(toolCard.getByRole('button', { name: 'Approve' })).toBeVisible()
    await expect(toolCard.getByRole('button', { name: 'Deny' })).toBeVisible()

    await toolCard.getByRole('button', { name: 'Approve' }).click()

    await expect(toolCard.getByText('Completed')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('The email has been sent successfully.')).toBeVisible({ timeout: 15_000 })
  })

  test('tool approval denied', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'approval', 'Send an email')

    const toolCard = page.locator('.rounded-md.border').filter({ hasText: 'send_email' })
    await expect(toolCard.getByText('Awaiting Approval')).toBeVisible({ timeout: 15_000 })

    await toolCard
      .getByRole('button', { name: /send_email|Awaiting/ })
      .first()
      .click()

    await toolCard.getByRole('button', { name: 'Deny' }).click()

    await expect(toolCard.getByText('Denied', { exact: true })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('The email was not sent because you denied the request.')).toBeVisible({
      timeout: 15_000,
    })
  })
})
