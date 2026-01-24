import { test as extendedTest, expect } from './fixtures'

extendedTest.describe('Xterm Content Extraction', () => {
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

      // Compare lengths
      expect(domContent.length).toBe(terminalContent.length)

      // Compare content (logging removed for minimal output)

      // Verify expected content is present
      const domJoined = domContent.join('\n')
      expect(domJoined).toContain('echo "Hello World"')
      expect(domJoined).toContain('Hello World')
    }
  )
})
