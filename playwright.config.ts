import { defineConfig, devices } from '@playwright/test'
import { readFileSync } from 'fs'

/**
 * @see https://playwright.dev/docs/test-configuration
 */

// Read the actual port from the test server
function getTestServerPort(): number {
  try {
    const portData = readFileSync('/tmp/test-server-port.txt', 'utf8').trim()
    return parseInt(portData, 10)
  } catch {
    return 8867 // fallback
  }
}

const testPort = getTestServerPort()

export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: false,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Run tests with 1 worker to avoid conflicts */
  workers: 1,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')'. */
    baseURL: `http://localhost:${testPort}`,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'NODE_ENV=test bun run test-web-server.ts',
    url: `http://localhost:${testPort}`,
    reuseExistingServer: true, // Reuse existing server if running
  },
})
