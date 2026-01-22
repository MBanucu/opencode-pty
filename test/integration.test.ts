import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { startWebServer, stopWebServer } from '../src/web/server.ts'
import { initManager, manager } from '../src/plugin/pty/manager.ts'
import { initLogger } from '../src/plugin/logger.ts'

describe('Web Server Integration', () => {
  const fakeClient = {
    app: {
      log: async (opts: any) => {
        // Mock logger
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

  describe('Full User Workflow', () => {
    it('should handle multiple concurrent sessions and clients', async () => {
      manager.cleanupAll() // Clean up any leftover sessions
      startWebServer({ port: 8781 })

      // Create multiple sessions
      const session1 = manager.spawn({
        command: 'echo',
        args: ['Session 1'],
        description: 'Multi-session test 1',
        parentSessionId: 'multi-test',
      })

      const session2 = manager.spawn({
        command: 'echo',
        args: ['Session 2'],
        description: 'Multi-session test 2',
        parentSessionId: 'multi-test',
      })

      // Create multiple WebSocket clients
      const ws1 = new WebSocket('ws://localhost:8781')
      const ws2 = new WebSocket('ws://localhost:8781')
      const messages1: any[] = []
      const messages2: any[] = []

      ws1.onmessage = (event) => messages1.push(JSON.parse(event.data))
      ws2.onmessage = (event) => messages2.push(JSON.parse(event.data))

      await Promise.all([
        new Promise((resolve) => {
          ws1.onopen = resolve
        }),
        new Promise((resolve) => {
          ws2.onopen = resolve
        }),
      ])

      // Subscribe clients to different sessions
      ws1.send(JSON.stringify({ type: 'subscribe', sessionId: session1.id }))
      ws2.send(JSON.stringify({ type: 'subscribe', sessionId: session2.id }))

      // Wait for sessions to complete
      await new Promise((resolve) => setTimeout(resolve, 300))

      // Check that API returns both sessions
      const response = await fetch('http://localhost:8781/api/sessions')
      const sessions = await response.json()
      expect(sessions.length).toBe(2)

      const sessionIds = sessions.map((s: any) => s.id)
      expect(sessionIds).toContain(session1.id)
      expect(sessionIds).toContain(session2.id)

      // Cleanup
      ws1.close()
      ws2.close()
    })

    it('should handle error conditions gracefully', async () => {
      manager.cleanupAll() // Clean up any leftover sessions
      startWebServer({ port: 8782 })

      // Test non-existent session
      let response = await fetch('http://localhost:8782/api/sessions/nonexistent')
      expect(response.status).toBe(404)

      // Test invalid input to existing session
      const session = manager.spawn({
        command: 'echo',
        args: ['test'],
        description: 'Error test session',
        parentSessionId: 'error-test',
      })

      response = await fetch(`http://localhost:8782/api/sessions/${session.id}/input`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: 'test input\n' }),
      })

      // Should handle gracefully even for exited sessions
      const result = await response.json()
      expect(result).toHaveProperty('success')

      // Test WebSocket error handling
      const ws = new WebSocket('ws://localhost:8782')
      const wsMessages: any[] = []

      ws.onmessage = (event) => wsMessages.push(JSON.parse(event.data))

      await new Promise((resolve) => {
        ws.onopen = () => {
          // Send invalid message
          ws.send('invalid json')
          setTimeout(resolve, 100)
        }
      })

      const errorMessages = wsMessages.filter((msg) => msg.type === 'error')
      expect(errorMessages.length).toBeGreaterThan(0)

      ws.close()
    })
  })

  describe('Performance and Reliability', () => {
    it('should handle rapid API requests', async () => {
      startWebServer({ port: 8783 })

      // Create a session
      const session = manager.spawn({
        command: 'echo',
        args: ['performance test'],
        description: 'Performance test',
        parentSessionId: 'perf-test',
      })

      // Make multiple concurrent requests
      const promises = []
      for (let i = 0; i < 10; i++) {
        promises.push(fetch(`http://localhost:8783/api/sessions/${session.id}`))
      }

      const responses = await Promise.all(promises)
      responses.forEach((response) => {
        expect(response.status).toBe(200)
      })
    })

    it('should cleanup properly on server stop', async () => {
      startWebServer({ port: 8784 })

      // Create session and WebSocket
      const session = manager.spawn({
        command: 'echo',
        args: ['cleanup test'],
        description: 'Cleanup test',
        parentSessionId: 'cleanup-test',
      })

      const ws = new WebSocket('ws://localhost:8784')
      await new Promise((resolve) => {
        ws.onopen = resolve
      })

      // Stop server
      stopWebServer()

      // Verify server is stopped (should fail to connect)
      const response = await fetch('http://localhost:8784/api/sessions').catch(() => null)
      expect(response).toBeNull()

      // Note: WebSocket may remain OPEN on client side until connection actually fails
      // This is expected behavior - the test focuses on server cleanup
    })
  })
})
