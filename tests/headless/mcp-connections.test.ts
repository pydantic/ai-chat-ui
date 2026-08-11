import { describe, expect, it } from 'vitest'

import { getServerPort } from '../chat-client'

type McpConnections = string | string[]

async function postChat(mcpConnections: McpConnections, extra: Record<string, boolean> = {}) {
  const port = getServerPort()
  return fetch(`http://127.0.0.1:${port}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 'mcp-connection-contract',
      trigger: 'submit-message',
      messages: [{ id: 'message-1', role: 'user', parts: [{ type: 'text', text: 'hello' }] }],
      mcpConnections,
      ...extra,
    }),
  })
}

describe('MCP connection request contract', () => {
  it('rejects a malformed connection selection', async () => {
    const response = await postChat('test-mcp')

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'mcpConnections must be a list of connection IDs' })
  })

  it('rejects an unknown connection ID', async () => {
    const response = await postChat(['unknown-mcp'])

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: "Unknown MCP connection(s): ['unknown-mcp']" })
  })

  it('ignores unrelated request extras', async () => {
    const response = await postChat([], { futureSdkOption: true })

    expect(response.ok).toBe(true)
  })
})
