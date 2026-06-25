import type { Locator, Page } from '@playwright/test'

export function chat(page: Page): Locator {
  return page.getByRole('log')
}

export async function sendMessage(page: Page, model: string, message: string) {
  await page
    .getByRole('combobox')
    .filter({ hasNotText: /^Effort:/ })
    .click()
  await page.getByRole('option', { name: model, exact: true }).click()
  const input = page.getByPlaceholder('What would you like to know?')
  await input.fill(message)
  await input.press('Enter')
}

export async function waitForPersisted(page: Page, minMessages = 2, timeoutMs = 10_000) {
  // Messages are persisted to IndexedDB (db `chat-storage`, store `messages`)
  // throttled at 500ms (see src/lib/chat-db.ts). Poll inside the page until the
  // record has at least `minMessages` entries AND the last (assistant) message
  // has flushed non-empty text. Counting messages alone races the throttle: the
  // assistant message can be persisted before its text part is populated, so a
  // reload then rehydrates an empty assistant bubble. Default min of 2 covers a
  // full user->assistant exchange.
  //
  // Implemented as a single page.evaluate with a JS poll loop rather than
  // page.waitForFunction(): the latter does not reliably re-evaluate a
  // Promise-returning callback that opens IDB on each iteration.
  const conversationId = new URL(page.url()).pathname
  await page.evaluate(
    async ({ id, min, timeout }) => {
      /* global indexedDB */
      const start = Date.now()
      interface PersistState {
        count: number
        lastHasText: boolean
      }
      const readState = () =>
        new Promise<PersistState>((resolve) => {
          const req = indexedDB.open('chat-storage')
          req.onerror = () => {
            resolve({ count: 0, lastHasText: false })
          }
          req.onsuccess = () => {
            const db = req.result
            if (!db.objectStoreNames.contains('messages')) {
              db.close()
              resolve({ count: 0, lastHasText: false })
              return
            }
            const tx = db.transaction('messages', 'readonly')
            const get = tx.objectStore('messages').get(id)
            get.onerror = () => {
              db.close()
              resolve({ count: 0, lastHasText: false })
            }
            get.onsuccess = () => {
              const record = get.result as { messages?: { parts?: { type?: string; text?: string }[] }[] } | undefined
              db.close()
              const messages = Array.isArray(record?.messages) ? record.messages : []
              const last = messages.at(-1)
              const lastHasText =
                !!last &&
                Array.isArray(last.parts) &&
                last.parts.some((p) => p.type === 'text' && typeof p.text === 'string' && p.text.trim().length > 0)
              resolve({ count: messages.length, lastHasText })
            }
          }
        })
      while (Date.now() - start < timeout) {
        const { count, lastHasText } = await readState()
        if (count >= min && lastHasText) return
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      throw new Error(
        `waitForPersisted timed out after ${timeout}ms waiting for >= ${min} messages with persisted assistant text`,
      )
    },
    { id: conversationId, min: minMessages, timeout: timeoutMs },
  )
}
