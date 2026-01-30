import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
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

class ManagedTestClient implements Disposable {
  public readonly ws: WebSocket
  private readonly stack = new DisposableStack()

  public readonly messages: WSMessageServer[] = []
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


  private constructor() {
    this.ws = new WebSocket(managedTestServer.server.getWsUrl()!)
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
  }
  [Symbol.dispose]() {
    this.ws.close()
    this.stack.dispose()
  }
  /**
   * Waits until the WebSocket connection is open.
   *
   * The onopen event is broken so we need to wait manually.
   * Problem: if onopen is set after the WebSocket is opened,
   * it will never be called. So we wait here until the readyState is OPEN.
   * This prevents flakiness.
   */
  public async waitOpen() {
    while (this.ws.readyState !== WebSocket.OPEN) {
      await new Promise(setImmediate)
    }
  }
  public static async create() {
    const client = new ManagedTestClient()
    await client.waitOpen()
    return client
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
}

class ManagedTestServer implements Disposable {
  public readonly server: PTYServer
  private readonly stack = new DisposableStack()
  public readonly sessionId: string

  public static async create() {
    const server = await PTYServer.createServer()

    return new ManagedTestServer(server)
  }

  private readonly fakeClient = {
    app: {
      log: async (_opts: any) => {
        // Mock logger
      },
    },
  } as any


  private constructor(server: PTYServer) {
    initManager(this.fakeClient)
    this.server = server
    this.stack.use(this.server)
    this.sessionId = crypto.randomUUID()
  }
  [Symbol.dispose]() {
    this.stack.dispose()
    manager.clearAllSessions()
    sessionUpdateCallbacks.length = 0
    rawOutputCallbacks.length = 0
  }
}

let managedTestServer: ManagedTestServer
let stack: DisposableStack

describe('WebSocket Functionality', () => {

  beforeAll(async () => {
    managedTestServer = await ManagedTestServer.create()
    stack = new DisposableStack()
    stack.use(managedTestServer)
  })

  afterAll(() => {
    stack.dispose()
    manager.clearAllSessions()
    rawOutputCallbacks.length = 0
    sessionUpdateCallbacks.length = 0
  })

  describe('WebSocket Connection', () => {
    it('should accept WebSocket connections', async () => {
      await using managedTestClient = await ManagedTestClient.create()
      await managedTestClient.waitOpen()
      expect(managedTestClient.ws.readyState).toBe(WebSocket.OPEN)
    }, 100)

    it('should not send session list on connection', async () => {
      await using managedTestClient = await ManagedTestClient.create()
      let called = false
      managedTestClient.sessionListCallbacks.push((message: WSMessageServerSessionList) => {
        expect(message).toBeUndefined()
        called = true
      })

      const title = crypto.randomUUID()
      const promise = new Promise<WSMessageServerSessionUpdate>((resolve) => {
        managedTestClient.sessionUpdateCallbacks.push((message) => {
          if (message.session.title === title) {
            if (message.session.status === 'exited') {
              resolve(message)
            }
          }
        })
      })

      managedTestClient.send({
        type: 'spawn',
        title: title,
        subscribe: true,
        command: 'echo',
        args: ['Hello World'],
        description: 'Test session',
        parentSessionId: managedTestServer.sessionId,
      })
      await promise
      expect(called, 'session list has been sent unexpectedly').toBe(false)
    }, 100)
  })

  describe('WebSocket Message Handling', () => {
    it('should handle subscribe message', async () => {
      await using managedTestClient = await ManagedTestClient.create()
      const title = crypto.randomUUID()
      const sessionRunningPromise = new Promise<WSMessageServerSessionUpdate>((resolve) => {
        managedTestClient.sessionUpdateCallbacks.push((message) => {
          if (message.session.title === title) {
            if (message.session.status === 'running') {
              resolve(message)
            }
          }
        })
      })
      managedTestClient.send({
        type: 'spawn',
        title: title,
        subscribe: false,
        command: 'bash',
        args: [],
        description: 'Test session',
        parentSessionId: managedTestServer.sessionId,
      })
      const runningSession = await sessionRunningPromise

      const subscribedPromise = new Promise<boolean>((res) => {
        managedTestClient.subscribedCallbacks.push((message) => {
          if (message.sessionId === runningSession.session.id) {
            res(true)
          }
        })
      })

      managedTestClient.send({
        type: 'subscribe',
        sessionId: runningSession.session.id,
      })

      const subscribed = await subscribedPromise
      expect(subscribed).toBe(true)
    }, 1000)

    it('should handle subscribe to non-existent session', async () => {
      await using managedTestClient = await ManagedTestClient.create()
      const nonexistentSessionId = crypto.randomUUID()
      const errorPromise = new Promise<WSMessageServerError>((res) => {
        managedTestClient.errorCallbacks.push((message) => {
          if (message.error.message.includes(nonexistentSessionId)) {
            res(message)
          }
        })
      })

      managedTestClient.send({
        type: 'subscribe',
        sessionId: nonexistentSessionId,
      })

      await errorPromise
    }, 100)

    it('should handle unsubscribe message', async () => {
      await using managedTestClient = await ManagedTestClient.create()
      const sessionId = crypto.randomUUID()

      const unsubscribedPromise = new Promise<WSMessageServerUnsubscribedSession>((res) => {
        managedTestClient.unsubscribedCallbacks.push((message) => {
          if (message.sessionId === sessionId) {
            res(message)
          }
        })
      })

      managedTestClient.send({
        type: 'unsubscribe',
        sessionId: sessionId,
      })

      await unsubscribedPromise
      expect(managedTestClient.ws.readyState).toBe(WebSocket.OPEN)
    }, 100)

    it('should handle session_list request', async () => {
      await using managedTestClient = await ManagedTestClient.create()
      const sessionListPromise = new Promise<WSMessageServerSessionList>((res) => {
        managedTestClient.sessionListCallbacks.push((message) => {
          res(message)
        })
      })

      managedTestClient.send({
        type: 'session_list',
      })

      await sessionListPromise
    }, 100)

    it('should handle invalid message format', async () => {
      await using managedTestClient = await ManagedTestClient.create()
      const errorPromise = new Promise<CustomError>((res) => {
        managedTestClient.errorCallbacks.push((message) => {
          res(message.error)
        })
      })

      managedTestClient.ws.send('invalid json')

      const customError = await errorPromise
      expect(customError.message).toContain('JSON Parse error')
    }, 100)

    it('should handle unknown message type', async () => {
      await using managedTestClient = await ManagedTestClient.create()
      const errorPromise = new Promise<CustomError>((res) => {
        managedTestClient.errorCallbacks.push((message) => {
          res(message.error)
        })
      })
      managedTestClient.ws.send(
        JSON.stringify({
          type: 'unknown_type',
          data: 'test',
        })
      )

      const customError = await errorPromise
      expect(customError.message).toContain('Unknown message type')
    }, 100)

    it('should demonstrate WebSocket subscription logic works correctly', async () => {
      await using managedTestClient = await ManagedTestClient.create()
      const testSession = manager.spawn({
        command: 'bash',
        args: [],
        description: 'Test session for subscription logic',
        parentSessionId: managedTestServer.sessionId,
      })

      // Subscribe to the session
      const subscribePromise = new Promise<WSMessageServerSubscribedSession>((res) => {
        managedTestClient.subscribedCallbacks.push((message) => {
          if (message.sessionId === testSession.id) {
            res(message)
          }
        })
      })

      managedTestClient.send({
        type: 'subscribe',
        sessionId: testSession.id,
      })
      await subscribePromise

      let rawData = ''
      managedTestClient.rawDataCallbacks.push((message) => {
        if (message.session.id === testSession.id) {
          rawData += message.rawData
        }
      })

      const sessionUpdatePromise = new Promise<WSMessageServerSessionUpdate>((res) => {
        managedTestClient.sessionUpdateCallbacks.push((message) => {
          if (message.session.id === testSession.id) {
            if (message.session.status === 'exited') {
              res(message)
            }
          }
        })
      })

      // Send input to the session
      managedTestClient.send({
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
        managedTestClient.unsubscribedCallbacks.push((message) => {
          if (message.sessionId === testSession.id) {
            res(message)
          }
        })
      })
      managedTestClient.send({
        type: 'unsubscribe',
        sessionId: testSession.id,
      })
      await unsubscribePromise
    }, 500)

    it('should handle multiple subscription states correctly', async () => {
      await using managedTestClient = await ManagedTestClient.create()
      // Test that demonstrates the subscription system tracks client state properly
      // This is important because the UI relies on proper subscription management
      const errors: CustomError[] = []
      managedTestClient.errorCallbacks.push((message) => {
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
        managedTestClient.subscribedCallbacks.push((message) => {
          if (message.sessionId === session1.id) {
            res(message)
          }
        })
      })

      const subscribePromise2 = new Promise<WSMessageServerSubscribedSession>((res) => {
        managedTestClient.subscribedCallbacks.push((message) => {
          if (message.sessionId === session2.id) {
            res(message)
          }
        })
      })

      // Subscribe to session1
      managedTestClient.send({
        type: 'subscribe',
        sessionId: session1.id,
      })
      // Subscribe to session2
      managedTestClient.send({
        type: 'subscribe',
        sessionId: session2.id,
      })
      await Promise.all([subscribePromise1, subscribePromise2])

      const unsubscribePromise1 = new Promise<WSMessageServerUnsubscribedSession>((res) => {
        managedTestClient.unsubscribedCallbacks.push((message) => {
          if (message.sessionId === session1.id) {
            res(message)
          }
        })
      })

      // Unsubscribe from session1
      managedTestClient.send({
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
