import { spawn, type IPty } from 'bun-pty'
import { RingBuffer } from './buffer.ts'
import type { PTYSession, PTYSessionInfo, SpawnOptions, PTYStatus } from './types.ts'
import { DEFAULT_TERMINAL_COLS, DEFAULT_TERMINAL_ROWS } from '../constants.ts'

const SESSION_ID_BYTE_LENGTH = 4

function generateId(): string {
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(SESSION_ID_BYTE_LENGTH)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return `pty_${hex}`
}

export class SessionLifecycleManager {
  private sessions: Map<string, PTYSession> = new Map()

  private createSessionObject(opts: SpawnOptions): PTYSession {
    console.log('Creating session object with opts:', opts)
    const id = generateId()
    const args = opts.args ?? []
    const workdir = opts.workdir ?? process.cwd()
    const title =
      opts.title ?? (`${opts.command} ${args.join(' ')}`.trim() || `Terminal ${id.slice(-4)}`)

    const buffer = new RingBuffer()
    const session = {
      id,
      title,
      description: opts.description,
      command: opts.command,
      args,
      workdir,
      env: opts.env,
      status: 'running' as PTYStatus,
      pid: 0, // will be set after spawn
      createdAt: new Date(),
      parentSessionId: opts.parentSessionId,
      notifyOnExit: opts.notifyOnExit ?? false,
      buffer,
      process: null, // will be set
    }
    console.log('Session object created:', session)
    return session
  }

  private spawnProcess(session: PTYSession): void {
    console.log('Spawning PTY process for command:', session.command, 'args:', session.args)
    const env = { ...process.env, ...session.env } as Record<string, string>
    try {
      const ptyProcess: IPty = spawn(session.command, session.args, {
        name: 'xterm-256color',
        cols: DEFAULT_TERMINAL_COLS,
        rows: DEFAULT_TERMINAL_ROWS,
        cwd: session.workdir,
        env,
      })
      console.log('PTY process spawned with pid:', ptyProcess.pid)
      session.process = ptyProcess
      session.pid = ptyProcess.pid
      console.log('Session after spawn:', {
        id: session.id,
        pid: session.pid,
        command: session.command,
        status: session.status,
      })
    } catch (error) {
      console.error('Failed to spawn PTY process:', error)
      throw error
    }
  }

  private setupEventHandlers(
    session: PTYSession,
    onData: (id: string, data: string) => void,
    onExit: (id: string, exitCode: number | null) => void
  ): void {
    console.log('Setting up event handlers for session:', session.id)
    session.process!.onData((data: string) => {
      console.log('PTY onData for session', session.id, 'data length:', data.length)
      session.buffer.append(data)
      onData(session.id, data)
    })

    session.process!.onExit(({ exitCode }) => {
      console.log('PTY onExit for session', session.id, 'exitCode:', exitCode)
      // Flush any remaining incomplete line in the buffer
      session.buffer.flush()

      if (session.status === 'running') {
        session.status = 'exited'
        session.exitCode = exitCode
      }
      onExit(session.id, exitCode)
    })
  }

  spawn(
    opts: SpawnOptions,
    onData: (id: string, data: string) => void,
    onExit: (id: string, exitCode: number | null) => void
  ): PTYSessionInfo {
    const session = this.createSessionObject(opts)
    this.spawnProcess(session)
    this.setupEventHandlers(session, onData, onExit)
    this.sessions.set(session.id, session)
    return this.toInfo(session)
  }

  kill(id: string, cleanup: boolean = false): boolean {
    const session = this.sessions.get(id)
    if (!session) {
      return false
    }

    if (session.status === 'running') {
      try {
        session.process!.kill()
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

  private clearAllSessionsInternal(): void {
    for (const id of [...this.sessions.keys()]) {
      this.kill(id, true)
    }
  }

  clearAllSessions(): void {
    this.clearAllSessionsInternal()
  }

  cleanupBySession(parentSessionId: string): void {
    for (const [id, session] of this.sessions) {
      if (session.parentSessionId === parentSessionId) {
        this.kill(id, true)
      }
    }
  }

  cleanupAll(): void {
    this.clearAllSessionsInternal()
  }

  getSession(id: string): PTYSession | null {
    const session = this.sessions.get(id) || null
    console.log('SessionLifecycle getSession for id:', id, 'found:', !!session)
    if (session)
      console.log('Session details:', {
        id: session.id,
        pid: session.pid,
        status: session.status,
        process: !!session.process,
        command: session.command,
        args: session.args,
      })
    return session
  }

  listSessions(): PTYSession[] {
    return Array.from(this.sessions.values())
  }

  toInfo(session: PTYSession): PTYSessionInfo {
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
