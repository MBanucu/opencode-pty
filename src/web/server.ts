import type { Server, ServerWebSocket, BunRequest } from 'bun'
import { manager, onRawOutput, setOnSessionUpdate } from '../plugin/pty/manager.ts'
import logger from './logger.ts'
import type { WSMessage, WSClient, ServerConfig } from './types.ts'
import { handleStaticAssets, get404Response, handleRoot } from './handlers/static.ts'
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
import { DEFAULT_SERVER_PORT } from './constants.ts'

const log = logger.child({ module: 'web-server' })

const defaultConfig: ServerConfig = {
  port: DEFAULT_SERVER_PORT,
  hostname: 'localhost',
}

let server: Server<WSClient> | null = null
const wsClients: Map<ServerWebSocket<WSClient>, WSClient> = new Map()

export { wsClients }

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

function subscribeToSession(wsClient: WSClient, sessionId: string): boolean {
  const session = manager.get(sessionId)
  if (!session) {
    return false
  }
  wsClient.subscribedSessions.add(sessionId)
  return true
}

function unsubscribeFromSession(wsClient: WSClient, sessionId: string): void {
  wsClient.subscribedSessions.delete(sessionId)
}

function broadcastRawSessionData(sessionId: string, rawData: string): void {
  const message: WSMessage = { type: 'raw_data', sessionId, rawData }
  const messageStr = JSON.stringify(message)

  for (const [ws, client] of wsClients) {
    if (client.subscribedSessions.has(sessionId)) {
      try {
        ws.send(messageStr)
      } catch (err) {
        log.error({ error: String(err) }, 'Failed to send to client')
      }
    }
  }

  log.debug({ sessionId, messageSize: messageStr.length }, 'broadcast raw data message')
}

function sendSessionList(ws: ServerWebSocket<WSClient>): void {
  const sessions = manager.list()
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

function handleSubscribe(
  ws: ServerWebSocket<WSClient>,
  wsClient: WSClient,
  message: WSMessage
): void {
  if (message.sessionId) {
    log.info({ sessionId: message.sessionId }, 'Client subscribing to session')
    const success = subscribeToSession(wsClient, message.sessionId)
    if (!success) {
      log.warn({ sessionId: message.sessionId }, 'Subscription failed - session not found')
      ws.send(JSON.stringify({ type: 'error', error: `Session ${message.sessionId} not found` }))
    } else {
      log.info({ sessionId: message.sessionId }, 'Subscription successful')
    }
  }
}

function handleUnsubscribe(
  _ws: ServerWebSocket<WSClient>,
  wsClient: WSClient,
  message: WSMessage
): void {
  if (message.sessionId) {
    unsubscribeFromSession(wsClient, message.sessionId)
  }
}

function handleSessionListRequest(
  ws: ServerWebSocket<WSClient>,
  _wsClient: WSClient,
  _message: WSMessage
): void {
  sendSessionList(ws)
}

function handleUnknownMessage(
  ws: ServerWebSocket<WSClient>,
  _wsClient: WSClient,
  _message: WSMessage
): void {
  ws.send(JSON.stringify({ type: 'error', error: 'Unknown message type' }))
}

// Set callback for session updates
setOnSessionUpdate(() => {
  for (const [ws] of wsClients) {
    sendSessionList(ws)
  }
})

function handleWebSocketMessage(
  ws: ServerWebSocket<WSClient>,
  wsClient: WSClient,
  data: string
): void {
  try {
    const message: WSMessage = JSON.parse(data)

    switch (message.type) {
      case 'subscribe':
        handleSubscribe(ws, wsClient, message)
        break

      case 'unsubscribe':
        handleUnsubscribe(ws, wsClient, message)
        break

      case 'session_list':
        handleSessionListRequest(ws, wsClient, message)
        break

      default:
        handleUnknownMessage(ws, wsClient, message)
    }
  } catch (err) {
    log.debug({ error: String(err) }, 'failed to handle ws message')
    ws.send(JSON.stringify({ type: 'error', error: 'Invalid message format' }))
  }
}

const wsHandler = {
  open(ws: ServerWebSocket<WSClient>) {
    log.info('ws client connected')
    const wsClient: WSClient = { socket: ws, subscribedSessions: new Set() }
    wsClients.set(ws, wsClient)
    sendSessionList(ws)
  },

  message(ws: ServerWebSocket<WSClient>, message: string) {
    const wsClient = wsClients.get(ws)
    if (wsClient) {
      handleWebSocketMessage(ws, wsClient, message)
    }
  },

  close(ws: ServerWebSocket<WSClient>) {
    log.info('ws client disconnected')
    wsClients.delete(ws)
  },
}

async function handleRequest(req: Request, server: Server<WSClient>): Promise<Response> {
  const url = new URL(req.url)

  // Handle root path
  if (url.pathname === '/') {
    if (req.headers.get('upgrade') === 'websocket') {
      log.info('WebSocket upgrade request')
      const success = server.upgrade(req, {
        data: { socket: null as any, subscribedSessions: new Set() },
      })
      if (success) {
        log.info('WebSocket upgrade success')
        return new Response(null, { status: 101 }) // Upgrade succeeded
      }
      log.warn('WebSocket upgrade failed')
      return new Response('WebSocket upgrade failed', { status: 400 })
    } else {
      return wrapWithSecurityHeaders(handleRoot)(req)
    }
  }

  // Fallback to static assets
  const staticResponse = await handleStaticAssets(url)
  if (staticResponse) return staticResponse

  return get404Response({ url: req.url, method: req.method, note: 'No route matched' })
}

export function startWebServer(config: Partial<ServerConfig> = {}): string {
  const finalConfig = { ...defaultConfig, ...config }

  log.info({ port: finalConfig.port, hostname: finalConfig.hostname }, 'Starting web server')

  if (server) {
    log.warn('web server already running')
    return `http://${server.hostname}:${server.port}`
  }

  onRawOutput((sessionId, rawData) => {
    broadcastRawSessionData(sessionId, rawData)
  })

  server = Bun.serve({
    hostname: finalConfig.hostname,
    port: finalConfig.port,

    routes: {
      '/health': wrapWithSecurityHeaders(handleHealth),
      '/api/sessions': wrapWithSecurityHeaders(async (req: Request) => {
        if (req.method === 'GET') return getSessions(req)
        if (req.method === 'POST') return createSession(req)
        return new Response('Method not allowed', { status: 405 })
      }),
      '/api/sessions/clear': wrapWithSecurityHeaders(async (req: Request) => {
        if (req.method === 'POST') return clearSessions(req)
        return new Response('Method not allowed', { status: 405 })
      }),
      '/api/sessions/:id': wrapWithSecurityHeaders(async (req: Request) => {
        if (req.method === 'GET') return getSession(req as BunRequest<'/api/sessions/:id'>)
        return new Response('Method not allowed', { status: 405 })
      }),
      '/api/sessions/:id/input': wrapWithSecurityHeaders(async (req: Request) => {
        if (req.method === 'POST') return sendInput(req as BunRequest<'/api/sessions/:id/input'>)
        return new Response('Method not allowed', { status: 405 })
      }),
      '/api/sessions/:id/kill': wrapWithSecurityHeaders(async (req: Request) => {
        if (req.method === 'POST') return killSession(req as BunRequest<'/api/sessions/:id/kill'>)
        return new Response('Method not allowed', { status: 405 })
      }),
      '/api/sessions/:id/buffer/raw': wrapWithSecurityHeaders(async (req: Request) => {
        if (req.method === 'GET')
          return getRawBuffer(req as BunRequest<'/api/sessions/:id/buffer/raw'>)
        return new Response('Method not allowed', { status: 405 })
      }),
      '/api/sessions/:id/buffer/plain': wrapWithSecurityHeaders(async (req: Request) => {
        if (req.method === 'GET')
          return getPlainBuffer(req as BunRequest<'/api/sessions/:id/buffer/plain'>)
        return new Response('Method not allowed', { status: 405 })
      }),
    },

    websocket: wsHandler,

    fetch: handleRequest,
  })

  log.info({ url: `http://${finalConfig.hostname}:${finalConfig.port}` }, 'web server started')
  return `http://${finalConfig.hostname}:${finalConfig.port}`
}

export function stopWebServer(): void {
  if (server) {
    server.stop()
    server = null
    wsClients.clear()
    log.info('web server stopped')
  }
}

export function getServerUrl(): string | null {
  if (!server) return null
  return `http://${server.hostname}:${server.port}`
}
