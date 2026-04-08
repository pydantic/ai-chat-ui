export interface ConversationEntry {
  id: string
  firstMessage?: string
  timestamp: number
  forkOf?: {
    conversationId: string
    messageIndex: number
  }
}
