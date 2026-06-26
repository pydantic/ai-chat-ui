import { test, expect } from '@playwright/test'
import { sendMessage } from '../conversation'
import { toolCard } from '../tools'

test.describe('multi-tool', () => {
  test('shows completed status for both tools', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'multi-tool', 'Do both')
    const weatherCard = toolCard(page, 'get_weather')
    const calculateCard = toolCard(page, 'calculate')
    await expect(weatherCard.getByText('Completed')).toBeVisible()
    await expect(calculateCard.getByText('Completed')).toBeVisible()
  })

  test('shows tool results and final text', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'multi-tool', 'Do both')
    const weatherCard = toolCard(page, 'get_weather')
    const calculateCard = toolCard(page, 'calculate')
    await expect(weatherCard.getByText('Completed')).toBeVisible()
    await expect(calculateCard.getByText('Completed')).toBeVisible()

    // Tool cards open in `output-available` only when the user clicks the
    // header. CodeBlock-rendered output may split text across multiple token
    // spans, so we anchor the visibility check with `.first()`.
    await weatherCard.getByRole('button', { name: /get_weather/ }).click()
    await expect(weatherCard.getByText('Weather in San Francisco: Sunny, 72°F').first()).toBeVisible()

    await calculateCard.getByRole('button', { name: /calculate/ }).click()
    await expect(calculateCard.getByText('Result: 42').first()).toBeVisible()

    await expect(page.getByText('All tools completed successfully.')).toBeVisible()
  })
})
