import type { ConversationEntry } from '@/types'
import type { UIMessage } from 'ai'
import { toast } from 'sonner'

const DB_NAME = 'chat-storage'
const DB_VERSION = 1
const CONVERSATIONS_STORE = 'conversations'
const MESSAGES_STORE = 'messages'

let dbPromise: Promise<IDBDatabase> | null = null

function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      dbPromise = null
      reject(new Error(request.error?.message ?? 'Failed to open database'))
    }
    request.onsuccess = () => {
      const db = request.result
      db.onclose = () => {
        dbPromise = null
      }
      resolve(db)
    }

    request.onupgradeneeded = () => {
      const db = request.result

      if (!db.objectStoreNames.contains(CONVERSATIONS_STORE)) {
        db.createObjectStore(CONVERSATIONS_STORE, { keyPath: 'id' })
      }

      if (!db.objectStoreNames.contains(MESSAGES_STORE)) {
        db.createObjectStore(MESSAGES_STORE, { keyPath: 'id' })
      }
    }
  })

  return dbPromise
}

export async function getConversations(): Promise<ConversationEntry[]> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CONVERSATIONS_STORE, 'readonly')
    const store = tx.objectStore(CONVERSATIONS_STORE)
    const request = store.getAll()

    request.onerror = () => {
      reject(new Error(request.error?.message ?? 'Failed to get conversations'))
    }
    request.onsuccess = () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- IDB getAll() returns untyped data
      const conversations: ConversationEntry[] = request.result
      conversations.sort((a, b) => b.timestamp - a.timestamp)
      resolve(conversations)
    }
  })
}

export async function saveConversation(conversation: ConversationEntry): Promise<void> {
  try {
    const db = await openDatabase()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(CONVERSATIONS_STORE, 'readwrite')
      const store = tx.objectStore(CONVERSATIONS_STORE)
      const request = store.put(conversation)

      request.onerror = () => {
        reject(new Error(request.error?.message ?? 'Failed to save conversation'))
      }
      request.onsuccess = () => {
        resolve()
      }
    })
  } catch (error) {
    toast.error('Failed to save conversation. Your browser storage may be full or unavailable.')
    throw error
  }
}

export async function deleteConversation(conversationId: string): Promise<void> {
  const db = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([CONVERSATIONS_STORE, MESSAGES_STORE], 'readwrite')

    const convStore = tx.objectStore(CONVERSATIONS_STORE)
    convStore.delete(conversationId)

    const msgStore = tx.objectStore(MESSAGES_STORE)
    msgStore.delete(conversationId)

    tx.oncomplete = () => {
      resolve()
    }
    tx.onerror = () => {
      reject(new Error(tx.error?.message ?? 'Failed to delete conversation'))
    }
  })
}

export async function getMessages(conversationId: string): Promise<UIMessage[] | null> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MESSAGES_STORE, 'readonly')
    const store = tx.objectStore(MESSAGES_STORE)
    const request = store.get(conversationId)

    request.onerror = () => {
      reject(new Error(request.error?.message ?? 'Failed to get messages'))
    }
    request.onsuccess = () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- IDB get() returns untyped data
      const result: { id: string; messages: UIMessage[] } | undefined = request.result
      resolve(result?.messages ?? null)
    }
  })
}

export async function saveMessages(conversationId: string, messages: UIMessage[]): Promise<void> {
  try {
    const db = await openDatabase()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(MESSAGES_STORE, 'readwrite')
      const store = tx.objectStore(MESSAGES_STORE)
      const request = store.put({ id: conversationId, messages })

      request.onerror = () => {
        reject(new Error(request.error?.message ?? 'Failed to save messages'))
      }
      request.onsuccess = () => {
        resolve()
      }
    })
  } catch (error) {
    toast.error('Failed to save messages. Your browser storage may be full or unavailable.')
    throw error
  }
}

export async function migrateFromLocalStorage(): Promise<boolean> {
  const migrationKey = 'indexeddb-migration-complete'
  if (localStorage.getItem(migrationKey)) {
    return false
  }

  const conversationsJson = localStorage.getItem('conversationIds')
  if (!conversationsJson) {
    localStorage.setItem(migrationKey, 'true')
    return false
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- JSON.parse returns untyped data
  const conversations: ConversationEntry[] = JSON.parse(conversationsJson)
  const migratedKeys: string[] = []

  for (const conv of conversations) {
    await saveConversation(conv)

    const messagesJson = localStorage.getItem(conv.id)
    if (messagesJson) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- JSON.parse returns untyped data
      const messages: UIMessage[] = JSON.parse(messagesJson)
      await saveMessages(conv.id, messages)
      migratedKeys.push(conv.id)
    }
  }

  // Clean up localStorage only after all IDB writes succeeded
  for (const key of migratedKeys) {
    localStorage.removeItem(key)
  }
  localStorage.removeItem('conversationIds')
  localStorage.setItem(migrationKey, 'true')

  return true
}
