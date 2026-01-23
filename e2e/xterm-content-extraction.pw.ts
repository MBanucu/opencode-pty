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
    await page.keyboard.type('echo "Hello from xterm test"')
    await page.keyboard.press('Enter')

    // Wait for command to execute and output to appear
    await page.waitForTimeout(1000)

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
})
