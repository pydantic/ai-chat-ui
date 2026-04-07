import { test, expect } from '@playwright/test'
import { setupMocks } from './mocks'

const sidebar = '[data-sidebar="sidebar"]'

test.beforeEach(async ({ page }) => {
  await setupMocks(page)
})

test.describe('chat', () => {
  test('app loads with sidebar and chat input', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByText('New conversation')).toBeVisible()
    await expect(page.getByPlaceholder('What would you like to know?')).toBeVisible()
  })

  test('sends a message and sees assistant response', async ({ page }) => {
    await page.goto('/')

    const input = page.getByPlaceholder('What would you like to know?')
    await input.fill('Hello there')
    await input.press('Enter')

    const chat = page.getByRole('log')
    await expect(chat.getByText('Hello there')).toBeVisible()
    await expect(chat.getByText('This is a mock response from the assistant.')).toBeVisible()
  })

  test('conversation appears in sidebar after sending', async ({ page }) => {
    await page.goto('/')

    const input = page.getByPlaceholder('What would you like to know?')
    await input.fill('My sidebar test message')
    await input.press('Enter')

    await expect(page.getByRole('log').getByText('This is a mock response from the assistant.')).toBeVisible()

    // Sidebar should show the conversation entry with truncated first message
    await expect(page.locator(sidebar).getByText('My sidebar test message')).toBeVisible()
  })

  test('navigates between conversations', async ({ page }) => {
    await page.goto('/')

    // Send message in conversation A
    const input = page.getByPlaceholder('What would you like to know?')
    await input.fill('Conversation A message')
    await input.press('Enter')
    await expect(page.getByRole('log').getByText('This is a mock response from the assistant.')).toBeVisible()

    // Wait for throttled save (useThrottle 500ms) to flush to IndexedDB
    await page.waitForTimeout(600)

    // Start conversation B
    await page.locator(sidebar).getByText('New conversation').click()
    await expect(page.getByPlaceholder('What would you like to know?')).toBeVisible()

    await page.getByPlaceholder('What would you like to know?').fill('Conversation B message')
    await page.getByPlaceholder('What would you like to know?').press('Enter')
    await expect(page.getByRole('log').getByText('Conversation B message')).toBeVisible()

    // Navigate back to conversation A via sidebar
    await page.locator(sidebar).getByText('Conversation A message').click()

    // Conversation A messages should reload from IndexedDB
    await expect(page.getByRole('log').getByText('Conversation A message')).toBeVisible()
  })

  test('messages persist after hard refresh', async ({ page }) => {
    await page.goto('/')

    const input = page.getByPlaceholder('What would you like to know?')
    await input.fill('Persistence test message')
    await input.press('Enter')

    await expect(page.getByRole('log').getByText('This is a mock response from the assistant.')).toBeVisible()

    // Wait for throttled save (500ms) to complete
    await page.waitForTimeout(600)

    // Hard refresh
    await page.reload()

    // Re-apply mocks after reload (route handlers are cleared on navigation)
    await setupMocks(page)

    // Messages should load back from IndexedDB
    await expect(page.getByRole('log').getByText('Persistence test message')).toBeVisible()
    await expect(page.getByRole('log').getByText('This is a mock response from the assistant.')).toBeVisible()
  })
})
