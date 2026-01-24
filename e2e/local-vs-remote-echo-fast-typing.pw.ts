import { getTerminalPlainText } from './xterm-test-helpers'
import { test as extendedTest, expect } from './fixtures'

extendedTest.describe('Xterm Content Extraction - Local vs Remote Echo (Fast Typing)', () => {
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
        echoObservations.push([...lines])
      }
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
