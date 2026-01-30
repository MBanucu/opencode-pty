import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { manager } from '../src/plugin/pty/manager.ts'
import { ManagedTestClient, ManagedTestServer } from './utils.ts'
import { PTYServer } from '../src/web/server/server.ts'
import type { WSMessageServerSessionUpdate } from '../src/web/shared/types.ts'
import type { PTYSessionInfo } from '../src/plugin/pty/types.ts'

describe('Web Server Integration', () => {
  let managedTestServer: ManagedTestServer
  let disposableStack: DisposableStack
  beforeAll(async () => {
    disposableStack = new DisposableStack()
    managedTestServer = await ManagedTestServer.create()
    disposableStack.use(managedTestServer)
  })

  afterAll(() => {
    disposableStack.dispose()
  })

  describe('Full User Workflow', () => {
    it('should handle multiple concurrent sessions and clients', async () => {
      console.log('[TEST] Starting multiple concurrent sessions test')
      await using managedTestClient1 = await ManagedTestClient.create(managedTestServer)
      console.log('[TEST] Client 1 connected')
      await using managedTestClient2 = await ManagedTestClient.create(managedTestServer)
      console.log('[TEST] Client 2 connected')

      const title1 = crypto.randomUUID()
      const title2 = crypto.randomUUID()
      console.log('[TEST] Generated session IDs:', { title1, title2 })

      const session1ExitedPromise = new Promise<WSMessageServerSessionUpdate>((resolve) => {
        managedTestClient1.sessionUpdateCallbacks.push((message) => {
          console.log(
            '[TEST] Client 1 session update:',
            message.session.title,
            message.session.status
          )
          if (message.session.title === title1 && message.session.status === 'exited') {
            console.log('[TEST] Session 1 exited detected')
            resolve(message)
          }
        })
      })

      const session2ExitedPromise = new Promise<WSMessageServerSessionUpdate>((resolve) => {
        managedTestClient2.sessionUpdateCallbacks.push((message) => {
          console.log(
            '[TEST] Client 2 session update:',
            message.session.title,
            message.session.status
          )
          if (message.session.title === title2 && message.session.status === 'exited') {
            console.log('[TEST] Session 2 exited detected')
            resolve(message)
          }
        })
      })

      managedTestClient1.send({
        type: 'spawn',
        title: title1,
        command: 'echo',
        args: ['Session 1'],
        description: 'Multi-session test 1',
        parentSessionId: managedTestServer.sessionId,
        subscribe: true,
      })
      console.log('[TEST] Sent spawn request for session 1')

      managedTestClient2.send({
        type: 'spawn',
        title: title2,
        command: 'echo',
        args: ['Session 2'],
        description: 'Multi-session test 2',
        parentSessionId: managedTestServer.sessionId,
        subscribe: true,
      })
      console.log('[TEST] Sent spawn request for session 2')

      console.log('[TEST] Waiting for both sessions to exit...')
      const [session1Exited, session2Exited] = await Promise.all([
        session1ExitedPromise,
        session2ExitedPromise,
      ])
      console.log('[TEST] Both sessions exited:', {
        session1: session1Exited.session.id,
        session2: session2Exited.session.id,
      })

      const response = await fetch(`${managedTestServer.server.server.url}/api/sessions`)
      console.log('[TEST] Fetched sessions, response status:', response.status)
      const sessions = (await response.json()) as PTYSessionInfo[]
      console.log('[TEST] Sessions count:', sessions.length)
      console.log(
        '[TEST] Session IDs:',
        sessions.map((s) => s.id)
      )
      expect(sessions.length).toBeGreaterThanOrEqual(2)

      const sessionIds = sessions.map((s) => s.id)
      expect(sessionIds).toContain(session1Exited.session.id)
      expect(sessionIds).toContain(session2Exited.session.id)
      console.log('[TEST] Session IDs found in list')
    })

    it('should handle error conditions gracefully', async () => {
      console.log('[TEST] Starting error conditions test')
      await using managedTestClient = await ManagedTestClient.create(managedTestServer)
      console.log('[TEST] Client connected')

      const testSessionId = crypto.randomUUID()
      console.log('[TEST] Generated session ID:', testSessionId)

      const sessionExitedPromise = new Promise<WSMessageServerSessionUpdate>((resolve) => {
        managedTestClient.sessionUpdateCallbacks.push((message) => {
          console.log('[TEST] Session update:', message.session.title, message.session.status)
          if (message.session.title === testSessionId && message.session.status === 'exited') {
            console.log('[TEST] Session exited detected')
            resolve(message)
          }
        })
      })

      const session = manager.spawn({
        title: testSessionId,
        command: 'echo',
        args: ['test'],
        description: 'Error test session',
        parentSessionId: managedTestServer.sessionId,
      })
      console.log('[TEST] Spawned session:', session.id)

      console.log('[TEST] Waiting for session to exit...')
      await sessionExitedPromise

      const response = await fetch(
        `${managedTestServer.server.server.url}/api/sessions/${session.id}/input`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: 'test input\n' }),
        }
      )
      console.log('[TEST] Sent input to session, response:', response)

      const result = await response.json()
      console.log('[TEST] Input API response:', result)
      expect(result).toHaveProperty('success')

      const errorPromise = new Promise((resolve) => {
        managedTestClient.errorCallbacks.push((message) => {
          console.log('[TEST] Received error message:', message)
          resolve(message)
        })
      })

      console.log('[TEST] Sending invalid JSON message')
      managedTestClient.ws.send('invalid json')

      console.log('[TEST] Waiting for error response...')
      await errorPromise
      console.log('[TEST] Error conditions test completed')
    })
  })

  describe('Performance and Reliability', () => {
    it('should handle rapid API requests', async () => {
      const title = crypto.randomUUID()

      const session = manager.spawn({
        title,
        command: 'echo',
        args: ['performance test'],
        description: 'Performance test',
        parentSessionId: managedTestServer.sessionId,
      })

      const promises: Promise<Response>[] = []
      for (let i = 0; i < 10; i++) {
        promises.push(fetch(`${managedTestServer.server.server.url}/api/sessions/${session.id}`))
      }

      const responses = await Promise.all(promises)
      responses.forEach((response) => {
        expect(response.status).toBe(200)
      })
    })

    it('should cleanup properly on server stop', async () => {
      const ptyServer = await PTYServer.createServer()

      const sessionId = crypto.randomUUID()
      manager.spawn({
        title: sessionId,
        command: 'echo',
        args: ['cleanup test'],
        description: 'Cleanup test',
        parentSessionId: sessionId,
      })

      const ws = new WebSocket(ptyServer.getWsUrl()!)
      await new Promise((resolve) => {
        ws.onopen = resolve
      })

      ws.close()

      ptyServer[Symbol.dispose]()

      const response = await fetch(`${ptyServer.server.url}/api/sessions`).catch(() => null)
      expect(response).toBeNull()
    })
  })
})
