import {
  bunStripANSI,
  getTerminalPlainText,
  getSerializedContentByXtermSerializeAddon,
  waitForTerminalRegex,
} from './xterm-test-helpers'
import { test as extendedTest, expect } from './fixtures'
import { createApiClient } from './helpers/apiClient'

extendedTest.describe(
  'Xterm Content Extraction - Visual Verification (DOM vs Serialize vs Plain API)',
  () => {
    extendedTest(
      'should provide visual verification of DOM vs SerializeAddon vs Plain API extraction in bash -c',
      async ({ page, server }) => {
        const apiClient = createApiClient(server.baseURL)
        // Clear any existing sessions for isolation
        await apiClient.sessions.clear()

        // Setup session with ANSI-rich content
        const session = await apiClient.sessions.create({
          command: 'bash',
          args: [
            '-c',
            'echo "Normal text"; echo "$(tput setaf 1)RED$(tput sgr0) and $(tput setaf 4)BLUE$(tput sgr0)"; echo "More text"',
          ],
          description: 'Visual verification test',
        })

        // Navigate and select
        await page.goto(server.baseURL)
        await page.waitForSelector('h1:has-text("PTY Sessions")')
        await page.waitForSelector('.session-item', { timeout: 5000 })
        await page.locator('.session-item:has-text("Visual verification test")').click()
        await page.waitForSelector('.xterm', { timeout: 5000 })
        await waitForTerminalRegex(page, /More text/, '__waitMoreText')

        // Extraction methods
        const domContent = await getTerminalPlainText(page)
        const serializeStrippedContent = bunStripANSI(
          await getSerializedContentByXtermSerializeAddon(page)
        ).split('\n')
        const plainData = await apiClient.session.buffer.plain({ id: session.id })
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
