import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test'
import { startWebServer, stopWebServer, getServerUrl } from '../src/web/server.ts'
import { initManager, manager } from '../src/plugin/pty/manager.ts'
import { initLogger } from '../src/plugin/logger.ts'

describe('Web Server', () => {
  const fakeClient = {
    app: {
      log: async (opts: any) => {
        // Mock logger - do nothing
      },
    },
  } as any

  beforeEach(() => {
    initLogger(fakeClient)
    initManager(fakeClient)
  })

  afterEach(() => {
    stopWebServer()
  })

  describe('Server Lifecycle', () => {
    it('should start server successfully', () => {
      const url = startWebServer({ port: 8766 })
      expect(url).toBe('http://localhost:8766')
      expect(getServerUrl()).toBe('http://localhost:8766')
    })

    it('should handle custom configuration', () => {
      const url = startWebServer({ port: 8767, hostname: '127.0.0.1' })
      expect(url).toBe('http://127.0.0.1:8767')
    })

    it('should prevent multiple server instances', () => {
      startWebServer({ port: 8768 })
      const secondUrl = startWebServer({ port: 8769 })
      expect(secondUrl).toBe('http://localhost:8768') // Returns existing server URL
    })

    it('should stop server correctly', () => {
      startWebServer({ port: 8770 })
      expect(getServerUrl()).toBeTruthy()
      stopWebServer()
      expect(getServerUrl()).toBeNull()
    })
  })

  describe('HTTP Endpoints', () => {
    let serverUrl: string

    beforeEach(() => {
      manager.cleanupAll() // Clean up any leftover sessions
      serverUrl = startWebServer({ port: 8771 })
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
        command: 'echo',
        args: ['test'],
        description: 'Test session',
        parentSessionId: 'test',
      })

      const response = await fetch(`${serverUrl}/api/sessions/${session.id}`)
      expect(response.status).toBe(200)

      const sessionData = await response.json()
      expect(sessionData.id).toBe(session.id)
      expect(sessionData.command).toBe('echo')
    })

    it('should return 404 for non-existent session', async () => {
      const response = await fetch(`${serverUrl}/api/sessions/nonexistent`)
      expect(response.status).toBe(404)
    })

    it('should handle input to session', async () => {
      // Create a running session (can't easily test with echo since it exits immediately)
      // This tests the API structure even if the session isn't running
      const session = manager.spawn({
        command: 'echo',
        args: ['test'],
        description: 'Test session',
        parentSessionId: 'test',
      })

      const response = await fetch(`${serverUrl}/api/sessions/${session.id}/input`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: 'test input\n' }),
      })

      // Should return success even if session is exited
      const result = await response.json()
      expect(result).toHaveProperty('success')
    })

    it('should handle kill session', async () => {
      const session = manager.spawn({
        command: 'echo',
        args: ['test'],
        description: 'Test session',
        parentSessionId: 'test',
      })

      const response = await fetch(`${serverUrl}/api/sessions/${session.id}/kill`, {
        method: 'POST',
      })

      expect(response.status).toBe(200)
      const result = await response.json()
      expect(result.success).toBe(true)
    })

    it('should return 404 for non-existent endpoints', async () => {
      const response = await fetch(`${serverUrl}/api/nonexistent`)
      expect(response.status).toBe(404)
      expect(await response.text()).toBe('Not found')
    })
  })
})
