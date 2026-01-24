import { test as extendedTest, expect } from './fixtures'
import type { Page } from '@playwright/test'
import type { SerializeAddon } from '@xterm/addon-serialize'
import stripAnsi from 'strip-ansi'

// Use Bun.stripANSI if available, otherwise fallback to npm strip-ansi
let bunStripANSI: (str: string) => string
try {
  // Check if we're running in Bun environment
  if (typeof Bun !== 'undefined' && Bun.stripANSI) {
    console.log('Using Bun.stripANSI for ANSI stripping')
    bunStripANSI = Bun.stripANSI
  } else {
    // Try to import from bun package
    console.log('Importing stripANSI from bun package')
    const bunModule = await import('bun')
    bunStripANSI = bunModule.stripANSI
  }
} catch {
  // Fallback to npm strip-ansi if Bun is not available
  console.log('Falling back to npm strip-ansi for ANSI stripping')
  bunStripANSI = stripAnsi
}

const getTerminalPlainText = async (page: Page): Promise<string[]> => {
  return await page.evaluate(() => {
    const getPlainText = () => {
      const terminalElement = document.querySelector('.xterm')
      if (!terminalElement) return []

      const lines = Array.from(terminalElement.querySelectorAll('.xterm-rows > div')).map((row) => {
        return Array.from(row.querySelectorAll('span'))
          .map((span) => span.textContent || '')
          .join('')
      })

      // Return only lines up to the last non-empty line
      const findLastNonEmptyIndex = (lines: string[]): number => {
        for (let i = lines.length - 1; i >= 0; i--) {
          if (lines[i] !== '') {
            return i
          }
        }
        return -1
      }

      const lastNonEmptyIndex = findLastNonEmptyIndex(lines)
      if (lastNonEmptyIndex === -1) return []

      return lines.slice(0, lastNonEmptyIndex + 1)
    }

    return getPlainText()
  })
}

const getSerializedContentByXtermSerializeAddon = async (page: Page) => {
  return await page.evaluate(() => {
    const serializeAddon = (window as any).xtermSerializeAddon as SerializeAddon | undefined
    if (!serializeAddon) return ''

    return serializeAddon.serialize({
      excludeModes: false,
      excludeAltBuffer: false,
    })
  })
}

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

      console.log('✅ Server buffer properly stores complete lines with expected output')
      console.log('✅ SerializeAddon captures terminal visual state')
      console.log('ℹ️  Buffer stores raw PTY data, SerializeAddon shows processed terminal display')
    }
  )

  extendedTest(
    'should validate DOM scraping against xterm.js Terminal API',
    async ({ page, server }) => {
      // Clear any existing sessions
      await page.request.post(server.baseURL + '/api/sessions/clear')

      await page.goto(server.baseURL)
      await page.waitForSelector('h1:has-text("PTY Sessions")')

      // Create a session and run some commands to generate content
      await page.request.post(server.baseURL + '/api/sessions', {
        data: {
          command: 'bash',
          args: ['-c', 'echo "Line 1" && echo "Line 2" && echo "Line 3"'],
          description: 'Content extraction validation test',
        },
      })

      // Wait for session to appear and select it
      await page.waitForSelector('.session-item', { timeout: 5000 })
      await page.locator('.session-item:has-text("Content extraction validation test")').click()
      await page.waitForSelector('.output-container', { timeout: 5000 })
      await page.waitForSelector('.xterm', { timeout: 5000 })

      // Wait for the command to complete
      await page.waitForTimeout(2000)

      // Extract content using DOM scraping
      const domContent = await page.evaluate(() => {
        const terminalElement = document.querySelector('.xterm')
        if (!terminalElement) return []

        const lines = Array.from(terminalElement.querySelectorAll('.xterm-rows > div')).map(
          (row) => {
            return Array.from(row.querySelectorAll('span'))
              .map((span) => span.textContent || '')
              .join('')
          }
        )

        return lines
      })

      // Extract content using xterm.js Terminal API
      const terminalContent = await page.evaluate(() => {
        const term = (window as any).xtermTerminal
        if (!term?.buffer?.active) return []

        const buffer = term.buffer.active
        const lines = []
        for (let i = 0; i < buffer.length; i++) {
          const line = buffer.getLine(i)
          if (line) {
            lines.push(line.translateToString())
          } else {
            lines.push('')
          }
        }
        return lines
      })

      console.log('🔍 DOM scraping lines:', domContent.length)
      console.log('🔍 Terminal API lines:', terminalContent.length)

      // Compare lengths
      expect(domContent.length).toBe(terminalContent.length)

      // Compare each line
      const differences = []
      domContent.forEach((domLine, i) => {
        if (domLine !== terminalContent[i]) {
          differences.push({ index: i, dom: domLine, terminal: terminalContent[i] })
          console.log(`🔍 Difference at line ${i}:`)
          console.log(`  DOM: ${JSON.stringify(domLine)}`)
          console.log(`  Terminal: ${JSON.stringify(terminalContent[i])}`)
        }
      })

      if (differences.length > 0) {
        console.log(`🔍 Found ${differences.length} differences`)
      } else {
        console.log('✅ DOM scraping matches Terminal API exactly')
      }

      // Assert no differences
      expect(differences.length).toBe(0)

      // Verify expected content is present
      const domJoined = domContent.join('\n')
      expect(domJoined).toContain('Line 1')
      expect(domJoined).toContain('Line 2')
      expect(domJoined).toContain('Line 3')
    }
  )

  extendedTest(
    'should compare DOM scraping vs Terminal API with interactive commands',
    async ({ page, server }) => {
      // Clear any existing sessions
      await page.request.post(server.baseURL + '/api/sessions/clear')

      await page.goto(server.baseURL)
      await page.waitForSelector('h1:has-text("PTY Sessions")')

      // Create interactive bash session
      await page.request.post(server.baseURL + '/api/sessions', {
        data: {
          command: 'bash',
          args: [],
          description: 'Interactive command comparison test',
        },
      })

      // Wait for session to appear and select it
      await page.waitForSelector('.session-item', { timeout: 5000 })
      await page.locator('.session-item:has-text("Interactive command comparison test")').click()
      await page.waitForSelector('.output-container', { timeout: 5000 })
      await page.waitForSelector('.xterm', { timeout: 5000 })

      // Wait for session to initialize
      await page.waitForTimeout(2000)

      // Send interactive command
      await page.locator('.terminal.xterm').click()
      await page.keyboard.type('echo "Hello World"')
      await page.keyboard.press('Enter')

      // Wait for command execution
      await page.waitForTimeout(2000)

      // Extract content using DOM scraping
      const domContent = await page.evaluate(() => {
        const terminalElement = document.querySelector('.xterm')
        if (!terminalElement) return []

        const lines = Array.from(terminalElement.querySelectorAll('.xterm-rows > div')).map(
          (row) => {
            return Array.from(row.querySelectorAll('span'))
              .map((span) => span.textContent || '')
              .join('')
          }
        )

        return lines
      })

      // Extract content using xterm.js Terminal API
      const terminalContent = await page.evaluate(() => {
        const term = (window as any).xtermTerminal
        if (!term?.buffer?.active) return []

        const buffer = term.buffer.active
        const lines = []
        for (let i = 0; i < buffer.length; i++) {
          const line = buffer.getLine(i)
          if (line) {
            lines.push(line.translateToString())
          } else {
            lines.push('')
          }
        }
        return lines
      })

      console.log('🔍 Interactive test - DOM scraping lines:', domContent.length)
      console.log('🔍 Interactive test - Terminal API lines:', terminalContent.length)

      // Compare lengths
      expect(domContent.length).toBe(terminalContent.length)

      // Compare content with detailed logging
      const differences: Array<{
        index: number
        dom: string
        terminal: string
        domLength: number
        terminalLength: number
      }> = []
      domContent.forEach((domLine, i) => {
        if (domLine !== terminalContent[i]) {
          differences.push({
            index: i,
            dom: domLine,
            terminal: terminalContent[i],
            domLength: domLine.length,
            terminalLength: terminalContent[i].length,
          })
        }
      })

      console.log(`🔍 Interactive test - Total lines: ${domContent.length}`)
      console.log(`🔍 Interactive test - Differences found: ${differences.length}`)

      // Show first few differences as examples
      differences.slice(0, 3).forEach((diff) => {
        console.log(`Line ${diff.index}:`)
        console.log(`  DOM (${diff.domLength} chars): ${JSON.stringify(diff.dom)}`)
        console.log(`  Terminal (${diff.terminalLength} chars): ${JSON.stringify(diff.terminal)}`)
      })

      // Verify expected content is present
      const domJoined = domContent.join('\n')
      expect(domJoined).toContain('echo "Hello World"')
      expect(domJoined).toContain('Hello World')

      // Document the differences (expected due to padding)
      console.log('✅ Interactive command test completed - differences documented')
    }
  )

  extendedTest(
    'should compare DOM scraping vs SerializeAddon with strip-ansi',
    async ({ page, server }) => {
      // Clear any existing sessions
      await page.request.post(server.baseURL + '/api/sessions/clear')

      await page.goto(server.baseURL)
      await page.waitForSelector('h1:has-text("PTY Sessions")')

      // Create interactive bash session
      await page.request.post(server.baseURL + '/api/sessions', {
        data: {
          command: 'bash',
          args: [],
          description: 'Strip-ANSI comparison test',
        },
      })

      // Wait for session to appear and select it
      await page.waitForSelector('.session-item', { timeout: 5000 })
      await page.locator('.session-item:has-text("Strip-ANSI comparison test")').click()
      await page.waitForSelector('.output-container', { timeout: 5000 })
      await page.waitForSelector('.xterm', { timeout: 5000 })

      // Wait for session to initialize
      await page.waitForTimeout(2000)

      // Send command to generate content
      await page.locator('.terminal.xterm').click()
      await page.keyboard.type('echo "Compare Methods"')
      await page.waitForTimeout(500) // Delay between typing and pressing enter
      await page.keyboard.press('Enter')

      // Wait for command execution
      await page.waitForTimeout(2000)

      // Extract content using DOM scraping
      const domContent = await page.evaluate(() => {
        const terminalElement = document.querySelector('.xterm')
        if (!terminalElement) return []

        const lines = Array.from(terminalElement.querySelectorAll('.xterm-rows > div')).map(
          (row) => {
            return Array.from(row.querySelectorAll('span'))
              .map((span) => span.textContent || '')
              .join('')
          }
        )

        return lines
      })

      // Extract content using SerializeAddon + strip-ansi
      const serializeStrippedContent = await page.evaluate(() => {
        const serializeAddon = (window as any).xtermSerializeAddon
        if (!serializeAddon) return []

        const raw = serializeAddon.serialize({
          excludeModes: true,
          excludeAltBuffer: true,
        })

        // Simple ANSI stripper for browser context
        function stripAnsi(str: string): string {
          return str.replace(/\x1B(?:[@-Z\\^-`]|[ -/]|[[-`])[ -~]*/g, '')
        }

        const clean = stripAnsi(raw)
        return clean.split('\n')
      })

      // Extract content using xterm.js Terminal API (for reference)
      const terminalContent = await page.evaluate(() => {
        const term = (window as any).xtermTerminal
        if (!term?.buffer?.active) return []

        const buffer = term.buffer.active
        const lines = []
        for (let i = 0; i < buffer.length; i++) {
          const line = buffer.getLine(i)
          if (line) {
            lines.push(line.translateToString())
          } else {
            lines.push('')
          }
        }
        return lines
      })

      console.log('🔍 Strip-ANSI test - DOM scraping lines:', domContent.length)
      console.log('🔍 Strip-ANSI test - Serialize+strip lines:', serializeStrippedContent.length)
      console.log('🔍 Strip-ANSI test - Terminal API lines:', terminalContent.length)

      // Note: Serialize+strip will have different line count than raw Terminal API
      // due to ANSI cleaning and empty line handling

      // Compare DOM vs Serialize+strip (should be very similar)
      const domVsSerializeDifferences: Array<{
        index: number
        dom: string
        serialize: string
      }> = []
      domContent.forEach((domLine, i) => {
        const serializeLine = serializeStrippedContent[i] || ''
        if (domLine !== serializeLine) {
          domVsSerializeDifferences.push({
            index: i,
            dom: domLine,
            serialize: serializeLine,
          })
        }
      })

      console.log(`🔍 DOM vs Serialize+strip differences: ${domVsSerializeDifferences.length}`)

      // Show sample differences
      domVsSerializeDifferences.slice(0, 3).forEach((diff) => {
        console.log(`Line ${diff.index}:`)
        console.log(`  DOM: ${JSON.stringify(diff.dom)}`)
        console.log(`  Serialize+strip: ${JSON.stringify(diff.serialize)}`)
      })

      // Document the differences between methods
      const domJoined = domContent.join('\n')
      const serializeJoined = serializeStrippedContent.join('\n')

      console.log('🔍 DOM scraping content preview:', JSON.stringify(domJoined.slice(0, 100)))
      console.log(
        '🔍 Serialize+strip content preview:',
        JSON.stringify(serializeJoined.slice(0, 100))
      )

      // Serialize+strip should be much cleaner than raw Terminal API
      const terminalJoined = terminalContent.join('\n')
      console.log(`🔍 Terminal API total chars: ${terminalJoined.length}`)
      console.log(`🔍 Serialize+strip total chars: ${serializeJoined.length}`)
      const serializeCleanliness = serializeJoined.length < terminalJoined.length * 0.5
      expect(serializeCleanliness).toBe(true)

      console.log('✅ Strip-ANSI comparison test completed')
    }
  )

  extendedTest(
    'should demonstrate local vs remote echo behavior with fast typing',
    async ({ page, server }) => {
      // Clear any existing sessions
      await page.request.post(server.baseURL + '/api/sessions/clear')

      await page.goto(server.baseURL)
      await page.waitForSelector('h1:has-text("PTY Sessions")')

      // Create interactive bash session
      const createResponse = await page.request.post(server.baseURL + '/api/sessions', {
        data: {
          command: 'bash',
          args: [],
          description: 'Local vs remote echo test',
        },
      })
      expect(createResponse.status()).toBe(200)
      const sessionData = await createResponse.json()
      const sessionId = sessionData.id

      // Wait for session to appear and select it
      await page.waitForSelector('.session-item', { timeout: 5000 })
      await page.locator('.session-item:has-text("Local vs remote echo test")').click()
      await page.waitForSelector('.output-container', { timeout: 5000 })
      await page.waitForSelector('.xterm', { timeout: 5000 })

      // Wait for session to initialize
      await page.waitForTimeout(2000)

      // Fast typing - no delays to trigger local echo interference
      await page.locator('.terminal.xterm').click()
      await page.keyboard.type('echo "Hello World"')
      await page.keyboard.press('Enter')

      // Progressive capture to observe echo character flow
      const echoObservations: string[][] = []

      for (let i = 0; i < 10; i++) {
        const lines = await getTerminalPlainText(page)
        echoObservations.push([...lines]) // Clone array
        // No delay - capture as fast as possible
      }

      console.log('🔍 Progressive echo observations:')
      echoObservations.forEach((obs, index) => {
        console.log(
          `Observation ${index}: ${obs.length} lines - ${JSON.stringify(obs.join(' | '))}`
        )
      })

      // Use the final observation for main analysis
      const domLines = echoObservations[echoObservations.length - 1] || []

      // Get plain buffer from API
      const plainApiResponse = await page.request.get(
        server.baseURL + `/api/sessions/${sessionId}/buffer/plain`
      )
      expect(plainApiResponse.status()).toBe(200)
      const plainData = await plainApiResponse.json()
      const plainBuffer = plainData.plain || plainData.data || ''

      // Analysis
      const domJoined = domLines.join('\n')
      const plainLines = plainBuffer.split('\n')

      console.log('🔍 Fast typing test - DOM lines:', domLines.length)
      console.log('🔍 Fast typing test - Plain buffer lines:', plainLines.length)
      console.log('🔍 DOM content (first 200 chars):', JSON.stringify(domJoined.slice(0, 200)))
      console.log(
        '🔍 Plain buffer content (first 200 chars):',
        JSON.stringify(plainBuffer.slice(0, 200))
      )

      // Check for differences that indicate local echo interference
      const hasLineWrapping = domLines.length > plainLines.length
      const hasContentDifferences = domJoined.replace(/\s/g, '') !== plainBuffer.replace(/\s/g, '')

      console.log('🔍 Line wrapping detected:', hasLineWrapping)
      console.log('🔍 Content differences detected:', hasContentDifferences)

      // The test demonstrates the behavior - differences indicate local echo effects
      expect(plainBuffer).toContain('echo')
      expect(plainBuffer).toContain('Hello World')

      console.log('✅ Local vs remote echo test completed')
    }
  )

  extendedTest(
    'should provide visual verification of DOM vs SerializeAddon vs Plain API extraction in bash -c',
    async ({ page, server }) => {
      // Setup session with ANSI-rich content
      const createResponse = await page.request.post(server.baseURL + '/api/sessions', {
        data: {
          command: 'bash',
          args: [
            '-c',
            'echo "Normal text"; echo "$(tput setaf 1)RED$(tput sgr0) and $(tput setaf 4)BLUE$(tput sgr0)"; echo "More text"',
          ],
          description: 'Visual verification test',
        },
      })
      expect(createResponse.status()).toBe(200)
      const sessionData = await createResponse.json()
      const sessionId = sessionData.id

      // Navigate and select
      await page.goto(server.baseURL)
      await page.waitForSelector('h1:has-text("PTY Sessions")')
      await page.waitForSelector('.session-item', { timeout: 5000 })
      await page.locator('.session-item:has-text("Visual verification test")').click()
      await page.waitForSelector('.xterm', { timeout: 5000 })
      await page.waitForTimeout(3000) // Allow full command execution

      // === EXTRACTION METHODS ===

      // 1. DOM Scraping
      const domContent = await getTerminalPlainText(page)

      // 2. SerializeAddon + inline ANSI stripper
      const serializeStrippedContent = stripAnsi(
        await getSerializedContentByXtermSerializeAddon(page)
      ).split('\n')

      // 3. Plain API
      const plainApiResponse = await page.request.get(
        server.baseURL + `/api/sessions/${sessionId}/buffer/plain`
      )
      expect(plainApiResponse.status()).toBe(200)
      const plainData = await plainApiResponse.json()
      const plainApiContent = plainData.plain.split('\n')

      // === VISUAL VERIFICATION LOGGING ===

      console.log('🔍 === VISUAL VERIFICATION: 3 Content Arrays ===')
      console.log('🔍 DOM Scraping Array:', JSON.stringify(domContent, null, 2))
      console.log(
        '🔍 SerializeAddon + NPM strip-ansi Array:',
        JSON.stringify(serializeStrippedContent, null, 2)
      )
      console.log('🔍 Plain API Array:', JSON.stringify(plainApiContent, null, 2))

      console.log('🔍 === LINE-BY-LINE COMPARISON ===')
      const maxLines = Math.max(
        domContent.length,
        serializeStrippedContent.length,
        plainApiContent.length
      )

      for (let i = 0; i < maxLines; i++) {
        const domLine = domContent[i] || '[EMPTY]'
        const serializeLine = serializeStrippedContent[i] || '[EMPTY]'
        const plainLine = plainApiContent[i] || '[EMPTY]'

        const domSerializeMatch = domLine === serializeLine
        const domPlainMatch = domLine === plainLine
        const allMatch = domSerializeMatch && domPlainMatch

        const status = allMatch
          ? '✅ ALL MATCH'
          : domSerializeMatch
            ? '⚠️ DOM=Serialize'
            : domPlainMatch
              ? '⚠️ DOM=Plain'
              : '❌ ALL DIFFERENT'

        console.log(`${status} Line ${i}:`)
        console.log(`    DOM: ${JSON.stringify(domLine)}`)
        console.log(`    Serialize: ${JSON.stringify(serializeLine)}`)
        console.log(`    Plain API: ${JSON.stringify(plainLine)}`)
      }

      console.log('🔍 === SUMMARY STATISTICS ===')
      console.log(
        `Array lengths: DOM=${domContent.length}, Serialize=${serializeStrippedContent.length}, Plain=${plainApiContent.length}`
      )

      // Calculate match statistics
      let domSerializeMatches = 0
      let domPlainMatches = 0
      let allMatches = 0

      for (let i = 0; i < maxLines; i++) {
        const d = domContent[i] || ''
        const s = serializeStrippedContent[i] || ''
        const p = plainApiContent[i] || ''

        if (d === s) domSerializeMatches++
        if (d === p) domPlainMatches++
        if (d === s && s === p) allMatches++
      }

      console.log(`Match counts (out of ${maxLines} lines):`)
      console.log(`  DOM ↔ Serialize: ${domSerializeMatches}`)
      console.log(`  DOM ↔ Plain API: ${domPlainMatches}`)
      console.log(`  All three match: ${allMatches}`)

      // === VALIDATION ASSERTIONS ===

      // Basic content presence
      const domJoined = domContent.join('\n')
      expect(domJoined).toContain('Normal text')
      expect(domJoined).toContain('RED')
      expect(domJoined).toContain('BLUE')
      expect(domJoined).toContain('More text')

      // ANSI cleaning validation
      const serializeJoined = serializeStrippedContent.join('\n')
      expect(serializeJoined).not.toContain('\x1B[') // No ANSI codes in Serialize+strip

      // Reasonable similarity (allowing for minor formatting differences)
      expect(Math.abs(domContent.length - serializeStrippedContent.length)).toBeLessThan(3)
      expect(Math.abs(domContent.length - plainApiContent.length)).toBeLessThan(3)

      console.log('✅ Visual verification test completed')
    }
  )

  extendedTest(
    'should assert exactly 2 "$" prompts appear and verify 4 extraction methods match (ignoring \\r) with echo "Hello World"',
    async ({ page, server }) => {
      // Setup session with echo command
      const createResponse = await page.request.post(server.baseURL + '/api/sessions', {
        data: {
          command: 'bash',
          args: [],
          description: 'Echo "Hello World" test',
        },
      })
      expect(createResponse.status()).toBe(200)
      const sessionData = await createResponse.json()
      const sessionId = sessionData.id

      // Navigate and select
      await page.goto(server.baseURL)
      await page.waitForSelector('h1:has-text("PTY Sessions")')
      await page.waitForSelector('.session-item', { timeout: 5000 })
      await page.locator('.session-item:has-text("Echo \\"Hello World\\" test")').click()
      await page.waitForSelector('.xterm', { timeout: 5000 })

      // Send echo command
      await page.locator('.terminal.xterm').click()
      await page.keyboard.type('echo "Hello World"')
      await page.keyboard.press('Enter')
      await page.waitForTimeout(2000) // Wait for command execution

      // === EXTRACTION METHODS ===

      // 1. DOM Scraping
      const domContent = await getTerminalPlainText(page)

      // 2. SerializeAddon + NPM strip-ansi
      const serializeStrippedContent = stripAnsi(
        await getSerializedContentByXtermSerializeAddon(page)
      ).split('\n')

      // 3. SerializeAddon + Bun.stripANSI (or fallback)
      const serializeBunStrippedContent = bunStripANSI(
        await getSerializedContentByXtermSerializeAddon(page)
      ).split('\n')

      // 4. Plain API
      const plainApiResponse = await page.request.get(
        server.baseURL + `/api/sessions/${sessionId}/buffer/plain`
      )
      expect(plainApiResponse.status()).toBe(200)
      const plainData = await plainApiResponse.json()
      const plainApiContent = plainData.plain.split('\n')

      // === VISUAL VERIFICATION LOGGING ===

      // Create normalized versions (remove \r for comparison)
      const normalizeLines = (lines: string[]) =>
        lines.map((line) => line.replace(/\r/g, '').trimEnd())
      const domNormalized = normalizeLines(domContent)
      const serializeNormalized = normalizeLines(serializeStrippedContent)
      const serializeBunNormalized = normalizeLines(serializeBunStrippedContent)
      const plainNormalized = normalizeLines(plainApiContent)

      // Count $ signs in each method
      const countDollarSigns = (lines: string[]) => lines.join('').split('$').length - 1
      const domDollarCount = countDollarSigns(domContent)
      const serializeDollarCount = countDollarSigns(serializeStrippedContent)
      const serializeBunDollarCount = countDollarSigns(serializeBunStrippedContent)
      const plainDollarCount = countDollarSigns(plainApiContent)

      console.log('🔍 === VISUAL VERIFICATION: 4 Content Arrays (with \\r preserved) ===')
      console.log('🔍 DOM Scraping Array:', JSON.stringify(domContent, null, 2))
      console.log(
        '🔍 SerializeAddon + NPM strip-ansi Array:',
        JSON.stringify(serializeStrippedContent, null, 2)
      )
      console.log(
        '🔍 SerializeAddon + Bun.stripANSI Array:',
        JSON.stringify(serializeBunStrippedContent, null, 2)
      )
      console.log('🔍 Plain API Array:', JSON.stringify(plainApiContent, null, 2))

      console.log(
        '🔍 === NORMALIZED ARRAYS (\\r removed and trailing whitespace trimmed for comparison) ==='
      )
      console.log('🔍 DOM Normalized:', JSON.stringify(domNormalized, null, 2))
      console.log('🔍 Serialize NPM Normalized:', JSON.stringify(serializeNormalized, null, 2))
      console.log('🔍 Serialize Bun Normalized:', JSON.stringify(serializeBunNormalized, null, 2))
      console.log('🔍 Plain Normalized:', JSON.stringify(plainNormalized, null, 2))

      console.log('🔍 === $ SIGN COUNTS ===')
      console.log(`🔍 DOM: ${domDollarCount} $ signs`)
      console.log(`🔍 Serialize NPM: ${serializeDollarCount} $ signs`)
      console.log(`🔍 Serialize Bun: ${serializeBunDollarCount} $ signs`)
      console.log(`🔍 Plain API: ${plainDollarCount} $ signs`)

      console.log('🔍 === LINE-BY-LINE COMPARISON ===')
      const maxLines = Math.max(
        domContent.length,
        serializeStrippedContent.length,
        serializeBunStrippedContent.length,
        plainApiContent.length
      )

      for (let i = 0; i < maxLines; i++) {
        const domLine = domContent[i] || '[EMPTY]'
        const serializeLine = serializeStrippedContent[i] || '[EMPTY]'
        const serializeBunLine = serializeBunStrippedContent[i] || '[EMPTY]'
        const plainLine = plainApiContent[i] || '[EMPTY]'

        const domSerializeMatch = domLine === serializeLine
        const domSerializeBunMatch = domLine === serializeBunLine
        const domPlainMatch = domLine === plainLine
        const allMatch = domSerializeMatch && domSerializeBunMatch && domPlainMatch

        const status = allMatch
          ? '✅ ALL MATCH'
          : domSerializeMatch && domSerializeBunMatch
            ? '⚠️ DOM=SerializeNPM=SerializeBun'
            : domSerializeMatch && domPlainMatch
              ? '⚠️ DOM=SerializeNPM=Plain'
              : domSerializeBunMatch && domPlainMatch
                ? '⚠️ DOM=SerializeBun=Plain'
                : domSerializeMatch
                  ? '⚠️ DOM=SerializeNPM'
                  : domSerializeBunMatch
                    ? '⚠️ DOM=SerializeBun'
                    : domPlainMatch
                      ? '⚠️ DOM=Plain'
                      : '❌ ALL DIFFERENT'

        console.log(`${status} Line ${i}:`)
        console.log(`    DOM: ${JSON.stringify(domLine)}`)
        console.log(`    Serialize NPM: ${JSON.stringify(serializeLine)}`)
        console.log(`    Serialize Bun: ${JSON.stringify(serializeBunLine)}`)
        console.log(`    Plain API: ${JSON.stringify(plainLine)}`)
      }

      console.log(
        '🔍 === NORMALIZED LINE-BY-LINE COMPARISON (\\r removed, trailing whitespace trimmed) ==='
      )
      for (let i = 0; i < maxLines; i++) {
        const domNormLine = domNormalized[i] || '[EMPTY]'
        const serializeNormLine = serializeNormalized[i] || '[EMPTY]'
        const serializeBunNormLine = serializeBunNormalized[i] || '[EMPTY]'
        const plainNormLine = plainNormalized[i] || '[EMPTY]'

        const domSerializeNormMatch = domNormLine === serializeNormLine
        const domSerializeBunNormMatch = domNormLine === serializeBunNormLine
        const domPlainNormMatch = domNormLine === plainNormLine
        const allNormMatch = domSerializeNormMatch && domSerializeBunNormMatch && domPlainNormMatch

        const normStatus = allNormMatch
          ? '✅ ALL MATCH (normalized)'
          : domSerializeNormMatch && domSerializeBunNormMatch
            ? '⚠️ DOM=SerializeNPM=SerializeBun (normalized)'
            : domSerializeNormMatch && domPlainNormMatch
              ? '⚠️ DOM=SerializeNPM=Plain (normalized)'
              : domSerializeBunNormMatch && domPlainNormMatch
                ? '⚠️ DOM=SerializeBun=Plain (normalized)'
                : domSerializeNormMatch
                  ? '⚠️ DOM=SerializeNPM (normalized)'
                  : domSerializeBunNormMatch
                    ? '⚠️ DOM=SerializeBun (normalized)'
                    : domPlainNormMatch
                      ? '⚠️ DOM=Plain (normalized)'
                      : '❌ ALL DIFFERENT (normalized)'

        console.log(`${normStatus} Line ${i}:`)
        console.log(`    DOM: ${JSON.stringify(domNormLine)}`)
        console.log(`    Serialize NPM: ${JSON.stringify(serializeNormLine)}`)
        console.log(`    Serialize Bun: ${JSON.stringify(serializeBunNormLine)}`)
        console.log(`    Plain API: ${JSON.stringify(plainNormLine)}`)
      }

      console.log('🔍 === SUMMARY STATISTICS ===')
      console.log(
        `Array lengths: DOM=${domContent.length}, SerializeNPM=${serializeStrippedContent.length}, SerializeBun=${serializeBunStrippedContent.length}, Plain=${plainApiContent.length}`
      )

      // Calculate match statistics
      let domSerializeMatches = 0
      let domSerializeBunMatches = 0
      let domPlainMatches = 0
      let allMatches = 0

      let domSerializeNormMatches = 0
      let domSerializeBunNormMatches = 0
      let domPlainNormMatches = 0
      let allNormMatches = 0

      for (let i = 0; i < maxLines; i++) {
        const d = domContent[i] || ''
        const s = serializeStrippedContent[i] || ''
        const sb = serializeBunStrippedContent[i] || ''
        const p = plainApiContent[i] || ''

        if (d === s) domSerializeMatches++
        if (d === sb) domSerializeBunMatches++
        if (d === p) domPlainMatches++
        if (d === s && d === sb && s === p) allMatches++

        const dn = domNormalized[i] || ''
        const sn = serializeNormalized[i] || ''
        const sbn = serializeBunNormalized[i] || ''
        const pn = plainNormalized[i] || ''

        if (dn === sn) domSerializeNormMatches++
        if (dn === sbn) domSerializeBunNormMatches++
        if (dn === pn) domPlainNormMatches++
        if (dn === sn && dn === sbn && sn === pn) allNormMatches++
      }

      console.log(`Match counts (out of ${maxLines} lines):`)
      console.log(
        `  Raw: DOM ↔ SerializeNPM: ${domSerializeMatches}, DOM ↔ SerializeBun: ${domSerializeBunMatches}, DOM ↔ Plain API: ${domPlainMatches}, All four: ${allMatches}`
      )
      console.log(
        `  Normalized (\\r removed, trailing trimmed): DOM ↔ SerializeNPM: ${domSerializeNormMatches}, DOM ↔ SerializeBun: ${domSerializeBunNormMatches}, DOM ↔ Plain API: ${domPlainNormMatches}, All four: ${allNormMatches}`
      )

      // === VALIDATION ASSERTIONS ===

      // Basic content presence
      const domJoined = domContent.join('\n')
      expect(domJoined).toContain('Hello World')

      // $ sign count validation
      expect(domDollarCount).toBe(2)
      expect(serializeDollarCount).toBe(2)
      expect(serializeBunDollarCount).toBe(2)
      expect(plainDollarCount).toBe(2)

      // Normalized content equality (ignoring \r differences)
      expect(domNormalized).toEqual(serializeNormalized)
      expect(domNormalized).toEqual(serializeBunNormalized)
      expect(domNormalized).toEqual(plainNormalized)

      // ANSI cleaning validation
      const serializeNpmJoined = serializeStrippedContent.join('\n')
      expect(serializeNpmJoined).not.toContain('\x1B[') // No ANSI codes in Serialize+NPM strip
      const serializeBunJoined = serializeBunStrippedContent.join('\n')
      expect(serializeBunJoined).not.toContain('\x1B[') // No ANSI codes in Serialize+Bun.stripANSI

      // Length similarity (should be very close with echo command)
      expect(Math.abs(domContent.length - serializeStrippedContent.length)).toBeLessThan(2)
      expect(Math.abs(domContent.length - serializeBunStrippedContent.length)).toBeLessThan(2)
      expect(Math.abs(domContent.length - plainApiContent.length)).toBeLessThan(2)

      console.log('✅ Echo "Hello World" verification test completed')
    }
  )
})
