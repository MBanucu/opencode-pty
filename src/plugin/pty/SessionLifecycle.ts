import { spawn, type IPty } from 'bun-pty'
import logger from '../logger.ts'
import { RingBuffer } from './buffer.ts'
import type { PTYSession, PTYSessionInfo, SpawnOptions } from './types.ts'
import { DEFAULT_TERMINAL_COLS, DEFAULT_TERMINAL_ROWS } from '../constants.ts'

const log = logger.child({ service: 'pty.lifecycle' })

function generateId(): string {
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return `pty_${hex}`
}

export class SessionLifecycleManager {
  private sessions: Map<string, PTYSession> = new Map()

  spawn(
    opts: SpawnOptions,
    onData: (id: string, data: string) => void,
    onExit: (id: string, exitCode: number | null) => void
  ): PTYSessionInfo {
    const id = generateId()
    const args = opts.args ?? []
    const workdir = opts.workdir ?? process.cwd()
    const env = { ...process.env, ...opts.env } as Record<string, string>
    const title =
      opts.title ?? (`${opts.command} ${args.join(' ')}`.trim() || `Terminal ${id.slice(-4)}`)

    const ptyProcess: IPty = spawn(opts.command, args, {
      name: 'xterm-256color',
      cols: DEFAULT_TERMINAL_COLS,
      rows: DEFAULT_TERMINAL_ROWS,
      cwd: workdir,
      env,
    })

    const buffer = new RingBuffer()
    const session: PTYSession = {
      id,
      title,
      description: opts.description,
      command: opts.command,
      args,
      workdir,
      env: opts.env,
      status: 'running',
      pid: ptyProcess.pid,
      createdAt: new Date(),
      parentSessionId: opts.parentSessionId,
      notifyOnExit: opts.notifyOnExit ?? false,
      buffer,
      process: ptyProcess,
    }

    this.sessions.set(id, session)

    ptyProcess.onData((data: string) => {
      buffer.append(data)
      onData(id, data)
    })

    ptyProcess.onExit(({ exitCode, signal }) => {
      log.info({ id, exitCode, signal, command: opts.command }, 'pty exited')
      if (session.status === 'running') {
        session.status = 'exited'
        session.exitCode = exitCode
      }
      onExit(id, exitCode)
    })

    return this.toInfo(session)
  }

  kill(id: string, cleanup: boolean = false): boolean {
    const session = this.sessions.get(id)
    if (!session) {
      return false
    }

    log.info({ id, cleanup }, 'killing pty')

    if (session.status === 'running') {
      try {
        session.process.kill()
      } catch {
        // Ignore kill errors
      }
      session.status = 'killed'
    }

    if (cleanup) {
      session.buffer.clear()
      this.sessions.delete(id)
    }

    return true
  }

  clearAllSessions(): void {
    // Kill all running processes
    for (const session of this.sessions.values()) {
      if (session.status === 'running') {
        try {
          session.process.kill()
        } catch (err) {
          log.warn({ id: session.id, error: String(err) }, 'failed to kill process during clear')
        }
      }
    }

    // Clear all sessions
    this.sessions.clear()
    log.info('cleared all sessions')
  }

  cleanupBySession(parentSessionId: string): void {
    log.info({ parentSessionId }, 'cleaning up ptys for session')
    for (const [id, session] of this.sessions) {
      if (session.parentSessionId === parentSessionId) {
        this.kill(id, true)
      }
    }
  }

  cleanupAll(): void {
    log.info('cleaning up all ptys')
    for (const id of this.sessions.keys()) {
      this.kill(id, true)
    }
  }

  getSession(id: string): PTYSession | null {
    return this.sessions.get(id) || null
  }

  listSessions(): PTYSession[] {
    return Array.from(this.sessions.values())
  }

  private toInfo(session: PTYSession): PTYSessionInfo {
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
}
