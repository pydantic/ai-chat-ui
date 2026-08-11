import { test, expect } from '@playwright/test'

import { sendMessage } from '../conversation'

test.describe('MCP connections', () => {
  test('sends only a selected server-provided connection ID', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: 'MCP connections' }).click()
    await page.getByText('Test MCP', { exact: true }).click()

    const requestPromise = page.waitForRequest('**/api/chat')
    await sendMessage(page, 'text', 'use the MCP connection')
    const request = await requestPromise

    const body: unknown = request.postDataJSON()
    expect(body).toEqual(expect.objectContaining({ mcpConnections: ['test-mcp'] }))
    expect(body).not.toHaveProperty('mcpHeaders')
    expect(body).not.toHaveProperty('mcpAuth')

    await expect(page.getByText('Hello from the test server')).toBeVisible()
    await expect(page.getByRole('button', { name: 'MCP connections' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('does not retain selected connections after reload', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'MCP connections' }).click()
    await page.getByText('Test MCP', { exact: true }).click()

    await page.reload()
    await page.getByRole('button', { name: 'MCP connections' }).click()

    await expect(page.getByRole('switch', { name: 'Use Test MCP' })).not.toBeChecked()
  })
})
