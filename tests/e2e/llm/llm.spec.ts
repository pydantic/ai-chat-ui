import { test, expect } from '@playwright/test'
import { chat, sendMessage } from '../conversation'

const providers = ['anthropic', 'openai', 'google']

for (const model of providers) {
  test.describe(model, () => {
    test('streams a response', async ({ page }) => {
      await page.goto('/')
      await sendMessage(page, model, 'Reply with exactly: hello world')
      await expect(chat(page).getByRole('paragraph').last()).toContainText('hello', {
        timeout: 30_000,
      })
    })
  })
}
