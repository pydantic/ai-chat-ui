import { test, expect } from '@playwright/test'
import { chat, requestBody, sendMessage, waitForPersisted } from '../conversation'
import { sidebar } from '../sidebar'

test.describe('switching conversations mid-run', () => {
  test('a reply in flight does not follow the user into another conversation', async ({ page }) => {
    await page.goto('/')
    const firstRequestPromise = page.waitForRequest('**/api/chat')
    await sendMessage(page, 'text', 'Conversation one')
    const firstBody = requestBody(await firstRequestPromise)
    const firstConversationId = new URL(page.url()).pathname
    await expect(chat(page).getByText('Hello from the test server')).toBeVisible()
    await waitForPersisted(page)

    // Start a slow run, then leave before it finishes.
    const slowRequestPromise = page.waitForRequest('**/api/chat')
    await sendMessage(page, 'slow', 'Take your time')
    const slowBody = requestBody(await slowRequestPromise)
    await expect(page.getByRole('button', { name: 'Stop generating' })).toBeVisible()
    await sidebar(page).getByRole('link', { name: 'New conversation' }).click()

    // The abandoned run must not stream into the new chat, nor be persisted there.
    await expect(page.getByRole('heading', { name: 'How can I help?' })).toBeVisible()
    await expect(page.getByText('Taking my time here.')).toBeHidden({ timeout: 15_000 })

    const destinationRequestPromise = page.waitForRequest('**/api/chat')
    await sendMessage(page, 'text', 'Conversation two')
    const destinationBody = requestBody(await destinationRequestPromise)
    const destinationConversationId = new URL(page.url()).pathname
    await expect(chat(page).getByText('Hello from the test server')).toBeVisible()
    await expect(chat(page).getByText('Taking my time')).toBeHidden()
    expect(firstBody.id).toBe(firstConversationId)
    expect(slowBody.id).toBe(firstConversationId)
    expect(destinationBody.id).toBe(destinationConversationId)
    expect(destinationConversationId).not.toBe(firstConversationId)
    expect(JSON.stringify(destinationBody.messages)).not.toContain('Take your time')
  })

  test('a reply already on screen does not follow the user into the next chat', async ({ page }) => {
    await page.goto('/')
    const firstRequestPromise = page.waitForRequest('**/api/chat')
    await sendMessage(page, 'text', 'Conversation one')
    const firstBody = requestBody(await firstRequestPromise)
    const firstConversationId = new URL(page.url()).pathname
    await expect(chat(page).getByText('Hello from the test server')).toBeVisible()
    await waitForPersisted(page)

    // `reasoning` says something straight away and keeps going, so the assistant
    // turn is already in the message list — with more chunks queued behind the
    // abort — at the moment the user leaves. `slow` sleeps a full second before
    // its first chunk, so it never reaches that state, and the abandoned-run
    // path it exercises is only the easy half.
    const reasoningRequestPromise = page.waitForRequest('**/api/chat')
    await sendMessage(page, 'reasoning', 'Think it over')
    const reasoningBody = requestBody(await reasoningRequestPromise)
    await expect(page.getByText('Understanding the question')).toBeVisible()
    await sidebar(page).getByRole('link', { name: 'New conversation' }).click()
    await expect(page.getByRole('heading', { name: 'How can I help?' })).toBeVisible()

    // Wait the abandoned stream out rather than sampling while it is still
    // arriving: a `toBeHidden` taken a frame after the click resolves on its
    // first poll and passes on any build. `stream_reasoning` runs ~1.6s.
    const drained = Date.now() + 3000
    await page.waitForFunction((until) => Date.now() >= until, drained)

    await expect(page.getByText('Here is the considered answer.')).toBeHidden()
    await expect(page.getByRole('heading', { name: 'How can I help?' })).toBeVisible()

    // A turn that is not on screen can still be in the list the next request is
    // built from, which is how an abandoned reply reaches the backend as history.
    const requestPromise = page.waitForRequest('**/api/chat')
    await sendMessage(page, 'text', 'Conversation two')
    const body = requestBody(await requestPromise)
    const destinationConversationId = new URL(page.url()).pathname
    await expect(chat(page).getByText('Hello from the test server')).toBeVisible()
    expect(firstBody.id).toBe(firstConversationId)
    expect(reasoningBody.id).toBe(firstConversationId)
    expect(body.id).toBe(destinationConversationId)
    expect(destinationConversationId).not.toBe(firstConversationId)
    expect(JSON.stringify(body.messages)).not.toContain('Understanding the question')
  })

  test('leaving a conversation keeps its history under its own id', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'text', 'Keeper')
    await expect(chat(page).getByText('Hello from the test server')).toBeVisible()
    await waitForPersisted(page)
    const keeperUrl = page.url()

    await sidebar(page).getByRole('link', { name: 'New conversation' }).click()
    await sendMessage(page, 'text', 'Second thread')
    await expect(chat(page).getByText('Hello from the test server')).toBeVisible()
    await waitForPersisted(page)

    // The throttled save lags the switch; it must not attribute one
    // conversation's messages to the other.
    await page.goto(keeperUrl)
    await expect(chat(page).getByText('Keeper')).toBeVisible()
    await expect(chat(page).getByText('Second thread')).toBeHidden()
  })
})
