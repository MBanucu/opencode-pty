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

      const inputRequests: string[] = []
      await page.route('**/api/sessions/*/input', async (route) => {
        const request = route.request()
        if (request.method() === 'POST') {
          const postData = request.postDataJSON()
          inputRequests.push(postData.data)
        }
        await route.continue()
      })

      await page.locator('.output-container').click()
      await page.focus('.xterm')
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
    page.on('console', (msg) => console.log('PAGE LOG:', msg.text()))
    await page.waitForSelector('h1:has-text("PTY Sessions")')

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

    await page.locator('.output-container').click()
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

    // Handle confirm dialog
    page.on('dialog', (dialog) => dialog.accept())

    // Kill the active session
    await page.locator('.kill-btn').click()

    // Wait for session to be inactive
    await page.waitForTimeout(1000)

    const inputRequests: string[] = []
    await page.route('**/api/sessions/*/input', async (route) => {
      if (route.request().method() === 'POST') {
        inputRequests.push(route.request().postDataJSON().data)
      }
      await route.continue()
    })

    await page.locator('.output-container').click()
    await page.keyboard.type('should not send')

    await page.waitForTimeout(500)

    // Should not send any input
    expect(inputRequests.length).toBe(0)
  })
})
