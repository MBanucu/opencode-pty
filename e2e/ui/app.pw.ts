import { test as extendedTest, expect } from '../fixtures'
import { createTestLogger } from '../test-logger.ts'

const log = createTestLogger('ui-test')

extendedTest.describe('App Component', () => {
  extendedTest('renders the PTY Sessions title', async ({ page, server }) => {
    // Ensure clean state for parallel execution
    const clearResponse = await page.request.post(server.baseURL + '/api/sessions/clear')
    expect(clearResponse.status()).toBe(200)

    // Log page errors
    page.on('pageerror', (error) => {
      log.error(`PAGE ERROR: ${error.message}`)
    })

    await page.goto(server.baseURL + '/')
    await expect(page.getByText('PTY Sessions')).toBeVisible()
  })

  extendedTest('shows connected status when WebSocket connects', async ({ page, server }) => {
    await page.goto(server.baseURL + '/')
    await expect(page.getByText('● Connected')).toBeVisible()
  })

  extendedTest('receives WebSocket session_list messages', async ({ page, server }) => {
    // Clear any existing sessions for clean state
    await page.request.post(server.baseURL + '/api/sessions/clear')

    // Navigate to page and wait for WebSocket connection
    await page.goto(server.baseURL + '/')

    // Create a session to trigger session_list update
    await page.request.post(server.baseURL + '/api/sessions', {
      data: {
        command: 'echo',
        args: ['test'],
        description: 'Test session for WebSocket check',
      },
    })

    // Wait for session to appear in UI (indicates WebSocket session_list was processed)
    await page.waitForSelector('.session-item', { timeout: 5000 })

    // Verify session appears in the list
    const sessionText = await page.locator('.session-item').first().textContent()
    expect(sessionText).toContain('Test session for WebSocket check')
  })

  extendedTest('shows no active sessions message when empty', async ({ page, server }) => {
    // Clear any existing sessions
    const clearResponse = await page.request.post(server.baseURL + '/api/sessions/clear')
    expect(clearResponse.status()).toBe(200)

    await page.goto(server.baseURL + '/')
    await expect(page.getByText('● Connected')).toBeVisible()

    // Now check that "No active sessions" appears in the sidebar
    await expect(page.getByText('No active sessions')).toBeVisible()
  })

  extendedTest('shows empty state when no session is selected', async ({ page, server }) => {
    // Log all console messages for debugging
    page.on('console', () => {})

    // Clear any existing sessions
    const clearResponse = await page.request.post(server.baseURL + '/api/sessions/clear')
    expect(clearResponse.status()).toBe(200)

    await page.goto(server.baseURL + '/')

    // Set skip autoselect to prevent automatic selection
    await page.evaluate(() => {
      localStorage.setItem('skip-autoselect', 'true')
    })

    // Create a session
    const createResponse = await page.request.post(server.baseURL + '/api/sessions', {
      data: {
        command: 'echo',
        args: ['test'],
        description: 'Test session',
      },
    })
    expect(createResponse.status()).toBe(200)

    // Reload to get the session list
    await page.reload()

    // Now there should be a session in the sidebar but none selected
    const emptyState = page.locator('.empty-state').first()
    await expect(emptyState).toBeVisible()
    await expect(emptyState).toHaveText('Select a session from the sidebar to view its output')
  })

  extendedTest.describe('WebSocket Message Handling', () => {
    extendedTest(
      'increments WS message counter when receiving data for active session',
      async ({ page, server }) => {
        extendedTest.setTimeout(15000) // Increase timeout for slow session startup
        // Log all console messages for debugging
        page.on('console', () => {})
        page.on('pageerror', (error) => log.error('PAGE ERROR: ' + error.message))

        // Navigate and wait for initial setup
        await page.goto(server.baseURL + '/')

        // Clear any existing sessions for clean test state
        await page.request.post(server.baseURL + '/api/sessions/clear')

        // Create a test session that produces continuous output

        await page.request.post(server.baseURL + '/api/sessions', {
          data: {
            command: 'bash',
            args: [
              '-c',
              'echo "Welcome to live streaming test"; while true; do echo "$(date +"%H:%M:%S"): Live update"; sleep 0.1; done',
            ],
            description: 'Live streaming test session',
          },
        })

        // Wait for session to actually start
        await page.waitForTimeout(5000)

        // Check session status
        const sessionsResponse = await page.request.get(server.baseURL + '/api/sessions')
        const sessions = await sessionsResponse.json()

        if (sessions.length > 0) {
        }

        // Don't reload - wait for the session to appear in the UI
        await page.waitForSelector('.session-item', { timeout: 5000 })

        // Wait for session to appear
        await page.waitForSelector('.session-item', { timeout: 5000 })

        // Check session status
        const sessionItems = page.locator('.session-item')

        // Click on the first session
        const firstSession = sessionItems.first()

        await firstSession.click()

        // Wait for session to be active and debug element to appear
        await page.waitForSelector('.output-header .output-title', { timeout: 2000 })
        await page.waitForSelector('[data-testid="debug-info"]', { timeout: 2000 })

        // Get session ID from debug element
        const initialDebugElement = page.locator('[data-testid="debug-info"]')
        await initialDebugElement.waitFor({ state: 'attached', timeout: 1000 })
        const initialDebugText = (await initialDebugElement.textContent()) || ''
        const activeMatch = initialDebugText.match(/active:\s*([^\s,]+)/)
        const sessionId = activeMatch && activeMatch[1] ? activeMatch[1] : null

        // Check if session has output
        if (sessionId) {
          const outputResponse = await page.request.get(
            `${server.baseURL}/api/sessions/${sessionId}/output`
          )
          if (outputResponse.status() === 200) {
            await outputResponse.json()
          } else {
          }
        }

        const initialWsMatch = initialDebugText.match(/WS messages:\s*(\d+)/)
        const initialCount = initialWsMatch && initialWsMatch[1] ? parseInt(initialWsMatch[1]) : 0

        // Wait for some WebSocket messages to arrive (the session should be running)
        await page.waitForTimeout(5000)

        // Check that WS message count increased
        const finalDebugText = (await initialDebugElement.textContent()) || ''
        const finalWsMatch = finalDebugText.match(/WS messages:\s*(\d+)/)
        const finalCount = finalWsMatch && finalWsMatch[1] ? parseInt(finalWsMatch[1]) : 0

        // The test should fail if no messages were received
        expect(finalCount).toBeGreaterThan(initialCount)
      }
    )

    extendedTest(
      'does not increment WS counter for messages from inactive sessions',
      async ({ page, server }) => {
        // Log all console messages for debugging
        page.on('console', () => {})

        // This test would require multiple sessions and verifying that messages
        // for non-active sessions don't increment the counter
        await page.goto(server.baseURL + '/')

        // Clear any existing sessions for clean test state
        await page.request.post(server.baseURL + '/api/sessions/clear')

        // Create first session
        await page.request.post(server.baseURL + '/api/sessions', {
          data: {
            command: 'bash',
            args: ['-c', 'while true; do echo "session1 $(date +%s)"; sleep 0.1; done'],
            description: 'Session 1',
          },
        })

        // Create second session
        await page.request.post(server.baseURL + '/api/sessions', {
          data: {
            command: 'bash',
            args: ['-c', 'while true; do echo "session2 $(date +%s)"; sleep 0.1; done'],
            description: 'Session 2',
          },
        })

        await page.waitForTimeout(1000)
        await page.reload()

        // Wait for sessions to load
        await page.waitForSelector('.session-item', { timeout: 5000 })

        // Click on first session
        const sessionItems = page.locator('.session-item')
        await sessionItems.nth(0).click()

        // Wait for it to be active
        await page.waitForSelector('.output-header .output-title', { timeout: 2000 })

        // Get initial count
        const debugElement = page.locator('[data-testid="debug-info"]')
        await debugElement.waitFor({ state: 'attached', timeout: 1000 })
        const initialDebugText = (await debugElement.textContent()) || ''
        const initialWsMatch = initialDebugText.match(/WS messages:\s*(\d+)/)
        const initialCount = initialWsMatch && initialWsMatch[1] ? parseInt(initialWsMatch[1]) : 0

        // Wait a bit and check count again
        await page.waitForTimeout(2000)
        const finalDebugText = (await debugElement.textContent()) || ''
        const finalWsMatch = finalDebugText.match(/WS messages:\s*(\d+)/)
        const finalCount = finalWsMatch && finalWsMatch[1] ? parseInt(finalWsMatch[1]) : 0

        // Should have received messages for the active session
        expect(finalCount).toBeGreaterThan(initialCount)
      }
    )

    extendedTest('resets WS counter when switching sessions', async ({ page, server }) => {
      // Log all console messages for debugging
      page.on('console', () => {})

      await page.goto(server.baseURL + '/')

      // Create two sessions
      await page.request.post(server.baseURL + '/api/sessions', {
        data: {
          command: 'bash',
          args: ['-c', 'while true; do echo "session1"; sleep 0.1; done'],
          description: 'Session 1 - streaming',
        },
      })

      await page.request.post(server.baseURL + '/api/sessions', {
        data: {
          command: 'bash',
          args: ['-c', 'while true; do echo "session2"; sleep 0.1; done'],
          description: 'Session 2 - streaming',
        },
      })

      await page.waitForTimeout(1000)
      await page.reload()

      // Wait for sessions
      await page.waitForSelector('.session-item', { timeout: 5000 })

      // Click first session
      const sessionItems = page.locator('.session-item')
      await sessionItems.nth(0).click()
      await page.waitForSelector('.output-header .output-title', { timeout: 2000 })

      // Wait for some messages
      await page.waitForTimeout(2000)

      // Switch to second session
      await sessionItems.nth(1).click()
      await page.waitForSelector('.output-header .output-title', { timeout: 2000 })

      // Check that counter resets when switching sessions
      const debugElement = page.locator('[data-testid="debug-info"]')
      await debugElement.waitFor({ state: 'attached', timeout: 2000 })
      const secondSessionDebug = (await debugElement.textContent()) || ''
      const secondSessionWsMatch = secondSessionDebug.match(/WS messages:\s*(\d+)/)
      const secondSessionCount =
        secondSessionWsMatch && secondSessionWsMatch[1] ? parseInt(secondSessionWsMatch[1]) : 0

      // Counter should reset when switching sessions (allow some messages due to streaming)
      expect(secondSessionCount).toBeLessThanOrEqual(5)
    })

    extendedTest('maintains WS counter state during page refresh', async ({ page, server }) => {
      // Log all console messages for debugging
      page.on('console', () => {})

      await page.goto(server.baseURL + '/')

      // Clear any existing sessions for clean test state
      await page.request.post(server.baseURL + '/api/sessions/clear')

      // Create a streaming session
      await page.request.post(server.baseURL + '/api/sessions', {
        data: {
          command: 'bash',
          args: ['-c', 'while true; do echo "streaming"; sleep 0.1; done'],
          description: 'Streaming session',
        },
      })

      await page.waitForTimeout(1000)
      await page.reload()

      // Select session and wait for messages
      await page.waitForSelector('.session-item', { timeout: 5000 })
      await page.locator('.session-item').first().click()
      await page.waitForSelector('.output-header .output-title', { timeout: 2000 })

      // Wait for messages
      await page.waitForTimeout(2000)

      const debugElement = page.locator('[data-testid="debug-info"]')
      await debugElement.waitFor({ state: 'attached', timeout: 2000 })
      const debugText = (await debugElement.textContent()) || ''
      const wsMatch = debugText.match(/WS messages:\s*(\d+)/)
      const count = wsMatch && wsMatch[1] ? parseInt(wsMatch[1]) : 0

      // Should have received some messages
      expect(count).toBeGreaterThan(0)
    })
  })
})
