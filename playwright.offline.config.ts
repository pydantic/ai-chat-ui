import { defineConfig, devices } from '@playwright/test'

// Separate config from playwright.config.ts because the offline artifact is served by
// `vite preview` out of offline/ rather than the dev server, and the spec asserts that
// nothing at all is fetched from outside the local host.

// Local-dev shim for HTTP firewalls (e.g. Socket Firewall) that set
// HTTP_PROXY=http://127.0.0.1:<port>. Without bypassing loopback, Playwright's
// URL probe gets routed through the proxy and returns 405, stalling the
// webServer wait. Harmless when no proxy is configured.
const LOOPBACK = ['localhost', '127.0.0.1', '::1']
const noProxy = (process.env.NO_PROXY ?? '').split(',').filter(Boolean)
for (const host of LOOPBACK) {
  if (!noProxy.includes(host)) noProxy.push(host)
}
process.env.NO_PROXY = noProxy.join(',')
process.env.no_proxy = process.env.NO_PROXY

const TEST_SERVER_PORT = 38788
const TEST_UI_PORT = 54322
const TEST_BASE_PATH = '/demo/'
const TEST_API_PATH = '/demo/api/'

export default defineConfig({
  testDir: 'tests/e2e/offline',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  expect: {
    timeout: 5_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  use: {
    baseURL: `http://127.0.0.1:${TEST_UI_PORT}${TEST_BASE_PATH}`,
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: `cd tests/server && uv run uvicorn server:app --host 127.0.0.1 --port ${TEST_SERVER_PORT}`,
      url: `http://127.0.0.1:${TEST_SERVER_PORT}/api/configure`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      // Serves the pre-built artifact; run `pnpm run build:offline` first (the
      // `test:e2e:offline` script does). Building here instead would fold a 30s compound
      // command into the readiness wait.
      command:
        `BACKEND_PORT=${TEST_SERVER_PORT} ` +
        `API_PROXY_PATH=${TEST_API_PATH.slice(0, -1)} ` +
        `pnpm exec vite preview --outDir offline --port ${TEST_UI_PORT} --host 127.0.0.1 --strictPort`,
      // Probe the prefixed API rather than the UI: the readiness fetch would otherwise pull
      // the whole 15MB artifact, and this also confirms the rewrite to /api is wired up.
      url: `http://127.0.0.1:${TEST_UI_PORT}${TEST_API_PATH}configure`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
})
