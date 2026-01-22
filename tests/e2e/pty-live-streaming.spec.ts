import { test, expect } from '@playwright/test'
import { createLogger } from '../../src/plugin/logger.ts'

const log = createLogger('e2e-live-streaming')

test.use({
  browserName: 'chromium',
  launchOptions: {
    executablePath: '/run/current-system/sw/bin/google-chrome-stable',
    headless: false,
  },
})

test.describe('PTY Live Streaming', () => {
  test('should display buffered output from running PTY session immediately', async ({ page }) => {
    // Navigate to the web UI (test server should be running)
    await page.goto('http://localhost:8867')

    // Check if there are sessions, if not, create one for testing
    const initialResponse = await page.request.get('/api/sessions')
    const initialSessions = await initialResponse.json()
    if (initialSessions.length === 0) {
      log.info('No sessions found, creating a test session for streaming...')
      await page.request.post('/api/sessions', {
        data: {
          command: 'bash',
          args: [
            '-c',
            'echo "Welcome to live streaming test"; echo "Type commands and see real-time output"; while true; do LC_TIME=C date +"%a %d. %b %H:%M:%S %Z %Y: Live update..."; sleep 0.1; done',
          ],
          description: 'Live streaming test session',
        },
      })
      // Wait a bit for the session to start and reload to get updated session list
      await page.waitForTimeout(1000)
      await page.reload()
    }

    // Wait for sessions to load
    await page.waitForSelector('.session-item', { timeout: 5000 })

    // Find the running session (there should be at least one)
    const sessionCount = await page.locator('.session-item').count()
    log.info(`📊 Found ${sessionCount} sessions`)

    // Find a running session
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

    log.info('✅ Found running session')

    // Click on the running session
    await runningSession.click()

    // Check if the session became active (header should appear)
    await page.waitForSelector('.output-header .output-title', { timeout: 2000 })

    // Check that the title contains the session info
    const headerTitle = await page.locator('.output-header .output-title').textContent()
    expect(headerTitle).toContain('Live streaming test session')

    // Now wait for output to appear
    await page.waitForSelector('.output-line', { timeout: 5000 })

    // Get initial output count
    const initialOutputLines = page.locator('.output-line')
    const initialCount = await initialOutputLines.count()
    log.info(`Initial output lines: ${initialCount}`)

    // Check debug info
    const debugText = await page.locator('text=/Debug:/').textContent()
    log.info(`Debug info: ${debugText}`)

    // Verify we have some initial output
    expect(initialCount).toBeGreaterThan(0)

    // Verify the output contains expected content (from the bash command)
    const firstLine = await initialOutputLines.first().textContent()
    expect(firstLine).toContain('Welcome to live streaming test')

    log.info('✅ Buffered output test passed - running session shows output immediately')
  })

  test('should receive live WebSocket updates from running PTY session', async ({ page }) => {
    // Listen to page console for debugging
    page.on('console', (msg) => log.info('PAGE CONSOLE: ' + msg.text()))

    // Navigate to the web UI
    await page.goto('http://localhost:8867')

    // Check if there are sessions, if not, create one for testing
    const initialResponse = await page.request.get('/api/sessions')
    const initialSessions = await initialResponse.json()
    if (initialSessions.length === 0) {
      log.info('No sessions found, creating a test session for streaming...')
      await page.request.post('/api/sessions', {
        data: {
          command: 'bash',
          args: [
            '-c',
            'echo "Welcome to live streaming test"; echo "Type commands and see real-time output"; while true; do LC_TIME=C date +"%a %d. %b %H:%M:%S %Z %Y: Live update..."; sleep 0.1; done',
          ],
          description: 'Live streaming test session',
        },
      })
      // Wait a bit for the session to start and reload to get updated session list
      await page.waitForTimeout(1000)
      await page.reload()
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

    // Wait for initial output
    await page.waitForSelector('.output-line', { timeout: 3000 })

    // Get initial count
    const outputLines = page.locator('.output-line')
    const initialCount = await outputLines.count()
    expect(initialCount).toBeGreaterThan(0)

    log.info(`Initial output lines: ${initialCount}`)

    // Check the debug info
    const debugInfo = await page.locator('.output-container').textContent()
    const debugText = (debugInfo || '') as string
    log.info(`Debug info: ${debugText}`)

    // Extract WS message count
    const wsMatch = debugText.match(/WS messages: (\d+)/)
    const initialWsMessages = wsMatch && wsMatch[1] ? parseInt(wsMatch[1]) : 0
    log.info(`Initial WS messages: ${initialWsMessages}`)

    // Wait for at least 5 WebSocket streaming updates
    let attempts = 0
    const maxAttempts = 50 // 5 seconds at 100ms intervals
    let currentWsMessages = initialWsMessages
    while (attempts < maxAttempts && currentWsMessages < initialWsMessages + 5) {
      await page.waitForTimeout(100)
      const currentDebugInfo = await page.locator('.output-container').textContent()
      const currentDebugText = (currentDebugInfo || '') as string
      const currentWsMatch = currentDebugText.match(/WS messages: (\d+)/)
      currentWsMessages = currentWsMatch && currentWsMatch[1] ? parseInt(currentWsMatch[1]) : 0
      attempts++
    }

    // Check final state
    const finalDebugInfo = await page.locator('.output-container').textContent()
    const finalDebugText = (finalDebugInfo || '') as string
    const finalWsMatch = finalDebugText.match(/WS messages: (\d+)/)
    const finalWsMessages = finalWsMatch && finalWsMatch[1] ? parseInt(finalWsMatch[1]) : 0

    log.info(`Final WS messages: ${finalWsMessages}`)

    // Check final output count
    const finalCount = await outputLines.count()
    log.info(`Final output lines: ${finalCount}`)

    // The test requires at least 5 WebSocket messages to validate streaming is working
    if (finalWsMessages >= initialWsMessages + 5) {
      log.info(
        `✅ Received at least 5 WebSocket messages (${finalWsMessages - initialWsMessages}) - streaming works!`
      )
    } else {
      log.info(`❌ Fewer than 5 WebSocket messages received - streaming is not working`)
      log.info(`WS messages: ${initialWsMessages} -> ${finalWsMessages}`)
      log.info(`Output lines: ${initialCount} -> ${finalCount}`)
      throw new Error('Live streaming test failed: Fewer than 5 WebSocket messages received')
    }

    // Check that the new lines contain the expected timestamp format if output increased
    if (finalCount > initialCount) {
      const lastTimestampLine = await outputLines.nth(finalCount - 2).textContent()
      expect(lastTimestampLine).toMatch(/\w{3} \d+\. \w{3} \d+:\d+:\d+ \w{3} \d+: Live update\.\.\./)
    }

    log.info(`✅ Live streaming test passed - received ${finalCount - initialCount} live updates`)
  })
})
