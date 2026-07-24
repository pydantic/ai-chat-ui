import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { sendMessage } from '../conversation'

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

test.describe('offline artifact', () => {
  test('renders code blocks and math with no external requests', async ({ page }) => {
    const attempted = await blockExternalRequests(page)

    await page.goto('/')
    await sendMessage(page, 'markdown', 'Show me markdown')

    // A fenced code block resolves a shiki language grammar through a dynamic import. In
    // the CDN build that import is fetched from jsdelivr at runtime; here it must already
    // be in the bundle, or this text never appears.
    await expect(page.getByText('def greet():')).toBeVisible()

    // KaTeX rendering the math is what pulls in its stylesheet, whose url() font refs are
    // the other thing that has to be inlined. `E=mc2` is the typeset output -- unrendered
    // markdown would still read `$$`.
    await expect(page.getByText('E=mc2').first()).toBeVisible()

    // The real assertion for the fonts: anything still living on the CDN shows up here.
    expect(attempted).toEqual([])
  })
})
