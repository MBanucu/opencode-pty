import { describe, it, expect, afterEach } from 'bun:test'
import { spawn } from 'bun'

describe('Logger Integration Tests', () => {
  let serverProcess: any = null
  let testPort = 8900 // Start from a high port to avoid conflicts

  afterEach(async () => {
    // Clean up any running server
    if (serverProcess) {
      serverProcess.kill()
      serverProcess = null
    }
    // Kill any lingering server processes on our test ports
    try {
      for (let port = 8900; port < 8920; port++) {
        try {
          const lsofProcess = spawn(['lsof', '-ti', `:${port}`], {
            stdout: 'pipe',
            stderr: 'pipe',
          })
          const pidOutput = await new Response(lsofProcess.stdout).text()
          if (pidOutput.trim()) {
            const killProcess = spawn(['kill', '-9', pidOutput.trim()], {
              stdout: 'pipe',
              stderr: 'pipe',
            })
            await killProcess.exited
          }
        } catch {
          // Ignore errors for this port
        }
      }
    } catch {
      // Ignore if no processes to kill
    }
  })

  describe('Plugin Logger Format', () => {
    it('should format logs with local time in development', async () => {
      const port = testPort++
      // Start server with development config
      serverProcess = spawn(['bun', 'run', 'test-web-server.ts', `--port=${port}`], {
        env: {
          ...process.env,
          NODE_ENV: 'development',
          LOG_LEVEL: 'info',
        },
        stdout: 'pipe',
        stderr: 'pipe',
      })

      // Wait for server to start
      await new Promise(resolve => setTimeout(resolve, 3000))

      // Make a request to trigger logging
      await fetch(`http://localhost:${port}/api/sessions`, {
        method: 'GET',
      })

      // Wait a bit for logs to be written
      await new Promise(resolve => setTimeout(resolve, 500))

      // Kill the server and capture output
      serverProcess.kill()
      const [stdout, stderr] = await Promise.all([
        new Response(serverProcess.stdout).text(),
        new Response(serverProcess.stderr).text(),
      ])

      const output = stdout + stderr

      // Verify log format contains local time
      expect(output).toContain(`Test server starting on port ${port}`)

      // Check for Pino pretty format with local time
      // The logs should contain something like: [2026-01-22 16:45:30.123 +0100]
      const localTimeRegex = /\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3} [+-]\d{4}\]/
      expect(localTimeRegex.test(output)).toBe(true)

      // Should contain service name
      expect(output).toContain('"service":"opencode-pty-test"')

      // Should contain environment
      expect(output).toContain('"env":"development"')
    })

    it('should respect LOG_LEVEL environment variable', async () => {
      const port = testPort++
      // Start server with debug level
      serverProcess = spawn(['bun', 'run', 'test-web-server.ts', `--port=${port}`], {
        env: {
          ...process.env,
          NODE_ENV: 'development',
          LOG_LEVEL: 'debug',
        },
        stdout: 'pipe',
        stderr: 'pipe',
      })

      // Wait for server to start
      await new Promise(resolve => setTimeout(resolve, 3000))

      // Make a request to trigger debug logging
      await fetch(`http://localhost:${port}/api/sessions`, {
        method: 'GET',
      })

      // Wait a bit for logs to be written
      await new Promise(resolve => setTimeout(resolve, 500))

      // Kill the server and capture output
      serverProcess.kill()
      const [stdout, stderr] = await Promise.all([
        new Response(serverProcess.stdout).text(),
        new Response(serverProcess.stderr).text(),
      ])

      const output = stdout + stderr

      // Should contain debug level logs
      expect(output).toContain('"level":20') // debug level
      // Should contain debug logs from our code
      expect(output).toContain('fetch request')
    })

    it('should handle CI environment correctly', async () => {
      const port = testPort++
      // Start server with CI=true
      serverProcess = spawn(['bun', 'run', 'test-web-server.ts', `--port=${port}`], {
        env: {
          ...process.env,
          CI: 'true',
          NODE_ENV: 'development',
        },
        stdout: 'pipe',
        stderr: 'pipe',
      })

      // Wait for server to start
      await new Promise(resolve => setTimeout(resolve, 3000))

      // Kill the server and capture output
      serverProcess.kill()
      const [stdout, stderr] = await Promise.all([
        new Response(serverProcess.stdout).text(),
        new Response(serverProcess.stderr).text(),
      ])

      const output = stdout + stderr

      // Should contain debug level (CI forces debug)
      expect(output).toContain('"level":20') // debug level
    })
  })

      // Wait for server to start
      await new Promise((resolve) => setTimeout(resolve, 3000))

      // Make a request to trigger logging
      await fetch(`http://localhost:${port}/api/sessions`, {
        method: 'GET',
      })

      // Wait a bit for logs to be written
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Kill the server and capture output
      serverProcess.kill()
      const [stdout, stderr] = await Promise.all([
        new Response(serverProcess.stdout).text(),
        new Response(serverProcess.stderr).text(),
      ])

      const output = stdout + stderr

      // Verify log format contains local time
      expect(output).toContain(`Test server starting on port ${port}`)

      // Check for Pino pretty format with local time
      // The logs should contain something like: [2026-01-22 16:45:30.123 +0100]
      const localTimeRegex = /\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3} [+-]\d{4}\]/
      expect(localTimeRegex.test(output)).toBe(true)

      // Should contain service name
      expect(output).toContain('"service":"opencode-pty-test"')

      // Should contain environment
      expect(output).toContain('"env":"development"')
    })

    it('should format logs correctly', async () => {
      const port = testPort++
      // Start server
      serverProcess = spawn(['bun', 'run', 'test-web-server.ts', `--port=${port}`], {
        env: {
          ...process.env,
          NODE_ENV: 'development',
          LOG_LEVEL: 'info',
        },
        stdout: 'pipe',
        stderr: 'pipe',
      })

      // Wait for server to start
      await new Promise(resolve => setTimeout(resolve, 3000))

      // Make a request to trigger logging
      await fetch(`http://localhost:${port}/api/sessions`, {
        method: 'GET',
      })

      // Wait a bit for logs to be written
      await new Promise(resolve => setTimeout(resolve, 500))

      // Kill the server and capture output
      serverProcess.kill()
      const [stdout, stderr] = await Promise.all([
        new Response(serverProcess.stdout).text(),
        new Response(serverProcess.stderr).text(),
      ])

      const output = stdout + stderr

      // Verify server started
      expect(output).toContain(`Test server starting on port ${port}`)

      // Should contain local time format
      const localTimeRegex = /\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3} [+-]\d{4}\]/
      expect(localTimeRegex.test(output)).toBe(true)

      // Should contain service name
      expect(output).toContain('"service":"opencode-pty-test"')

      // Should contain proper log levels
      expect(output).toContain('"level":30') // info level
    })

      // Wait for server to start
      await new Promise((resolve) => setTimeout(resolve, 3000))

      // Make a request to trigger logging
      await fetch(`http://localhost:${port}/api/sessions`, {
        method: 'GET',
      })

      // Wait a bit for logs to be written
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Kill the server and capture output
      serverProcess.kill()
      const [stdout, stderr] = await Promise.all([
        new Response(serverProcess.stdout).text(),
        new Response(serverProcess.stderr).text(),
      ])

      const output = stdout + stderr

      // Verify server started
      expect(output).toContain(`Test server starting on port ${port}`)

      // In production, should be JSON format (not pretty-printed)
      // Should contain ISO timestamps
      const isoTimeRegex = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/
      expect(isoTimeRegex.test(output)).toBe(true)

      // Should be valid JSON lines
      const lines = output
        .trim()
        .split('\n')
        .filter((line) => line.trim())
      lines.forEach((line) => {
        expect(() => JSON.parse(line)).not.toThrow()
      })
    })

    it('should respect LOG_LEVEL environment variable', async () => {
      const port = testPort++
      // Start server with debug level
      serverProcess = spawn(['bun', 'run', 'test-web-server.ts', `--port=${port}`], {
        env: {
          ...process.env,
          NODE_ENV: 'development',
          LOG_LEVEL: 'debug',
        },
        stdout: 'pipe',
        stderr: 'pipe',
      })

      // Wait for server to start
      await new Promise((resolve) => setTimeout(resolve, 3000))

      // Make a request to trigger debug logging
      await fetch(`http://localhost:${port}/api/sessions`, {
        method: 'GET',
      })

      // Wait a bit for logs to be written
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Kill the server and capture output
      serverProcess.kill()
      const [stdout, stderr] = await Promise.all([
        new Response(serverProcess.stdout).text(),
        new Response(serverProcess.stderr).text(),
      ])

      const output = stdout + stderr

      // Should contain debug level logs
      expect(output).toContain('"level":20') // debug level
      // Should contain debug logs from our code
      expect(output).toContain('fetch request')
    })

    it('should handle CI environment correctly', async () => {
      const port = testPort++
      // Start server with CI=true
      serverProcess = spawn(['bun', 'run', 'test-web-server.ts', `--port=${port}`], {
        env: {
          ...process.env,
          CI: 'true',
          NODE_ENV: 'development',
        },
        stdout: 'pipe',
        stderr: 'pipe',
      })

      // Wait for server to start
      await new Promise((resolve) => setTimeout(resolve, 3000))

      // Kill the server and capture output
      serverProcess.kill()
      const [stdout, stderr] = await Promise.all([
        new Response(serverProcess.stdout).text(),
        new Response(serverProcess.stderr).text(),
      ])

      const output = stdout + stderr

      // Should contain debug level (CI forces debug)
      expect(output).toContain('"level":20') // debug level
    })
  })

  describe('Web Logger Format', () => {
    // Web logger testing is limited in Node environment
    // We can only test that it doesn't throw errors
    it('should create web logger without errors', async () => {
      const { default: webLogger } = await import('../../src/web/logger.ts')

      expect(() => {
        webLogger.info('Test message')
        webLogger.debug('Debug message')
        webLogger.error('Error message')
      }).not.toThrow()
    })
  })
})
