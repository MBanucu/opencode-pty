import { test as extendedTest, expect } from './fixtures'

extendedTest.describe('Xterm Content Extraction', () => {
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

      // Only log if there is a difference between DOM and Serialize+strip
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
      if (domVsSerializeDifferences.length > 0) {
        const diff = domVsSerializeDifferences[0]
        console.log(`DIFFERENCE: DOM vs Serialize+strip at line ${diff.index}:`)
        console.log(`  DOM: ${JSON.stringify(diff.dom)}`)
        console.log(`  Serialize+strip: ${JSON.stringify(diff.serialize)}`)
      }

      console.log('✅ Strip-ANSI comparison test completed')
    }
  )
})
