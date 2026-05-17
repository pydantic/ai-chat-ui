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

const STREAM_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
  'X-Vercel-AI-UI-Message-Stream': 'v1',
}

function encodeStream(events: object[]): string {
  return events.map((e) => `data: ${JSON.stringify(e)}`).join('\n\n') + '\n\ndata: [DONE]\n\n'
}

/**
 * AI SDK v6 stream that asks the user to approve a tool call.
 * Emits: optional text → tool-input-available → tool-approval-request.
 * The UI should render the Confirmation prompt for the named tool.
 */
function buildToolApprovalRequestStream(opts: {
  toolName: string
  toolCallId: string
  approvalId: string
  preText?: string
  input?: unknown
}): string {
  const events: object[] = []
  if (opts.preText) {
    const textId = 'aitxt_pre_0000000000000001'
    events.push({ type: 'text-start', id: textId })
    events.push({ type: 'text-delta', id: textId, delta: opts.preText })
    events.push({ type: 'text-end', id: textId })
  }
  events.push({
    type: 'tool-input-available',
    toolCallId: opts.toolCallId,
    toolName: opts.toolName,
    input: opts.input ?? {},
  })
  events.push({
    type: 'tool-approval-request',
    approvalId: opts.approvalId,
    toolCallId: opts.toolCallId,
  })
  return encodeStream(events)
}

/**
 * Followup stream sent after the user approves the tool. Carries the tool
 * result and an optional assistant message confirming completion.
 */
function buildToolOutputStream(opts: { toolCallId: string; output: unknown; postText?: string }): string {
  const events: object[] = [
    {
      type: 'tool-output-available',
      toolCallId: opts.toolCallId,
      output: opts.output,
    },
  ]
  if (opts.postText) {
    const textId = 'aitxt_post_0000000000000001'
    events.push({ type: 'text-start', id: textId })
    events.push({ type: 'text-delta', id: textId, delta: opts.postText })
    events.push({ type: 'text-end', id: textId })
  }
  return encodeStream(events)
}

/**
 * Sets up mocks for the v6 tool-approval flow.
 *
 * Call sequence:
 *   1. First POST /api/chat → approval-request stream
 *   2. User clicks Approve or Deny; SDK auto-sends a follow-up POST
 *   3. Second POST /api/chat → tool-output stream (approve) or empty
 *      completion stream (deny, since the tool never ran)
 */
export async function setupToolApprovalMocks(
  page: Page,
  opts: {
    toolName: string
    preText?: string
    output: unknown
    postText?: string
  },
) {
  const toolCallId = 'call_approval_001'
  const approvalId = 'appr_001'
  let chatCallCount = 0

  await page.route('**/api/configure', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(CONFIGURE_RESPONSE),
    }),
  )

  await page.route('**/api/chat', (route) => {
    chatCallCount++
    if (chatCallCount === 1) {
      return route.fulfill({
        status: 200,
        headers: STREAM_HEADERS,
        body: buildToolApprovalRequestStream({
          toolName: opts.toolName,
          toolCallId,
          approvalId,
          preText: opts.preText,
        }),
      })
    }
    return route.fulfill({
      status: 200,
      headers: STREAM_HEADERS,
      body: buildToolOutputStream({ toolCallId, output: opts.output, postText: opts.postText }),
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
