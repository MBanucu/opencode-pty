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
    data: { command: 'bash', args: ['-i'], description },
  })
  expect(createResp.status()).toBe(200)
  const { id } = await createResp.json()
  await page.goto(server.baseURL)
  await page.waitForSelector('h1:has-text("PTY Sessions")')
  await page.waitForSelector('.session-item')
  await page.locator(`.session-item:has-text("${description}")`).click()
  await page.waitForSelector('.output-container', { timeout: 5000 })
  await page.waitForSelector('.xterm', { timeout: 5000 })
  await page.waitForSelector('.xterm:has-text("$")', { timeout: 10000 })
  return id
}
async function typeInTerminal(page: Page, text: string, expects: string) {
  await page.locator('.terminal.xterm').click()
  await page.keyboard.type(text)
  await page.waitForSelector(`.xterm:has-text("${expects}")`, { timeout: 2000 })
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
async function getXtermSerialized(page: Page): Promise<string> {
  return await page.evaluate(() => {
    const serializeAddon = (window as any).xtermSerializeAddon
    if (!serializeAddon) return ''
    return serializeAddon.serialize({ excludeModes: true, excludeAltBuffer: true })
  })
}

extendedTest.describe('Buffer Extension on Input', () => {
  extendedTest(
    'should extend buffer when sending input to interactive bash session',
    async ({ page, server }) => {
      const description = 'Buffer extension test session'
      const sessionId = await setupSession(page, server, description)
      const initialRaw = await getRawBuffer(page, server, sessionId)
      const initialLen = initialRaw.length
      await typeInTerminal(page, 'a', 'a')
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
      const initialContent = await getXtermSerialized(page)
      const initialLength = initialContent.length
      await typeInTerminal(page, 'a', 'a')
      const afterContent = await getXtermSerialized(page)
      expect(afterContent.length).toBeGreaterThan(initialLength)
      expect(afterContent).toContain('a')
    }
  )

  extendedTest(
    'should extend xterm display by exactly 1 character when typing "a"',
    async ({ page, server }) => {
      const description = 'Exact display extension test session'
      await setupSession(page, server, description)
      const initialContent = await getXtermSerialized(page)
      const initialLength = initialContent.length
      await typeInTerminal(page, 'a', 'a')
      const afterContent = await getXtermSerialized(page)
      expect(afterContent.length).toBe(initialLength + 1)
      expect(afterContent).toContain('a')
    }
  )
})
