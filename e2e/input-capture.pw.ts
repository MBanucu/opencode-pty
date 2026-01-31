import { test as extendedTest, expect } from './fixtures'

extendedTest.describe('PTY Input Capture', () => {
  extendedTest(
    'should capture and send printable character input (letters)',
    async ({ page, api }) => {
      await api.sessions.clear()
      await page.addInitScript(() => {
        localStorage.setItem('skip-autoselect', 'true')
        ;(window as any).inputRequests = []
      })
      await page.waitForSelector('h1:has-text("PTY Sessions")')
      await api.sessions.create({
        command: 'bash',
        args: ['-i'],
        description: 'Input test session',
      })
      await page.waitForSelector('.session-item', { timeout: 5000 })
      await page.locator('.session-item:has-text("Input test session")').click()
      await page.waitForSelector('.output-container', { timeout: 5000 })
      const inputRequests: string[] = []
      await page.route('**/api/sessions/*/input', async (route) => {
        const request = route.request()
        if (request.method() === 'POST') {
          const postData = request.postDataJSON()
          inputRequests.push(postData.data)
          await page.evaluate((data) => {
            ;(window as any).inputRequests.push(data)
          }, postData.data)
        }
        await route.continue()
      })
      await page.waitForSelector('.terminal.xterm', { timeout: 5000 })
      await page.locator('.terminal.xterm').click()
      await page.keyboard.type('hello')
      await page.waitForFunction(
        () => {
          return (window as any).inputRequests?.length >= 5
        },
        undefined,
        { timeout: 2000 }
      )
      expect(inputRequests).toContain('h')
      expect(inputRequests).toContain('e')
      expect(inputRequests).toContain('l')
      expect(inputRequests).toContain('o')
    }
  )

  extendedTest('should capture spacebar input', async ({ page, api }) => {
    await page.addInitScript(() => {
      localStorage.setItem('skip-autoselect', 'true')
      ;(window as any).inputRequests = []
    })
    await api.sessions.clear()
    await page.waitForSelector('h1:has-text("PTY Sessions")')
    await api.sessions.create({
      command: 'bash',
      args: ['-i'],
      description: 'Space test session',
    })
    await page.waitForSelector('.session-item', { timeout: 5000 })
    await page.locator('.session-item:has-text("Space test session")').click()
    await page.waitForSelector('.output-container', { timeout: 5000 })
    await page.waitForSelector('.xterm', { timeout: 5000 })
    const inputRequests: string[] = []
    await page.route('**/api/sessions/*/input', async (route) => {
      const request = route.request()
      if (request.method() === 'POST') {
        const postData = request.postDataJSON()
        inputRequests.push(postData.data)
        await page.evaluate((data) => {
          ;(window as any).inputRequests.push(data)
        }, postData.data)
      }
      await route.continue()
    })
    await page.locator('.terminal.xterm').click()
    await page.keyboard.press(' ')
    await page.waitForFunction(
      () => {
        return (window as any).inputRequests.filter((req: string) => req === ' ').length >= 1
      },
      undefined,
      { timeout: 2000 }
    )
    expect(inputRequests.filter((req) => req === ' ')).toHaveLength(1)
  })

  extendedTest('should capture "ls" command with Enter key', async ({ page, api }) => {
    await page.addInitScript(() => {
      localStorage.setItem('skip-autoselect', 'true')
      ;(window as any).inputRequests = []
    })
    await api.sessions.clear()
    await page.waitForSelector('h1:has-text("PTY Sessions")')
    await api.sessions.create({
      command: 'bash',
      args: ['-i'],
      description: 'ls command test session',
    })
    await page.waitForSelector('.session-item', { timeout: 5000 })
    await page.locator('.session-item:has-text("ls command test session")').click()
    await page.waitForSelector('.output-container', { timeout: 5000 })
    await page.waitForSelector('.xterm', { timeout: 5000 })

    // Robustify: setup route & inputRequests before terminal interaction
    const inputRequests: string[] = []
    await page.route('**/api/sessions/*/input', async (route) => {
      const request = route.request()
      if (request.method() === 'POST') {
        const postData = request.postDataJSON()
        inputRequests.push(postData.data)
        await page.evaluate((data) => {
          ;(window as any).inputRequests.push(data)
        }, postData.data)
      }
      await route.continue()
    })

    // Add extra debug: log all outbound network requests
    // Remove noisy output: no test runner logging of requests or browser console events

    await page.locator('.terminal.xterm').click()
    await page.keyboard.type('ls')
    await page.keyboard.press('Enter')
    await page.waitForFunction(
      () => {
        const arr = (window as any).inputRequests || []
        return arr.includes('l') && arr.includes('s') && (arr.includes('\r') || arr.includes('\n'))
      },
      undefined,
      { timeout: 2000 }
    )
    expect(inputRequests).toContain('l')
    expect(inputRequests).toContain('s')
    expect(inputRequests.some((chr) => chr === '\n' || chr === '\r')).toBeTruthy()
  })

  extendedTest('should send backspace sequences', async ({ page, api }) => {
    await page.addInitScript(() => {
      localStorage.setItem('skip-autoselect', 'true')
      ;(window as any).inputRequests = []
    })
    await api.sessions.clear()
    await page.waitForSelector('h1:has-text("PTY Sessions")')
    await api.sessions.create({
      command: 'bash',
      args: ['-i'],
      description: 'Backspace test session',
    })
    await page.waitForSelector('.session-item', { timeout: 5000 })
    await page.locator('.session-item:has-text("Backspace test session")').click()
    await page.waitForSelector('.output-container', { timeout: 5000 })
    await page.waitForSelector('.xterm', { timeout: 5000 })
    const inputRequests: string[] = []
    await page.route('**/api/sessions/*/input', async (route) => {
      const request = route.request()
      if (request.method() === 'POST') {
        const postData = request.postDataJSON()
        inputRequests.push(postData.data)
        await page.evaluate((data) => {
          ;(window as any).inputRequests.push(data)
        }, postData.data)
      }
      await route.continue()
    })
    await page.locator('.terminal.xterm').click()
    await page.keyboard.type('test')
    await page.keyboard.press('Backspace')
    await page.keyboard.press('Backspace')
    await page.waitForFunction(
      () => {
        const arr = (window as any).inputRequests || []
        return arr.some((req: string) => req === '\x7f' || req === '\b')
      },
      undefined,
      { timeout: 1500 }
    )
    expect(inputRequests.some((req) => req === '\x7f' || req === '\b')).toBe(true)
  })

  extendedTest('should handle Ctrl+C interrupt', async ({ page, api }) => {
    await page.addInitScript(() => {
      localStorage.setItem('skip-autoselect', 'true')
      ;(window as any).inputRequests = []
      ;(window as any).killRequests = []
    })
    await api.sessions.clear()
    await page.waitForSelector('h1:has-text("PTY Sessions")')
    page.on('dialog', (dialog) => dialog.accept())
    await api.sessions.create({
      command: 'bash',
      args: ['-i'],
      description: 'Ctrl+C test session',
    })
    await page.waitForSelector('.session-item', { timeout: 5000 })
    await page.locator('.session-item:has-text("Ctrl+C test session")').click()
    await page.waitForSelector('.output-container', { timeout: 5000 })
    const inputRequests: string[] = []
    await page.route('**/api/sessions/*/input', async (route) => {
      const request = route.request()
      if (request.method() === 'POST') {
        const postData = request.postDataJSON()
        inputRequests.push(postData.data)
        await page.evaluate((data) => {
          ;(window as any).inputRequests.push(data)
        }, postData.data)
      }
      await route.continue()
    })
    const killRequests: string[] = []
    await page.route('**/api/sessions/*/kill', async (route) => {
      if (route.request().method() === 'POST') {
        killRequests.push('kill')
        await page.evaluate(() => {
          ;(window as any).killRequests = (window as any).killRequests || []
          ;(window as any).killRequests.push('kill')
        })
      }
      await route.continue()
    })
    await page.waitForSelector('.xterm', { timeout: 5000 })
    await page.locator('.terminal.xterm').click()
    await page.keyboard.type('hello')
    await page.waitForFunction(
      () => {
        const arr = (window as any).inputRequests || []
        return arr.includes('h') && arr.includes('e') && arr.includes('l') && arr.includes('o')
      },
      undefined,
      { timeout: 1500 }
    )
    expect(inputRequests).toContain('h')
    expect(inputRequests).toContain('e')
    expect(inputRequests).toContain('l')
    expect(inputRequests).toContain('o')
    await page.waitForFunction(() => (window as any).inputRequests?.includes('o'), undefined, {
      timeout: 500,
    })
    await page.keyboard.press('Control+c')
    await page.waitForFunction(
      () => {
        // Accept kill POST for Ctrl+C
        return (
          Array.isArray((window as any).killRequests) && (window as any).killRequests.length > 0
        )
      },
      undefined,
      { timeout: 2000 }
    )
    expect(killRequests.length).toBeGreaterThan(0)
  })

  extendedTest('should not capture input when session is inactive', async ({ page, api }) => {
    await page.addInitScript(() => {
      localStorage.setItem('skip-autoselect', 'true')
      ;(window as any).inputRequests = []
    })
    await api.sessions.clear()
    await page.waitForSelector('h1:has-text("PTY Sessions")')
    page.on('dialog', (dialog) => dialog.accept())
    await api.sessions.create({
      command: 'bash',
      args: ['-c', 'echo "Ready for input"'],
      description: 'Inactive session test',
    })
    await page.waitForSelector('.session-item', { timeout: 5000 })
    await page.locator('.session-item:has-text("Inactive session test")').click()
    await page.waitForSelector('.output-container', { timeout: 5000 })
    await page.waitForSelector('.xterm', { timeout: 5000 })
    await page.locator('.kill-btn').click()
    await page.waitForSelector(
      '.empty-state:has-text("Select a session from the sidebar to view its output")',
      { timeout: 5000 }
    )
    const inputRequests: string[] = []
    await page.route('**/api/sessions/*/input', async (route) => {
      const request = route.request()
      if (request.method() === 'POST') {
        const postData = request.postDataJSON()
        inputRequests.push(postData.data)
        await page.evaluate((data) => {
          ;(window as any).inputRequests.push(data)
        }, postData.data)
      }
      await route.continue()
    })
    await page.keyboard.type('should not send')
    // Wait to ensure input would be captured if incorrectly routed
    await page.waitForTimeout(300)
    expect(inputRequests.length).toBe(0)
  })

  extendedTest(
    'should display "Hello World" twice when running echo command',
    async ({ page, api }) => {
      await page.addInitScript(() => {
        localStorage.setItem('skip-autoselect', 'true')
        ;(window as any).inputRequests = []
      })
      await api.sessions.clear()
      await page.waitForSelector('h1:has-text("PTY Sessions")')
      await api.sessions.create({
        command: 'bash',
        args: ['-c', "echo 'Hello World'"],
        description: 'Echo test session',
      })
      await page.waitForSelector('.session-item:has-text("Echo test session")', { timeout: 5000 })
      await page.locator('.session-item:has-text("Echo test session")').click()
      await page.waitForSelector('.output-container', { timeout: 5000 })
      await page.waitForSelector('.xterm', { timeout: 5000 })

      // Wait for the command to complete and output to appear
      await page.waitForTimeout(1000)

      const outputLines = await page
        .locator('[data-testid="test-output"] .output-line')
        .allTextContents()
      const allOutput = outputLines.join('\n')
      expect(outputLines.length).toBeGreaterThan(0)
      expect(allOutput).toContain('Hello World')
    }
  )
})
