import { test, expect } from '@playwright/test'
import { sendMessage } from '../conversation'

test.describe('effort selector', () => {
  test('shows effort options in the dropdown', async ({ page }) => {
    await page.goto('/')
    await page
      .getByRole('combobox')
      .filter({ hasText: /^Effort:/ })
      .click()
    await expect(page.getByRole('option', { name: 'Effort: Minimal' })).toBeVisible()
    await expect(page.getByRole('option', { name: 'Effort: Low' })).toBeVisible()
    await expect(page.getByRole('option', { name: 'Effort: Medium' })).toBeVisible()
    await expect(page.getByRole('option', { name: 'Effort: High' })).toBeVisible()
    await expect(page.getByRole('option', { name: 'Effort: X-High' })).toBeVisible()
  })

  test('selected effort level is sent in the request body', async ({ page }) => {
    await page.goto('/')

    await page
      .getByRole('combobox')
      .filter({ hasText: /^Effort:/ })
      .click()
    await page.getByRole('option', { name: 'Effort: High' }).click()

    const requestPromise = page.waitForRequest('**/api/chat')
    await sendMessage(page, 'text', 'hello effort')
    const request = await requestPromise

    const body = request.postDataJSON() as Record<string, unknown>
    expect(body.effort).toBe('high')
    expect(body.model).toBeTruthy()

    await expect(page.getByText('Hello from the test server')).toBeVisible()
  })

  test('default effort is medium and is sent in the request body', async ({ page }) => {
    await page.goto('/')

    const requestPromise = page.waitForRequest('**/api/chat')
    await sendMessage(page, 'text', 'hello default effort')
    const request = await requestPromise

    const body = request.postDataJSON() as Record<string, unknown>
    expect(body.effort).toBe('medium')
    expect(body.model).toBeTruthy()

    await expect(page.getByText('Hello from the test server')).toBeVisible()
  })
})
