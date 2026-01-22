import { test, expect } from '@playwright/test'
import { createLogger } from '../../src/plugin/logger.ts'

const log = createLogger('e2e-clean-start')

test.describe('Server Clean Start', () => {
  test('should start with empty session list via API', async ({ request }) => {
    // Clear any existing sessions first
    await request.post('http://localhost:8867/api/sessions/clear')

    // Test the API directly to check sessions
    const response = await request.get('http://localhost:8867/api/sessions')

    expect(response.ok()).toBe(true)
    const sessions = await response.json()

    // Should be an empty array
    expect(Array.isArray(sessions)).toBe(true)
    expect(sessions.length).toBe(0)

    log.info('Server started cleanly with no sessions via API')
  })

  test('should start with empty session list via browser', async ({ page }) => {
    // Clear any existing sessions first
    await page.request.post('/api/sessions/clear')

    // Navigate to the web UI (test server should be running)
    await page.goto('/')

    // Wait for the page to load
    await page.waitForLoadState('networkidle')

    // Check that there are no sessions in the sidebar
    const sessionItems = page.locator('.session-item')
    await expect(sessionItems).toHaveCount(0, { timeout: 5000 })

    // Check that the empty state message is shown
    const emptyState = page.locator('.empty-state').first()
    await expect(emptyState).toBeVisible()

    log.info('Server started cleanly with no sessions in browser')
  })
})
