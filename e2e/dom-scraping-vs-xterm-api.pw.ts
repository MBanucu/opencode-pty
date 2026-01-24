import { test as extendedTest, expect } from './fixtures'

extendedTest.describe('Xterm Content Extraction', () => {
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

      // Compare lengths
      expect(domContent.length).toBe(terminalContent.length)

      // Compare lines, collect minimal example if any diffs
      const differences: Array<{ index: number; dom: string; terminal: string }> = []
      domContent.forEach((domLine, i) => {
        if (domLine !== terminalContent[i]) {
          differences.push({ index: i, dom: domLine, terminal: terminalContent[i] })
        }
      })

      expect(differences.length).toBe(0)

      // Verify expected content is present
      const domJoined = domContent.join('\n')
      expect(domJoined).toContain('Line 1')
      expect(domJoined).toContain('Line 2')
      expect(domJoined).toContain('Line 3')
    }
  )
})
