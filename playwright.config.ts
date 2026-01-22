import { defineConfig, devices } from '@playwright/test'

/**
 * @see https://playwright.dev/docs/test-configuration
 */

// Use worker-index based ports for parallel test execution
function getWorkerPort(): number {
  const workerIndex = process.env.TEST_WORKER_INDEX
    ? parseInt(process.env.TEST_WORKER_INDEX, 10)
    : 0
  return 8867 + workerIndex // Base port 8867, increment for each worker
}

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
  workers: 3, // Increased from 2 for faster test execution
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
        // Set worker-specific base URL
        baseURL: `http://localhost:${getWorkerPort()}`,
      },
    },
  ],

  /* Run worker-specific dev servers */
  webServer: [
    {
      command: `env NODE_ENV=test LOG_LEVEL=warn TEST_WORKER_INDEX=0 bun run test-web-server.ts --port=${8867}`,
      url: 'http://localhost:8867',
      reuseExistingServer: false,
    },
    {
      command: `env NODE_ENV=test LOG_LEVEL=warn TEST_WORKER_INDEX=1 bun run test-web-server.ts --port=${8868}`,
      url: 'http://localhost:8868',
      reuseExistingServer: false,
    },
    {
      command: `env NODE_ENV=test LOG_LEVEL=warn TEST_WORKER_INDEX=2 bun run test-web-server.ts --port=${8869}`,
      url: 'http://localhost:8869',
      reuseExistingServer: false,
    },
  ],
})
