import { test, expect } from '@playwright/test'
import { initManager, manager } from '../src/plugin/pty/manager.ts'
import { initLogger } from '../src/plugin/logger.ts'
import { startWebServer, stopWebServer } from '../src/web/server.ts'

test.setTimeout(120000)

async function collectResourceStats(page: any) {
  // Collect resource timing entries from the page
  const entries = await page.evaluate(() => {
    // @ts-ignore
    return performance.getEntriesByType('resource').map((e: any) => ({
      name: e.name,
      initiatorType: e.initiatorType,
      transferSize: (e as any).transferSize || 0,
      encodedBodySize: (e as any).encodedBodySize || 0,
      decodedBodySize: (e as any).decodedBodySize || 0,
    }))
  })
  // Also get navigation timing
  const nav = await page.evaluate(() => ({
    loadEventEnd: performance.timing.loadEventEnd,
    loadEventStart: performance.timing.loadEventStart,
  }))
  return { entries, nav }
}

function sumTransfer(entries: any[], prefix?: string) {
  let total = 0
  for (const e of entries) {
    if (!prefix || e.name.includes(prefix)) total += e.transferSize || e.encodedBodySize || 0
  }
  return total
}

test('playwright perf: dist vs src', async ({ page }) => {
  const fakeClient = { app: { log: async (_: any) => {} } } as any
  initLogger(fakeClient)
  initManager(fakeClient)

  // 1) Production (dist)
  process.env.NODE_ENV = 'production'

  // Helper: try starting server on a random ephemeral port until it succeeds
  function getRandomPort() {
    return 10000 + Math.floor(Math.random() * 30000)
  }

  function startServerWithRetries(mode: 'production' | 'test') {
    for (let i = 0; i < 12; i++) {
      const port = getRandomPort()
      try {
        process.env.NODE_ENV = mode
        if (mode === 'test') {
          process.env.HTML_PATH = 'src/web/index.html'
        } else {
          delete process.env.HTML_PATH
        }
        const url = startWebServer({ port })
        return url
      } catch (err) {
        // port likely in use, try another
      }
    }
    throw new Error('Failed to start server on random ports')
  }

  const prodUrl = startServerWithRetries('production')

  // Attach console and pageerror listeners for diagnostics
  const consoleEvents: string[] = []
  page.on('console', (msg) => consoleEvents.push(`console:${msg.type()}:${msg.text()}`))
  page.on('pageerror', (err) => consoleEvents.push(`pageerror:${String(err)}`))

  async function collectDiagnostics(prefix: string, baseUrl = prodUrl) {
    let html = ''
    try {
      html = await page.content()
    } catch (e) {
      html = `failed to get page.content(): ${String(e)}`
    }
    let resources: string[] = []
    try {
      resources = await page.evaluate(() =>
        performance.getEntriesByType('resource').map((e: any) => e.name)
      )
    } catch (e) {
      resources = [`failed to read resources: ${String(e)}`]
    }
    let apiBody = ''
    try {
      const r = await page.request.get(`${baseUrl}/api/sessions`)
      apiBody = await r.text()
    } catch (e) {
      apiBody = `failed to fetch /api/sessions: ${String(e)}`
    }
    console.log(`--- DIAGNOSTICS ${prefix}`)
    console.log('console events:', consoleEvents.join('\n'))
    console.log('root HTML size:', html.length)
    console.log('resources (first 40):', resources.slice(0, 40))
    console.log('/api/sessions body (truncated):', apiBody.slice(0, 2000))
  }

  let prodTotal = 0
  let prodStats: any = null
  try {
    await page.goto(prodUrl, { waitUntil: 'load' })
    // Wait for the app container and the sidebar to render. The app may
    // receive the session list via WebSocket rather than an XHR, so
    // waiting for an XHR is brittle; rely on DOM instead.
    await page.waitForSelector('.container', { timeout: 5000 })
    await page.waitForSelector('.sidebar', { timeout: 5000 })
    const sessionCount = await page.locator('.sidebar .session-item').count()
    const listText = await page.locator('.sidebar .session-list').innerText()
    if (sessionCount === 0) {
      // Accept the 'No active sessions' empty state
      expect(listText).toMatch(/No active sessions/i)
    }
    prodStats = await collectResourceStats(page)
    prodTotal = sumTransfer(prodStats.entries)
  } catch (err) {
    await collectDiagnostics('prod-failure')
    stopWebServer()
    throw err
  }

  stopWebServer()

  // 2) Test (serve src modules)
  // Use the repository's own Bun web server in test mode so it serves src files
  const testUrl = startServerWithRetries('test')

  let testStats: any = null
  let testTotal = 0

  try {
    await page.goto(testUrl, { waitUntil: 'load' })
    // The client may use WebSocket or fetch to obtain sessions. Wait for
    // the sidebar to appear which indicates the app mounted and rendered.
    await page.waitForSelector('.sidebar', { timeout: 5000 })
    const sessionCount = await page.locator('.sidebar .session-item').count()
    const listText = await page.locator('.sidebar .session-list').innerText()
    if (sessionCount === 0) {
      expect(listText).toMatch(/No active sessions/i)
    }
    testStats = await collectResourceStats(page)
    testTotal = sumTransfer(testStats.entries)
  } catch (err) {
    await collectDiagnostics('test-failure', testUrl)
    stopWebServer()
    throw err
  }

  stopWebServer()

  // Log results to test output
  console.log('prod total transfer bytes:', prodTotal)
  console.log('test total transfer bytes:', testTotal)

  // Basic assertions: pages load and resource lists are present
  expect(prodStats.entries.length).toBeGreaterThan(0)
  expect(testStats.entries.length).toBeGreaterThan(0)

  // We don't strictly assert prod < test because bundle splitting and caching
  // can affect numbers; instead ensure both loads succeeded and record numbers.
})
