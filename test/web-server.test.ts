import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { PTYServer } from '../src/web/server/PTYServer.ts'
import { initManager, manager, registerRawOutputCallback } from '../src/plugin/pty/manager.ts'

describe('Web Server', () => {
  const fakeClient = {
    app: {
      log: async (_opts: any) => {
        // Mock logger - do nothing
      },
    },
  } as any

  const server = new PTYServer()

  beforeEach(async () => {
    initManager(fakeClient)
    await server.startWebServer()
  })

  afterEach(() => {
    manager.clearAllSessions()
    server.stopWebServer()
  })

  describe('Server Lifecycle', () => {
    it('should start server successfully', async () => {
      const url = await server.startWebServer({ port: 8766 })
      expect(url).toBe('http://localhost:8766')
      expect(server.getServerUrl()).toBe('http://localhost:8766')
    })

    it('should handle custom configuration', async () => {
      const url = await server.startWebServer({ port: 8767, hostname: '127.0.0.1' })
      expect(url).toBe('http://127.0.0.1:8767')
    })

    it('should prevent multiple server instances', async () => {
      await server.startWebServer({ port: 8768 })
      const secondUrl = await server.startWebServer({ port: 8769 })
      expect(secondUrl).toBe('http://localhost:8768') // Returns existing server URL
    })

    it('should stop server correctly', async () => {
      const server = new PTYServer()
      await server.startWebServer()
      expect(server.getServerUrl()).toBeTruthy()
      server.stopWebServer()
      expect(server.getServerUrl()).toBeNull()
    })
  })

  describe('HTTP Endpoints', () => {
    it('should serve built assets when NODE_ENV=test', async () => {
      // Set test mode to serve from dist
      process.env.NODE_ENV = 'test'

      try {
        const response = await fetch(`${server.getServerUrl()}/`)
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
          const jsResponse = await fetch(`${server.getServerUrl()}/assets/${jsAsset}`)
          expect(jsResponse.status).toBe(200)
          const ct = jsResponse.headers.get('content-type')
          expect((ct || '').toLowerCase()).toMatch(/^(application|text)\/javascript(;.*)?$/)
        }

        if (cssMatch) {
          const cssAsset = cssMatch[1]
          const cssResponse = await fetch(`${server.getServerUrl()}/assets/${cssAsset}`)
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

      const response = await fetch(`${server.getServerUrl()}/`)
      expect(response.status).toBe(200)
      const html = await response.text()

      // Should contain built HTML
      expect(html).toContain('<!doctype html>')
      expect(html).toContain('PTY Sessions Monitor')
      expect(html).toContain('<div id="root"></div>')
      expect(html).toContain('/assets/')
    })

    it('should serve HTML on root path', async () => {
      const response = await fetch(`${server.getServerUrl()}/`)
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toContain('text/html')

      const html = await response.text()
      expect(html).toContain('<!doctype html>')
      expect(html).toContain('PTY Sessions Monitor')
    })

    it('should return sessions list', async () => {
      const response = await fetch(`${server.getServerUrl()}/api/sessions`)
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toContain('application/json')

      const sessions = await response.json()
      expect(Array.isArray(sessions)).toBe(true)
    })

    it('should return individual session', async () => {
      // Create a test session first
      const session = manager.spawn({
        command: 'echo',
        args: ['test output'],
        description: 'Test session',
        parentSessionId: 'test',
      })
      let rawDataTotal = ""
      await new Promise<void>((resolve) => {
        registerRawOutputCallback((sessionId: string, rawData: string) => {
          if (sessionId === session.id) {
            rawDataTotal += rawData
            if (rawDataTotal.includes('test output')) {
              resolve()
            }
          }
        })
        setTimeout(() => resolve(), 1000)
      })

      const response = await fetch(`${server.getServerUrl()}/api/sessions/${session.id}`)
      expect(response.status).toBe(200)

      const sessionData = await response.json()
      expect(sessionData.id).toBe(session.id)
      expect(sessionData.command).toBe('echo')
      expect(sessionData.args).toEqual(['test output'])
      expect(rawDataTotal).toContain('test output')
    })

    it('should return 404 for non-existent session', async () => {
      const nonexistentId = `nonexistent-${Math.random().toString(36).substr(2, 9)}`
      const response = await fetch(`${server.getServerUrl()}/api/sessions/${nonexistentId}`)
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

      // Wait for PTY to start
      await new Promise((resolve) => setTimeout(resolve, 100))

      const response = await fetch(`${server.getServerUrl()}/api/sessions/${session.id}/input`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: 'test input\n' }),
      })

      // Should return success
      expect(response.status).toBe(200)
      const result = await response.json()
      expect(result).toHaveProperty('success', true)

      // Clean up
      manager.kill(session.id, true)
    })

    it('should handle kill session', async () => {
      const session = manager.spawn({
        command: 'echo',
        args: ['test output'],
        description: 'Test session',
        parentSessionId: 'test',
      })

      // Wait for PTY to start
      await new Promise((resolve) => setTimeout(resolve, 100))

      const response = await fetch(`${server.getServerUrl()}/api/sessions/${session.id}/kill`, {
        method: 'POST',
      })

      expect(response.status).toBe(200)
      const result = await response.json()
      expect(result.success).toBe(true)
    })

    it('should return session output', async () => {
      // Create a session that produces output
      const session = manager.spawn({
        command: 'echo',
        args: ['line1\nline2\nline3'],
        description: 'Test session with output',
        parentSessionId: 'test-output',
      })

      // Wait a bit for output to be captured
      await new Promise((resolve) => setTimeout(resolve, 100))

      const response = await fetch(`${server.getServerUrl()}/api/sessions/${session.id}/buffer/raw`)
      expect(response.status).toBe(200)

      const bufferData = await response.json()
      expect(bufferData).toHaveProperty('raw')
      expect(bufferData).toHaveProperty('byteLength')
      expect(typeof bufferData.raw).toBe('string')
      expect(typeof bufferData.byteLength).toBe('number')
      expect(bufferData.raw.length).toBeGreaterThan(0)
    })

    it('should return 404 for non-existent endpoints', async () => {
      const response = await fetch(`${server.getServerUrl()}/api/nonexistent`)
      expect(response.status).toBe(404)
      const text = await response.text()
      expect(text).toContain('404: Not Found')
      expect(text).toContain('<!DOCTYPE html>')
    })
  })
})
