import type { Server, ServerWebSocket, BunRequest } from 'bun'
import { manager, onRawOutput, setOnSessionUpdate, PTYManager } from '../../plugin/pty/manager.ts'
import type { WSMessage, ServerConfig } from '../shared/types.ts'
import { get404Response } from './handlers/static.ts'
import { handleHealth } from './handlers/health.ts'
import {
  getSessions,
  createSession,
  clearSessions,
  getSession,
  sendInput,
  killSession,
  getRawBuffer,
  getPlainBuffer,
} from './handlers/sessions.ts'
import { DEFAULT_SERVER_PORT } from '../shared/constants.ts'

import { buildStaticRoutes } from './handlers/static.ts'

const defaultConfig: ServerConfig = {
  port: DEFAULT_SERVER_PORT,
  hostname: 'localhost',
}

let server: Server<any> | null = null
let wsConnectionCount = 0
const wsClients: Map<ServerWebSocket<any>, any> = new Map()

export { wsConnectionCount }

function wrapWithSecurityHeaders(
  handler: (req: Request) => Promise<Response> | Response
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    const response = await handler(req)
    const headers = new Headers(response.headers)
    headers.set('X-Content-Type-Options', 'nosniff')
    headers.set('X-Frame-Options', 'DENY')
    headers.set('X-XSS-Protection', '1; mode=block')
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    headers.set(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
    )
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  }
}

async function handleRequest(req: Request): Promise<Response> {
  return get404Response({ url: req.url, method: req.method, note: 'No route matched' })
}

export async function startWebServer(
  config: Partial<ServerConfig> = {},
  testManager?: PTYManager
): Promise<string> {
  const finalConfig = { ...defaultConfig, ...config }
  const ptyManager = testManager || manager

  function sendSessionList(ws: ServerWebSocket<any>): void {
    const sessions = ptyManager.list()
    const sessionData = sessions.map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      command: s.command,
      status: s.status,
      exitCode: s.exitCode,
      pid: s.pid,
      lineCount: s.lineCount,
      createdAt: s.createdAt.toISOString(),
    }))
    const message: WSMessage = { type: 'session_list', sessions: sessionData }
    ws.send(JSON.stringify(message))
  }

  function handleSubscribe(ws: ServerWebSocket<any>, message: WSMessage): void {
    if (message.sessionId) {
      const session = ptyManager.get(message.sessionId)
      if (!session) {
        ws.send(JSON.stringify({ type: 'error', error: `Session ${message.sessionId} not found` }))
      } else {
        ws.subscribe(`session:${message.sessionId}`)
      }
    }
  }

  function handleUnsubscribe(ws: ServerWebSocket<any>, message: WSMessage): void {
    if (message.sessionId) {
      ws.unsubscribe(`session:${message.sessionId}`)
    }
  }

  function handleSessionListRequest(ws: ServerWebSocket<any>, _message: WSMessage): void {
    sendSessionList(ws)
  }

  function handleUnknownMessage(ws: ServerWebSocket<any>, _message: WSMessage): void {
    ws.send(JSON.stringify({ type: 'error', error: 'Unknown message type' }))
  }

  // Set callback for session updates
  setOnSessionUpdate(() => {
    const sessions = ptyManager.list()
    const sessionData = sessions.map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      command: s.command,
      status: s.status,
      exitCode: s.exitCode,
      pid: s.pid,
      lineCount: s.lineCount,
      createdAt: s.createdAt.toISOString(),
    }))
    const message = { type: 'session_list', sessions: sessionData }
    for (const [ws] of wsClients) {
      ws.send(JSON.stringify(message))
    }
  })

  function handleWebSocketMessage(ws: ServerWebSocket<any>, data: string): void {
    try {
      const message: WSMessage = JSON.parse(data)

      switch (message.type) {
        case 'subscribe':
          handleSubscribe(ws, message)
          break

        case 'unsubscribe':
          handleUnsubscribe(ws, message)
          break

        case 'session_list':
          handleSessionListRequest(ws, message)
          break

        default:
          handleUnknownMessage(ws, message)
      }
    } catch (err) {
      ws.send(JSON.stringify({ type: 'error', error: 'Invalid message format' }))
    }
  }

  const wsHandler = {
    open(ws: ServerWebSocket<any>) {
      wsConnectionCount++
      wsClients.set(ws, {})
      sendSessionList(ws)
    },

    message(ws: ServerWebSocket<any>, message: string) {
      handleWebSocketMessage(ws, message)
    },

    close(_ws: ServerWebSocket<any>) {
      wsConnectionCount--
      wsClients.delete(_ws)
    },
  }

  if (server) {
    return `http://${server.hostname}:${server.port}`
  }

  onRawOutput((sessionId, rawData) => {
    if (server) {
      server.publish(
        `session:${sessionId}`,
        JSON.stringify({ type: 'raw_data', sessionId, rawData })
      )
    }
  })

  const staticRoutes = await buildStaticRoutes()

  const createServer = (port: number) => {
    return Bun.serve({
      hostname: finalConfig.hostname,
      port,

      routes: {
        ...staticRoutes,
        '/': wrapWithSecurityHeaders(
          () => new Response(null, { status: 302, headers: { Location: '/index.html' } })
        ),
        '/ws': (req: Request) => {
          if (req.headers.get('upgrade') === 'websocket') {
            const success = server!.upgrade(req)
            if (success) {
              return undefined // Upgrade succeeded, Bun sends 101 automatically
            }
            return new Response('WebSocket upgrade failed', { status: 400 })
          } else {
            return new Response('WebSocket endpoint - use WebSocket upgrade', { status: 426 })
          }
        },
        '/health': wrapWithSecurityHeaders(handleHealth),
        '/api/sessions': wrapWithSecurityHeaders(async (req: Request) => {
          if (req.method === 'GET') return getSessions(ptyManager)
          if (req.method === 'POST') return createSession(req, ptyManager)
          return new Response('Method not allowed', { status: 405 })
        }),
        '/api/sessions/clear': wrapWithSecurityHeaders(async (req: Request) => {
          if (req.method === 'POST') return clearSessions(ptyManager)
          return new Response('Method not allowed', { status: 405 })
        }),
        '/api/sessions/:id': wrapWithSecurityHeaders(async (req: Request) => {
          if (req.method === 'GET')
            return getSession(req as BunRequest<'/api/sessions/:id'>, ptyManager)
          return new Response('Method not allowed', { status: 405 })
        }),
        '/api/sessions/:id/input': wrapWithSecurityHeaders(async (req: Request) => {
          if (req.method === 'POST')
            return sendInput(req as BunRequest<'/api/sessions/:id/input'>, ptyManager)
          return new Response('Method not allowed', { status: 405 })
        }),
        '/api/sessions/:id/kill': wrapWithSecurityHeaders(async (req: Request) => {
          if (req.method === 'POST')
            return killSession(req as BunRequest<'/api/sessions/:id/kill'>, ptyManager)
          return new Response('Method not allowed', { status: 405 })
        }),
        '/api/sessions/:id/buffer/raw': wrapWithSecurityHeaders(async (req: Request) => {
          if (req.method === 'GET')
            return getRawBuffer(req as BunRequest<'/api/sessions/:id/buffer/raw'>, ptyManager)
          return new Response('Method not allowed', { status: 405 })
        }),
        '/api/sessions/:id/buffer/plain': wrapWithSecurityHeaders(async (req: Request) => {
          if (req.method === 'GET')
            return getPlainBuffer(req as BunRequest<'/api/sessions/:id/buffer/plain'>, ptyManager)
          return new Response('Method not allowed', { status: 405 })
        }),
      },

      websocket: {
        perMessageDeflate: true,
        ...wsHandler,
      },

      fetch: handleRequest,
    })
  }

  try {
    server = createServer(finalConfig.port)
  } catch (error: any) {
    if (error.code === 'EADDRINUSE' || error.message?.includes('EADDRINUSE')) {
      server = createServer(0)
    } else {
      throw error
    }
  }

  return `http://${server.hostname}:${server.port}`
}

export function stopWebServer(): void {
  if (server) {
    server.stop()
    server = null
    wsClients.clear()
  }
}

export function getServerUrl(): string | null {
  if (!server) return null
  return `http://${server.hostname}:${server.port}`
}
