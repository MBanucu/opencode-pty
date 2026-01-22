import type { Server, ServerWebSocket } from 'bun'
import { manager, onOutput, setOnSessionUpdate } from '../plugin/pty/manager.ts'
import logger from './logger.ts'
import type { WSMessage, WSClient, ServerConfig } from './types.ts'
import { join, resolve } from 'path'
import { DEFAULT_SERVER_PORT, DEFAULT_READ_LIMIT, ASSET_CONTENT_TYPES } from './constants.ts'

const log = logger.child({ module: 'web-server' })

const defaultConfig: ServerConfig = {
  port: DEFAULT_SERVER_PORT,
  hostname: 'localhost',
}

// Security headers for all responses
function getSecurityHeaders(): Record<string, string> {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy':
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';",
  }
}

// Helper for JSON responses with security headers
function secureJsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...getSecurityHeaders(),
    },
  })
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
      log.debug({ sessionId }, 'Sending to subscribed client')
      try {
        ws.send(messageStr)
        sentCount++
      } catch (err) {
        log.error({ error: String(err) }, 'Failed to send to client')
      }
    }
  }
  if (sentCount === 0) {
    log.debug({ sessionId, clientCount: wsClients.size }, 'No clients subscribed to session')
  }
  log.info({ sentCount }, 'Broadcast complete')
}

function sendSessionList(ws: ServerWebSocket<WSClient>): void {
  const sessions = manager.list()
  const sessionData = sessions.map((s) => ({
    id: s.id,
    title: s.title,
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

    async fetch(req, server) {
      const url = new URL(req.url)
      log.debug(
        { url: req.url, method: req.method, upgrade: req.headers.get('upgrade') },
        'fetch request'
      )

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
        return new Response('WebSocket upgrade failed', {
          status: 400,
          headers: getSecurityHeaders(),
        })
      }

      if (url.pathname === '/') {
        log.info({ nodeEnv: process.env.NODE_ENV }, 'Serving root')
        // In test mode, serve built HTML from dist/web, otherwise serve source
        const htmlPath = import.meta.dir ? `${import.meta.dir}/../../dist/web/index.html` : "./dist/web/index.html";
        log.debug({ htmlPath }, 'Serving HTML')
        return new Response(await Bun.file(htmlPath).bytes(), {
          headers: { 'Content-Type': 'text/html', ...getSecurityHeaders() },
        })
      }

      // Serve static assets
      if (url.pathname.startsWith('/assets/')) {
        log.info({ pathname: url.pathname, nodeEnv: process.env.NODE_ENV }, 'Serving asset')
        // Always serve assets from dist/web in both test and production
        const baseDir = 'dist/web'
        const assetDir = resolve(process.cwd(), baseDir)
        const assetPath = url.pathname.slice(1) // remove leading /
        const filePath = join(assetDir, assetPath)
        const file = Bun.file(filePath)
        const exists = await file.exists()
        if (exists) {
          const ext = url.pathname.split('.').pop() || ''
          const contentType = ASSET_CONTENT_TYPES[`.${ext}`] || 'text/plain'
          log.debug({ filePath, contentType }, 'Asset served')
          return new Response(await file.bytes(), {
            headers: { 'Content-Type': contentType, ...getSecurityHeaders() },
          })
        } else {
          log.debug({ filePath }, 'Asset not found')
        }
      }

      // Serve TypeScript files in test mode
      if (
        process.env.NODE_ENV === 'test' &&
        (url.pathname.endsWith('.tsx') ||
          url.pathname.endsWith('.ts') ||
          url.pathname.endsWith('.jsx') ||
          url.pathname.endsWith('.js'))
      ) {
        log.info({ pathname: url.pathname }, 'Serving TypeScript file in test mode')
        const filePath = join(process.cwd(), 'src/web', url.pathname)
        const file = Bun.file(filePath)
        const exists = await file.exists()
        if (exists) {
          log.debug({ filePath }, 'TypeScript file served')
          return new Response(await file.bytes(), {
            headers: { 'Content-Type': 'application/javascript', ...getSecurityHeaders() },
          })
        } else {
          log.debug({ filePath }, 'TypeScript file not found')
        }
      }

      // Health check endpoint
      if (url.pathname === '/health' && req.method === 'GET') {
        const sessions = manager.list()
        const activeSessions = sessions.filter((s) => s.status === 'running').length
        const totalSessions = sessions.length
        const wsConnections = wsClients.size

        // Calculate response time (rough approximation)
        const startTime = Date.now()

        const healthResponse = {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          sessions: {
            total: totalSessions,
            active: activeSessions,
          },
          websocket: {
            connections: wsConnections,
          },
          memory: process.memoryUsage
            ? {
                rss: process.memoryUsage().rss,
                heapUsed: process.memoryUsage().heapUsed,
                heapTotal: process.memoryUsage().heapTotal,
              }
            : undefined,
        }

        // Add response time
        const responseTime = Date.now() - startTime
        ;(healthResponse as any).responseTime = responseTime

        return secureJsonResponse(healthResponse)
      }

      if (url.pathname === '/api/sessions' && req.method === 'GET') {
        const sessions = manager.list()
        return secureJsonResponse(sessions)
      }

      if (url.pathname === '/api/sessions' && req.method === 'POST') {
        const body = (await req.json()) as {
          command: string
          args?: string[]
          description?: string
          workdir?: string
        }
        const session = manager.spawn({
          command: body.command,
          args: body.args || [],
          title: body.description,
          description: body.description,
          workdir: body.workdir,
          parentSessionId: 'web-api',
        })
        // Broadcast updated session list to all clients
        for (const [ws] of wsClients) {
          sendSessionList(ws)
        }
        return secureJsonResponse(session)
      }

      if (url.pathname === '/api/sessions/clear' && req.method === 'POST') {
        manager.clearAllSessions()
        // Broadcast updated session list to all clients
        for (const [ws] of wsClients) {
          sendSessionList(ws)
        }
        return secureJsonResponse({ success: true })
      }

      if (url.pathname.match(/^\/api\/sessions\/[^/]+$/) && req.method === 'GET') {
        const sessionId = url.pathname.split('/')[3]
        log.debug({ sessionId }, 'Handling individual session request')
        if (!sessionId) return new Response('Invalid session ID', { status: 400 })
        const session = manager.get(sessionId)
        log.debug({
          sessionId,
          found: !!session,
          command: session?.command,
        })
        if (!session) {
          log.debug({ sessionId }, 'Returning 404 for session not found')
          return new Response('Session not found', { status: 404 })
        }
        log.debug({ sessionId: session.id }, 'Returning session data')
        return Response.json(session)
      }

      if (url.pathname.match(/^\/api\/sessions\/[^/]+\/input$/) && req.method === 'POST') {
        const sessionId = url.pathname.split('/')[3]
        log.debug({ sessionId }, 'Handling input request')
        if (!sessionId) return new Response('Invalid session ID', { status: 400 })
        const body = (await req.json()) as { data: string }
        log.debug({ sessionId, dataLength: body.data.length }, 'Input data')
        const success = manager.write(sessionId, body.data)
        log.debug({ sessionId, success }, 'Write result')
        if (!success) {
          return new Response('Failed to write to session', { status: 400 })
        }
        return secureJsonResponse({ success: true })
      }

      if (url.pathname.match(/^\/api\/sessions\/[^/]+\/kill$/) && req.method === 'POST') {
        const sessionId = url.pathname.split('/')[3]
        log.debug({ sessionId }, 'Handling kill request')
        if (!sessionId) return new Response('Invalid session ID', { status: 400 })
        const success = manager.kill(sessionId)
        log.debug({ sessionId, success }, 'Kill result')
        if (!success) {
          return new Response('Failed to kill session', { status: 400 })
        }
        return secureJsonResponse({ success: true })
      }

      if (url.pathname.match(/^\/api\/sessions\/[^/]+\/output$/) && req.method === 'GET') {
        const sessionId = url.pathname.split('/')[3]
        if (!sessionId) return new Response('Invalid session ID', { status: 400 })

        const result = manager.read(sessionId, 0, DEFAULT_READ_LIMIT)
        if (!result) {
          return new Response('Session not found', { status: 404 })
        }
        return secureJsonResponse({
          lines: result.lines,
          totalLines: result.totalLines,
          offset: result.offset,
          hasMore: result.hasMore,
        })
      }

      return new Response('Not found', { status: 404 })
    },
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
