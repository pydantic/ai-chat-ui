import type { Locator, Page } from '@playwright/test'

export function chat(page: Page): Locator {
  return page.getByRole('log')
}

export async function sendMessage(page: Page, model: string, message: string) {
  await page.getByRole('combobox').click()
  await page.getByRole('option', { name: model, exact: true }).click()
  const input = page.getByPlaceholder('What would you like to know?')
  await input.fill(message)
  await input.press('Enter')
}

export async function waitForPersisted(page: Page) {
  const conversationId = new URL(page.url()).pathname
  await page.waitForFunction((id) => {
    const data = localStorage.getItem(id)
    return data && JSON.parse(data).length > 0
  }, conversationId)
}
