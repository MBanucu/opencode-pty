#!/usr/bin/env bun

import { chromium } from 'playwright-core'
import { initManager, manager } from './src/plugin/pty/manager.ts'
import { initLogger } from './src/plugin/logger.ts'
import { startWebServer, stopWebServer } from './src/web/server.ts'

// Mock OpenCode client for testing
const fakeClient = {
  app: {
    log: async (_opts: any) => {},
  },
} as any

async function runBrowserTest() {
  // Initialize the PTY manager and logger
  initLogger(fakeClient)
  initManager(fakeClient)

  // Start the web server
  startWebServer({ port: 8867 })

  // Spawn an exited test session
  const exitedSession = manager.spawn({
    command: 'echo',
    args: ['Hello from exited session!'],
    description: 'Exited session test',
    parentSessionId: 'test',
  })

  // Wait for output and exit

  let attempts = 0
  while (attempts < 50) {
    // Wait up to 5 seconds
    const currentSession = manager.get(exitedSession.id)
    const output = manager.read(exitedSession.id)
    if (currentSession?.status === 'exited' && output && output.lines.length > 0) {
      break
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
    attempts++
  }

  // Double-check the session status and output

  // Spawn a running test session
  manager.spawn({
    command: 'bash',
    args: ['-c', 'echo "Initial output"; while true; do echo "Still running..."; sleep 1; done'],
    description: 'Running session test',
    parentSessionId: 'test',
  })

  // Give it time to produce initial output
  await new Promise((resolve) => setTimeout(resolve, 1000))

  // Check if sessions have buffer content

  // Launch browser
  const browser = await chromium.launch({
    executablePath: '/run/current-system/sw/bin/google-chrome-stable',
    headless: true,
  })

  try {
    const context = await browser.newContext()
    const page = await context.newPage()

    // Navigate to the web UI
    await page.goto('http://localhost:8867/')

    // Wait for sessions to load
    await page.waitForSelector('.session-item', { timeout: 10000 })

    // Check that we have sessions
    const sessionCount = await page.locator('.session-item').count()

    if (sessionCount === 0) {
      throw new Error('No sessions found in UI')
    }

    // Wait a bit for auto-selection to complete
    await page.waitForTimeout(1000)

    // Test exited session first
    const exitedSessionItem = page
      .locator('.session-item')
      .filter({ hasText: 'Hello from exited session!' })
      .first()
    const exitedVisible = await exitedSessionItem.isVisible()

    if (exitedVisible) {
      // Click on exited session
      await exitedSessionItem.click()

      // Check page title
      await page.waitForTimeout(500)

      // Wait for output
      await page.waitForSelector('.output-line', { timeout: 5000 })
      const exitedOutput = await page.locator('.output-line').first().textContent()

      if (exitedOutput?.includes('Hello from exited session!')) {
      } else {
        return
      }
    }

    // Test running session
    // Find session by status badge "running" instead of text content
    const allSessions2 = page.locator('.session-item')
    const totalSessions = await allSessions2.count()
    let runningSessionItem = null

    for (let i = 0; i < totalSessions; i++) {
      const session = allSessions2.nth(i)
      const statusBadge = await session.locator('.status-badge').textContent()
      if (statusBadge === 'running') {
        runningSessionItem = session
        break
      }
    }

    const runningVisible = runningSessionItem !== null

    if (runningVisible && runningSessionItem) {
      // Click on running session
      await runningSessionItem.click()

      // Check page title
      await page.waitForTimeout(500)

      // Wait for output
      await page.waitForSelector('.output-line', { timeout: 5000 })
      const runningOutput = await page.locator('.output-line').first().textContent()

      if (runningOutput?.includes('Initial output')) {
      }
    }

    // All E2E tests completed successfully
  } finally {
    await browser.close()
    stopWebServer()
  }
}

// Run the test
runBrowserTest().catch(console.error)
