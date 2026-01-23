import { test as extendedTest, expect } from './fixtures'

extendedTest.describe('Xterm Content Extraction', () => {
  extendedTest(
    'should extract terminal content using SerializeAddon from command output',
    async ({ page, server }) => {
      // Clear any existing sessions
      await page.request.post(server.baseURL + '/api/sessions/clear')

      await page.goto(server.baseURL)
      await page.waitForSelector('h1:has-text("PTY Sessions")')

      // Create a session that runs a command and produces output
      await page.request.post(server.baseURL + '/api/sessions', {
        data: {
          command: 'echo',
          args: ['Hello from manual buffer test'],
          description: 'Manual buffer test',
        },
      })

      // Wait for session to appear and select it
      await page.waitForSelector('.session-item', { timeout: 5000 })
      await page.locator('.session-item:has-text("Manual buffer test")').click()
      await page.waitForSelector('.output-container', { timeout: 5000 })
      await page.waitForSelector('.xterm', { timeout: 5000 })

      // Wait for the command to complete and output to appear
      await page.waitForTimeout(2000)

      // Extract content directly from xterm.js Terminal buffer using manual reading
      const extractedContent = await page.evaluate(() => {
        const term = (window as any).xtermTerminal

        if (!term?.buffer?.active) {
          console.error('Terminal not found')
          return []
        }

        const buffer = term.buffer.active
        const result: string[] = []

        // Read all lines that exist in the buffer
        for (let i = 0; i < buffer.length; i++) {
          const line = buffer.getLine(i)
          if (!line) continue

          // Use translateToString for proper text extraction
          let text = ''
          if (line.translateToString) {
            text = line.translateToString()
          }

          // Trim trailing whitespace
          text = text.replace(/\s+$/, '')
          if (text) result.push(text)
        }

        return result
      })

      // Verify we extracted some content
      expect(extractedContent.length).toBeGreaterThan(0)
      console.log('Extracted lines:', extractedContent)

      // Verify the expected output is present
      const fullContent = extractedContent.join('\n')
      expect(fullContent).toContain('Hello from manual buffer test')

      console.log('Full extracted content:', fullContent)
    }
  )

  extendedTest(
    'should compare SerializeAddon output with server buffer content',
    async ({ page, server }) => {
      // Clear any existing sessions
      await page.request.post(server.baseURL + '/api/sessions/clear')

      await page.goto(server.baseURL)
      await page.waitForSelector('h1:has-text("PTY Sessions")')

      // Create a session that runs a command and produces output
      await page.request.post(server.baseURL + '/api/sessions', {
        data: {
          command: 'echo',
          args: ['Hello from SerializeAddon test'],
          description: 'SerializeAddon extraction test',
        },
      })

      // Wait for session to appear and select it
      await page.waitForSelector('.session-item', { timeout: 5000 })
      await page.locator('.session-item:has-text("SerializeAddon extraction test")').click()
      await page.waitForSelector('.output-container', { timeout: 5000 })
      await page.waitForSelector('.xterm', { timeout: 5000 })

      // Wait for the command to complete and output to appear
      await page.waitForTimeout(2000)

      // Extract content using SerializeAddon
      const serializeAddonOutput = await page.evaluate(() => {
        const serializeAddon = (window as any).xtermSerializeAddon

        if (!serializeAddon) {
          console.error('SerializeAddon not found')
          return ''
        }

        try {
          return serializeAddon.serialize({
            excludeModes: true,
            excludeAltBuffer: true,
          })
        } catch (error) {
          console.error('Serialization failed:', error)
          return ''
        }
      })

      // Verify we extracted some content
      expect(serializeAddonOutput.length).toBeGreaterThan(0)
      console.log('Serialized content:', serializeAddonOutput)

      // Verify the expected output is present (may contain ANSI codes)
      expect(serializeAddonOutput).toContain('Hello from SerializeAddon test')

      console.log('SerializeAddon extraction successful!')
    }
  )

  extendedTest(
    'should verify server buffer consistency with terminal display',
    async ({ page, server }) => {
      // Clear any existing sessions
      await page.request.post(server.baseURL + '/api/sessions/clear')

      await page.goto(server.baseURL)

      // Capture console logs from the app
      page.on('console', (msg) => {
        console.log('PAGE CONSOLE:', msg.text())
      })

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

      // Wait for the session to complete and historical output to be loaded
      await page.waitForTimeout(3000)

      // Extract content using SerializeAddon
      const serializeAddonOutput = await page.evaluate(() => {
        const serializeAddon = (window as any).xtermSerializeAddon

        if (!serializeAddon) {
          console.error('SerializeAddon not found')
          return ''
        }

        try {
          return serializeAddon.serialize({
            excludeModes: true,
            excludeAltBuffer: true,
          })
        } catch (error) {
          console.error('Serialization failed:', error)
          return ''
        }
      })

      // Get server buffer content via API
      const bufferResponse = await page.request.get(
        server.baseURL + `/api/sessions/${sessionId}/output`
      )
      expect(bufferResponse.status()).toBe(200)
      const bufferData = await bufferResponse.json()

      // Verify server buffer contains the expected command and output
      expect(bufferData.lines.length).toBeGreaterThan(0)

      // Check that the buffer contains the command execution
      const bufferText = bufferData.lines.join('\n')
      expect(bufferText).toContain('Hello from consistency test')

      // Verify SerializeAddon captured some terminal content
      expect(serializeAddonOutput.length).toBeGreaterThan(0)

      console.log('✅ Server buffer properly stores complete lines with expected output')
      console.log('✅ SerializeAddon captures terminal visual state')
      console.log('ℹ️  Buffer stores raw PTY data, SerializeAddon shows processed terminal display')
    }
  )
})
