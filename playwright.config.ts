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
  workers: process.env.CI ? 8 : 3, // 3 locally, 8 on CI for parallel execution
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
        // baseURL handled dynamically via fixtures
      },
    },
  ],
  // Server managed per worker via fixtures
})
