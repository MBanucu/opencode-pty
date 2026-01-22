import type { ServerWebSocket } from 'bun'

export interface WSMessage {
  type: 'subscribe' | 'unsubscribe' | 'data' | 'session_list' | 'error'
  sessionId?: string
  data?: string[]
  error?: string
  sessions?: SessionData[]
}

export interface SessionData {
  id: string
  title: string
  command: string
  status: string
  exitCode?: number
  pid: number
  lineCount: number
  createdAt: string
}

export interface ServerConfig {
  port: number
  hostname: string
}

export interface WSClient {
  socket: ServerWebSocket<WSClient>
  subscribedSessions: Set<string>
}

// React component types
export interface Session {
  id: string
  title: string
  command: string
  status: 'running' | 'exited' | 'killed'
  exitCode?: number
  pid: number
  lineCount: number
  createdAt: string
}

export interface AppState {
  sessions: Session[]
  activeSession: Session | null
  output: string[]
  connected: boolean
  inputValue: string
}
