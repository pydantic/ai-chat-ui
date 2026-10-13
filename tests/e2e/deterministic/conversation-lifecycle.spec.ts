import { test, expect } from '@playwright/test'
import { chat, requestBody, sendMessage, waitForPersisted } from '../conversation'
import { conversationAction, sidebar } from '../sidebar'

test.describe('conversation lifecycle', () => {
  test('messages persist across page reload', async ({ page }) => {
    await page.goto('/')
    const firstRequestPromise = page.waitForRequest('**/api/chat')
    await sendMessage(page, 'text', 'Persist test')
    const firstRequest = await firstRequestPromise
    const conversationId = new URL(page.url()).pathname
    const firstBody = requestBody(firstRequest)
    await expect(chat(page).getByText('Hello from the test server')).toBeVisible()
    await waitForPersisted(page)

    await page.reload()
    await expect(chat(page).getByText('Persist test')).toBeVisible()
    await expect(chat(page).getByText('Hello from the test server')).toBeVisible()

    const resumedRequestPromise = page.waitForRequest('**/api/chat')
    await sendMessage(page, 'text', 'After reload')
    const resumedBody = requestBody(await resumedRequestPromise)
    expect(firstBody.id).toBe(conversationId)
    expect(resumedBody.id).toBe(conversationId)
    expect(JSON.stringify(resumedBody.messages)).toContain('Persist test')
  })

  test('switching conversations preserves messages', async ({ page }) => {
    await page.goto('/')
    const firstRequestPromise = page.waitForRequest('**/api/chat')
    await sendMessage(page, 'text', 'First conversation')
    const firstBody = requestBody(await firstRequestPromise)
    const firstConversationId = new URL(page.url()).pathname
    await expect(chat(page).getByText('Hello from the test server')).toBeVisible()
    await waitForPersisted(page)

    await sidebar(page).getByRole('link', { name: 'New conversation' }).click()
    const secondRequestPromise = page.waitForRequest('**/api/chat')
    await sendMessage(page, 'text', 'Second conversation')
    const secondBody = requestBody(await secondRequestPromise)
    const secondConversationId = new URL(page.url()).pathname
    await expect(chat(page).getByText('Hello from the test server')).toBeVisible()
    await waitForPersisted(page)

    await expect(sidebar(page).getByText('First conversation')).toBeVisible()
    await expect(sidebar(page).getByText('Second conversation')).toBeVisible()

    await sidebar(page).getByText('First conversation').click()
    await expect(chat(page).getByText('First conversation')).toBeVisible()
    await expect(chat(page).getByText('Hello from the test server')).toBeVisible()

    const reopenedRequestPromise = page.waitForRequest('**/api/chat')
    await sendMessage(page, 'text', 'Back in the first conversation')
    const reopenedBody = requestBody(await reopenedRequestPromise)
    expect(firstBody.id).toBe(firstConversationId)
    expect(secondBody.id).toBe(secondConversationId)
    expect(secondConversationId).not.toBe(firstConversationId)
    expect(reopenedBody.id).toBe(firstConversationId)
    expect(JSON.stringify(reopenedBody.messages)).toContain('First conversation')
  })

  test('deleting active conversation navigates home', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'text', 'Delete me')
    await expect(chat(page).getByText('Hello from the test server')).toBeVisible()

    await conversationAction(page, 'Delete me', 'Delete')

    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Delete' }).click()

    await expect(page.getByText('Chat deleted successfully')).toBeVisible()
    await expect(page).toHaveURL('/')
    await expect(sidebar(page).getByText('Delete me')).not.toBeVisible()
  })

  test('a deleted conversation stays deleted at its own URL', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'text', 'Delete me for good')
    await expect(chat(page).getByText('Hello from the test server')).toBeVisible()
    await waitForPersisted(page)
    const deletedUrl = page.url()

    await conversationAction(page, 'Delete me for good', 'Delete')
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByText('Chat deleted successfully')).toBeVisible()

    // Deleting the conversation you are looking at navigates away, and leaving a
    // conversation flushes what was on screen — so the flush landed after the
    // delete and wrote the history back. The row was gone from the sidebar while
    // the URL still served the whole conversation.
    await page.goto(deletedUrl)
    await expect(page.getByRole('heading', { name: 'How can I help?' })).toBeVisible()
    await expect(chat(page).getByText('Delete me for good')).toHaveCount(0)
  })

  test('deletion wins over a pending save from another tab', async ({ context, page }) => {
    await page.goto('/')
    await sendMessage(page, 'text', 'Delete across tabs')
    await expect(chat(page).getByText('Hello from the test server')).toBeVisible()
    await waitForPersisted(page)
    const deletedUrl = page.url()

    const otherPage = await context.newPage()
    await otherPage.goto(deletedUrl)
    await expect(chat(otherPage).getByText('Delete across tabs')).toBeVisible()

    // Queue a throttled write in another tab, then delete before its 500ms
    // delay expires. An in-memory tombstone exists only in the deleting tab;
    // without an IndexedDB-level guard, this write recreates the message record
    // after deletion and the supposedly deleted history remains at its URL.
    await sendMessage(otherPage, 'slow', 'Write after deletion')
    await expect(otherPage.getByRole('button', { name: 'Stop generating' })).toBeVisible()

    await conversationAction(page, 'Delete across tabs', 'Delete')
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByText('Chat deleted successfully')).toBeVisible()

    const saveAttempted = Date.now() + 1500
    await page.waitForFunction((until) => Date.now() >= until, saveAttempted)

    await page.goto(deletedUrl)
    await expect(page.getByRole('heading', { name: 'How can I help?' })).toBeVisible()
    await expect(chat(page).getByText('Delete across tabs')).toHaveCount(0)
    await expect(chat(page).getByText('Write after deletion')).toHaveCount(0)
  })

  test('Back does not reopen the conversation that was just deleted', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'text', 'Gone for good')
    await expect(chat(page).getByText('Hello from the test server')).toBeVisible()
    await waitForPersisted(page)

    await conversationAction(page, 'Gone for good', 'Delete')
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
    await expect(page).toHaveURL('/')

    // The delete used to push `/` on top of the conversation, leaving it one
    // Back press away — where it opened as an empty chat whose messages were
    // then dropped by the guard that keeps a deleted conversation deleted.
    await page.goBack()
    await expect(page).toHaveURL('/')
    await expect(page.getByRole('heading', { name: 'How can I help?' })).toBeVisible()
  })

  test('Enter on the freshly opened delete dialog does not delete', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'text', 'Spare me')
    await expect(chat(page).getByText('Hello from the test server')).toBeVisible()
    await waitForPersisted(page)

    await conversationAction(page, 'Spare me', 'Delete')

    // Focus opens on Cancel, and a dialog-wide Enter handler used to confirm
    // the delete regardless — so the opening keystroke destroyed the
    // conversation from the safe control.
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused()
    await page.keyboard.press('Enter')

    await expect(dialog).toBeHidden()
    await expect(page.getByText('Chat deleted successfully')).toHaveCount(0)
    await expect(sidebar(page).getByText('Spare me')).toBeVisible()
  })

  test('Enter confirms once focus is on Delete', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'text', 'Enter deletes me')
    await expect(chat(page).getByText('Hello from the test server')).toBeVisible()
    await waitForPersisted(page)

    await conversationAction(page, 'Enter deletes me', 'Delete')

    // Dropping the dialog-wide handler must not cost the keyboard path: Enter
    // still confirms, natively, on the button the user actually moved to.
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).focus()
    await page.keyboard.press('Enter')

    await expect(page.getByText('Chat deleted successfully')).toBeVisible()
    await expect(sidebar(page).getByText('Enter deletes me')).toHaveCount(0)
  })

  test('a URL with no conversation behind it becomes a real one when used', async ({ page }) => {
    // A bookmark to a chat cleared from this browser, or a mistyped id. It
    // opened as an empty chat and took messages, but nothing ever created an
    // entry for it: the conversation was stored under an id the sidebar had
    // never heard of and vanished as soon as it was navigated away from.
    await page.goto('/bookmarked-elsewhere')
    await expect(page.getByRole('heading', { name: 'How can I help?' })).toBeVisible()

    await sendMessage(page, 'text', 'Still worth keeping')
    await expect(chat(page).getByText('Hello from the test server')).toBeVisible()
    await waitForPersisted(page)

    await expect(sidebar(page).getByText('Still worth keeping')).toBeVisible()
    await expect(page).toHaveURL('/bookmarked-elsewhere')

    await sidebar(page).getByRole('link', { name: 'New conversation' }).click()
    await expect(sidebar(page).getByText('Still worth keeping')).toBeVisible()
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
    await conversationAction(page, 'Remove this', 'Delete')

    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Delete' }).click()

    await expect(page).toHaveURL(currentUrl)
    await expect(chat(page).getByText('Keep this')).toBeVisible()
    await expect(chat(page).getByText('Hello from the test server')).toBeVisible()
  })
})
