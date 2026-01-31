import { getTerminalPlainText } from './xterm-test-helpers'
import { test as extendedTest, expect } from './fixtures'

extendedTest.describe('Xterm Content Extraction - Local vs Remote Echo (Fast Typing)', () => {
  extendedTest(
    'should demonstrate local vs remote echo behavior with fast typing',
    async ({ page, api }) => {
      await page.waitForSelector('h1:has-text("PTY Sessions")')

      // Create interactive bash session
      const session = await api.sessions.create({
        command: 'bash',
        args: ['-i'],
        description: 'Local vs remote echo test',
      })

      // Wait for session to appear and select it
      await page.waitForSelector('.session-item', { timeout: 5000 })
      await page.locator('.session-item:has-text("Local vs remote echo test")').click()
      await page.waitForSelector('.output-container', { timeout: 5000 })
      await page.waitForSelector('.xterm', { timeout: 5000 })

      // Wait for session prompt to appear, indicating readiness
      await page.waitForSelector('.xterm:has-text("$")', { timeout: 10000 })

      // Fast typing - no delays to trigger local echo interference
      await page.locator('.terminal.xterm').click()
      await page.keyboard.type('echo "Hello World"')
      await page.keyboard.press('Enter')

      // Progressive capture to observe echo character flow
      const echoObservations: string[][] = []
      for (let i = 0; i < 10; i++) {
        const lines = await getTerminalPlainText(page)
        echoObservations.push([...lines])
      }
      const domLines = echoObservations[echoObservations.length - 1] || []

      // Get plain buffer from API
      const plainData = await api.session.buffer.plain({ id: session.id })
      const plainBuffer = plainData.plain

      // Analysis
      const domJoined = domLines.join('\n')
      const plainLines = plainBuffer.split('\n')

      const hasLineWrapping = domLines.length > plainLines.length
      const hasContentDifferences = domJoined.replace(/\s/g, '') !== plainBuffer.replace(/\s/g, '')

      expect(plainBuffer).toContain('echo')
      expect(plainBuffer).toContain('Hello World')
      expect(domJoined).toContain('Hello World')

      // Only print one concise message if a difference is present
      if (hasLineWrapping || hasContentDifferences) {
        // Only log on failure: comment out for ultra-silence, or keep for minimal debug
        // console.log(
        //   'DIFFERENCE: Echo output differs between dom/text and server buffer (see assertions for details)'
        // )
      }
    }
  )
})
