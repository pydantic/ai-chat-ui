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
  // throttled at 500ms — see src/lib/chat-db.ts. Poll inside the page until
  // the record for the current conversation has at least `minMessages`
  // entries. Default of 2 covers a full user→assistant exchange — `1` would
  // race the throttle and resolve before the assistant turn flushes.
  //
  // Implemented as a single page.evaluate with a JS poll loop rather than
  // page.waitForFunction(): the latter does not reliably re-evaluate a
  // Promise-returning callback that opens IDB on each iteration.
  const conversationId = new URL(page.url()).pathname
  await page.evaluate(
    async ({ id, min, timeout }) => {
      /* global indexedDB */
      const start = Date.now()
      const readCount = () =>
        new Promise<number>((resolve) => {
          const req = indexedDB.open('chat-storage')
          req.onerror = () => {
            resolve(0)
          }
          req.onsuccess = () => {
            const db = req.result
            if (!db.objectStoreNames.contains('messages')) {
              db.close()
              resolve(0)
              return
            }
            const tx = db.transaction('messages', 'readonly')
            const get = tx.objectStore('messages').get(id)
            get.onerror = () => {
              db.close()
              resolve(0)
            }
            get.onsuccess = () => {
              const record = get.result as { messages?: unknown[] } | undefined
              db.close()
              resolve(Array.isArray(record?.messages) ? record.messages.length : 0)
            }
          }
        })
      while (Date.now() - start < timeout) {
        const count = await readCount()
        if (count >= min) return
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      throw new Error(`waitForPersisted timed out after ${timeout}ms; last count < ${min}`)
    },
    { id: conversationId, min: minMessages, timeout: timeoutMs },
  )
}
