import { defineConfig, devices } from '@playwright/test'

/**
 * @see https://playwright.dev/docs/test-configuration
 */

// Fixed port for tests
const TEST_PORT = 8877

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.pw.ts',
  /* Run tests in files in parallel */
  fullyParallel: false,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Run tests in parallel for better performance */
  workers: 1, // Increased from 2 for faster test execution
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Global timeout reduced from 30s to 5s for faster test execution */
  timeout: 5000,
  expect: { timeout: 2000 },
  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Set fixed base URL for tests
        baseURL: `http://localhost:${TEST_PORT}`,
      },
    },
  ],

  /* Run worker-specific dev servers */
  webServer: [
    {
      command: `env NODE_ENV=test LOG_LEVEL=debug TEST_WORKER_INDEX=0 bun run test-web-server.ts --port=${8877}`,
      url: 'http://localhost:8877',
      reuseExistingServer: true,
    },
  ],
})
