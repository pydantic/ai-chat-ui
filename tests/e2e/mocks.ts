import type { Page } from '@playwright/test'

const CONFIGURE_RESPONSE = {
  models: [
    {
      id: 'test-model',
      name: 'Test Model',
      builtinTools: ['web_search'],
    },
  ],
  builtinTools: [
    {
      name: 'Web Search',
      id: 'web_search',
    },
  ],
}

/**
 * Build an AI SDK v5 UI message stream response body (SSE format).
 *
 * Protocol: each event is `data: <json>\n\n`, terminated by `data: [DONE]\n\n`
 * Header: `X-Vercel-AI-UI-Message-Stream: v1`, `Content-Type: text/event-stream`
 *
 * Event types for text: text-start, text-delta, text-end
 */
function buildStreamBody(text: string, partId = 'aitxt_mock000000000000001'): string {
  const events = [
    `data: ${JSON.stringify({ type: 'text-start', id: partId })}`,
    `data: ${JSON.stringify({ type: 'text-delta', id: partId, delta: text })}`,
    `data: ${JSON.stringify({ type: 'text-end', id: partId })}`,
    'data: [DONE]',
  ]
  return events.join('\n\n') + '\n\n'
}

let chatCallCount = 0

export async function setupMocks(page: Page, responseText = 'This is a mock response from the assistant.') {
  chatCallCount = 0

  await page.route('**/api/configure', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(CONFIGURE_RESPONSE),
    }),
  )

  await page.route('**/api/chat', (route) => {
    chatCallCount++
    const partId = `aitxt_mock${String(chatCallCount).padStart(18, '0')}`
    return route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Vercel-AI-UI-Message-Stream': 'v1',
      },
      body: buildStreamBody(responseText, partId),
    })
  })
}

/**
 * Sets up mocks where each call to /api/chat returns a different response
 * from the provided array (cycling through them).
 */
export async function setupMocksWithResponses(page: Page, responses: string[]) {
  let callIndex = 0

  await page.route('**/api/configure', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(CONFIGURE_RESPONSE),
    }),
  )

  await page.route('**/api/chat', (route) => {
    const text = responses[callIndex % responses.length]
    callIndex++
    const partId = `aitxt_mock${String(callIndex).padStart(18, '0')}`
    return route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Vercel-AI-UI-Message-Stream': 'v1',
      },
      body: buildStreamBody(text, partId),
    })
  })
}
