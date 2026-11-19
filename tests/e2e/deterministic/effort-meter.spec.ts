import { test, expect } from '@playwright/test'
import { requestBody, sendMessage } from '../conversation'

test.describe('effort meter', () => {
  test('shows every effort level with what it means', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /Thinking effort/ }).click()

    await expect(page.getByRole('radio', { name: /Minimal/ })).toBeVisible()
    await expect(page.getByRole('radio', { name: /Low/ })).toBeVisible()
    await expect(page.getByRole('radio', { name: /Medium/ })).toBeVisible()
    await expect(page.getByRole('radio', { name: /High/, exact: false }).first()).toBeVisible()
    await expect(page.getByRole('radio', { name: /X-High/ })).toBeVisible()
    await expect(page.getByRole('radio', { name: /Max/ })).toBeVisible()

    // The level is described, not just named.
    await expect(page.getByText('Think it through at length')).toBeVisible()
  })

  test('selected effort level is sent in the request body', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: /Thinking effort/ }).click()
    await page.getByRole('radio', { name: /^High/ }).click()
    await expect(page.getByRole('button', { name: 'Thinking effort: High' })).toBeVisible()

    const requestPromise = page.waitForRequest('**/api/chat')
    await sendMessage(page, 'text', 'hello effort')
    const request = await requestPromise

    const body = requestBody(request)
    expect(body.effort).toBe('high')
    expect(body.model).toBeTruthy()

    await expect(page.getByText('Hello from the test server')).toBeVisible()
  })

  test('default effort is medium and is sent in the request body', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Thinking effort: Medium' })).toBeVisible()

    const requestPromise = page.waitForRequest('**/api/chat')
    await sendMessage(page, 'text', 'hello default effort')
    const request = await requestPromise

    const body = requestBody(request)
    expect(body.effort).toBe('medium')
    expect(body.model).toBeTruthy()

    await expect(page.getByText('Hello from the test server')).toBeVisible()
  })
})
