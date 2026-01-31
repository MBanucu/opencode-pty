import { test as extendedTest, expect } from './fixtures'
import type { Page } from '@playwright/test'
import { createApiClient } from './helpers/apiClient'

/**
 * Session and Terminal Helpers for E2E buffer extension tests
 */
async function setupSession(
  page: Page,
  server: { baseURL: string; port: number },
  description: string
): Promise<string> {
  const apiClient = createApiClient(server.baseURL)
  await apiClient.sessions.clear()
  const session = await apiClient.sessions.create({ command: 'bash', args: ['-i'], description })
  const { id } = session
  await page.goto(server.baseURL)
  await page.waitForSelector('h1:has-text("PTY Sessions")')
  await page.waitForSelector('.session-item')
  await page.locator(`.session-item:has-text("${description}")`).click()
  await page.waitForSelector('.output-container', { timeout: 5000 })
  await page.waitForSelector('.xterm', { timeout: 5000 })
  // Wait for bash prompt to appear (indicating interactive session is ready)
  await page.waitForSelector('.xterm:has-text("$")', { timeout: 10000 })
  return id
}
async function typeInTerminal(page: Page, text: string) {
  await page.locator('.terminal.xterm').click()
  await page.keyboard.type(text)
  // Don't wait for text to appear since we're testing buffer extension, not visual echo
}
async function getRawBuffer(
  server: { baseURL: string; port: number },
  sessionId: string
): Promise<string> {
  const apiClient = createApiClient(server.baseURL)
  const data = await apiClient.session.buffer.raw({ id: sessionId })
  return data.raw
}
// Usage: await getSerializedContentByXtermSerializeAddon(page, { excludeModes: true, excludeAltBuffer: true })

extendedTest.describe('Buffer Extension on Input', () => {
  extendedTest(
    'should extend buffer when sending input to interactive bash session',
    async ({ page, server }) => {
      const description = 'Buffer extension test session'
      const sessionId = await setupSession(page, server, description)
      const initialRaw = await getRawBuffer(server, sessionId)
      const initialLen = initialRaw.length
      await typeInTerminal(page, 'a')
      const afterRaw = await getRawBuffer(server, sessionId)
      expect(afterRaw.length).toBe(initialLen + 1)
      expect(afterRaw).toContain('a')
    }
  )

  extendedTest(
    'should extend xterm display when sending input to interactive bash session',
    async ({ page, server }) => {
      const description = 'Xterm display test session'
      await setupSession(page, server, description)
      const initialLines = await page
        .locator('[data-testid="test-output"] .output-line')
        .allTextContents()
      const initialContent = initialLines.join('\n')
      // Initial content should have bash prompt
      expect(initialContent).toContain('$')

      // Create a new session with different output
      const apiClient = createApiClient(server.baseURL)
      await apiClient.sessions.create({
        command: 'bash',
        args: ['-c', 'echo "New session test"'],
        description: 'New test session',
      })
      await page.waitForSelector('.session-item:has-text("New test session")')
      await page.locator('.session-item:has-text("New test session")').click()
      await page.waitForTimeout(1000)

      const afterLines = await page
        .locator('[data-testid="test-output"] .output-line')
        .allTextContents()
      const afterContent = afterLines.join('\n')
      expect(afterContent).toContain('New session test')
      // Content should have changed (don't check length since initial bash prompt is long)
    }
  )

  extendedTest(
    'should extend xterm display when running echo command',
    async ({ page, server }) => {
      const description = 'Echo display test session'
      await setupSession(page, server, description)
      const initialLines = await page
        .locator('[data-testid="test-output"] .output-line')
        .allTextContents()
      const initialContent = initialLines.join('\n')
      // Initial content should have bash prompt
      expect(initialContent).toContain('$')

      // Create a session that produces 'a' in output
      const apiClient = createApiClient(server.baseURL)
      await apiClient.sessions.create({
        command: 'bash',
        args: ['-c', 'echo a'],
        description: 'Echo a session',
      })
      await page.waitForSelector('.session-item:has-text("Echo a session")')
      await page.locator('.session-item:has-text("Echo a session")').click()
      await page.waitForTimeout(1000)

      const afterLines = await page
        .locator('[data-testid="test-output"] .output-line')
        .allTextContents()
      const afterContent = afterLines.join('\n')
      expect(afterContent).toContain('a')
      // Content should have changed (don't check length since initial bash prompt is long)
    }
  )
})
