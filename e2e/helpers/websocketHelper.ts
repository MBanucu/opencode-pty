import { ManagedTestClient } from '../../test/utils'
import type {
  WSMessageServerRawData,
  WSMessageClientSubscribeSession,
} from '../../src/web/shared/types'

/**
 * E2E WebSocket client wrapper for testing buffer events in Playwright tests
 * Uses the shared ManagedTestClient for core WebSocket functionality
 */
export class E2ETestWebSocketClient implements Disposable {
  private client: ManagedTestClient

  public static async create(wsUrl: string) {
    return new E2ETestWebSocketClient(await ManagedTestClient.create(wsUrl))
  }

  constructor(client: ManagedTestClient) {
    this.client = client
  }

  /**
   * Connect to WebSocket and subscribe to a specific session
   */
  async connectAndSubscribe(sessionId: string): Promise<void> {
    if (!this.client) throw new Error('Client not initialized')
    const message: WSMessageClientSubscribeSession = {
      type: 'subscribe',
      sessionId,
    }
    this.client.send(message)
  }

  /**
   * Wait for the next raw_data event with timeout
   */
  async waitForRawData(timeout = 5000): Promise<WSMessageServerRawData> {
    if (!this.client) throw new Error('Client not initialized')

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Timeout waiting for raw_data event after ${timeout}ms`))
      }, timeout)

      const client = this.client!
      client.rawDataCallbacks.push((message) => {
        clearTimeout(timeoutId)
        resolve(message)
      })
    })
  }

  /**
   * Collect all raw_data events that occur within a time window
   */
  async collectRawDataEvents(duration: number): Promise<WSMessageServerRawData[]> {
    if (!this.client) throw new Error('Client not initialized')

    const events: WSMessageServerRawData[] = []
    const startTime = Date.now()

    return new Promise((resolve) => {
      const client = this.client!
      client.rawDataCallbacks.push((message) => {
        events.push(message)

        // Stop collecting after duration
        if (Date.now() - startTime >= duration) {
          resolve(events)
        }
      })

      // Also resolve after duration even if no events
      setTimeout(() => {
        resolve(events)
      }, duration)
    })
  }

  /**
   * Verify that a specific character appears in raw_data events within timeout
   */
  async verifyCharacterInEvents(char: string, timeout = 5000): Promise<boolean> {
    if (!this.client) throw new Error('Client not initialized')

    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        resolve(false)
      }, timeout)

      const client = this.client!
      client.rawDataCallbacks.push((message) => {
        if (message.rawData.includes(char)) {
          clearTimeout(timeoutId)
          resolve(true)
        }
      })
    })
  }

  /**
   * Get access to the underlying ManagedTestClient for advanced use cases
   */
  getManagedClient(): ManagedTestClient {
    if (!this.client) throw new Error('Client not initialized')
    return this.client
  }

  [Symbol.dispose]() {
    if (this.client) {
      this.client[Symbol.dispose]()
    }
  }
}
