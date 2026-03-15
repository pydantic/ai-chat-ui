import type { Page } from '@playwright/test'

export async function sendMessage(page: Page, model: string, message: string) {
  await page.getByRole('combobox').click()
  await page.getByRole('option', { name: model, exact: true }).click()
  const input = page.getByPlaceholder('What would you like to know?')
  await input.fill(message)
  await input.press('Enter')
}
