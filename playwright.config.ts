import { defineConfig, devices } from '@playwright/test'

/**
 * @see https://playwright.dev/docs/test-configuration
 */

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.pw.ts',
  /* Run tests in files in parallel */
  fullyParallel: true, // Enable parallel execution with isolated servers
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Allow multiple workers for parallelism */
  workers: process.env.CI ? 8 : 4, // 3 locally, 8 on CI for parallel execution
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Global timeout increased for reliable parallel execution */
  timeout: 15000,
  expect: { timeout: 5000 },
  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
      },
    },
  ],
  // Server managed per worker via fixtures
  // Use worker-scoped state for better isolation
  use: {
    // Increase action timeout for slower operations
    actionTimeout: 5000,
    // Increase navigation timeout
    navigationTimeout: 10000,
  },
})
