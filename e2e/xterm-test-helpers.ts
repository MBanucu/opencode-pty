import type { Page } from '@playwright/test'
import type { SerializeAddon } from '@xterm/addon-serialize'
import stripAnsi from 'strip-ansi'

// Use Bun.stripANSI if available, otherwise fallback to npm strip-ansi
let bunStripANSI: (str: string) => string
try {
  if (typeof Bun !== 'undefined' && Bun.stripANSI) {
    bunStripANSI = Bun.stripANSI
  } else {
    // Note: dynamic import only relevant in Bun, for typing only in Node
    // @ts-ignore
    const bunModule = await import('bun')
    bunStripANSI = bunModule.stripANSI
  }
} catch {
  bunStripANSI = stripAnsi
}

export { bunStripANSI }

/**
 * Deprecated: Use getSerializedContentByXtermSerializeAddon for all terminal content extraction in E2E tests.
 * This DOM scraping method should only be used for rare visual/manual cross-checks or debugging.
 */
export const getTerminalPlainText = async (page: Page): Promise<string[]> => {
  return await page.evaluate(() => {
    const getPlainText = () => {
      const terminalElement = document.querySelector('.xterm')
      if (!terminalElement) return []

      const lines = Array.from(terminalElement.querySelectorAll('.xterm-rows > div')).map((row) => {
        return Array.from(row.querySelectorAll('span'))
          .map((span) => span.textContent || '')
          .join('')
      })

      // Return only lines up to the last non-empty line
      const findLastNonEmptyIndex = (lines: string[]): number => {
        for (let i = lines.length - 1; i >= 0; i--) {
          if (lines[i] !== '') {
            return i
          }
        }
        return -1
      }

      const lastNonEmptyIndex = findLastNonEmptyIndex(lines)
      if (lastNonEmptyIndex === -1) return []

      return lines.slice(0, lastNonEmptyIndex + 1)
    }

    return getPlainText()
  })
}

/**
 * Extract terminal text via xterm.js SerializeAddon (configurable modes for DRY E2E usage)
 */
export const getSerializedContentByXtermSerializeAddon = async (
  page: Page,
  { excludeModes = false, excludeAltBuffer = false } = {}
): Promise<string> => {
  return await page.evaluate(
    (opts) => {
      const serializeAddon = (window as any).xtermSerializeAddon as SerializeAddon | undefined
      if (!serializeAddon) return ''
      return serializeAddon.serialize({
        excludeModes: opts.excludeModes,
        excludeAltBuffer: opts.excludeAltBuffer,
      })
    },
    { excludeModes, excludeAltBuffer }
  )
}

/**
 * Robust, DRY event-driven terminal content waiter for Playwright E2E
 * Waits for regex pattern to appear in xterm.js SerializeAddon buffer (optionally specify flagName).
 * Usage: await waitForTerminalRegex(page, /pattern/, '__someCustomFlag')
 */
export const waitForTerminalRegex = async (
  page: Page,
  regex: RegExp,
  flagName = '__terminalOutputReady',
  serializeOptions: { excludeModes?: boolean; excludeAltBuffer?: boolean } = {
    excludeModes: true,
    excludeAltBuffer: true,
  },
  timeout: number = 5000
) => {
  const pattern = regex.source
  await page.evaluate(
    ({ pattern, flagName, opts }) => {
      // Setup output watcher on window
      const term =
        (window as any).xtermSerializeAddon && (window as any).xtermSerializeAddon._terminal
      const serializeAddon = (window as any).xtermSerializeAddon
      function stripAnsi(str: string) {
        return str.replace(
          /[\u001B\u009B][[()#;?]*(?:(?:[a-zA-Z\d]*(?:;[a-zA-Z\d]*)*)?\u0007|(?:\d{1,4}(?:;\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~])/g,
          ''
        )
      }
      function checkMatch() {
        if (serializeAddon && typeof serializeAddon.serialize === 'function') {
          const c = serializeAddon.serialize({
            excludeModes: opts.excludeModes,
            excludeAltBuffer: opts.excludeAltBuffer,
          })
          try {
            const plain = stripAnsi(c.replaceAll('\r', ''))
            return new RegExp(pattern).test(plain)
          } catch (e) {
            return false
          }
        }
        return false
      }
      if (term && typeof term.onWriteParsed === 'function') {
        ;(window as any)[flagName] = false
        const disposable = term.onWriteParsed(() => {
          if (checkMatch()) {
            ;(window as any)[flagName] = true
            disposable.dispose()
          }
        })
        // Check immediately (catch output that already arrived)
        if (checkMatch()) {
          ;(window as any)[flagName] = true
          disposable.dispose()
        }
      } else {
        ;(window as any)[flagName] = true // fallback, treat as ready
      }
    },
    { pattern, flagName, opts: serializeOptions }
  )
  await page.waitForFunction((flagName) => (window as any)[flagName] === true, flagName, {
    timeout,
  })
}
