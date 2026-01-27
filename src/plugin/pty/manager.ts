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
    const session = this.lifecycleManager.spawn(
      opts,
      (id, data) => {
        notifyRawOutput(id, data)
      },
      async (id, exitCode) => {
        if (onSessionUpdate) onSessionUpdate()
        const session = this.lifecycleManager.getSession(id)
        if (session && session.notifyOnExit) {
          await this.notificationManager.sendExitNotification(session, exitCode || 0)
        }
      }
    )
    if (onSessionUpdate) onSessionUpdate()
    return session
  }

  write(id: string, data: string): boolean {
    return withSession(
      this.lifecycleManager,
      id,
      (session) => this.outputManager.write(session, data),
      false
    )
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
      (session) => this.lifecycleManager.toInfo(session),
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
