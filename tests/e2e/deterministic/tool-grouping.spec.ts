import { test, expect } from '@playwright/test'
import { sendMessage } from '../conversation'
import { toolCard } from '../tools'

test.describe('tool-call grouping', () => {
  test('collapses repeated same-tool calls into one group, then expands', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'repeated-tool', 'weather everywhere')

    // The three get_weather calls collapse into a single group line showing the
    // tool name and an x3 count; no individual cards are visible yet.
    const group = page.locator('[data-slot="tool-call-group"]')
    await expect(group).toBeVisible()
    await expect(group).toContainText('get_weather')
    await expect(group).toContainText('x3')
    await expect(toolCard(page, 'get_weather')).toHaveCount(0)

    // Expanding reveals the three individual get_weather cards inline.
    await group.getByRole('button', { name: /get_weather/ }).click()
    await expect(toolCard(page, 'get_weather')).toHaveCount(3)
  })
})
