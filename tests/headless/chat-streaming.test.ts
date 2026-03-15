import { describe, it, expect } from 'vitest'
import { TestChat, getServerPort, resolveModelId } from '../chat-client'
import { isTextUIPart } from 'ai'

describe('chat streaming', () => {
  it('receives a text response', async () => {
    const port = getServerPort()
    const model = await resolveModelId(port, 'text')
    const chat = new TestChat(port)
    await chat.sendMessage({ text: 'hello' }, { body: { model } })

    expect(chat.messages).toHaveLength(2) // user + assistant
    expect(chat.messages[0].role).toBe('user')
    expect(chat.messages[1].role).toBe('assistant')

    const assistantParts = chat.messages[1].parts.filter(isTextUIPart)
    expect(assistantParts.length).toBeGreaterThanOrEqual(1)
    expect(assistantParts.some((p) => p.text.includes('Hello from the test server'))).toBe(true)
  })

  it('returns to ready status after completion', async () => {
    const port = getServerPort()
    const model = await resolveModelId(port, 'text')
    const chat = new TestChat(port)

    expect(chat.status).toBe('ready')
    await chat.sendMessage({ text: 'hello' }, { body: { model } })
    expect(chat.status).toBe('ready')
  })

  it('handles multiple sequential messages', async () => {
    const port = getServerPort()
    const model = await resolveModelId(port, 'text')
    const chat = new TestChat(port)

    await chat.sendMessage({ text: 'first' }, { body: { model } })
    await chat.sendMessage({ text: 'second' }, { body: { model } })

    expect(chat.messages).toHaveLength(4)
    expect(chat.messages[0].role).toBe('user')
    expect(chat.messages[1].role).toBe('assistant')
    expect(chat.messages[2].role).toBe('user')
    expect(chat.messages[3].role).toBe('assistant')
  })
})
