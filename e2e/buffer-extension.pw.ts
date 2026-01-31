import { test as extendedTest, expect } from './fixtures'
import type { Page } from '@playwright/test'

/**
 * Session and Terminal Helpers for E2E buffer extension tests
 */
async function setupSession(
  page: Page,
  server: { baseURL: string; port: number },
  description: string
): Promise<string> {
  await page.request.post(server.baseURL + '/api/sessions/clear')
  const createResp = await page.request.post(server.baseURL + '/api/sessions', {
    data: { command: 'bash', args: ['-c', 'echo "Ready for test"'], description },
  })
  expect(createResp.status()).toBe(200)
  const { id } = await createResp.json()
  await page.goto(server.baseURL)
  await page.waitForSelector('h1:has-text("PTY Sessions")')
  await page.waitForSelector('.session-item')
  await page.locator(`.session-item:has-text("${description}")`).click()
  await page.waitForSelector('.output-container', { timeout: 5000 })
  await page.waitForSelector('.xterm', { timeout: 5000 })
  await page.waitForSelector('.xterm:has-text("Ready for test")', { timeout: 10000 })
  return id
}
async function typeInTerminal(page: Page, text: string) {
  await page.locator('.terminal.xterm').click()
  await page.keyboard.type(text)
  // Don't wait for text to appear since we're testing buffer extension, not visual echo
}
async function getRawBuffer(
  page: Page,
  server: { baseURL: string; port: number },
  sessionId: string
): Promise<string> {
  const resp = await page.request.get(`${server.baseURL}/api/sessions/${sessionId}/buffer/raw`)
  expect(resp.status()).toBe(200)
  const data = await resp.json()
  return data.raw
}
// Usage: await getSerializedContentByXtermSerializeAddon(page, { excludeModes: true, excludeAltBuffer: true })

extendedTest.describe('Buffer Extension on Input', () => {
  extendedTest(
    'should extend buffer when sending input to interactive bash session',
    async ({ page, server }) => {
      const description = 'Buffer extension test session'
      const sessionId = await setupSession(page, server, description)
      const initialRaw = await getRawBuffer(page, server, sessionId)
      const initialLen = initialRaw.length
      await typeInTerminal(page, 'a')
      const afterRaw = await getRawBuffer(page, server, sessionId)
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
      expect(initialContent).toContain('Ready for test')

      // Create a new session with different output
      const createResp = await page.request.post(server.baseURL + '/api/sessions', {
        data: {
          command: 'bash',
          args: ['-c', 'echo "New session test"'],
          description: 'New test session',
        },
      })
      expect(createResp.status()).toBe(200)
      await page.waitForSelector('.session-item:has-text("New test session")')
      await page.locator('.session-item:has-text("New test session")').click()
      await page.waitForTimeout(1000)

      const afterLines = await page
        .locator('[data-testid="test-output"] .output-line')
        .allTextContents()
      const afterContent = afterLines.join('\n')
      expect(afterContent).toContain('New session test')
      expect(afterContent.length).toBeGreaterThan(initialContent.length)
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

      // Create a session that produces 'a' in output
      const createResp = await page.request.post(server.baseURL + '/api/sessions', {
        data: { command: 'bash', args: ['-c', 'echo a'], description: 'Echo a session' },
      })
      expect(createResp.status()).toBe(200)
      await page.waitForSelector('.session-item:has-text("Echo a session")')
      await page.locator('.session-item:has-text("Echo a session")').click()
      await page.waitForTimeout(1000)

      const afterLines = await page
        .locator('[data-testid="test-output"] .output-line')
        .allTextContents()
      const afterContent = afterLines.join('\n')
      expect(afterContent).toContain('a')
      expect(afterContent.length).toBeGreaterThan(initialContent.length)
    }
  )
})
