import {
  bunStripANSI,
  getTerminalPlainText,
  getSerializedContentByXtermSerializeAddon,
} from './xterm-test-helpers'
import { test as extendedTest, expect } from './fixtures'

extendedTest.describe(
  'Xterm Content Extraction - Visual Verification (DOM vs Serialize vs Plain API)',
  () => {
    extendedTest(
      'should provide visual verification of DOM vs SerializeAddon vs Plain API extraction in bash -c',
      async ({ page, server }) => {
        // Clear any existing sessions for isolation
        await page.request.post(server.baseURL + '/api/sessions/clear')

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

        // Extraction methods
        const domContent = await getTerminalPlainText(page)
        const serializeStrippedContent = bunStripANSI(
          await getSerializedContentByXtermSerializeAddon(page)
        ).split('\n')
        const plainApiResponse = await page.request.get(
          server.baseURL + `/api/sessions/${sessionId}/buffer/plain`
        )
        expect(plainApiResponse.status()).toBe(200)
        const plainData = await plainApiResponse.json()
        const plainApiContent = plainData.plain.split('\n')

        // Only print concise message if key discrepancies (ignoring trivial \r/empty lines)
        const domJoined = domContent.join('\n')
        const serializeJoined = serializeStrippedContent.join('\n')
        // Removed unused lengthMismatch (was for old logging)

        // Basic expectations
        expect(domJoined).toContain('Normal text')
        expect(domJoined).toContain('RED')
        expect(domJoined).toContain('BLUE')
        expect(domJoined).toContain('More text')
        expect(serializeJoined).not.toContain('\x1B[') // No ANSI codes in Serialize+strip
        expect(Math.abs(domContent.length - serializeStrippedContent.length)).toBeLessThan(3)
        expect(Math.abs(domContent.length - plainApiContent.length)).toBeLessThan(3)
      }
    )
  }
)
