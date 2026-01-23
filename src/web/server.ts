import type { Server, ServerWebSocket } from 'bun'
import { manager, onOutput, setOnSessionUpdate } from '../plugin/pty/manager.ts'
import logger from './logger.ts'
import type { WSMessage, WSClient, ServerConfig } from './types.ts'
import { handleRoot, handleStaticAssets } from './handlers/static.ts'
import { handleHealth, handleAPISessions } from './handlers/api.ts'
import { DEFAULT_SERVER_PORT } from './constants.ts'

const log = logger.child({ module: 'web-server' })

const defaultConfig: ServerConfig = {
  port: DEFAULT_SERVER_PORT,
  hostname: 'localhost',
}

let server: Server<WSClient> | null = null
const wsClients: Map<ServerWebSocket<WSClient>, WSClient> = new Map()
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

function broadcastSessionData(sessionId: string, data: string[]): void {
  log.info({ sessionId, dataLength: data.length }, 'broadcastSessionData called')
  const message: WSMessage = { type: 'data', sessionId, data }
  const messageStr = JSON.stringify(message)
  log.info({ clientCount: wsClients.size }, 'Broadcasting session data')

  let sentCount = 0
  for (const [ws, client] of wsClients) {
    if (client.subscribedSessions.has(sessionId)) {
      try {
        ws.send(messageStr)
        sentCount++
      } catch (err) {
        log.error({ error: String(err) }, 'Failed to send to client')
      }
    }
  }
  log.info({ sentCount }, 'Broadcast complete')
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
        if (message.sessionId) {
          log.info({ sessionId: message.sessionId }, 'Client subscribing to session')
          const success = subscribeToSession(wsClient, message.sessionId)
          if (!success) {
            log.warn({ sessionId: message.sessionId }, 'Subscription failed - session not found')
            ws.send(
              JSON.stringify({ type: 'error', error: `Session ${message.sessionId} not found` })
            )
          } else {
            log.info({ sessionId: message.sessionId }, 'Subscription successful')
          }
        }
        break

      case 'unsubscribe':
        if (message.sessionId) {
          unsubscribeFromSession(wsClient, message.sessionId)
        }
        break

      case 'session_list':
        sendSessionList(ws)
        break

      default:
        ws.send(JSON.stringify({ type: 'error', error: 'Unknown message type' }))
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

  // Handle WebSocket upgrade
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
  }

  if (url.pathname === '/') {
    return handleRoot()
  }

  const staticResponse = await handleStaticAssets(url)
  if (staticResponse) return staticResponse

  if (url.pathname === '/health' && req.method === 'GET') {
    return handleHealth(wsClients.size)
  }

  const apiResponse = await handleAPISessions(url, req, wsClients)
  if (apiResponse) return apiResponse

  return new Response('Not found', { status: 404 })
}

export function startWebServer(config: Partial<ServerConfig> = {}): string {
  const finalConfig = { ...defaultConfig, ...config }

  log.info({ port: finalConfig.port, hostname: finalConfig.hostname }, 'Starting web server')

  if (server) {
    log.warn('web server already running')
    return `http://${server.hostname}:${server.port}`
  }

  onOutput((sessionId, data) => {
    log.info({ sessionId, dataLength: data.length }, 'PTY output received')
    broadcastSessionData(sessionId, data)
  })

  server = Bun.serve({
    hostname: finalConfig.hostname,
    port: finalConfig.port,

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
