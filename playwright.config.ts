import { defineConfig, devices } from '@playwright/test'

const TEST_SERVER_PORT = 8787
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
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://localhost:5173`,
    trace: 'on-first-retry',
    video: record ? 'on' : 'off',
    launchOptions: record ? { slowMo: 500 } : {},
  },
  webServer: [
    {
      command: `cd tests/server && uv run uvicorn server:app --port ${TEST_SERVER_PORT}`,
      port: TEST_SERVER_PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: `BACKEND_PORT=${TEST_SERVER_PORT} pnpm run dev`,
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 15_000,
    },
  ],
})
