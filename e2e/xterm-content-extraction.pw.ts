import { test as extendedTest, expect } from './fixtures'

extendedTest.describe('Xterm Content Extraction', () => {
  extendedTest('should extract terminal content from xterm buffer', async ({ page, server }) => {
    // Clear any existing sessions
    await page.request.post(server.baseURL + '/api/sessions/clear')

    await page.goto(server.baseURL)

    // Capture console logs from the app
    page.on('console', (msg) => {
      console.log('PAGE CONSOLE:', msg.text())
    })

    await page.waitForSelector('h1:has-text("PTY Sessions")')

    // Create an interactive bash session that stays running
    await page.request.post(server.baseURL + '/api/sessions', {
      data: {
        command: 'bash',
        args: [], // Interactive bash that stays running
        description: 'Xterm extraction test',
      },
    })

    // Wait for session to appear and select it
    await page.waitForSelector('.session-item', { timeout: 5000 })
    await page.locator('.session-item:has-text("Xterm extraction test")').click()
    await page.waitForSelector('.output-container', { timeout: 5000 })
    await page.waitForSelector('.xterm', { timeout: 5000 })

    // Type a simple command and wait for output
    await page.locator('.xterm').click()
    await page.waitForTimeout(500) // Wait for terminal to be focused

    // Type command character by character with small delays
    await page.keyboard.type('echo', { delay: 50 })
    await page.keyboard.type(' ', { delay: 50 })
    await page.keyboard.type('"', { delay: 50 })
    await page.keyboard.type('Hello from xterm test', { delay: 50 })
    await page.keyboard.type('"', { delay: 50 })
    await page.keyboard.press('Enter')

    // Wait for command to execute and output to appear
    await page.waitForTimeout(1500)

    // Extract content directly from xterm.js Terminal buffer
    const extractedContent = await page.evaluate(() => {
      // Access the terminal instance exposed for testing
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

        let text = ''
        // Iterate through cells in the line
        for (let j = 0; j < line.length; j++) {
          const cell = line.getCell(j)
          if (cell && cell.getChars()) {
            text += cell.getChars()
          }
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
    expect(fullContent).toContain('Hello from xterm test')

    console.log('Full extracted content:', fullContent)
  })

  extendedTest('should extract terminal content using SerializeAddon', async ({ page, server }) => {
    // Clear any existing sessions
    await page.request.post(server.baseURL + '/api/sessions/clear')

    await page.goto(server.baseURL)

    // Capture console logs from the app
    page.on('console', (msg) => {
      console.log('PAGE CONSOLE:', msg.text())
    })

    await page.waitForSelector('h1:has-text("PTY Sessions")')

    // Create an interactive bash session that stays running
    await page.request.post(server.baseURL + '/api/sessions', {
      data: {
        command: 'bash',
        args: [], // Interactive bash that stays running
        description: 'SerializeAddon extraction test',
      },
    })

    // Wait for session to appear and select it
    await page.waitForSelector('.session-item', { timeout: 5000 })
    await page.locator('.session-item:has-text("SerializeAddon extraction test")').click()
    await page.waitForSelector('.output-container', { timeout: 5000 })
    await page.waitForSelector('.xterm', { timeout: 5000 })

    // Type a simple command and wait for output
    await page.locator('.xterm').click()
    await page.waitForTimeout(500) // Wait for terminal to be focused

    // Type command character by character with small delays
    await page.keyboard.type('echo', { delay: 50 })
    await page.keyboard.type(' ', { delay: 50 })
    await page.keyboard.type('"', { delay: 50 })
    await page.keyboard.type('Hello from SerializeAddon test', { delay: 50 })
    await page.keyboard.type('"', { delay: 50 })
    await page.keyboard.press('Enter')

    // Wait for command to execute and output to appear
    await page.waitForTimeout(1500)

    // Extract content using SerializeAddon
    const extractedContent = await page.evaluate(() => {
      // Access the serialize addon exposed for testing
      const serializeAddon = (window as any).xtermSerializeAddon

      if (!serializeAddon) {
        console.error('SerializeAddon not found')
        return ''
      }

      try {
        // Serialize with clean text options
        return serializeAddon.serialize({
          excludeModes: true, // Exclude mode information for clean text
          excludeAltBuffer: true, // Focus on main buffer
        })
      } catch (error) {
        console.error('Serialization failed:', error)
        return ''
      }
    })

    // Verify we extracted some content
    expect(extractedContent).toBeTruthy()
    expect(extractedContent.length).toBeGreaterThan(0)
    console.log('Serialized content:', extractedContent)

    // Verify the expected output is present
    expect(extractedContent).toContain('Hello from SerializeAddon test')

    console.log('SerializeAddon extraction successful!')
  })

  extendedTest(
    'should match server buffer content with SerializeAddon output after ANSI stripping',
    async ({ page, server }) => {
      // Clear any existing sessions
      await page.request.post(server.baseURL + '/api/sessions/clear')

      await page.goto(server.baseURL)

      // Capture console logs from the app
      page.on('console', (msg) => {
        console.log('PAGE CONSOLE:', msg.text())
      })

      await page.waitForSelector('h1:has-text("PTY Sessions")')

      // Create an interactive bash session
      const createResponse = await page.request.post(server.baseURL + '/api/sessions', {
        data: {
          command: 'bash',
          args: [], // Interactive bash that stays running
          description: 'Buffer comparison test',
        },
      })
      expect(createResponse.status()).toBe(200)

      // Get the session ID from the response
      const createData = await createResponse.json()
      const sessionId = createData.id
      expect(sessionId).toBeDefined()

      // Wait for session to appear and select it
      await page.waitForSelector('.session-item', { timeout: 5000 })
      await page.locator('.session-item:has-text("Buffer comparison test")').click()
      await page.waitForSelector('.output-container', { timeout: 5000 })
      await page.waitForSelector('.xterm', { timeout: 5000 })

      // Type a simple echo command
      await page.locator('.xterm').click()
      await page.waitForTimeout(500)

      // Type command character by character with small delays
      await page.keyboard.type('echo', { delay: 50 })
      await page.keyboard.type(' ', { delay: 50 })
      await page.keyboard.type('"', { delay: 50 })
      await page.keyboard.type('Hello from buffer test', { delay: 50 })
      await page.keyboard.type('"', { delay: 50 })
      await page.keyboard.press('Enter')

      // Wait for command to execute
      await page.waitForTimeout(1500)

      // Extract content using SerializeAddon
      const serializeAddonOutput = await page.evaluate(() => {
        const serializeAddon = (window as any).xtermSerializeAddon
        if (!serializeAddon) {
          throw new Error('SerializeAddon not found')
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

      // First, log the raw outputs to understand the differences
      console.log('🔍 Raw SerializeAddon output:', JSON.stringify(serializeAddonOutput))
      console.log('🔍 Raw server buffer lines:', bufferData.lines)

      // Strip ANSI codes from both outputs using regex
      // Note: SerializeAddon shows final terminal visual state, server buffer shows raw PTY stream
      const cleanedSerializeOutput = serializeAddonOutput
        .replace(/\u001b\[[0-9;]*[A-Za-z]/g, '') // Standard ANSI codes
        .replace(/\u001b\][0-9;]*[^\u0007]*\u0007/g, '') // OSC sequences
        .replace(/\u001b[()[][A-Z0-9]/g, '') // Character set sequences
        .replace(/\u001b[>=]/g, '') // Mode switching
        .replace(/\u001b./g, '') // Other escape sequences

      const cleanedBufferOutput = bufferData.lines
        .map(
          (line: string) =>
            line
              .replace(/\u001b\[[0-9;]*[A-Za-z]/g, '') // Standard ANSI codes
              .replace(/\u001b\][0-9;]*[^\u0007]*\u0007/g, '') // OSC sequences
              .replace(/\u001b[()[][A-Z0-9]/g, '') // Character set sequences
              .replace(/\u001b[>=]/g, '') // Mode switching
              .replace(/\u001b./g, '') // Other escape sequences
        )
        .join('\n')

      console.log('🧹 SerializeAddon (cleaned):', JSON.stringify(cleanedSerializeOutput))
      console.log('🧹 Server buffer (cleaned):', JSON.stringify(cleanedBufferOutput))

      // Verify both outputs contain the expected content
      // Note: They won't be exactly equal because:
      // - SerializeAddon: Final visual terminal state
      // - Server buffer: Raw PTY stream (character-by-character input)
      expect(cleanedSerializeOutput).toContain('echo "Hello from buffer test"')
      expect(cleanedSerializeOutput).toContain('Hello from buffer test')

      // Server buffer should contain the typed command and output
      expect(cleanedBufferOutput).toContain('Hello from buffer test')

      console.log(
        '✅ Both SerializeAddon and server buffer contain expected content after ANSI stripping'
      )
      console.log(
        'ℹ️  Note: Outputs differ in format due to different processing stages (visual vs raw stream)'
      )
    }
  )
})
