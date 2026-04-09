import { test, expect, type Page } from '@playwright/test'
import { setupMocks, setupMocksWithResponses } from './mocks'

/** Scope selectors to the chat area (avoids matching sidebar text) */
function chatArea(page: Page) {
  return page.getByRole('log')
}

async function sendMessage(page: Page, text: string) {
  const textarea = page.getByRole('textbox')
  await textarea.fill(text)
  await textarea.press('Enter')
  // Wait for assistant response to appear
  await expect(chatArea(page).getByText('This is a mock response from the assistant.')).toBeVisible({ timeout: 5000 })
}

test.describe('edit user message', () => {
  test('shows edit icon on user message hover', async ({ page }) => {
    await setupMocks(page)
    await page.goto('/')
    await sendMessage(page, 'Original message')

    // Hover over the user message in the chat area
    await chatArea(page).getByText('Original message').hover()

    // Edit button should become visible
    await expect(page.getByRole('button', { name: 'Edit message' })).toBeVisible()
  })

  test('clicking edit shows inline textarea with message text', async ({ page }) => {
    await setupMocks(page)
    await page.goto('/')
    await sendMessage(page, 'Original message')

    // Click edit
    await chatArea(page).getByText('Original message').hover()
    await page.getByRole('button', { name: 'Edit message' }).click()

    // Textarea should appear with original text
    const editTextarea = chatArea(page).locator('textarea')
    await expect(editTextarea).toBeVisible()
    await expect(editTextarea).toHaveValue('Original message')

    // Submit and cancel buttons should be visible
    await expect(page.getByRole('button', { name: 'Submit edit' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cancel edit' })).toBeVisible()
  })

  test('cancel edit preserves draft and restores on re-edit', async ({ page }) => {
    await setupMocks(page)
    await page.goto('/')
    await sendMessage(page, 'Original message')

    // Start editing
    await chatArea(page).getByText('Original message').hover()
    await page.getByRole('button', { name: 'Edit message' }).click()

    // Modify the text
    const editTextarea = chatArea(page).locator('textarea')
    await editTextarea.clear()
    await editTextarea.fill('Modified text')

    // Cancel
    await page.getByRole('button', { name: 'Cancel edit' }).click()

    // Original message should be visible again
    await expect(chatArea(page).getByText('Original message')).toBeVisible()

    // Re-edit: draft should be restored
    await chatArea(page).getByText('Original message').hover()
    await page.getByRole('button', { name: 'Edit message' }).click()

    await expect(chatArea(page).locator('textarea')).toHaveValue('Modified text')
  })

  test('escape key cancels edit', async ({ page }) => {
    await setupMocks(page)
    await page.goto('/')
    await sendMessage(page, 'Original message')

    // Start editing
    await chatArea(page).getByText('Original message').hover()
    await page.getByRole('button', { name: 'Edit message' }).click()

    // Press Escape
    const editTextarea = chatArea(page).locator('textarea')
    await editTextarea.press('Escape')

    // Should be back to view mode
    await expect(chatArea(page).getByText('Original message')).toBeVisible()
    await expect(editTextarea).not.toBeVisible()
  })

  test('submitting edit opens modify/fork dialog', async ({ page }) => {
    await setupMocks(page)
    await page.goto('/')
    await sendMessage(page, 'Original message')

    // Start editing
    await chatArea(page).getByText('Original message').hover()
    await page.getByRole('button', { name: 'Edit message' }).click()

    // Modify and submit
    const editTextarea = chatArea(page).locator('textarea')
    await editTextarea.clear()
    await editTextarea.fill('Edited message')
    await page.getByRole('button', { name: 'Submit edit' }).click()

    // Dialog should appear
    await expect(page.getByRole('dialog').getByText('Edit message')).toBeVisible()
    await expect(page.getByText('Update conversation')).toBeVisible()
    await expect(page.getByText('Fork conversation')).toBeVisible()
  })

  test('enter key submits edit and opens dialog', async ({ page }) => {
    await setupMocks(page)
    await page.goto('/')
    await sendMessage(page, 'Original message')

    // Start editing
    await chatArea(page).getByText('Original message').hover()
    await page.getByRole('button', { name: 'Edit message' }).click()

    // Type new text and press Enter
    const editTextarea = chatArea(page).locator('textarea')
    await editTextarea.clear()
    await editTextarea.fill('Edited message')
    await editTextarea.press('Enter')

    // Dialog should appear
    await expect(page.getByText('Update conversation')).toBeVisible()
    await expect(page.getByText('Fork conversation')).toBeVisible()
  })
})

test.describe('modify conversation', () => {
  test('update conversation truncates and resends', async ({ page }) => {
    await setupMocksWithResponses(page, ['First response', 'Second response'])
    await page.goto('/')

    // Send initial message
    const textarea = page.getByRole('textbox')
    await textarea.fill('First message')
    await textarea.press('Enter')
    await expect(chatArea(page).getByText('First response')).toBeVisible({ timeout: 5000 })

    // Edit the message
    await chatArea(page).getByText('First message').hover()
    await page.getByRole('button', { name: 'Edit message' }).click()

    const editTextarea = chatArea(page).locator('textarea')
    await editTextarea.clear()
    await editTextarea.fill('Edited message')
    await page.getByRole('button', { name: 'Submit edit' }).click()

    // Click "Update conversation"
    await page.getByText('Update conversation').click()

    // Should see the edited message and a new response
    await expect(chatArea(page).getByText('Edited message')).toBeVisible({ timeout: 5000 })
    await expect(chatArea(page).getByText('Second response')).toBeVisible({ timeout: 5000 })

    // Original message and response should be gone
    await expect(chatArea(page).getByText('First message')).not.toBeVisible()
    await expect(chatArea(page).getByText('First response')).not.toBeVisible()
  })
})

test.describe('fork conversation', () => {
  test('fork creates a new conversation and navigates to it', async ({ page }) => {
    await setupMocksWithResponses(page, ['First response', 'Forked response'])
    await page.goto('/')

    // Send initial message
    const textarea = page.getByRole('textbox')
    await textarea.fill('First message')
    await textarea.press('Enter')
    await expect(chatArea(page).getByText('First response')).toBeVisible({ timeout: 5000 })

    // Remember the original URL
    const originalUrl = page.url()

    // Edit and fork
    await chatArea(page).getByText('First message').hover()
    await page.getByRole('button', { name: 'Edit message' }).click()

    const editTextarea = chatArea(page).locator('textarea')
    await editTextarea.clear()
    await editTextarea.fill('Forked message')
    await page.getByRole('button', { name: 'Submit edit' }).click()

    await page.getByText('Fork conversation').click()

    // URL should change (new conversation)
    await expect(page).not.toHaveURL(originalUrl)

    // Should see the forked message and new response
    await expect(chatArea(page).getByText('Forked message')).toBeVisible({ timeout: 5000 })
    await expect(chatArea(page).getByText('Forked response')).toBeVisible({ timeout: 5000 })
  })

  test('forked conversation appears in sidebar', async ({ page }) => {
    await setupMocksWithResponses(page, ['First response', 'Forked response'])
    await page.goto('/')

    // Send initial message
    const textarea = page.getByRole('textbox')
    await textarea.fill('Hello world test message')
    await textarea.press('Enter')
    await expect(chatArea(page).getByText('First response')).toBeVisible({ timeout: 5000 })

    // Edit and fork
    await chatArea(page).getByText('Hello world test message').hover()
    await page.getByRole('button', { name: 'Edit message' }).click()

    const editTextarea = chatArea(page).locator('textarea')
    await editTextarea.clear()
    await editTextarea.fill('Forked version')
    await page.getByRole('button', { name: 'Submit edit' }).click()

    await page.getByText('Fork conversation').click()
    await expect(chatArea(page).getByText('Forked response')).toBeVisible({ timeout: 5000 })

    // Sidebar should show both conversations
    const sidebar = page.locator('[data-sidebar="sidebar"]')
    const sidebarItems = sidebar.locator('[data-sidebar="menu-button"]')
    // "New conversation" + original + fork = 3
    await expect(sidebarItems).toHaveCount(3, { timeout: 5000 })
  })
})

test.describe('assistant message actions', () => {
  test('assistant messages have retry and copy buttons', async ({ page }) => {
    await setupMocks(page)
    await page.goto('/')
    await sendMessage(page, 'Test message')

    await expect(page.getByRole('button', { name: 'Copy' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible()
  })
})
