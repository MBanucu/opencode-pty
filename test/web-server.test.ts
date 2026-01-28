import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { startWebServer, stopWebServer, getServerUrl } from '../src/web/server/server.ts'
import { PTYManager } from '../src/plugin/pty/manager.ts'
import { manager } from '../src/plugin/pty/manager.ts'

describe.serial('Web Server', () => {
  const fakeClient = {
    app: {
      log: async (_opts: any) => {
        // Mock logger - do nothing
      },
    },
  } as any

  beforeEach(() => {
    testManager = new PTYManager()
    testManager.init(fakeClient)
  })

  afterEach(() => {
    stopWebServer()
    manager.clearAllSessions() // Ensure cleanup after each test
  })

  describe('Server Lifecycle', () => {
    it('should start server successfully', async () => {
      const url = await startWebServer({ port: 8766 })
      expect(url).toBe('http://localhost:8766')
      expect(getServerUrl()).toBe('http://localhost:8766')
    })

    it('should handle custom configuration', async () => {
      const url = await startWebServer({ port: 8767, hostname: '127.0.0.1' })
      expect(url).toBe('http://127.0.0.1:8767')
    })

    it('should prevent multiple server instances', async () => {
      await startWebServer({ port: 8768 })
      const secondUrl = await startWebServer({ port: 8769 })
      expect(secondUrl).toBe('http://localhost:8768') // Returns existing server URL
    })

    it('should stop server correctly', async () => {
      await startWebServer({ port: 8770 })
      expect(getServerUrl()).toBeTruthy()
      stopWebServer()
      expect(getServerUrl()).toBeNull()
    })
  })

  describe.serial('HTTP Endpoints', () => {
    let serverUrl: string

    beforeEach(async () => {
      manager.clearAllSessions() // Clean up any leftover sessions
      serverUrl = await startWebServer({ port: 8771 })
    })

    it('should serve built assets when NODE_ENV=test', async () => {
      // Set test mode to serve from dist
      process.env.NODE_ENV = 'test'

      try {
        const response = await fetch(`${serverUrl}/`)
        expect(response.status).toBe(200)
        const html = await response.text()

        // Should contain built HTML with assets
        expect(html).toContain('<!doctype html>')
        expect(html).toContain('PTY Sessions Monitor')
        expect(html).toContain('/assets/')
        expect(html).not.toContain('/main.tsx')

        // Extract asset URLs from HTML
        const jsMatch = html.match(/src="\/assets\/([^"]+\.js)"/)
        const cssMatch = html.match(/href="\/assets\/([^"]+\.css)"/)

        if (jsMatch) {
          const jsAsset = jsMatch[1]
          const jsResponse = await fetch(`${serverUrl}/assets/${jsAsset}`)
          expect(jsResponse.status).toBe(200)
          const ct = jsResponse.headers.get('content-type')
          expect((ct || '').toLowerCase()).toMatch(/^(application|text)\/javascript(;.*)?$/)
        }

        if (cssMatch) {
          const cssAsset = cssMatch[1]
          const cssResponse = await fetch(`${serverUrl}/assets/${cssAsset}`)
          expect(cssResponse.status).toBe(200)
          expect((cssResponse.headers.get('content-type') || '').toLowerCase()).toMatch(
            /^text\/css(;.*)?$/
          )
        }
      } finally {
        delete process.env.NODE_ENV
      }
    })

    it('should serve dev HTML when NODE_ENV is not set', async () => {
      // Ensure NODE_ENV is not set
      delete process.env.NODE_ENV

      const response = await fetch(`${serverUrl}/`)
      expect(response.status).toBe(200)
      const html = await response.text()

      // Should contain built HTML
      expect(html).toContain('<!doctype html>')
      expect(html).toContain('PTY Sessions Monitor')
      expect(html).toContain('<div id="root"></div>')
      expect(html).toContain('/assets/')
    })

    it('should serve HTML on root path', async () => {
      const response = await fetch(`${serverUrl}/`)
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toContain('text/html')

      const html = await response.text()
      expect(html).toContain('<!doctype html>')
      expect(html).toContain('PTY Sessions Monitor')
    })

    it('should return sessions list', async () => {
      const response = await fetch(`${serverUrl}/api/sessions`)
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toContain('application/json')

      const sessions = await response.json()
      expect(Array.isArray(sessions)).toBe(true)
    })

    it('should return individual session', async () => {
      // Create a test session first
      const session = manager.spawn({
        command: 'sleep',
        args: ['1'],
        description: 'Test session',
        parentSessionId: 'test',
      })

      console.log('Created session:', session)
      const fullSession = manager.get(session.id)
      console.log('Session from manager.get:', fullSession)

      // Wait for PTY to start
      await new Promise((resolve) => setTimeout(resolve, 100))

      const response = await fetch(`${serverUrl}/api/sessions/${session.id}`)
      console.log('Session response status:', response.status)
      expect(response.status).toBe(200)

      const sessionData = await response.json()
      console.log('Session data:', sessionData)
      expect(sessionData.id).toBe(session.id)
      expect(sessionData.command).toBe('sleep')
      expect(sessionData.args).toEqual(['1'])
    })

      console.log('Created session:', session)
      const fullSession = testManager.get(session.id)
      console.log('Session from manager.get:', fullSession)

      // Wait for PTY to start
      await new Promise((resolve) => setTimeout(resolve, 100))

      const response = await fetch(`${serverUrl}/api/sessions/${session.id}`)
      console.log('Session response status:', response.status)
      expect(response.status).toBe(200)

      const sessionData = await response.json()
      console.log('Session data:', sessionData)
      expect(sessionData.id).toBe(session.id)
      expect(sessionData.command).toBe('sleep')
      expect(sessionData.args).toEqual(['1'])
    })

    it('should return 404 for non-existent session', async () => {
      const nonexistentId = `nonexistent-${Math.random().toString(36).substr(2, 9)}`
      console.log('Testing non-existent session ID:', nonexistentId)
      const response = await fetch(`${serverUrl}/api/sessions/${nonexistentId}`)
      console.log('Non-existent response status:', response.status)
      expect(response.status).toBe(404)
    })

    it('should handle input to session', async () => {
      // Create a session to test input
      const session = manager.spawn({
        command: 'cat',
        args: [],
        description: 'Test session',
        parentSessionId: 'test',
      })

      console.log('Input session:', session)

      // Wait for PTY to start
      await new Promise((resolve) => setTimeout(resolve, 100))

      const response = await fetch(`${serverUrl}/api/sessions/${session.id}/input`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: 'test input\n' }),
      })

      console.log('Input response status:', response.status)

      // Should return success
      expect(response.status).toBe(200)
      const result = await response.json()
      expect(result).toHaveProperty('success', true)

      // Clean up
      manager.kill(session.id, true)
    })

    it('should handle kill session', async () => {
      const session = manager.spawn({
        command: 'sleep',
        args: ['1'],
        description: 'Test session',
        parentSessionId: 'test',
      })

      console.log('Kill session:', session)

      // Wait for PTY to start
      await new Promise((resolve) => setTimeout(resolve, 100))

      const response = await fetch(`${serverUrl}/api/sessions/${session.id}/kill`, {
        method: 'POST',
      })

      console.log('Kill response status:', response.status)

      expect(response.status).toBe(200)
      const result = await response.json()
      expect(result.success).toBe(true)
    })

    it('should return session output', async () => {
      // Create a session that produces output
      const session = testManager.spawn({
        command: 'sh',
        args: ['-c', 'echo "line1"; echo "line2"; echo "line3"'],
        description: 'Test session with output',
        parentSessionId: 'test-output',
      })

      console.log('Output session:', session)

      // Wait a bit for output to be captured
      await new Promise((resolve) => setTimeout(resolve, 100))

      const response = await fetch(`${serverUrl}/api/sessions/${session.id}/buffer/raw`)
      console.log('Buffer response status:', response.status)
      expect(response.status).toBe(200)

      const bufferData = await response.json()
      expect(bufferData).toHaveProperty('raw')
      expect(bufferData).toHaveProperty('byteLength')
      expect(typeof bufferData.raw).toBe('string')
      expect(typeof bufferData.byteLength).toBe('number')
      expect(bufferData.raw.length).toBeGreaterThan(0)
    })

    it('should return 404 for non-existent endpoints', async () => {
      const response = await fetch(`${serverUrl}/api/nonexistent`)
      expect(response.status).toBe(404)
      const text = await response.text()
      expect(text).toContain('404: Not Found')
      expect(text).toContain('<!DOCTYPE html>')
    })
  })
})
