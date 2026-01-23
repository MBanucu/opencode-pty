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

type OutputCallback = (sessionId: string, data: string[]) => void
const outputCallbacks: OutputCallback[] = []

export function onOutput(callback: OutputCallback): void {
  outputCallbacks.push(callback)
}

function notifyOutput(sessionId: string, data: string): void {
  const lines = data.split('\n')
  for (const callback of outputCallbacks) {
    try {
      callback(sessionId, lines)
    } catch (err) {
      log.error({ sessionId, error: String(err) }, 'output callback failed')
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
        notifyOutput(id, data)
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
    return this.lifecycleManager.listSessions().map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      command: s.command,
      args: s.args,
      workdir: s.workdir,
      status: s.status,
      exitCode: s.exitCode,
      pid: s.pid,
      createdAt: s.createdAt,
      lineCount: s.buffer.length,
    }))
  }

  get(id: string): PTYSessionInfo | null {
    const session = this.lifecycleManager.getSession(id)
    if (!session) return null
    return {
      id: session.id,
      title: session.title,
      description: session.description,
      command: session.command,
      args: session.args,
      workdir: session.workdir,
      status: session.status,
      exitCode: session.exitCode,
      pid: session.pid,
      createdAt: session.createdAt,
      lineCount: session.buffer.length,
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
