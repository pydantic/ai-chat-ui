import type { Locator, Page } from '@playwright/test'

export function toolCard(page: Page, toolName: string): Locator {
  return page.locator(`[data-tool-name="${toolName}"]`)
}
