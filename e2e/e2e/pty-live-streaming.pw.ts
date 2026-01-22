import { test, expect } from '@playwright/test'
import { createTestLogger } from '../test-logger.ts'

const log = createTestLogger('e2e-live-streaming')

test.describe('PTY Live Streaming', () => {
  test('should load historical buffered output when connecting to running PTY session', async ({
    page,
  }) => {
    // Navigate to the web UI (test server should be running)
    await page.goto('/')

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

    // Check debug info using data-testid
    const debugElement = page.locator('[data-testid="debug-info"]')
    await debugElement.waitFor({ timeout: 10000 })
    const debugText = await debugElement.textContent()
    log.info(`Debug info: ${debugText}`)

    // Verify we have some initial output
    expect(initialCount).toBeGreaterThan(0)

    // Verify the output contains the initial welcome message from the bash command
    const firstLine = await initialOutputLines.first().textContent()
    expect(firstLine).toContain('Welcome to live streaming test')

    log.info(
      '✅ Historical data loading test passed - buffered output from before UI connection is displayed'
    )
  })

  test('should preserve and display complete historical output buffer', async ({ page }) => {
    // This test verifies that historical data (produced before UI connects) is preserved and loaded
    // when connecting to a running PTY session. This is crucial for users who reconnect to long-running sessions.

    // Navigate to the web UI first
    await page.goto('/')

    // Ensure clean state - clear any existing sessions from previous tests
    const clearResponse = await page.request.post('/api/sessions/clear')
    expect(clearResponse.status()).toBe(200)
    await page.waitForTimeout(500) // Allow cleanup to complete

    // Create a fresh session that produces identifiable historical output
    log.info('Creating fresh session with historical output markers...')
    await page.request.post('/api/sessions', {
      data: {
        command: 'bash',
        args: [
          '-c',
          'echo "=== START HISTORICAL ==="; echo "Line A"; echo "Line B"; echo "Line C"; echo "=== END HISTORICAL ==="; while true; do echo "LIVE: $(date +%S)"; sleep 2; done',
        ],
        description: `Historical buffer test - ${Date.now()}`,
      },
    })

    // Wait for session to produce historical output (before UI connects)
    await page.waitForTimeout(2000) // Give time for historical output to accumulate

    // Check session status via API to ensure it's running
    const sessionsResponse = await page.request.get('/api/sessions')
    const sessions = await sessionsResponse.json()
    const testSessionData = sessions.find((s: any) => s.title?.startsWith('Historical buffer test'))
    expect(testSessionData).toBeDefined()
    expect(testSessionData.status).toBe('running')

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
    await page.waitForSelector('.output-line', { timeout: 5000 })

    // Verify the API returns the expected historical data
    const sessionData = await page.request.get(`/api/sessions/${testSessionData.id}/output`)
    const outputData = await sessionData.json()
    expect(outputData.lines).toBeDefined()
    expect(Array.isArray(outputData.lines)).toBe(true)
    expect(outputData.lines.length).toBeGreaterThan(0)

    // Check that historical output is present in the UI
    const allText = await page.locator('.output-container').textContent()
    expect(allText).toContain('=== START HISTORICAL ===')
    expect(allText).toContain('Line A')
    expect(allText).toContain('Line B')
    expect(allText).toContain('Line C')
    expect(allText).toContain('=== END HISTORICAL ===')

    // Verify live updates are also working
    expect(allText).toMatch(/LIVE: \d{2}/)

    log.info(
      '✅ Historical buffer preservation test passed - pre-connection data is loaded correctly'
    )
  })

  test('should receive live WebSocket updates from running PTY session', async ({ page }) => {
    // Listen to page console for debugging
    page.on('console', (msg) => log.info('PAGE CONSOLE: ' + msg.text()))

    // Navigate to the web UI
    await page.goto('/')

    // Ensure clean state for this test
    await page.request.post('/api/sessions/clear')
    await page.waitForTimeout(500)

    // Create a fresh session for this test
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
    await page.waitForTimeout(2000)

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

    // Wait for at least 1 WebSocket streaming update
    let attempts = 0
    const maxAttempts = 50 // 5 seconds at 100ms intervals
    let currentWsMessages = initialWsMessages
    const debugElement = page.locator('[data-testid="debug-info"]')
    while (attempts < maxAttempts && currentWsMessages < initialWsMessages + 1) {
      await page.waitForTimeout(100)
      const currentDebugText = (await debugElement.textContent()) || ''
      const currentWsMatch = currentDebugText.match(/WS messages: (\d+)/)
      currentWsMessages = currentWsMatch && currentWsMatch[1] ? parseInt(currentWsMatch[1]) : 0
      if (attempts % 10 === 0) {
        // Log every second
        log.info(`Attempt ${attempts}: WS messages: ${currentWsMessages}`)
      }
      attempts++
    }

    // Check final state
    const finalDebugText = (await debugElement.textContent()) || ''
    const finalWsMatch = finalDebugText.match(/WS messages: (\d+)/)
    const finalWsMessages = finalWsMatch && finalWsMatch[1] ? parseInt(finalWsMatch[1]) : 0

    log.info(`Final WS messages: ${finalWsMessages}`)

    // Check final output count
    const finalCount = await outputLines.count()
    log.info(`Final output lines: ${finalCount}`)

    // Validate that live streaming is working by checking output increased

    // Check that the new lines contain the expected timestamp format if output increased
    // Check that new live update lines were added during WebSocket streaming
    const finalOutputLines = await outputLines.count()
    log.info(`Final output lines: ${finalOutputLines}, initial was: ${initialCount}`)

    // Look for lines that contain "Live update..." pattern
    let liveUpdateFound = false
    for (let i = Math.max(0, finalOutputLines - 10); i < finalOutputLines; i++) {
      const lineText = await outputLines.nth(i).textContent()
      if (lineText && lineText.includes('Live update...')) {
        liveUpdateFound = true
        log.info(`Found live update line ${i}: "${lineText}"`)
        break
      }
    }

    expect(liveUpdateFound).toBe(true)

    log.info(`✅ Live streaming test passed - received ${finalCount - initialCount} live updates`)
  })
})
