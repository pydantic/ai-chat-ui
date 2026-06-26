import { test, expect } from '@playwright/test'
import { sendMessage } from '../conversation'
import { toolCard } from '../tools'

test.describe('large tool output', () => {
  test('renders large output via the lightweight pre path', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'large-output', 'Give me a large result')

    const card = toolCard(page, 'large_output')
    await expect(card.getByText('Completed')).toBeVisible()

    // The card's content is collapsed until the header is clicked. The output
    // exceeds ToolOutputCode's 20k threshold, so it renders inside a plain
    // <pre> instead of being Prism-highlighted. The marker proves the large
    // payload rendered without hanging.
    await card.getByRole('button', { name: /large_output/ }).click()

    await expect(card.getByText('large_result_marker').first()).toBeVisible()
  })
})
