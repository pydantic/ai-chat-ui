import type { ConversationEntry } from '@/types'
import { useEffect, useState } from 'react'

interface ForkSiblings {
  siblings: ConversationEntry[]
  currentIndex: number
  total: number
}

function getConversations(): ConversationEntry[] {
  const stored = window.localStorage.getItem('conversationIds')
  return stored ? (JSON.parse(stored) as ConversationEntry[]) : []
}

/**
 * For a given conversation and message index, find all sibling forks:
 * - If this conversation has no forkOf, it's a parent — find children forked from it at messageIndex
 * - If this conversation has forkOf, find the parent and all siblings forked at the same point
 */
function computeSiblings(
  conversationId: string,
  messageIndex: number,
  conversations: ConversationEntry[],
): ForkSiblings {
  const current = conversations.find((c) => c.id === conversationId)
  if (!current) return { siblings: [], currentIndex: 0, total: 0 }

  let parentId: string
  let forkMessageIndex: number

  if (current.forkOf) {
    parentId = current.forkOf.conversationId
    forkMessageIndex = current.forkOf.messageIndex
  } else {
    parentId = conversationId
    forkMessageIndex = messageIndex
  }

  // Only show fork navigation on the message index where forks actually occurred
  if (forkMessageIndex !== messageIndex) {
    return { siblings: [], currentIndex: 0, total: 0 }
  }

  const parent = conversations.find((c) => c.id === parentId)
  const children = conversations
    .filter((c) => c.forkOf?.conversationId === parentId && c.forkOf.messageIndex === forkMessageIndex)
    .sort((a, b) => a.timestamp - b.timestamp)

  // Parent is always first in the list, then children by timestamp
  const siblings = parent ? [parent, ...children] : children
  const currentIndex = siblings.findIndex((c) => c.id === conversationId)

  return {
    siblings,
    currentIndex: currentIndex === -1 ? 0 : currentIndex,
    total: siblings.length,
  }
}

export function useForkSiblings(conversationId: string, messageIndex: number): ForkSiblings {
  const [conversations, setConversations] = useState<ConversationEntry[]>(getConversations)

  useEffect(() => {
    const refresh = () => {
      setConversations(getConversations())
    }

    window.addEventListener('local-storage-change', refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener('local-storage-change', refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  return computeSiblings(conversationId, messageIndex, conversations)
}
