import type { Page } from '@playwright/test'

const CONFIG_RESPONSE = {
  models: [{ id: 'test-model', name: 'Test Model', builtinTools: [] }],
  builtinTools: [],
}

/**
 * Creates a properly formatted AI SDK UI Message Stream (SSE) response body.
 * Format: data: {json}\n\n per chunk, ending with data: [DONE]\n\n
 */
function createStreamBody(text: string): string {
  const textId = 'text-' + Math.random().toString(36).slice(2, 10)
  const chunks = [
    { type: 'start', messageId: 'msg-test-response' },
    { type: 'text-start', id: textId },
    { type: 'text-delta', id: textId, delta: text },
    { type: 'text-end', id: textId },
    { type: 'finish', finishReason: 'stop', usage: { promptTokens: 10, completionTokens: 5 } },
  ]
  const sseLines = chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`)
  return sseLines.join('') + 'data: [DONE]\n\n'
}

export async function setupMocks(page: Page, responseText = 'Hello from the assistant!') {
  await page.route('/api/configure', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(CONFIG_RESPONSE),
    }),
  )

  await page.route('/api/chat', (route) =>
    route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Vercel-AI-UI-Message-Stream': 'v1',
      },
      body: createStreamBody(responseText),
    }),
  )
}

/**
 * Sets up mocks where each call to /api/chat returns a different response
 * from the provided array (cycling through them).
 */
export async function setupMocksWithResponses(page: Page, responses: string[]) {
  let callIndex = 0

  await page.route('/api/configure', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(CONFIG_RESPONSE),
    }),
  )

  await page.route('/api/chat', (route) => {
    const text = responses[callIndex % responses.length]
    callIndex++
    return route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Vercel-AI-UI-Message-Stream': 'v1',
      },
      body: createStreamBody(text),
    })
  })
}
