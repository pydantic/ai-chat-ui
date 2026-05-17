import { AbstractChat, DefaultChatTransport, type ChatState, type ChatStatus, type UIMessage } from 'ai'

class SimpleChatState implements ChatState<UIMessage> {
  status: ChatStatus = 'ready'
  error: Error | undefined = undefined
  messages: UIMessage[] = []

  pushMessage(message: UIMessage): void {
    this.messages = [...this.messages, message]
  }

  popMessage(): void {
    this.messages = this.messages.slice(0, -1)
  }

  replaceMessage(index: number, message: UIMessage): void {
    this.messages = this.messages.map((m, i) => (i === index ? message : m))
  }

  snapshot<T>(thing: T): T {
    return structuredClone(thing)
  }
}

export class TestChat extends AbstractChat<UIMessage> {
  constructor(port: number) {
    const state = new SimpleChatState()
    super({
      transport: new DefaultChatTransport({ api: `http://127.0.0.1:${port}/api/chat` }),
      state,
    })
  }
}

export function getServerPort(): number {
  const port = process.env.TEST_SERVER_PORT
  if (!port) throw new Error('TEST_SERVER_PORT not set — is global-setup running?')
  return Number(port)
}

interface ModelConfig {
  id: string
  name: string
  builtinTools: string[]
}

interface ServerConfig {
  models: ModelConfig[]
  builtinTools: { name: string; id: string }[]
}

let cachedConfig: ServerConfig | undefined

async function fetchConfig(port: number): Promise<ServerConfig> {
  if (cachedConfig) return cachedConfig
  const res = await fetch(`http://127.0.0.1:${port}/api/configure`)
  if (!res.ok) {
    throw new Error(`/api/configure returned ${res.status}`)
  }
  cachedConfig = (await res.json()) as ServerConfig
  return cachedConfig
}

export async function resolveModelId(port: number, name: string): Promise<string> {
  const config = await fetchConfig(port)
  const model = config.models.find((m) => m.name === name)
  if (!model) throw new Error(`Model "${name}" not found in server config`)
  return model.id
}
