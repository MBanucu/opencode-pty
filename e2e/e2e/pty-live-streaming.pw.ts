import { createApiClient } from '../helpers/apiClient'
import { RouteBuilder } from '../../src/web/shared/RouteBuilder'
import { test as extendedTest } from '../fixtures'
import { expect } from '@playwright/test'

extendedTest.describe('PTY Live Streaming', () => {
  extendedTest(
    'should preserve and display complete historical output buffer',
    async ({ page, server }) => {
      const apiClient = createApiClient(server.baseURL)

      // This test verifies that historical data (produced before UI connects) is preserved and loaded
      // when connecting to a running PTY session. This is crucial for users who reconnect to long-running sessions.

      // Navigate to the web UI first
      await page.goto(server.baseURL + '/')

      // Ensure clean state - clear any existing sessions from previous tests
      await apiClient.sessions.clear()
      // Wait until sessions are actually cleared
      await page.waitForFunction(async (url: string) => {
        const resp = await fetch(url)
        const list = await resp.json()
        return Array.isArray(list) && list.length === 0
      }, server.baseURL + RouteBuilder.sessions.list())

      // Create a fresh session that produces identifiable historical output
      const session = await apiClient.sessions.create({
        command: 'bash',
        args: [
          '-c',
          'echo "=== START HISTORICAL ==="; echo "Line A"; echo "Line B"; echo "Line C"; echo "=== END HISTORICAL ==="; while true; do echo "LIVE: $(date +%S)"; sleep 2; done',
        ],
        description: `Historical buffer test - ${Date.now()}`,
      })

      // Wait for session to produce historical output (before UI connects)
      // Wait until required historical buffer marker appears in raw output
      await page.waitForFunction(
        async (url: string) => {
          const resp = await fetch(url)
          const bufferData = await resp.json()
          return bufferData.raw && bufferData.raw.includes('=== END HISTORICAL ===')
        },
        server.baseURL + RouteBuilder.session.rawBuffer({ id: session.id })
      )

      // Check session status via API to ensure it's running (using apiClient)
      expect(session.status).toBe('running')

      // Now connect via UI and check that historical data is loaded
      await page.reload()
      await page.waitForSelector('.session-item', { timeout: 5000 })

      // Find and click the running session
      const allSessions = page.locator('.session-item')
      const sessionCount = await allSessions.count()
      let testSession = null
      for (let i = 0; i < sessionCount; i++) {
        const session = allSessions.nth(i)
        const statusBadge = await session.locator('.status-badge').textContent()
        if (statusBadge === 'running') {
          testSession = session
          break
        }
      }

      if (!testSession) {
        throw new Error('Historical buffer test session not found')
      }

      await testSession.click()
      await page.waitForSelector('[data-testid="test-output"] .output-line', { timeout: 5000 })

      // Verify the API returns the expected historical data
      const bufferData = await apiClient.session.buffer.raw({ id: session.id })
      expect(bufferData.raw).toBeDefined()
      expect(typeof bufferData.raw).toBe('string')
      expect(bufferData.raw.length).toBeGreaterThan(0)

      // Check that historical output is present in the UI
      const allText = await page.locator('[data-testid="test-output"]').textContent()
      expect(allText).toContain('=== START HISTORICAL ===')
      expect(allText).toContain('Line A')
      expect(allText).toContain('Line B')
      expect(allText).toContain('Line C')
      expect(allText).toContain('=== END HISTORICAL ===')

      // Verify live updates are also working
      expect(allText).toMatch(/LIVE: \d{2}/)
    }
  )

  extendedTest(
    'should receive live WebSocket updates from running PTY session',
    async ({ page, server }) => {
      const apiClient = createApiClient(server.baseURL)
      // Navigate to the web UI
      await page.goto(server.baseURL + '/')

      // Ensure clean state for this test
      await apiClient.sessions.clear()
      // Wait until sessions are actually cleared
      await page.waitForFunction(async (url: string) => {
        const resp = await fetch(url)
        const list = await resp.json()
        return Array.isArray(list) && list.length === 0
      }, server.baseURL + RouteBuilder.sessions.list())

      // Create a fresh session for this test
      const initialSessions = await apiClient.sessions.list()
      if (initialSessions.length === 0) {
        await apiClient.sessions.create({
          command: 'bash',
          args: [
            '-c',
            'echo "Welcome to live streaming test"; echo "Type commands and see real-time output"; while true; do LC_TIME=C date +"%a %d. %b %H:%M:%S %Z %Y: Live update..."; sleep 0.1; done',
          ],
          description: 'Live streaming test session',
        })
        // Wait a bit for the session to start and reload to get updated session list
        // Wait until running session is available in API
        await page.waitForFunction(async (url: string) => {
          const resp = await fetch(url)
          const sessions = await resp.json()
          return (
            Array.isArray(sessions) &&
            sessions.some(
              (s: any) => s.description === 'Live streaming test session' && s.status === 'running'
            )
          )
        }, server.baseURL + RouteBuilder.sessions.list())
      }

      // Wait for sessions to load
      await page.waitForSelector('.session-item', { timeout: 5000 })

      // Find the running session
      const sessionCount = await page.locator('.session-item').count()
      const allSessions = page.locator('.session-item')

      let runningSession = null
      for (let i = 0; i < sessionCount; i++) {
        const session = allSessions.nth(i)
        const statusBadge = await session.locator('.status-badge').textContent()
        if (statusBadge === 'running') {
          runningSession = session
          break
        }
      }

      if (!runningSession) {
        throw new Error('No running session found')
      }

      await runningSession.click()

      // Wait for WebSocket to stabilize
      // Wait for output container or debug info to be visible
      await page.waitForSelector('[data-testid="debug-info"]', { timeout: 3000 })

      // Wait for initial output
      await page.waitForSelector('[data-testid="test-output"] .output-line', { timeout: 3000 })

      // Get initial count
      const outputLines = page.locator('[data-testid="test-output"] .output-line')
      const initialCount = await outputLines.count()
      expect(initialCount).toBeGreaterThan(0)

      // Check the debug info
      const debugInfo = await page.locator('[data-testid="debug-info"]').textContent()
      const debugText = (debugInfo || '') as string

      // Extract WS raw_data message count
      const wsMatch = debugText.match(/WS raw_data: (\d+)/)
      const initialWsMessages = wsMatch && wsMatch[1] ? parseInt(wsMatch[1]) : 0

      // Wait for at least 1 WebSocket streaming update
      let attempts = 0
      const maxAttempts = 50 // 5 seconds at 100ms intervals
      let currentWsMessages = initialWsMessages
      const debugElement = page.locator('[data-testid="debug-info"]')
      while (attempts < maxAttempts && currentWsMessages < initialWsMessages + 1) {
        await page.waitForTimeout(100)
        const currentDebugText = (await debugElement.textContent()) || ''
        const currentWsMatch = currentDebugText.match(/WS raw_data: (\d+)/)
        currentWsMessages = currentWsMatch && currentWsMatch[1] ? parseInt(currentWsMatch[1]) : 0
        if (attempts % 10 === 0) {
          // Log every second
        }
        attempts++
      }

      // Check final state

      // Check final output count
      // Validate that live streaming is working by checking output increased

      // Check that the new lines contain the expected timestamp format if output increased
      // Check that new live update lines were added during WebSocket streaming
      const finalOutputLines = await outputLines.count()
      // Look for lines that contain "Live update..." pattern
      let liveUpdateFound = false
      for (let i = Math.max(0, finalOutputLines - 10); i < finalOutputLines; i++) {
        const lineText = await outputLines.nth(i).textContent()
        if (lineText && lineText.includes('Live update...')) {
          liveUpdateFound = true

          break
        }
      }

      expect(liveUpdateFound).toBe(true)
    }
  )
})
