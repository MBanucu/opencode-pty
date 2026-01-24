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

export const getSerializedContentByXtermSerializeAddon = async (page: Page) => {
  return await page.evaluate(() => {
    const serializeAddon = (window as any).xtermSerializeAddon as SerializeAddon | undefined
    if (!serializeAddon) return ''

    return serializeAddon.serialize({
      excludeModes: false,
      excludeAltBuffer: false,
    })
  })
}
