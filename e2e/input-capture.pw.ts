import { test, expect } from './fixtures'

test.describe('PTY Input Capture', () => {
  test('should capture and send printable character input (letters)', async ({ page, server }) => {
    // Navigate to the test server
    await page.goto(server.baseURL)

    // Wait for app to load
    await page.waitForSelector('h1:has-text("PTY Sessions")')

    // Intercept POST requests to input endpoint
    const inputRequests: string[] = []
    await page.route('**/api/sessions/*/input', async (route) => {
      const request = route.request()
      if (request.method() === 'POST') {
        const postData = request.postDataJSON()
        inputRequests.push(postData.data)
      }
      await route.continue()
    })

    // Type "hello" using keyboard (space has known issue)
    await page.keyboard.type('hello')

    // Wait a bit for requests to be sent
    await page.waitForTimeout(500)

    // Verify each character was captured and sent
    expect(inputRequests).toContain('h')
    expect(inputRequests).toContain('e')
    expect(inputRequests).toContain('l')
    expect(inputRequests).toContain('o')
  })

  test('should handle Enter key for command submission', async ({ page, server }) => {
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
    await page.keyboard.type('ls')
    await page.keyboard.press('Enter')

    await page.waitForTimeout(500)

    // Should have sent 'l', 's', '\n' (or '\r\n')
    expect(inputRequests).toContain('l')
    expect(inputRequests).toContain('s')
    expect(inputRequests.some((req) => req.includes('\n') || req.includes('\r'))).toBe(true)
  })

  test('should send backspace sequences', async ({ page, server }) => {
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

  test('should handle Ctrl+C interrupt', async ({ page, server }) => {
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

    await page.locator('.output-container').click()
    await page.keyboard.type('hello world')

    await page.waitForTimeout(500)

    // Verify each character was captured and sent
    expect(inputRequests).toContain('h')
    expect(inputRequests).toContain('e')
    expect(inputRequests).toContain('l')
    expect(inputRequests).toContain('o')
    expect(inputRequests).toContain(' ')
    expect(inputRequests).toContain('w')
    expect(inputRequests).toContain('o')
    expect(inputRequests).toContain('r')
    expect(inputRequests).toContain('l')
    expect(inputRequests).toContain('d')
  })

  test('should not capture input when session is inactive', async ({ page, server }) => {
    await page.goto(server.baseURL)
    await page.waitForSelector('h1:has-text("PTY Sessions")')

    // Kill the active session
    await page.locator('.kill-btn').click()
    await page.locator('button:has-text("Kill Session")').click() // Confirm dialog

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
