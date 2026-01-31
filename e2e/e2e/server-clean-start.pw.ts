import { expect } from '@playwright/test'
import { test as extendedTest } from '../fixtures'

extendedTest.describe('Server Clean Start', () => {
  extendedTest('should start with empty session list via API', async ({ request, server }) => {
    // Clear any existing sessions first
    await request.delete(server.baseURL + '/api/sessions')

    // Wait for sessions to actually be cleared (retry up to 5 times)
    let sessions = []
    for (let i = 0; i < 5; i++) {
      const response = await request.get(server.baseURL + '/api/sessions')
      expect(response.ok()).toBe(true)
      sessions = await response.json()
      if (sessions.length === 0) break
      // Wait a bit before retrying
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    // Should be an empty array
    expect(Array.isArray(sessions)).toBe(true)
    expect(sessions.length).toBe(0)
  })

  extendedTest('should start with empty session list via browser', async ({ page, server }) => {
    // Navigate to the web UI
    await page.goto(server.baseURL + '/')

    // Clear any existing sessions from previous tests
    const clearResponse = await page.request.delete(server.baseURL + '/api/sessions')
    expect(clearResponse.status()).toBe(200)

    // Wait for sessions to actually be cleared in the UI (retry up to 5 times)
    for (let i = 0; i < 5; i++) {
      const sessionItems = page.locator('.session-item')
      try {
        await expect(sessionItems).toHaveCount(0, { timeout: 500 })
        break // Success, sessions are cleared
      } catch {
        // Wait a bit before retrying
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    }

    // Check that there are no sessions in the sidebar
    const sessionItems = page.locator('.session-item')
    await expect(sessionItems).toHaveCount(0, { timeout: 2000 })

    // Check that the "No active sessions" message appears in the sidebar
    await expect(page.getByText('No active sessions')).toBeVisible()
  })
})
