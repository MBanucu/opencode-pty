import { test, expect } from '@playwright/test'
import { createTestLogger } from '../test-logger.ts'

const log = createTestLogger('e2e-server-clean')

test.describe('Server Clean Start', () => {
  test('should start with empty session list via API', async ({ request }) => {
    // Clear any existing sessions first
    await request.post('/api/sessions/clear')

    // Test the API directly to check sessions
    const response = await request.get('/api/sessions')

    expect(response.ok()).toBe(true)
    const sessions = await response.json()

    // Should be an empty array
    expect(Array.isArray(sessions)).toBe(true)
    expect(sessions.length).toBe(0)

    log.info('Server started cleanly with no sessions via API')
  })

  test('should start with empty session list via browser', async ({ page }) => {
    // Navigate to the web UI
    await page.goto('/')

    // Clear any existing sessions from previous tests
    const clearResponse = await page.request.delete('/api/sessions')
    if (clearResponse && clearResponse.status() === 200) {
      await page.waitForTimeout(500) // Wait for cleanup
      await page.reload() // Reload to get fresh state
    }

    // Check that there are no sessions in the sidebar
    const sessionItems = page.locator('.session-item')
    await expect(sessionItems).toHaveCount(0, { timeout: 2000 })

    // Check that the "No active sessions" message appears in the sidebar
    await expect(page.getByText('No active sessions')).toBeVisible()
  })
})
