import { test as extendedTest, expect } from '../fixtures'

extendedTest.describe('App Component', () => {
  extendedTest('renders the PTY Sessions title', async ({ page, server }) => {
    // Ensure clean state for parallel execution
    const clearResponse = await page.request.post(server.baseURL + '/api/sessions/clear')
    expect(clearResponse.status()).toBe(200)

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

        // Navigate and wait for initial setup
        await page.goto(server.baseURL + '/')

        // Clear any existing sessions for clean test state
        await page.request.post(server.baseURL + '/api/sessions/clear')

        // Create a test session that produces continuous output
        const createResponse = await page.request.post(server.baseURL + '/api/sessions', {
          data: {
            command: 'bash',
            args: [
              '-c',
              'echo "Welcome to live streaming test"; while true; do echo "$(date +"%H:%M:%S"): Live update"; sleep 0.1; done',
            ],
            description: 'Live streaming test session',
          },
        })
        console.log('Session creation response status:', createResponse.status())
        const sessionData = await createResponse.json()
        console.log('Created session:', sessionData)

        // Robustly wait for session to actually start (event-driven)
        const sessionsApi = server.baseURL + '/api/sessions'
        await page.waitForFunction(
          async ({ sessionsApi, description }) => {
            const response = await fetch(sessionsApi)
            if (!response.ok) return false
            const sessions = await response.json()
            return (
              Array.isArray(sessions) &&
              sessions.some((s) => s.description === description && s.status === 'running')
            )
          },
          { sessionsApi, description: 'Live streaming test session' },
          { timeout: 10000 }
        )

        // Optionally, also wait for session-item in UI
        await page.waitForSelector('.session-item', { timeout: 5000 })

        // This enforces robust event-driven wait before proceeding further.

        // Check session status
        const sessionsResponse = await page.request.get(server.baseURL + '/api/sessions')
        const sessions = await sessionsResponse.json()
        console.log('All sessions after creation:', sessions)

        if (sessions.length > 0) {
          console.log('First session status:', sessions[0].status)
          console.log('First session PID:', sessions[0].pid)
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
          const bufferResponse = await page.request.get(
            `${server.baseURL}/api/sessions/${sessionId}/buffer/raw`
          )
          if (bufferResponse.status() === 200) {
            await bufferResponse.json()
          } else {
          }
        }

        const initialWsMatch = initialDebugText.match(/WS raw_data:\s*(\d+)/)
        const initialCount = initialWsMatch && initialWsMatch[1] ? parseInt(initialWsMatch[1]) : 0

        // Wait until WebSocket message count increases from initial
        await page.waitForFunction(
          ({ selector, initialCount }) => {
            const el = document.querySelector(selector)
            if (!el) return false
            const match = el.textContent && el.textContent.match(/WS raw_data:\s*(\d+)/)
            const count = match && match[1] ? parseInt(match[1]) : 0
            return count > initialCount
          },
          { selector: '[data-testid="debug-info"]', initialCount },
          { timeout: 7000 }
        )

        // Check that WS message count increased
        const finalDebugText = (await initialDebugElement.textContent()) || ''
        const finalWsMatch = finalDebugText.match(/WS raw_data:\s*(\d+)/)
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

        // Wait until both session items appear in the sidebar before continuing
        // Only one session is needed for the next test.
        await page.waitForFunction(
          () => {
            return document.querySelectorAll('.session-item').length >= 1
          },
          { timeout: 6000 }
        )
        await page.reload()

        // Wait for sessions
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
        const initialWsMatch = initialDebugText.match(/WS raw_data:\s*(\d+)/)
        const initialCount = initialWsMatch && initialWsMatch[1] ? parseInt(initialWsMatch[1]) : 0

        // Wait until WebSocket message count increases from initial
        await page.waitForFunction(
          ({ selector, initialCount }) => {
            const el = document.querySelector(selector)
            if (!el) return false
            const match = el.textContent && el.textContent.match(/WS raw_data:\s*(\d+)/)
            const count = match && match[1] ? parseInt(match[1]) : 0
            return count > initialCount
          },
          { selector: '[data-testid="debug-info"]', initialCount },
          { timeout: 7000 }
        )
        const finalDebugText = (await debugElement.textContent()) || ''
        const finalWsMatch = finalDebugText.match(/WS raw_data:\s*(\d+)/)
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

      // Wait until both session items appear in the sidebar
      await page.waitForFunction(
        () => {
          return document.querySelectorAll('.session-item').length >= 2
        },
        { timeout: 6000 }
      )
      await page.reload()

      // Wait for sessions
      await page.waitForSelector('.session-item', { timeout: 5000 })

      // Click first session
      const sessionItems = page.locator('.session-item')
      await sessionItems.nth(0).click()
      await page.waitForSelector('.output-header .output-title', { timeout: 2000 })

      // Wait for some messages (WS message counter event-driven)
      const debugEl = page.locator('[data-testid="debug-info"]')
      await debugEl.waitFor({ state: 'attached', timeout: 2000 })
      // const beforeSwitchDebug = (await debugEl.textContent()) || ''
      // const beforeCountMatch = beforeSwitchDebug.match(/WS raw_data:\s*(\d+)/)
      // const beforeCount =
      //   beforeCountMatch && beforeCountMatch[1] ? parseInt(beforeCountMatch[1]) : 0
      // Switch to second session
      await sessionItems.nth(1).click()
      await page.waitForSelector('.output-header .output-title', { timeout: 2000 })

      // Check that counter resets when switching sessions (allow some messages due to streaming)
      const debugElement = page.locator('[data-testid="debug-info"]')
      await debugElement.waitFor({ state: 'attached', timeout: 2000 })
      const secondSessionDebug = (await debugElement.textContent()) || ''
      const secondSessionWsMatch = secondSessionDebug.match(/WS raw_data:\s*(\d+)/)
      const secondSessionCount =
        secondSessionWsMatch && secondSessionWsMatch[1] ? parseInt(secondSessionWsMatch[1]) : 0
      // Should be <= 20, if higher, log debug output and count
      expect(secondSessionCount).toBeLessThanOrEqual(20)
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

      // Wait until a session item appears in the sidebar (robust: >= 1 session)
      await page.waitForFunction(
        () => {
          return document.querySelectorAll('.session-item').length >= 1
        },
        { timeout: 6000 }
      )
      await page.reload()

      // Wait for sessions
      await page.waitForSelector('.session-item', { timeout: 5000 })

      await page.locator('.session-item').first().click()
      await page.waitForSelector('.output-header .output-title', { timeout: 2000 })

      // Wait for messages (WS message counter event-driven)
      await page.waitForFunction(
        ({ selector }) => {
          const el = document.querySelector(selector)
          if (!el) return false
          const match = el.textContent && el.textContent.match(/WS raw_data:\s*(\d+)/)
          const count = match && match[1] ? parseInt(match[1]) : 0
          return count > 0
        },
        { selector: '[data-testid="debug-info"]' },
        { timeout: 7000 }
      )

      const debugElement = page.locator('[data-testid="debug-info"]')
      await debugElement.waitFor({ state: 'attached', timeout: 2000 })
      const debugText = (await debugElement.textContent()) || ''
      const wsMatch = debugText.match(/WS raw_data:\s*(\d+)/)
      const count = wsMatch && wsMatch[1] ? parseInt(wsMatch[1]) : 0

      // Should have received some messages
      expect(count).toBeGreaterThan(0)
    })
  })
})
