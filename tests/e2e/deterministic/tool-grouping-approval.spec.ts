import { test, expect } from '@playwright/test'
import { sendMessage } from '../conversation'
import { toolCard } from '../tools'

test.describe('tool-call grouping with approval', () => {
  test('keeps a grouped run expanded while awaiting approval so both Approve buttons show', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'repeated-approval', 'Send two emails')

    // Two adjacent send_email calls (both requires_approval) collapse into one
    // ToolCallGroup. Because both are still awaiting approval (a running state),
    // the group must default to expanded -- the approval prompts have to be
    // visible without the user clicking "show", or the run can never resolve.
    const group = page.locator('[data-slot="tool-call-group"]')
    await expect(group).toBeVisible()
    await expect(group).toContainText('send_email')
    await expect(group).toContainText('x2')

    const cards = toolCard(page, 'send_email')
    await expect(cards).toHaveCount(2)

    const approveButtons = group.getByRole('button', { name: 'Approve' })
    await expect(approveButtons).toHaveCount(2)
    await expect(approveButtons.first()).toBeVisible()
    await expect(approveButtons.last()).toBeVisible()

    // Approving both resolves the run; the group then collapses by default.
    await approveButtons.first().click()
    await group.getByRole('button', { name: 'Approve' }).first().click()
    await expect(page.getByText('Both emails have been sent successfully.')).toBeVisible()
  })
})
