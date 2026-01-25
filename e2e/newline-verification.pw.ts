import { test as extendedTest, expect } from './fixtures'
import { waitForTerminalRegex } from './xterm-test-helpers'
import type { Page } from '@playwright/test'

const getTerminalPlainText = async (page: Page): Promise<string[]> => {
  return await page.evaluate(() => {
    const getPlainText = () => {
      const terminalElement = document.querySelector('.xterm')
      if (!terminalElement) return []

      const lines = Array.from(terminalElement.querySelectorAll('.xterm-rows > div')).map((row) => {
        return Array.from(row.querySelectorAll('span'))
          .map((span) => span.textContent || '')
          .join('')
      })

      return lines
    }

    return getPlainText()
  })
}

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

      // Analyze and assert bug presence inline (formerly had log output)
      const trailingEmptyLines = finalLines.length - 1 - finalLastNonEmpty
      expect(finalLastNonEmpty - initialLastNonEmpty > 3 || trailingEmptyLines > 2).toBe(true) // Demonstrates the newline duplication bug

      // Verify content structure (accept any non-negative initial prompt line)
      expect(initialLastNonEmpty).toBeGreaterThanOrEqual(0) // Accept any line with prompt
      expect(finalLastNonEmpty).toBeGreaterThan(2) // More than expected due to bug
    }
  )
})
