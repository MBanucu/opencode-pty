import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { PTYServer } from '../src/web/server/server.ts'
import {
  initManager,
  manager,
  rawOutputCallbacks,
  sessionUpdateCallbacks,
} from '../src/plugin/pty/manager.ts'
import {
  CustomError,
  type WSMessageClientInput,
  type WSMessageClientSessionList,
  type WSMessageClientSpawnSession,
  type WSMessageClientSubscribeSession,
  type WSMessageClientUnsubscribeSession,
  type WSMessageServer,
  type WSMessageServerData,
  type WSMessageServerError,
  type WSMessageServerRawData,
  type WSMessageServerReadRawResponse,
  type WSMessageServerSessionList,
  type WSMessageServerSessionUpdate,
  type WSMessageServerSubscribedSession,
  type WSMessageServerUnsubscribedSession,
} from '../src/web/shared/types.ts'

class ManagedTestObjects implements Disposable {
  public readonly server: PTYServer
  public readonly ws: WebSocket
  private readonly stack = new DisposableStack()
  public readonly sessionId: string
  public readonly messages: WSMessageServer[] = []

  public static async create() {
    const server = await PTYServer.createServer()

    const managedTestObjects = new ManagedTestObjects(server)
    await managedTestObjects.waitWsOpen()

    return managedTestObjects
  }

  private readonly fakeClient = {
    app: {
      log: async (_opts: any) => {
        // Mock logger
      },
    },
  } as any

  public readonly subscribedCallbacks: Array<(message: WSMessageServerSubscribedSession) => void> =
    []
  public readonly unsubscribedCallbacks: Array<
    (message: WSMessageServerUnsubscribedSession) => void
  > = []
  public readonly sessionUpdateCallbacks: Array<(message: WSMessageServerSessionUpdate) => void> =
    []
  public readonly rawDataCallbacks: Array<(message: WSMessageServerRawData) => void> = []
  public readonly dataCallbacks: Array<(message: WSMessageServerData) => void> = []
  public readonly readRawResponseCallbacks: Array<
    (message: WSMessageServerReadRawResponse) => void
  > = []
  public readonly sessionListCallbacks: Array<(message: WSMessageServerSessionList) => void> = []
  public readonly errorCallbacks: Array<(message: WSMessageServerError) => void> = []

  private constructor(server: PTYServer) {
    initManager(this.fakeClient)
    this.server = server
    this.stack.use(this.server)
    this.ws = new WebSocket(server.getWsUrl())
    this.ws.onerror = (error) => {
      throw error
    }
    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data) as WSMessageServer
      this.messages.push(message)
      switch (message.type) {
        case 'subscribed':
          this.subscribedCallbacks.forEach((callback) =>
            callback(message as WSMessageServerSubscribedSession)
          )
          break
        case 'unsubscribed':
          this.unsubscribedCallbacks.forEach((callback) =>
            callback(message as WSMessageServerUnsubscribedSession)
          )
          break
        case 'session_update':
          this.sessionUpdateCallbacks.forEach((callback) =>
            callback(message as WSMessageServerSessionUpdate)
          )
          break
        case 'raw_data':
          this.rawDataCallbacks.forEach((callback) => callback(message as WSMessageServerRawData))
          break
        case 'data':
          this.dataCallbacks.forEach((callback) => callback(message as WSMessageServerData))
          break
        case 'readRawResponse':
          this.readRawResponseCallbacks.forEach((callback) =>
            callback(message as WSMessageServerReadRawResponse)
          )
          break
        case 'session_list':
          this.sessionListCallbacks.forEach((callback) =>
            callback(message as WSMessageServerSessionList)
          )
          break
        case 'error':
          this.errorCallbacks.forEach((callback) => callback(message as WSMessageServerError))
          break
      }
    }
    this.sessionId = crypto.randomUUID()
  }
  [Symbol.dispose]() {
    this.ws.close()
    this.stack.dispose()
    manager.clearAllSessions()
    sessionUpdateCallbacks.length = 0
    rawOutputCallbacks.length = 0
  }

  public send(
    message:
      | WSMessageClientInput
      | WSMessageClientSessionList
      | WSMessageClientSpawnSession
      | WSMessageClientSubscribeSession
      | WSMessageClientUnsubscribeSession
  ) {
    this.ws.send(JSON.stringify(message))
  }

  /**
   * Waits until the WebSocket connection is open.
   *
   * The onopen event is broken so we need to wait manually.
   * Problem: if onopen is set after the WebSocket is opened,
   * it will never be called. So we wait here until the readyState is OPEN.
   * This prevents flakiness.
   */
  public async waitWsOpen() {
    while (this.ws.readyState !== WebSocket.OPEN) {
      await new Promise(setImmediate)
    }
  }
}

describe('WebSocket Functionality', () => {
  let testSetup: ManagedTestObjects
  let stack: DisposableStack

  beforeEach(async () => {
    testSetup = await ManagedTestObjects.create()
    stack = new DisposableStack()
    stack.use(testSetup)
  })

  afterEach(() => {
    stack.dispose()
  })

  describe('WebSocket Connection', () => {
    it('should accept WebSocket connections', async () => {
      await testSetup.waitWsOpen()
      expect(testSetup.ws.readyState).toBe(WebSocket.OPEN)
    }, 100)

    it('should not send session list on connection', async () => {
      let called = false
      testSetup.sessionListCallbacks.push((message: WSMessageServerSessionList) => {
        expect(message).toBeUndefined()
        called = true
      })

      const title = crypto.randomUUID()
      const promise = new Promise<WSMessageServerSessionUpdate>((resolve) => {
        testSetup.sessionUpdateCallbacks.push((message) => {
          if (message.session.title === title) {
            if (message.session.status === 'exited') {
              resolve(message)
            }
          }
        })
      })

      testSetup.send({
        type: 'spawn',
        title: title,
        subscribe: true,
        command: 'echo',
        args: ['Hello World'],
        description: 'Test session',
        parentSessionId: testSetup.sessionId,
      })
      await promise
      expect(called, 'session list has been sent unexpectedly').toBe(false)
    }, 100)
  })

  describe('WebSocket Message Handling', () => {
    it('should handle subscribe message', async () => {
      const title = crypto.randomUUID()
      const sessionRunningPromise = new Promise<WSMessageServerSessionUpdate>((resolve) => {
        testSetup.sessionUpdateCallbacks.push((message) => {
          if (message.session.title === title) {
            if (message.session.status === 'running') {
              resolve(message)
            }
          }
        })
      })
      testSetup.send({
        type: 'spawn',
        title: title,
        subscribe: false,
        command: 'bash',
        args: [],
        description: 'Test session',
        parentSessionId: testSetup.sessionId,
      })
      const runningSession = await sessionRunningPromise

      const subscribedPromise = new Promise<boolean>((res) => {
        testSetup.subscribedCallbacks.push((message) => {
          if (message.sessionId === runningSession.session.id) {
            res(true)
          }
        })
      })

      testSetup.send({
        type: 'subscribe',
        sessionId: runningSession.session.id,
      })

      const subscribed = await subscribedPromise
      expect(subscribed).toBe(true)
    }, 100)

    it('should handle subscribe to non-existent session', async () => {
      const nonexistentSessionId = crypto.randomUUID()
      const errorPromise = new Promise<WSMessageServerError>((res) => {
        testSetup.errorCallbacks.push((message) => {
          if (message.error.message.includes(nonexistentSessionId)) {
            res(message)
          }
        })
      })

      testSetup.send({
        type: 'subscribe',
        sessionId: nonexistentSessionId,
      })

      await errorPromise
    }, 100)

    it('should handle unsubscribe message', async () => {
      const sessionId = crypto.randomUUID()

      const unsubscribedPromise = new Promise<WSMessageServerUnsubscribedSession>((res) => {
        testSetup.unsubscribedCallbacks.push((message) => {
          if (message.sessionId === sessionId) {
            res(message)
          }
        })
      })

      testSetup.send({
        type: 'unsubscribe',
        sessionId: sessionId,
      })

      await unsubscribedPromise
      expect(testSetup.ws.readyState).toBe(WebSocket.OPEN)
    }, 100)

    it('should handle session_list request', async () => {
      const sessionListPromise = new Promise<WSMessageServerSessionList>((res) => {
        testSetup.sessionListCallbacks.push((message) => {
          res(message)
        })
      })

      testSetup.send({
        type: 'session_list',
      })

      await sessionListPromise
    }, 100)

    it('should handle invalid message format', async () => {
      const errorPromise = new Promise<CustomError>((res) => {
        testSetup.errorCallbacks.push((message) => {
          res(message.error)
        })
      })

      testSetup.ws.send('invalid json')

      const customError = await errorPromise
      expect(customError.message).toContain('JSON Parse error')
    }, 100)

    it('should handle unknown message type', async () => {
      const errorPromise = new Promise<CustomError>((res) => {
        testSetup.errorCallbacks.push((message) => {
          res(message.error)
        })
      })
      testSetup.ws.send(
        JSON.stringify({
          type: 'unknown_type',
          data: 'test',
        })
      )

      const customError = await errorPromise
      expect(customError.message).toContain('Unknown message type')
    }, 100)

    it('should demonstrate WebSocket subscription logic works correctly', async () => {
      const testSession = manager.spawn({
        command: 'bash',
        args: [],
        description: 'Test session for subscription logic',
        parentSessionId: testSetup.sessionId,
      })

      // Subscribe to the session
      const subscribePromise = new Promise<WSMessageServerSubscribedSession>((res) => {
        testSetup.subscribedCallbacks.push((message) => {
          if (message.sessionId === testSession.id) {
            res(message)
          }
        })
      })

      testSetup.send({
        type: 'subscribe',
        sessionId: testSession.id,
      })
      await subscribePromise

      let rawData = ''
      testSetup.rawDataCallbacks.push((message) => {
        if (message.session.id === testSession.id) {
          rawData += message.rawData
        }
      })

      const sessionUpdatePromise = new Promise<WSMessageServerSessionUpdate>((res) => {
        testSetup.sessionUpdateCallbacks.push((message) => {
          if (message.session.id === testSession.id) {
            if (message.session.status === 'exited') {
              res(message)
            }
          }
        })
      })

      // Send input to the session
      testSetup.send({
        type: 'input',
        sessionId: testSession.id,
        data: "echo 'Hello from subscription test'\nexit\n",
      })

      // Wait for session to exit
      await sessionUpdatePromise

      // Check that we received the echoed output
      expect(rawData).toContain('Hello from subscription test')

      // Unsubscribe
      const unsubscribePromise = new Promise<WSMessageServerUnsubscribedSession>((res) => {
        testSetup.unsubscribedCallbacks.push((message) => {
          if (message.sessionId === testSession.id) {
            res(message)
          }
        })
      })
      testSetup.send({
        type: 'unsubscribe',
        sessionId: testSession.id,
      })
      await unsubscribePromise
    }, 200)

    it('should handle multiple subscription states correctly', async () => {
      // Test that demonstrates the subscription system tracks client state properly
      // This is important because the UI relies on proper subscription management
      const errors: CustomError[] = []
      testSetup.errorCallbacks.push((message) => {
        errors.push(message.error)
      })

      const session1 = manager.spawn({
        command: 'bash',
        args: [],
        description: 'Session 1',
        parentSessionId: crypto.randomUUID(),
      })

      const session2 = manager.spawn({
        command: 'bash',
        args: [],
        description: 'Session 2',
        parentSessionId: crypto.randomUUID(),
      })

      const subscribePromise1 = new Promise<WSMessageServerSubscribedSession>((res) => {
        testSetup.subscribedCallbacks.push((message) => {
          if (message.sessionId === session1.id) {
            res(message)
          }
        })
      })

      const subscribePromise2 = new Promise<WSMessageServerSubscribedSession>((res) => {
        testSetup.subscribedCallbacks.push((message) => {
          if (message.sessionId === session2.id) {
            res(message)
          }
        })
      })

      // Subscribe to session1
      testSetup.send({
        type: 'subscribe',
        sessionId: session1.id,
      })
      // Subscribe to session2
      testSetup.send({
        type: 'subscribe',
        sessionId: session2.id,
      })
      await Promise.all([subscribePromise1, subscribePromise2])

      const unsubscribePromise1 = new Promise<WSMessageServerUnsubscribedSession>((res) => {
        testSetup.unsubscribedCallbacks.push((message) => {
          if (message.sessionId === session1.id) {
            res(message)
          }
        })
      })

      // Unsubscribe from session1
      testSetup.send({
        type: 'unsubscribe',
        sessionId: session1.id,
      })
      await unsubscribePromise1

      // Check no errors occurred
      expect(errors.length).toBe(0)

      // This demonstrates that the WebSocket server correctly manages
      // multiple subscriptions per client, which is essential for the UI
      // to properly track counter state for different sessions.
      // Integration test failures were DOM-related, not subscription logic issues.
    }, 200)
  })
})
