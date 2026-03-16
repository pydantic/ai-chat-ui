import { test, expect } from '@playwright/test'
import { chat, sendMessage, waitForPersisted } from '../conversation'
import { sidebar } from '../sidebar'

test.describe('conversation lifecycle', () => {
  test('messages persist across page reload', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'text', 'Persist test')
    await expect(chat(page).getByText('Hello from the test server')).toBeVisible()
    await waitForPersisted(page)

    await page.reload()
    await expect(chat(page).getByText('Persist test')).toBeVisible()
    await expect(chat(page).getByText('Hello from the test server')).toBeVisible()
  })

  test('switching conversations preserves messages', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'text', 'First conversation')
    await expect(chat(page).getByText('Hello from the test server')).toBeVisible()
    await waitForPersisted(page)

    await sidebar(page).getByRole('link', { name: 'New conversation' }).click()
    await sendMessage(page, 'text', 'Second conversation')
    await expect(chat(page).getByText('Hello from the test server')).toBeVisible()
    await waitForPersisted(page)

    await expect(sidebar(page).getByText('First conversation')).toBeVisible()
    await expect(sidebar(page).getByText('Second conversation')).toBeVisible()

    await sidebar(page).getByText('First conversation').click()
    await expect(chat(page).getByText('First conversation')).toBeVisible()
    await expect(chat(page).getByText('Hello from the test server')).toBeVisible()
  })

  test('deleting active conversation navigates home', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'text', 'Delete me')
    await expect(chat(page).getByText('Hello from the test server')).toBeVisible()

    const entry = sidebar(page).locator('.group\\/sidebar-menu-item', { hasText: 'Delete me' })
    await entry.getByRole('button').click({ force: true })

    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Delete' }).click()

    await expect(page.getByText('Chat deleted successfully')).toBeVisible()
    await expect(page).toHaveURL('/')
    await expect(sidebar(page).getByText('Delete me')).not.toBeVisible()
  })

  test('deleting inactive conversation preserves current view', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'text', 'Keep this')
    await expect(chat(page).getByText('Hello from the test server')).toBeVisible()
    await waitForPersisted(page)

    await sidebar(page).getByRole('link', { name: 'New conversation' }).click()
    await sendMessage(page, 'text', 'Remove this')
    await expect(chat(page).getByText('Hello from the test server')).toBeVisible()

    await sidebar(page).getByText('Keep this').click()
    await expect(chat(page).getByText('Keep this')).toBeVisible()

    const currentUrl = page.url()
    const entry = sidebar(page).locator('.group\\/sidebar-menu-item', { hasText: 'Remove this' })
    await entry.getByRole('button').click({ force: true })

    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Delete' }).click()

    await expect(page).toHaveURL(currentUrl)
    await expect(chat(page).getByText('Keep this')).toBeVisible()
    await expect(chat(page).getByText('Hello from the test server')).toBeVisible()
  })
})
