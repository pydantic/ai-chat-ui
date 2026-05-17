import { defineConfig, devices } from '@playwright/test'

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

const TEST_SERVER_PORT = 38787
const TEST_UI_PORT = 54321
const record = !!process.env.E2E_VIDEO

export default defineConfig({
  testDir: process.env.E2E_TEST_DIR ?? 'tests/e2e',
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
    baseURL: `http://127.0.0.1:${TEST_UI_PORT}`,
    trace: 'retain-on-failure',
    video: record ? 'on' : 'off',
    launchOptions: record ? { slowMo: 500 } : {},
  },
  webServer: [
    {
      // Deterministic FastAPI server backed by pydantic-ai's FunctionModel.
      // See tests/server/server.py for the model registry.
      command: `cd tests/server && uv run uvicorn server:app --host 127.0.0.1 --port ${TEST_SERVER_PORT}`,
      url: `http://127.0.0.1:${TEST_SERVER_PORT}/api/configure`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      // Vite dev server proxying /api to the test backend on TEST_SERVER_PORT
      // (vite.config.ts reads BACKEND_PORT). --host 127.0.0.1 pinned so the
      // probe and the bind agree (macOS default is IPv6-only).
      command: `BACKEND_PORT=${TEST_SERVER_PORT} pnpm vite --port ${TEST_UI_PORT} --host 127.0.0.1`,
      url: `http://127.0.0.1:${TEST_UI_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 15_000,
    },
  ],
})
