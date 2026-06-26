import { test, expect } from '@playwright/test'
import { sendMessage } from '../conversation'
import { toolCard } from '../tools'

test.describe('tool approval', () => {
  test('approve runs the tool and shows the result', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'approval', 'Send an email')

    const card = toolCard(page, 'send_email')
    // ToolPart auto-opens on approval-requested, so the buttons should be
    // visible without needing to expand the card manually.
    await expect(card.getByText('Approval Required')).toBeVisible()
    await expect(card.getByRole('button', { name: 'Approve' })).toBeVisible()
    await expect(card.getByRole('button', { name: 'Deny' })).toBeVisible()

    await card.getByRole('button', { name: 'Approve' }).click()

    await expect(card.getByText('Approved. Executing tool.')).toBeVisible()
    await expect(card.getByText('Completed')).toBeVisible()
    await expect(page.getByText('The email has been sent successfully.')).toBeVisible()
  })

  test('deny shows the rejected state and does not execute the tool', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'approval', 'Send an email')

    const card = toolCard(page, 'send_email')
    await expect(card.getByText('Approval Required')).toBeVisible()

    await card.getByRole('button', { name: 'Deny' }).click()

    await expect(card.getByText('Denied. Tool will not run.')).toBeVisible()
    await expect(page.getByText('The email was not sent because you denied the request.')).toBeVisible()
  })
})
