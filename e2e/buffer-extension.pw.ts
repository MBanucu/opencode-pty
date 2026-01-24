import { test as extendedTest, expect } from './fixtures'

extendedTest.describe('Buffer Extension on Input', () => {
  extendedTest(
    'should extend buffer when sending input to interactive bash session',
    async ({ page, server }) => {
      // Clear any existing sessions
      await page.request.post(server.baseURL + '/api/sessions/clear')

      // Create interactive bash session
      const createResponse = await page.request.post(server.baseURL + '/api/sessions', {
        data: {
          command: 'bash',
          args: [],
          description: 'Buffer extension test session',
        },
      })
      expect(createResponse.status()).toBe(200)
      const sessionData = await createResponse.json()
      const sessionId = sessionData.id

      // Navigate to the page
      await page.goto(server.baseURL)
      await page.waitForSelector('h1:has-text("PTY Sessions")')

      // Wait for session to appear and select it
      await page.waitForSelector('.session-item', { timeout: 5000 })
      await page.locator('.session-item:has-text("Buffer extension test session")').click()
      await page.waitForSelector('.output-container', { timeout: 5000 })
      await page.waitForSelector('.xterm', { timeout: 5000 })

      // Wait for session to fully load
      await page.waitForTimeout(2000)

      // Get initial buffer content
      const initialBufferResponse = await page.request.get(
        server.baseURL + `/api/sessions/${sessionId}/buffer/raw`
      )
      expect(initialBufferResponse.status()).toBe(200)
      const initialBufferData = await initialBufferResponse.json()
      const initialBufferLength = initialBufferData.raw.length

      // Send input 'a'
      await page.locator('.terminal.xterm').click()
      await page.keyboard.type('a')
      await page.waitForTimeout(500) // Allow time for echo

      // Get buffer content after input
      const afterBufferResponse = await page.request.get(
        server.baseURL + `/api/sessions/${sessionId}/buffer/raw`
      )
      expect(afterBufferResponse.status()).toBe(200)
      const afterBufferData = await afterBufferResponse.json()

      // Verify buffer was extended by exactly 1 character ('a')
      expect(afterBufferData.raw.length).toBe(initialBufferLength + 1)
      expect(afterBufferData.raw).toContain('a')
    }
  )

  extendedTest(
    'should extend xterm display when sending input to interactive bash session',
    async ({ page, server }) => {
      // Clear any existing sessions
      await page.request.post(server.baseURL + '/api/sessions/clear')

      // Create interactive bash session
      const createResponse = await page.request.post(server.baseURL + '/api/sessions', {
        data: {
          command: 'bash',
          args: [],
          description: 'Xterm display test session',
        },
      })
      expect(createResponse.status()).toBe(200)

      // Navigate to the page
      await page.goto(server.baseURL)
      await page.waitForSelector('h1:has-text("PTY Sessions")')

      // Wait for session to appear and select it
      await page.waitForSelector('.session-item', { timeout: 5000 })
      await page.locator('.session-item:has-text("Xterm display test session")').click()
      await page.waitForSelector('.output-container', { timeout: 5000 })
      await page.waitForSelector('.xterm', { timeout: 5000 })

      // Wait for session to fully load
      await page.waitForTimeout(2000)

      // Get initial xterm display content
      const initialContent = await page.evaluate(() => {
        const serializeAddon = (window as any).xtermSerializeAddon
        if (!serializeAddon) return ''
        return serializeAddon.serialize({
          excludeModes: true,
          excludeAltBuffer: true,
        })
      })
      const initialLength = initialContent.length

      // Send input 'a'
      await page.locator('.terminal.xterm').click()
      await page.keyboard.type('a')
      await page.waitForTimeout(500) // Allow time for display update

      // Get xterm content after input
      const afterContent = await page.evaluate(() => {
        const serializeAddon = (window as any).xtermSerializeAddon
        if (!serializeAddon) return ''
        return serializeAddon.serialize({
          excludeModes: true,
          excludeAltBuffer: true,
        })
      })

      // Verify display was extended (may include additional terminal updates)
      expect(afterContent.length).toBeGreaterThan(initialLength)
      expect(afterContent).toContain('a')
    }
  )

  extendedTest(
    'should extend xterm display by exactly 1 character when typing "a"',
    async ({ page, server }) => {
      // Clear any existing sessions
      await page.request.post(server.baseURL + '/api/sessions/clear')

      // Create interactive bash session
      const createResponse = await page.request.post(server.baseURL + '/api/sessions', {
        data: {
          command: 'bash',
          args: [],
          description: 'Exact display extension test session',
        },
      })
      expect(createResponse.status()).toBe(200)

      // Navigate to the page
      await page.goto(server.baseURL)
      await page.waitForSelector('h1:has-text("PTY Sessions")')

      // Wait for session to appear and select it
      await page.waitForSelector('.session-item', { timeout: 5000 })
      await page.locator('.session-item:has-text("Exact display extension test session")').click()
      await page.waitForSelector('.output-container', { timeout: 5000 })
      await page.waitForSelector('.xterm', { timeout: 5000 })

      // Wait for session to fully load
      await page.waitForTimeout(2000)

      // Get initial xterm display content
      const initialContent = await page.evaluate(() => {
        const serializeAddon = (window as any).xtermSerializeAddon
        if (!serializeAddon) return ''
        return serializeAddon.serialize({
          excludeModes: true,
          excludeAltBuffer: true,
        })
      })
      const initialLength = initialContent.length

      // Send input 'a'
      await page.locator('.terminal.xterm').click()
      await page.keyboard.type('a')
      await page.waitForTimeout(500) // Allow time for display update

      // Get xterm content after input
      const afterContent = await page.evaluate(() => {
        const serializeAddon = (window as any).xtermSerializeAddon
        if (!serializeAddon) return ''
        return serializeAddon.serialize({
          excludeModes: true,
          excludeAltBuffer: true,
        })
      })

      // Verify display was extended by exactly 1 character
      expect(afterContent.length).toBe(initialLength + 1)
      expect(afterContent).toContain('a')
    }
  )
})
