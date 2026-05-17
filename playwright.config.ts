import { defineConfig, devices } from '@playwright/test'

// Local-dev shim for HTTP firewalls (e.g. Socket Firewall) that set
// HTTP_PROXY=http://127.0.0.1:<port>. Without bypassing loopback, Playwright's
// URL probe for the dev server gets routed through the proxy and returns 405,
// so the webServer wait times out. Harmless when no proxy is configured.
const LOOPBACK = ['localhost', '127.0.0.1', '::1']
const noProxy = (process.env.NO_PROXY ?? '').split(',').filter(Boolean)
for (const host of LOOPBACK) {
  if (!noProxy.includes(host)) noProxy.push(host)
}
process.env.NO_PROXY = noProxy.join(',')
process.env.no_proxy = process.env.NO_PROXY

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://127.0.0.1:54321',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // Vite's default host on macOS binds IPv6-only, so Playwright's IPv4 probe times out.
    // Pin to 127.0.0.1 so probe + bind agree across macOS / Linux CI.
    command: 'pnpm vite --port 54321 --host 127.0.0.1',
    url: 'http://127.0.0.1:54321',
    reuseExistingServer: !process.env.CI,
  },
})
