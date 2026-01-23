import { test as extendedTest, expect } from './fixtures'

extendedTest.describe('Terminal Mode Switching', () => {
  extendedTest('should display mode switcher with radio buttons', async ({ page, server }) => {
    await page.goto(server.baseURL + '/')

    // Wait for the page to load
    await page.waitForSelector('.container', { timeout: 10000 })

    // Check if mode switcher exists
    const modeSwitcher = page.locator('[data-testid="terminal-mode-switcher"]')
    await expect(modeSwitcher).toBeVisible()

    // Check if radio buttons exist
    const rawRadio = page.locator('input[type="radio"][value="raw"]')
    const processedRadio = page.locator('input[type="radio"][value="processed"]')

    await expect(rawRadio).toBeVisible()
    await expect(processedRadio).toBeVisible()
  })

  extendedTest('should default to processed mode', async ({ page, server }) => {
    await page.goto(server.baseURL + '/')

    // Wait for the page to load
    await page.waitForSelector('.container', { timeout: 10000 })

    // Check if processed mode is selected by default
    const processedRadio = page.locator('input[type="radio"][value="processed"]')
    await expect(processedRadio).toBeChecked()
  })

  extendedTest('should switch between raw and processed modes', async ({ page, server }) => {
    await page.goto(server.baseURL + '/')

    // Wait for the page to load
    await page.waitForSelector('.container', { timeout: 10000 })

    // Start with processed mode
    const processedRadio = page.locator('input[type="radio"][value="processed"]')
    await expect(processedRadio).toBeChecked()

    // Switch to raw mode
    const rawRadio = page.locator('input[type="radio"][value="raw"]')
    await rawRadio.click()

    // Check that raw mode is now selected
    await expect(rawRadio).toBeChecked()
    await expect(processedRadio).not.toBeChecked()

    // Switch back to processed mode
    await processedRadio.click()

    // Check that processed mode is selected again
    await expect(processedRadio).toBeChecked()
    await expect(rawRadio).not.toBeChecked()
  })

  extendedTest('should persist mode selection in localStorage', async ({ page, server }) => {
    await page.goto(server.baseURL + '/')

    // Wait for the page to load
    await page.waitForSelector('.container', { timeout: 10000 })

    // Switch to raw mode
    const rawRadio = page.locator('input[type="radio"][value="raw"]')
    await rawRadio.click()

    // Check localStorage
    const storedMode = await page.evaluate(() => localStorage.getItem('terminal-mode'))
    expect(storedMode).toBe('raw')

    // Reload the page
    await page.reload()

    // Wait for the page to load again
    await page.waitForSelector('.container', { timeout: 10000 })

    // Check that raw mode is still selected
    await expect(rawRadio).toBeChecked()
  })

  extendedTest(
    'should display different content in raw vs processed modes',
    async ({ page, server }) => {
      // Clear any existing sessions
      await page.request.post(server.baseURL + '/api/sessions/clear')

      // Create a test session with some output
      const createResponse = await page.request.post(server.baseURL + '/api/sessions', {
        data: {
          command: 'echo',
          args: ['Hello World'],
          description: 'Test session for mode switching',
        },
      })
      expect(createResponse.status()).toBe(200)

      await page.goto(server.baseURL + '/')

      // Wait for the session to appear and select it
      await page.waitForSelector('.session-item', { timeout: 5000 })
      await page.locator('.session-item').first().click()

      // Wait for terminal to be ready - use the specific terminal class
      await page.waitForSelector('.terminal.xterm', { timeout: 5000 })

      // Wait for output to appear
      await page.waitForTimeout(2000)

      // Default should be processed mode - check for clean output
      const processedContent = await page.locator('.terminal.xterm').textContent()
      expect(processedContent).toContain('Hello World')

      // Switch to raw mode
      const rawRadio = page.locator('input[type="radio"][value="raw"]')
      await rawRadio.click()

      // Wait for mode switch
      await page.waitForTimeout(500)

      // In raw mode, we should see the actual terminal content (may include ANSI codes, etc.)
      const rawContent = await page.locator('.terminal.xterm').textContent()
      expect(rawContent).toBeTruthy()
      expect(rawContent?.length).toBeGreaterThan(0)

      // Switch back to processed mode
      const processedRadio = page.locator('input[type="radio"][value="processed"]')
      await processedRadio.click()

      // Wait for mode switch
      await page.waitForTimeout(500)

      // Should see clean output again
      const processedContentAgain = await page.locator('.terminal.xterm').textContent()
      expect(processedContentAgain).toContain('Hello World')
    }
  )

  extendedTest(
    'should maintain WebSocket updates when switching modes',
    async ({ page, server }) => {
      // Clear any existing sessions
      await page.request.post(server.baseURL + '/api/sessions/clear')

      // Create a session that produces continuous output
      const createResponse = await page.request.post(server.baseURL + '/api/sessions', {
        data: {
          command: 'bash',
          args: ['-c', 'for i in {1..5}; do echo "Line $i: $(date)"; sleep 0.5; done'],
          description: 'Continuous output session for WebSocket test',
        },
      })
      expect(createResponse.status()).toBe(200)

      await page.goto(server.baseURL + '/')

      // Wait for the session to appear and select it
      await page.waitForSelector('.session-item', { timeout: 5000 })
      await page.locator('.session-item').first().click()

      // Wait for terminal to be ready
      await page.waitForSelector('.terminal.xterm', { timeout: 5000 })

      // Wait for initial output
      await page.waitForTimeout(2000)

      // Get initial content
      const initialContent = await page.locator('.terminal.xterm').textContent()
      expect(initialContent).toContain('Line 1')

      // Switch to raw mode while session is running
      const rawRadio = page.locator('input[type="radio"][value="raw"]')
      await rawRadio.click()

      // Wait for more output to arrive
      await page.waitForTimeout(2000)

      // Verify that new output appears in raw mode
      const rawContent = await page.locator('.terminal.xterm').textContent()
      expect(rawContent).toContain('Line 3') // Should have received more lines

      // Switch back to processed mode
      const processedRadio = page.locator('input[type="radio"][value="processed"]')
      await processedRadio.click()

      // Wait for final output
      await page.waitForTimeout(1500)

      // Verify that final output appears in processed mode
      const finalContent = await page.locator('.terminal.xterm').textContent()
      expect(finalContent).toContain('Line 5') // Should have received all lines
    }
  )
})
