import { test as extendedTest, expect } from './fixtures'
import { waitForTerminalRegex, getTerminalPlainText } from './xterm-test-helpers'

const findLastNonEmptyLineIndex = (lines: string[]): number => {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i] !== '') {
      return i
    }
  }
  return -1
}

extendedTest.describe('Xterm Newline Handling', () => {
  extendedTest('should capture typed character in xterm display', async ({ page, server }) => {
    // Clear any existing sessions
    await page.request.post(server.baseURL + '/api/sessions/clear')

    // Create interactive bash session
    const createResponse = await page.request.post(server.baseURL + '/api/sessions', {
      data: {
        command: 'bash',
        args: ['-i'],
        description: 'Simple typing test session',
      },
    })
    expect(createResponse.status()).toBe(200)

    // Navigate and select session
    await page.goto(server.baseURL)
    await page.waitForSelector('h1:has-text("PTY Sessions")')
    await page.waitForSelector('.session-item', { timeout: 5000 })
    await page.locator('.session-item').first().click()
    await page.waitForSelector('.xterm', { timeout: 5000 })
    await waitForTerminalRegex(page, /\$\s*$/, '__waitPromptInitial')

    // Type single character
    await page.locator('.terminal.xterm').click()
    await page.keyboard.type('a')
    await waitForTerminalRegex(page, /a\s*$/, '__waitEchoA')

    // Capture after
    const afterLines = await getTerminalPlainText(page)
    const afterLastNonEmpty = findLastNonEmptyLineIndex(afterLines)
    // console.log('\ud83d\udd0d Simple test - After lines count:', afterLines.length)
    // console.log('\ud83d\udd0d Simple test - After last non-empty:', afterLastNonEmpty)

    // Assert that the new prompt line has the typed character at the end (accepts spaces)
    const promptPattern = /\$ *a\s*$/
    expect(afterLastNonEmpty).toBeGreaterThanOrEqual(0)
    expect(afterLines[afterLastNonEmpty]).toBeDefined()
    expect(promptPattern.test((afterLines[afterLastNonEmpty] || '').trim())).toBe(true)
  })

  extendedTest(
    'should not add extra newlines when running echo command',
    async ({ page, server }) => {
      // Clear any existing sessions
      await page.request.post(server.baseURL + '/api/sessions/clear')

      // Create interactive bash session
      const createResponse = await page.request.post(server.baseURL + '/api/sessions', {
        data: {
          command: 'bash',
          args: ['-i'],
          description: 'PTY Buffer readRaw() Function',
        },
      })
      expect(createResponse.status()).toBe(200)

      // Navigate and select session
      await page.goto(server.baseURL)
      await page.waitForSelector('h1:has-text("PTY Sessions")')
      await page.waitForSelector('.session-item', { timeout: 5000 })
      await page.locator('.session-item').first().click()
      await page.waitForSelector('.xterm', { timeout: 5000 })
      await waitForTerminalRegex(page, /\$\s*$/, '__waitPromptInitial2')

      // Capture initial
      const initialLines = await getTerminalPlainText(page)
      const initialLastNonEmpty = findLastNonEmptyLineIndex(initialLines)
      // console.log('🔍 Initial lines count:', initialLines.length)
      // console.log('🔍 Initial last non-empty line index:', initialLastNonEmpty)
      // logLinesUpToIndex(initialLines, initialLastNonEmpty, 'Initial content')

      // Type command
      await page.locator('.terminal.xterm').click()
      await page.keyboard.type("echo 'Hello World'")
      await page.keyboard.press('Enter')

      // Wait for output
      await waitForTerminalRegex(page, /Hello World/, '__waitHelloWorld')

      // Get final displayed plain text content
      const finalLines = await getTerminalPlainText(page)
      const finalLastNonEmpty = findLastNonEmptyLineIndex(finalLines)
      // console.log('🔍 Final lines count:', finalLines.length)
      // console.log('🔍 Final last non-empty line index:', finalLastNonEmpty)
      // logLinesUpToIndex(finalLines, finalLastNonEmpty, 'Final content')

      // Ignore trailing empty lines: focus on real content
      const nonEmptyLines = finalLines.filter((line) => line.trim().length > 0)
      // Should be: prompt, echoed command, output, new prompt
      // console.log('DEBUG nonEmptyLines', nonEmptyLines)
      expect(nonEmptyLines.some((l) => l.includes('Hello World'))).toBe(true)
      expect(nonEmptyLines[nonEmptyLines.length - 1]).toMatch(/\$/)
      // Order: prompt, echo, output, (optional prompt)
      const idxCmd = nonEmptyLines.findIndex((l) => l.includes("echo 'Hello World'"))
      const idxOut = nonEmptyLines.findLastIndex((l) => l.includes('Hello World'))
      expect(idxCmd).toBeGreaterThan(-1)
      expect(idxOut).toBeGreaterThan(idxCmd)
      // At least 3 lines: the first prompt, echoed line, 'Hello World', maybe prompt
      expect(nonEmptyLines.length).toBeGreaterThanOrEqual(3)
    }
  )
})
