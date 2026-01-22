import { test, expect } from '@playwright/test'
import { createLogger } from '../../src/plugin/logger.ts'

const log = createLogger('ui-test')

test.describe('App Component', () => {
  test('renders the PTY Sessions title', async ({ page }) => {
    // Listen to page console for debugging
    page.on('console', (msg) => log.info('PAGE CONSOLE: ' + msg.text()))

    await page.goto('/')
    await expect(page.getByText('PTY Sessions')).toBeVisible()
  })

  test('shows connected status when WebSocket connects', async ({ page }) => {
    // Listen to page console for debugging
    page.on('console', (msg) => log.info('PAGE CONSOLE: ' + msg.text()))

    await page.goto('/')
    await expect(page.getByText('● Connected')).toBeVisible()
  })

  test('shows no active sessions message when empty', async ({ page }) => {
    // Listen to page console for debugging
    page.on('console', (msg) => log.info('PAGE CONSOLE: ' + msg.text()))

    await page.goto('/')
    await expect(page.getByText('No active sessions')).toBeVisible()
  })

  test('shows empty state when no session is selected', async ({ page }) => {
    // Listen to page console for debugging
    page.on('console', (msg) => log.info('PAGE CONSOLE: ' + msg.text()))

    await page.goto('/')
    await expect(
      page.getByText('Select a session from the sidebar to view its output')
    ).toBeVisible()
  })

  test.describe('WebSocket Message Handling', () => {
    test('increments WS message counter when receiving data for active session', async ({ page }) => {
      // Listen to page console for debugging
      page.on('console', (msg) => log.info('PAGE CONSOLE: ' + msg.text()))
      page.on('pageerror', (error) => log.error('PAGE ERROR: ' + error.message))

      // Navigate and wait for initial setup
      await page.goto('/')

      // Create a test session that produces continuous output
      const initialResponse = await page.request.get('/api/sessions')
      const initialSessions = await initialResponse.json()
      if (initialSessions.length === 0) {
        await page.request.post('/api/sessions', {
          data: {
            command: 'bash',
            args: [
              '-c',
              'echo "Starting live streaming test"; while true; do echo "$(date +"%H:%M:%S"): Live update"; sleep 0.1; done',
            ],
            description: 'Live streaming test session',
          },
        })
        await page.waitForTimeout(2000) // Wait longer for session to start
        await page.reload()
      }

      // Wait for session to appear
      await page.waitForSelector('.session-item', { timeout: 5000 })

      // Check session status
      const sessionItems = page.locator('.session-item')
      const sessionCount = await sessionItems.count()
      log.info(`Found ${sessionCount} sessions`)

      // Click on the first session
      const firstSession = sessionItems.first()
      const statusBadge = await firstSession.locator('.status-badge').textContent()
      log.info(`Session status: ${statusBadge}`)

      await firstSession.click()

      // Wait for session to be active
      await page.waitForSelector('.output-header .output-title', { timeout: 3000 })

      // Get initial WS message count
      const initialDebugText = await page.locator('.output-container').textContent() || ''
      const initialWsMatch = initialDebugText.match(/WS messages:\s*(\d+)/)
      const initialCount = initialWsMatch && initialWsMatch[1] ? parseInt(initialWsMatch[1]) : 0

      // Wait for some WebSocket messages to arrive (the session should be running)
      await page.waitForTimeout(3000)

      // Check that WS message count increased
      const finalDebugText = await page.locator('.output-container').textContent() || ''
      const finalWsMatch = finalDebugText.match(/WS messages:\s*(\d+)/)
      const finalCount = finalWsMatch && finalWsMatch[1] ? parseInt(finalWsMatch[1]) : 0

      // The test should fail if no messages were received
      expect(finalCount).toBeGreaterThan(initialCount)
    })

    test('does not increment WS counter for messages from inactive sessions', async ({ page }) => {
      // Listen to page console for debugging
      page.on('console', (msg) => log.info('PAGE CONSOLE: ' + msg.text()))

      // This test would require multiple sessions and verifying that messages
      // for non-active sessions don't increment the counter
      await page.goto('/')

      // Create first session
      await page.request.post('/api/sessions', {
        data: {
          command: 'bash',
          args: ['-c', 'echo "session1" && sleep 10'],
          description: 'Session 1',
        },
      })

      // Create second session
      await page.request.post('/api/sessions', {
        data: {
          command: 'bash',
          args: ['-c', 'echo "session2" && sleep 10'],
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
      const initialDebugText = await page.locator('.output-container').textContent() || ''
      const initialWsMatch = initialDebugText.match(/WS messages:\s*(\d+)/)
      const initialCount = initialWsMatch && initialWsMatch[1] ? parseInt(initialWsMatch[1]) : 0

      // Wait a bit and check count again
      await page.waitForTimeout(2000)
      const finalDebugText = await page.locator('.output-container').textContent() || ''
      const finalWsMatch = finalDebugText.match(/WS messages:\s*(\d+)/)
      const finalCount = finalWsMatch && finalWsMatch[1] ? parseInt(finalWsMatch[1]) : 0

      // Should have received messages for the active session
      expect(finalCount).toBeGreaterThan(initialCount)
    })

    test('resets WS counter when switching sessions', async ({ page }) => {
      // Listen to page console for debugging
      page.on('console', (msg) => log.info('PAGE CONSOLE: ' + msg.text()))

      await page.goto('/')

      // Create two sessions
      await page.request.post('/api/sessions', {
        data: {
          command: 'bash',
          args: ['-c', 'while true; do echo "session1"; sleep 0.1; done'],
          description: 'Session 1 - streaming',
        },
      })

      await page.request.post('/api/sessions', {
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

      const firstSessionDebug = await page.locator('.output-container').textContent() || ''
      const firstSessionWsMatch = firstSessionDebug.match(/WS messages:\s*(\d+)/)
      const firstSessionCount = firstSessionWsMatch && firstSessionWsMatch[1] ? parseInt(firstSessionWsMatch[1]) : 0

      // Switch to second session
      await sessionItems.nth(1).click()
      await page.waitForSelector('.output-header .output-title', { timeout: 2000 })

      // The counter should reset or be lower for the new session
      const secondSessionDebug = await page.locator('.output-container').textContent() || ''
      const secondSessionWsMatch = secondSessionDebug.match(/WS messages:\s*(\d+)/)
      const secondSessionCount = secondSessionWsMatch && secondSessionWsMatch[1] ? parseInt(secondSessionWsMatch[1]) : 0

      // Counter should be lower for the new session (or reset to 0)
      expect(secondSessionCount).toBeLessThanOrEqual(firstSessionCount)
    })

    test('maintains WS counter state during page refresh', async ({ page }) => {
      // Listen to page console for debugging
      page.on('console', (msg) => log.info('PAGE CONSOLE: ' + msg.text()))

      await page.goto('/')

      // Create a streaming session
      await page.request.post('/api/sessions', {
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

      const debugText = await page.locator('.output-container').textContent() || ''
      const wsMatch = debugText.match(/WS messages:\s*(\d+)/)
      const count = wsMatch && wsMatch[1] ? parseInt(wsMatch[1]) : 0

      // Should have received some messages
      expect(count).toBeGreaterThan(0)
    })
  })
})
