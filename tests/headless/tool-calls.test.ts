import { describe, it, expect } from 'vitest'
import { TestChat, getServerPort, resolveModelId } from '../chat-client'
import { isToolUIPart, isTextUIPart, type UIMessage } from 'ai'

function extractToolName(part: UIMessage['parts'][number]): string {
  if ('toolName' in part) return part.toolName
  return part.type.slice(5) // Remove 'tool-' prefix
}

describe('tool calls', () => {
  it('executes a single tool call', async () => {
    const port = getServerPort()
    const model = await resolveModelId(port, 'tool')
    const chat = new TestChat(port)
    await chat.sendMessage({ text: 'what is the weather?' }, { body: { model } })

    const assistant = chat.messages.find((m) => m.role === 'assistant')
    expect(assistant).toBeDefined()

    const toolParts = assistant!.parts.filter(isToolUIPart)
    expect(toolParts.length).toBeGreaterThanOrEqual(1)

    expect(extractToolName(toolParts[0])).toBe('get_weather')
    expect(toolParts[0].state).toBe('output-available')
  })

  it('executes multiple parallel tool calls', async () => {
    const port = getServerPort()
    const model = await resolveModelId(port, 'multi-tool')
    const chat = new TestChat(port)
    await chat.sendMessage({ text: 'weather and calc' }, { body: { model } })

    const assistant = chat.messages.find((m) => m.role === 'assistant')
    expect(assistant).toBeDefined()

    const toolParts = assistant!.parts.filter(isToolUIPart)
    expect(toolParts.length).toBeGreaterThanOrEqual(2)

    const toolNames = toolParts.map(extractToolName)
    expect(toolNames).toContain('get_weather')
    expect(toolNames).toContain('calculate')
  })

  it('includes tool input parameters', async () => {
    const port = getServerPort()
    const model = await resolveModelId(port, 'tool')
    const chat = new TestChat(port)
    await chat.sendMessage({ text: 'weather' }, { body: { model } })

    const assistant = chat.messages.find((m) => m.role === 'assistant')
    expect(assistant).toBeDefined()
    const toolParts = assistant!.parts.filter(isToolUIPart)
    expect(toolParts[0].input).toEqual({ city: 'San Francisco' })
  })

  it('includes final text response after tool execution', async () => {
    const port = getServerPort()
    const model = await resolveModelId(port, 'tool')
    const chat = new TestChat(port)
    await chat.sendMessage({ text: 'weather' }, { body: { model } })

    const assistant = chat.messages.find((m) => m.role === 'assistant')
    expect(assistant).toBeDefined()
    const textParts = assistant!.parts.filter(isTextUIPart)
    expect(textParts.length).toBeGreaterThanOrEqual(1)
    expect(textParts.some((p) => p.text.includes('Tool result'))).toBe(true)
  })

  it('handles tool error with output-error state', async () => {
    const port = getServerPort()
    const model = await resolveModelId(port, 'error')
    const chat = new TestChat(port)
    await chat.sendMessage({ text: 'weather' }, { body: { model } })

    const assistant = chat.messages.find((m) => m.role === 'assistant')
    expect(assistant).toBeDefined()

    const toolParts = assistant!.parts.filter(isToolUIPart)
    expect(toolParts.length).toBeGreaterThanOrEqual(1)
    expect(extractToolName(toolParts[0])).toBe('get_weather')
    expect(toolParts[0].state).toBe('output-error')

    const textParts = assistant!.parts.filter(isTextUIPart)
    expect(textParts.length).toBeGreaterThanOrEqual(1)
    expect(textParts.some((p) => p.text.includes('The tool encountered an error'))).toBe(true)
  })
})
