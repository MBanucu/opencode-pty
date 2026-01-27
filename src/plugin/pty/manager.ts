import type { PTYSessionInfo, SpawnOptions, ReadResult, SearchResult } from './types.ts'
import type { OpencodeClient } from '@opencode-ai/sdk'
import { SessionLifecycleManager } from './SessionLifecycle.ts'
import { OutputManager } from './OutputManager.ts'
import { NotificationManager } from './NotificationManager.ts'
import { withSession } from './utils.ts'

let onSessionUpdate: (() => void) | undefined

export function setOnSessionUpdate(callback: () => void) {
  onSessionUpdate = callback
}

type RawOutputCallback = (sessionId: string, rawData: string) => void

const rawOutputCallbacks: RawOutputCallback[] = []

export function onRawOutput(callback: RawOutputCallback): void {
  rawOutputCallbacks.push(callback)
}

function notifyRawOutput(sessionId: string, rawData: string): void {
  for (const callback of rawOutputCallbacks) {
    try {
      callback(sessionId, rawData)
    } catch {}
  }
}

class PTYManager {
  private lifecycleManager = new SessionLifecycleManager()
  private outputManager = new OutputManager()
  private notificationManager = new NotificationManager()

  init(client: OpencodeClient): void {
    this.notificationManager.init(client)
  }

  clearAllSessions(): void {
    this.lifecycleManager.clearAllSessions()
  }

  spawn(opts: SpawnOptions): PTYSessionInfo {
    console.log('Manager spawn called with opts:', opts)
    const session = this.lifecycleManager.spawn(
      opts,
      (id, data) => {
        console.log('Manager onData callback for id:', id, 'data length:', data.length)
        notifyRawOutput(id, data)
      },
      async (id, exitCode) => {
        console.log('Manager onExit callback for id:', id, 'exitCode:', exitCode)
        if (onSessionUpdate) onSessionUpdate()
        const session = this.lifecycleManager.getSession(id)
        if (session && session.notifyOnExit) {
          await this.notificationManager.sendExitNotification(session, exitCode || 0)
        }
      }
    )
    console.log('Manager spawn returning session:', session)
    if (onSessionUpdate) onSessionUpdate()
    return session
  }

  write(id: string, data: string): boolean {
    console.log('Manager write called for id:', id, 'data:', data)
    const result = withSession(
      this.lifecycleManager,
      id,
      (session) => this.outputManager.write(session, data),
      false
    )
    console.log('Manager write result:', result)
    return result
  }

  read(id: string, offset: number = 0, limit?: number): ReadResult | null {
    return withSession(
      this.lifecycleManager,
      id,
      (session) => this.outputManager.read(session, offset, limit),
      null
    )
  }

  search(id: string, pattern: RegExp, offset: number = 0, limit?: number): SearchResult | null {
    return withSession(
      this.lifecycleManager,
      id,
      (session) => this.outputManager.search(session, pattern, offset, limit),
      null
    )
  }

  list(): PTYSessionInfo[] {
    return this.lifecycleManager.listSessions().map((s) => this.lifecycleManager.toInfo(s))
  }

  get(id: string): PTYSessionInfo | null {
    return withSession(
      this.lifecycleManager,
      id,
      (session) => {
        const info = this.lifecycleManager.toInfo(session)
        console.log('Manager get returning info:', info)
        return info
      },
      null
    )
  }

  getRawBuffer(id: string): { raw: string; byteLength: number } | null {
    return withSession(
      this.lifecycleManager,
      id,
      (session) => ({
        raw: session.buffer.readRaw(),
        byteLength: session.buffer.byteLength,
      }),
      null
    )
  }

  kill(id: string, cleanup: boolean = false): boolean {
    return this.lifecycleManager.kill(id, cleanup)
  }

  cleanupBySession(parentSessionId: string): void {
    this.lifecycleManager.cleanupBySession(parentSessionId)
  }

  cleanupAll(): void {
    this.lifecycleManager.cleanupAll()
  }
}

export const manager = new PTYManager()

export function initManager(opcClient: OpencodeClient): void {
  manager.init(opcClient)
}
