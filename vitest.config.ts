import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/headless/**/*.test.ts'],
    globalSetup: 'tests/global-setup.ts',
    testTimeout: 30_000,
    teardownTimeout: 1_000,
  },
})
