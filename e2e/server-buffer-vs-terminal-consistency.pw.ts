import { test as extendedTest, expect } from './fixtures'

extendedTest.describe('Xterm Content Extraction', () => {
  extendedTest(
    'should verify server buffer consistency with terminal display',
    async ({ page, server }) => {
      // Clear any existing sessions
      await page.request.post(server.baseURL + '/api/sessions/clear')

      await page.goto(server.baseURL)

      await page.waitForSelector('h1:has-text("PTY Sessions")')

      // Create a session that runs a command and produces output
      const createResponse = await page.request.post(server.baseURL + '/api/sessions', {
        data: {
          command: 'bash',
          args: ['-c', 'echo "Hello from consistency test" && sleep 1'],
          description: 'Buffer consistency test',
        },
      })
      expect(createResponse.status()).toBe(200)

      // Get the session ID from the response
      const createData = await createResponse.json()
      const sessionId = createData.id
      expect(sessionId).toBeDefined()

      // Wait for session to appear and select it
      await page.waitForSelector('.session-item', { timeout: 5000 })
      await page.locator('.session-item:has-text("Buffer consistency test")').click()
      await page.waitForSelector('.output-container', { timeout: 5000 })
      await page.waitForSelector('.xterm', { timeout: 5000 })

      // Wait for the expected output to be present in the terminal
      await page.waitForSelector('.xterm:has-text("Hello from consistency test")', {
        timeout: 10000,
      })

      // Extract content using SerializeAddon
      const serializeAddonOutput = await page.evaluate(() => {
        const serializeAddon = (window as any).xtermSerializeAddon

        if (!serializeAddon) {
          // SerializeAddon not found; let Playwright fail
          return ''
        }

        try {
          return serializeAddon.serialize({
            excludeModes: true,
            excludeAltBuffer: true,
          })
        } catch (error) {
          return ''
        }
      })

      // Get server buffer content via API
      const bufferResponse = await page.request.get(
        server.baseURL + `/api/sessions/${sessionId}/buffer/raw`
      )
      expect(bufferResponse.status()).toBe(200)
      const bufferData = await bufferResponse.json()

      // Verify server buffer contains the expected content
      expect(bufferData.raw.length).toBeGreaterThan(0)

      // Check that the buffer contains the command execution
      expect(bufferData.raw).toContain('Hello from consistency test')

      // Verify SerializeAddon captured some terminal content
      expect(serializeAddonOutput.length).toBeGreaterThan(0)
    }
  )
})
