import type { Locator, Page } from '@playwright/test'

export function sidebar(page: Page): Locator {
  return page.locator('[data-slot="sidebar"]')
}
