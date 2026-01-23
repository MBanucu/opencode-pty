import logger from '../logger.ts'
import type { PTYSessionInfo, SpawnOptions, ReadResult, SearchResult } from './types.ts'
import type { OpencodeClient } from '@opencode-ai/sdk'
import { SessionLifecycleManager } from './SessionLifecycle.ts'
import { OutputManager } from './OutputManager.ts'
import { NotificationManager } from './NotificationManager.ts'

let onSessionUpdate: (() => void) | undefined

export function setOnSessionUpdate(callback: () => void) {
  onSessionUpdate = callback
}

const log = logger.child({ service: 'pty.manager' })

type RawOutputCallback = (sessionId: string, rawData: string) => void

const rawOutputCallbacks: RawOutputCallback[] = []

export function onRawOutput(callback: RawOutputCallback): void {
  rawOutputCallbacks.push(callback)
}

function notifyRawOutput(sessionId: string, rawData: string): void {
  for (const callback of rawOutputCallbacks) {
    try {
      callback(sessionId, rawData)
    } catch (err) {
      log.error({ sessionId, error: String(err) }, 'raw output callback failed')
    }
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
    return this.lifecycleManager.spawn(
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
  }

  write(id: string, data: string): boolean {
    const session = this.lifecycleManager.getSession(id)
    if (!session) {
      return false
    }
    return this.outputManager.write(session, data)
  }

  read(id: string, offset: number = 0, limit?: number): ReadResult | null {
    const session = this.lifecycleManager.getSession(id)
    if (!session) {
      return null
    }
    return this.outputManager.read(session, offset, limit)
  }

  search(id: string, pattern: RegExp, offset: number = 0, limit?: number): SearchResult | null {
    const session = this.lifecycleManager.getSession(id)
    if (!session) {
      return null
    }
    return this.outputManager.search(session, pattern, offset, limit)
  }

  list(): PTYSessionInfo[] {
    return this.lifecycleManager.listSessions().map((s) => this.lifecycleManager.toInfo(s))
  }

  get(id: string): PTYSessionInfo | null {
    const session = this.lifecycleManager.getSession(id)
    if (!session) return null
    return this.lifecycleManager.toInfo(session)
  }

  getRawBuffer(id: string): { raw: string; byteLength: number } | null {
    const session = this.lifecycleManager.getSession(id)
    if (!session) return null
    return {
      raw: session.buffer.readRaw(),
      byteLength: session.buffer.byteLength,
    }
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
