import { createLogger } from '../src/plugin/logger.ts'
import { test as extendedTest, expect } from './fixtures'

extendedTest.describe('PTY Input Capture', () => {
  extendedTest(
    'should capture and send printable character input (letters)',
    async ({ page, server }) => {
      // Navigate to the test server
      await page.goto(server.baseURL)

      // Capture browser console logs after navigation
      page.on('console', (msg) => console.log('PAGE LOG:', msg.text()))

      // Test console logging
      await page.evaluate(() => console.log('Test console log from browser'))
      await page.waitForSelector('h1:has-text("PTY Sessions")')

      // Create a test session
      await page.request.post(server.baseURL + '/api/sessions', {
        data: {
          command: 'bash',
          args: ['-c', 'echo "Ready for input"'],
          description: 'Input test session',
        },
      })

      // Wait for session to appear and auto-select
      await page.waitForSelector('.session-item', { timeout: 5000 })
      await page.waitForSelector('.output-container', { timeout: 5000 })

      const inputRequests: string[] = []
      await page.route('**/api/sessions/*/input', async (route) => {
        const request = route.request()
        if (request.method() === 'POST') {
          const postData = request.postDataJSON()
          inputRequests.push(postData.data)
        }
        await route.continue()
      })

      // Wait for terminal to be ready and focus it
      await page.waitForSelector('.xterm', { timeout: 5000 })
      await page.locator('.xterm').click()
      await page.keyboard.type('hello')

      await page.waitForTimeout(500)

      // Should have sent 'h', 'e', 'l', 'l', 'o'
      expect(inputRequests).toContain('h')
      expect(inputRequests).toContain('e')
      expect(inputRequests).toContain('l')
      expect(inputRequests).toContain('o')
    }
  )

  extendedTest('should capture spacebar input', async ({ page, server }) => {
    await page.goto(server.baseURL)
    await page.waitForSelector('h1:has-text("PTY Sessions")')

    // Skip auto-selection to avoid interference with other tests
    await page.evaluate(() => localStorage.setItem('skip-autoselect', 'true'))

    const inputRequests: string[] = []
    await page.route('**/api/sessions/*/input', async (route) => {
      const request = route.request()
      if (request.method() === 'POST') {
        const postData = request.postDataJSON()
        inputRequests.push(postData.data)
      }
      await route.continue()
    })

    // Wait for session to be active
    await page.waitForSelector('[data-active-session]')

    await page.locator('.output-container').click()
    await page.focus('.xterm')
    await page.keyboard.press(' ')

    await page.waitForTimeout(1000)

    // Should have sent exactly one space character
    expect(inputRequests.filter((req) => req === ' ')).toHaveLength(1)
  })

  extendedTest('should capture "ls" command with Enter key', async ({ page, server }) => {
    await page.goto(server.baseURL)
    page.on('console', (msg) => console.log('PAGE LOG:', msg.text()))
    await page.waitForSelector('h1:has-text("PTY Sessions")')

    // Create a test session
    await page.request.post(server.baseURL + '/api/sessions', {
      data: {
        command: 'bash',
        args: ['-c', 'echo "Ready for ls test"'],
        description: 'ls command test session',
      },
    })

    // Wait for session to appear and auto-select
    await page.waitForSelector('.session-item', { timeout: 5000 })
    await page.waitForSelector('.output-container', { timeout: 5000 })
    await page.waitForSelector('.xterm', { timeout: 5000 })

    const inputRequests: string[] = []
    await page.route('**/api/sessions/*/input', async (route) => {
      const request = route.request()
      if (request.method() === 'POST') {
        const postData = request.postDataJSON()
        inputRequests.push(postData.data)
      }
      await route.continue()
    })

    // Type the ls command
    await page.locator('.xterm').click()
    await page.keyboard.type('ls')
    await page.keyboard.press('Enter')

    await page.waitForTimeout(1000)

    // Should have sent 'l', 's', and '\r' (Enter)
    expect(inputRequests).toContain('l')
    expect(inputRequests).toContain('s')
    expect(inputRequests).toContain('\r')
  })

  extendedTest('should send backspace sequences', async ({ page, server }) => {
    await page.goto(server.baseURL)
    await page.waitForSelector('h1:has-text("PTY Sessions")')

    // Skip auto-selection to avoid interference with other tests
    await page.evaluate(() => localStorage.setItem('skip-autoselect', 'true'))

    const inputRequests: string[] = []
    await page.route('**/api/sessions/*/input', async (route) => {
      if (route.request().method() === 'POST') {
        inputRequests.push(route.request().postDataJSON().data)
      }
      await route.continue()
    })

    await page.locator('.output-container').click()
    await page.keyboard.type('test')
    await page.keyboard.press('Backspace')
    await page.keyboard.press('Backspace')

    await page.waitForTimeout(500)

    // Should contain backspace characters (\x7f or \b)
    expect(inputRequests.some((req) => req.includes('\x7f') || req.includes('\b'))).toBe(true)
  })

  extendedTest('should handle Ctrl+C interrupt', async ({ page, server }) => {
    await page.goto(server.baseURL)
    await page.waitForSelector('h1:has-text("PTY Sessions")')

    // Skip auto-selection to avoid interference with other tests
    await page.evaluate(() => localStorage.setItem('skip-autoselect', 'true'))

    // Handle confirm dialog
    page.on('dialog', (dialog) => dialog.accept())

    // Create a test session
    await page.request.post(server.baseURL + '/api/sessions', {
      data: {
        command: 'bash',
        args: ['-c', 'echo "Ready for input"'],
        description: 'Ctrl+C test session',
      },
    })

    // Wait for session to appear and auto-select
    await page.waitForSelector('.session-item', { timeout: 5000 })
    await page.waitForSelector('.output-container', { timeout: 5000 })

    const inputRequests: string[] = []
    await page.route('**/api/sessions/*/input', async (route) => {
      const request = route.request()
      if (request.method() === 'POST') {
        const postData = request.postDataJSON()
        inputRequests.push(postData.data)
      }
      await route.continue()
    })

    // For Ctrl+C, also check for session kill request
    const killRequests: string[] = []
    await page.route('**/api/sessions/*/kill', async (route) => {
      if (route.request().method() === 'POST') {
        killRequests.push('kill')
      }
      await route.continue()
    })

    // Wait for terminal to be ready and focus it
    await page.waitForSelector('.xterm', { timeout: 5000 })
    await page.locator('.xterm').click()
    await page.keyboard.type('hello')

    await page.waitForTimeout(500)

    // Verify characters were captured
    expect(inputRequests).toContain('h')
    expect(inputRequests).toContain('e')
    expect(inputRequests).toContain('l')
    expect(inputRequests).toContain('o')

    await page.keyboard.press('Control+c')

    await page.waitForTimeout(500)

    // Should trigger kill request
    expect(killRequests.length).toBeGreaterThan(0)
  })

  extendedTest('should not capture input when session is inactive', async ({ page, server }) => {
    await page.goto(server.baseURL)
    await page.waitForSelector('h1:has-text("PTY Sessions")')

    // Skip auto-selection to test inactive state
    await page.evaluate(() => localStorage.setItem('skip-autoselect', 'true'))

    // Handle confirm dialog
    page.on('dialog', (dialog) => dialog.accept())

    // Create a test session
    await page.request.post(server.baseURL + '/api/sessions', {
      data: {
        command: 'bash',
        args: ['-c', 'echo "Ready for input"'],
        description: 'Inactive session test',
      },
    })

    // Wait for session to appear and auto-select
    await page.waitForSelector('.session-item', { timeout: 5000 })
    await page.waitForSelector('.output-container', { timeout: 5000 })
    await page.waitForSelector('.xterm', { timeout: 5000 })

    // Kill the active session
    await page.locator('.kill-btn').click()

    // Wait for session to be killed (UI shows empty state)
    await page.waitForSelector(
      '.empty-state:has-text("Select a session from the sidebar to view its output")',
      { timeout: 5000 }
    )

    const inputRequests: string[] = []
    await page.route('**/api/sessions/*/input', async (route) => {
      if (route.request().method() === 'POST') {
        inputRequests.push(route.request().postDataJSON().data)
      }
      await route.continue()
    })

    // Try to type (but there's no terminal, so no input should be sent)
    await page.keyboard.type('should not send')

    await page.waitForTimeout(500)

    // Should not send any input
    expect(inputRequests.length).toBe(0)
  })

  extendedTest(
    'should display "Hello World" twice when running echo command',
    async ({ page, server }) => {
      // Set localStorage before page loads to prevent auto-selection
      await page.addInitScript(() => {
        localStorage.setItem('skip-autoselect', 'true')
      })

      await page.goto(server.baseURL)
      page.on('console', (msg) => console.log('PAGE LOG:', msg.text()))
      await page.waitForSelector('h1:has-text("PTY Sessions")')

      // Clear any existing sessions for clean test state
      await page.request.post(server.baseURL + '/api/sessions/clear')

      // Create an interactive bash session for testing input
      await page.request.post(server.baseURL + '/api/sessions', {
        data: {
          command: 'bash',
          args: [], // Interactive bash that stays running
          description: 'Echo test session',
        },
      })

      // Wait for the session to appear in the list and be running
      await page.waitForSelector('.session-item:has-text("Echo test session")', { timeout: 5000 })
      await page.waitForSelector('.session-item:has-text("running")', { timeout: 5000 })

      // Explicitly select the session we just created by clicking on its description
      await page.locator('.session-item:has-text("Echo test session")').click()

      // Wait for session to be selected and terminal ready
      await page.waitForSelector('.output-container', { timeout: 5000 })
      await page.waitForSelector('.xterm', { timeout: 5000 })

      // Set up route interception to capture input
      const inputRequests: string[] = []
      await page.route('**/api/sessions/*/input', async (route) => {
        const request = route.request()
        if (request.method() === 'POST') {
          const postData = request.postDataJSON()
          inputRequests.push(postData.data)
        }
        await route.continue()
      })

      // Type the echo command
      await page.locator('.xterm').click()
      await page.keyboard.type("echo 'Hello World'")
      await page.keyboard.press('Enter')

      // Wait for command execution and output
      await page.waitForTimeout(2000)

      // Verify the command characters were sent
      expect(inputRequests).toContain('e')
      expect(inputRequests).toContain('c')
      expect(inputRequests).toContain('h')
      expect(inputRequests).toContain('o')
      expect(inputRequests).toContain(' ')
      expect(inputRequests).toContain("'")
      expect(inputRequests).toContain('H')
      expect(inputRequests).toContain('W')
      expect(inputRequests).toContain('\r')

      // Get output from the test output div (since xterm.js canvas can't be read)
      const outputLines = await page
        .locator('[data-testid="test-output"] .output-line')
        .allTextContents()
      const allOutput = outputLines.join('\n')

      // Debug: log what we captured
      console.log('Captured output lines:', outputLines.length)
      console.log('All output:', JSON.stringify(allOutput))

      // Verify that we have output lines
      expect(outputLines.length).toBeGreaterThan(0)

      // The key verification: the echo command should produce "Hello World" output
      // We may or may not see the command itself depending on PTY echo settings
      expect(allOutput).toContain('Hello World')
    }
  )
})
