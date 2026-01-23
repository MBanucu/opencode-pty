import { expect } from '@playwright/test'
import { test as extendedTest } from '../fixtures'

extendedTest.describe('Server Clean Start', () => {
  extendedTest('should start with empty session list via API', async ({ request, server }) => {
    // Clear any existing sessions first
    await request.post(server.baseURL + '/api/sessions/clear')

    // Test the API directly to check sessions
    const response = await request.get(server.baseURL + '/api/sessions')

    expect(response.ok()).toBe(true)
    const sessions = await response.json()

    // Should be an empty array
    expect(Array.isArray(sessions)).toBe(true)
    expect(sessions.length).toBe(0)
  })

  extendedTest('should start with empty session list via browser', async ({ page, server }) => {
    // Navigate to the web UI
    await page.goto(server.baseURL + '/')

    // Clear any existing sessions from previous tests
    const clearResponse = await page.request.post(server.baseURL + '/api/sessions/clear')
    expect(clearResponse.status()).toBe(200)

    // Check that there are no sessions in the sidebar
    const sessionItems = page.locator('.session-item')
    await expect(sessionItems).toHaveCount(0, { timeout: 2000 })

    // Check that the "No active sessions" message appears in the sidebar
    await expect(page.getByText('No active sessions')).toBeVisible()
  })
})
