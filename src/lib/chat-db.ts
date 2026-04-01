import type { ConversationEntry } from '@/types'

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
      reject(new Error(request.error?.message ?? 'Failed to open database'))
    }
    request.onsuccess = () => {
      resolve(request.result)
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

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
      const conversations = request.result as ConversationEntry[]
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
    window.alert('Failed to save conversation. Your browser storage may be full or unavailable.')
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

export async function getMessages(conversationId: string): Promise<unknown[] | null> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MESSAGES_STORE, 'readonly')
    const store = tx.objectStore(MESSAGES_STORE)
    const request = store.get(conversationId)

    request.onerror = () => {
      reject(new Error(request.error?.message ?? 'Failed to get messages'))
    }
    request.onsuccess = () => {
      const result = request.result as { id: string; messages: unknown[] } | undefined
      resolve(result?.messages ?? null)
    }
  })
}

export async function saveMessages(conversationId: string, messages: unknown[]): Promise<void> {
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
    window.alert('Failed to save messages. Your browser storage may be full or unavailable.')
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

  const conversations = JSON.parse(conversationsJson) as ConversationEntry[]

  for (const conv of conversations) {
    await saveConversation(conv)

    const messagesJson = localStorage.getItem(conv.id)
    if (messagesJson) {
      const messages = JSON.parse(messagesJson) as unknown[]
      await saveMessages(conv.id, messages)
      localStorage.removeItem(conv.id)
    }
  }

  localStorage.removeItem('conversationIds')
  localStorage.setItem(migrationKey, 'true')

  return true
}
