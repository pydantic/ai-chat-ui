import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { sendMessage, waitForPersisted } from '../conversation'

const BASE_PATH = '/demo/'
const API_PATH = '/demo/api/'

// The bug (pydantic-ai#5318): the CDN build bakes an absolute jsdelivr base into
// index.html *and* into the runtime chunk loader, so a self-hosted copy silently reaches
// back out to the CDN. `--mode offline` inlines everything into one file.
//
// Blocking every non-loopback request is what gives this spec teeth: if an asset stopped
// being inlined, the request would be aborted rather than quietly served by the real CDN,
// so the render fails instead of passing on a machine that happens to be online.
// A URL predicate rather than a glob so loopback traffic is never intercepted: routing the
// 15MB document and the streaming /api/chat response through the interception layer stalls
// the run.
async function blockExternalRequests(page: Page): Promise<string[]> {
  const attempted: string[] = []
  await page.route(
    ({ hostname }) => hostname !== '127.0.0.1' && hostname !== 'localhost',
    (route) => {
      attempted.push(route.request().url())
      return route.abort()
    },
  )
  return attempted
}

async function configurePage(page: Page, apiPath: string): Promise<void> {
  await page.addInitScript(
    ({ basePath, apiPath }) => {
      window.PYDANTIC_AI_CHAT_CONFIG = { basePath, apiPath }
    },
    { basePath: BASE_PATH, apiPath },
  )
}

test.describe('offline artifact', () => {
  test('works below a configured prefix with no external requests', async ({ page }) => {
    await configurePage(page, API_PATH)
    const attempted = await blockExternalRequests(page)
    const configureRequest = page.waitForRequest(
      (request) => new URL(request.url()).pathname === `${API_PATH}configure`,
    )

    await page.goto(BASE_PATH)
    await configureRequest

    const chatRequest = page.waitForRequest((request) => new URL(request.url()).pathname === `${API_PATH}chat`)
    await sendMessage(page, 'markdown', 'Show me markdown')
    await chatRequest

    const conversationPath = new URL(page.url()).pathname
    expect(conversationPath).toMatch(/^\/demo\/[\w-]+$/)

    // A fenced code block resolves a shiki language grammar through a dynamic import. In
    // the CDN build that import is fetched from jsdelivr at runtime; here it must already
    // be in the bundle, or this text never appears.
    await expect(page.getByText('def greet():')).toBeVisible()

    // KaTeX rendering the math is what pulls in its stylesheet, whose url() font refs are
    // the other thing that has to be inlined. `E=mc2` is the typeset output -- unrendered
    // markdown would still read `$$`.
    await expect(page.getByText('E=mc2').first()).toBeVisible()

    const conversationId = conversationPath.slice('/demo'.length)
    await waitForPersisted(page, 2, 10_000, conversationId)

    const conversationLink = page.getByRole('link', { name: /Show me markdown/ })
    await expect(conversationLink).toHaveAttribute('href', conversationPath)
    await page.getByRole('link', { name: 'New conversation' }).click()
    await expect(page).toHaveURL(new RegExp(`${BASE_PATH}$`))
    await conversationLink.click()
    await expect(page).toHaveURL(new RegExp(`${conversationPath}$`))

    await page.reload()
    await expect(page.getByText('def greet():')).toBeVisible()

    // The real assertion for the fonts: anything still living on the CDN shows up here.
    expect(attempted).toEqual([])
  })

  test('keeps the API directory independent from the navigation prefix', async ({ page }) => {
    await configurePage(page, '/api/')
    const attempted = await blockExternalRequests(page)
    const configureRequest = page.waitForRequest((request) => new URL(request.url()).pathname === '/api/configure')

    await page.goto(BASE_PATH)
    await configureRequest

    const chatRequest = page.waitForRequest((request) => new URL(request.url()).pathname === '/api/chat')
    await sendMessage(page, 'text', 'Hello')
    await chatRequest

    await expect(page).toHaveURL(/^http:\/\/127\.0\.0\.1:\d+\/demo\/[\w-]+$/)
    await expect(page.getByText('Hello from the test server')).toBeVisible()
    expect(attempted).toEqual([])
  })
})
