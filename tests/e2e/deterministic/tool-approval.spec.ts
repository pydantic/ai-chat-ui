import { test, expect } from '@playwright/test'
import { sendMessage } from '../conversation'
import { toolCard } from '../tools'

test.describe('tool approval', () => {
  test('tool approval accepted', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'approval', 'Send an email')

    const card = toolCard(page, 'send_email')
    await expect(card.getByText('Awaiting Approval')).toBeVisible()

    await card
      .getByRole('button', { name: /send_email|Awaiting/ })
      .first()
      .click()

    await expect(card.getByRole('button', { name: 'Approve' })).toBeVisible()
    await expect(card.getByRole('button', { name: 'Deny' })).toBeVisible()

    await card.getByRole('button', { name: 'Approve' }).click()

    await expect(card.getByText('Completed')).toBeVisible()
    await expect(page.getByText('The email has been sent successfully.')).toBeVisible()
  })

  test('tool approval denied', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'approval', 'Send an email')

    const card = toolCard(page, 'send_email')
    await expect(card.getByText('Awaiting Approval')).toBeVisible()

    await card
      .getByRole('button', { name: /send_email|Awaiting/ })
      .first()
      .click()

    await card.getByRole('button', { name: 'Deny' }).click()

    await expect(card.getByText('Denied', { exact: true })).toBeVisible()
    await expect(page.getByText('The email was not sent because you denied the request.')).toBeVisible()
  })
})
