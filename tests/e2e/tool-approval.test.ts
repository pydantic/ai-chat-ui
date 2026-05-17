import { test, expect } from '@playwright/test'
import { setupToolApprovalMocks } from './mocks'

test.describe('tool approval (AI SDK v6)', () => {
  test('approve runs the tool and shows the result', async ({ page }) => {
    await setupToolApprovalMocks(page, {
      toolName: 'delete_file',
      preText: "I'll need approval before deleting.",
      output: { deleted: true, path: '/tmp/foo' },
      postText: 'Done — file deleted.',
    })

    await page.goto('/')

    await page.getByPlaceholder('What would you like to know?').fill('please delete /tmp/foo')
    await page.getByPlaceholder('What would you like to know?').press('Enter')

    const chat = page.getByRole('log')

    // Approval prompt appears
    await expect(chat.getByText('This tool requires your approval to run')).toBeVisible()
    const approveButton = chat.getByRole('button', { name: 'Approve' })
    await expect(approveButton).toBeVisible()
    await expect(chat.getByRole('button', { name: 'Deny' })).toBeVisible()

    await approveButton.click()

    // Confirmation flips to the accepted state and the tool result lands.
    // The post-tool assistant text only renders if the SDK actually applied
    // the tool-output-available chunk from the follow-up POST, so seeing it
    // is the regression signal that the round-trip works end-to-end.
    await expect(chat.getByText('Approved. Executing tool.')).toBeVisible()
    await expect(chat.getByText('Done — file deleted.')).toBeVisible()
  })

  test('deny shows the rejected state and does not execute the tool', async ({ page }) => {
    await setupToolApprovalMocks(page, {
      toolName: 'delete_file',
      preText: "I'll need approval before deleting.",
      // these would only appear if the tool ran — so seeing them in the chat
      // is the regression signal we want to guard against
      output: { deleted: true, path: '/tmp/foo' },
      postText: 'Done — file deleted.',
    })

    await page.goto('/')

    await page.getByPlaceholder('What would you like to know?').fill('please delete /tmp/foo')
    await page.getByPlaceholder('What would you like to know?').press('Enter')

    const chat = page.getByRole('log')

    await expect(chat.getByText('This tool requires your approval to run')).toBeVisible()
    await chat.getByRole('button', { name: 'Deny' }).click()

    await expect(chat.getByText('Denied. Tool will not run.')).toBeVisible()
    // Action buttons should be gone after responding
    await expect(chat.getByRole('button', { name: 'Approve' })).toHaveCount(0)
    await expect(chat.getByRole('button', { name: 'Deny' })).toHaveCount(0)
  })
})
