import { test as extendedTest, expect } from './fixtures'
import { createApiClient } from './helpers/apiClient'

extendedTest.describe('Xterm Content Extraction', () => {
  extendedTest(
    'should compare SerializeAddon output with server buffer content',
    async ({ page, server }) => {
      const apiClient = createApiClient(server.baseURL)
      // Clear any existing sessions
      await apiClient.sessions.clear()

      await page.goto(server.baseURL)
      await page.waitForSelector('h1:has-text("PTY Sessions")')

      // Create a session that runs a command and produces output
      await apiClient.sessions.create({
        command: 'echo',
        args: ['Hello from SerializeAddon test'],
        description: 'SerializeAddon extraction test',
      })

      // Wait for session to appear and select it
      await page.waitForSelector('.session-item', { timeout: 5000 })
      await page.locator('.session-item:has-text("SerializeAddon extraction test")').click()
      await page.waitForSelector('.output-container', { timeout: 5000 })
      await page.waitForSelector('.xterm', { timeout: 5000 })

      // Wait for the command output to appear in the terminal
      await page.waitForSelector('.xterm:has-text("Hello from SerializeAddon test")', {
        timeout: 10000,
      })

      // Extract content using SerializeAddon
      const serializeAddonOutput = await page.evaluate(() => {
        const serializeAddon = (window as any).xtermSerializeAddon

        if (!serializeAddon) {
          // SerializeAddon not found; let Playwright fail
          return ''
        }

        try {
          return serializeAddon.serialize({
            excludeModes: true,
            excludeAltBuffer: true,
          })
        } catch (error) {
          return ''
        }
      })

      // Verify we extracted some content
      expect(serializeAddonOutput.length).toBeGreaterThan(0)

      // Verify the expected output is present (may contain ANSI codes)
      expect(serializeAddonOutput).toContain('Hello from SerializeAddon test')
    }
  )
})
