import type { Server, ServerWebSocket } from 'bun'
import { manager, onOutput, setOnSessionUpdate } from '../plugin/pty/manager.ts'
import { createLogger } from '../plugin/logger.ts'
import type { WSMessage, WSClient, ServerConfig } from './types.ts'

const log = createLogger('web-server')

let server: Server<WSClient> | null = null
const wsClients: Map<ServerWebSocket<WSClient>, WSClient> = new Map()

const defaultConfig: ServerConfig = {
  port: 8765,
  hostname: 'localhost',
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

function broadcastSessionData(sessionId: string, data: string[]): void {
  log.info('broadcastSessionData called', { sessionId, dataLength: data.length })
  const message: WSMessage = { type: 'data', sessionId, data }
  const messageStr = JSON.stringify(message)
  log.info('Broadcasting session data', { clientCount: wsClients.size })

  let sentCount = 0
  for (const [ws, client] of wsClients) {
    if (client.subscribedSessions.has(sessionId)) {
      log.debug('Sending to subscribed client')
      try {
        ws.send(messageStr)
        sentCount++
      } catch (err) {
        log.error('Failed to send to client', { error: String(err) })
      }
    }
  }
  log.info('Broadcast complete', { sentCount })
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
          const success = subscribeToSession(wsClient, message.sessionId)
          if (!success) {
            ws.send(
              JSON.stringify({ type: 'error', error: `Session ${message.sessionId} not found` })
            )
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
    log.error('failed to handle ws message', { error: String(err) })
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

  if (server) {
    log.warn('web server already running')
    return `http://${server.hostname}:${server.port}`
  }

  onOutput((sessionId, data) => {
    log.info('PTY output received', { sessionId, dataLength: data.length })
    broadcastSessionData(sessionId, data)
  })

  server = Bun.serve({
    hostname: finalConfig.hostname,
    port: finalConfig.port,

    websocket: wsHandler,

    async fetch(req, server) {
      const url = new URL(req.url)

      // Handle WebSocket upgrade
      if (req.headers.get('upgrade') === 'websocket') {
        const success = server.upgrade(req, {
          data: { socket: null as any, subscribedSessions: new Set() },
        })
        if (success) return // Upgrade succeeded, no response needed
        return new Response('WebSocket upgrade failed', { status: 400 })
      }

      if (url.pathname === '/') {
        // In test mode, serve the built HTML with assets
        if (process.env.NODE_ENV === 'test') {
          return new Response(await Bun.file('./dist/web/index.html').bytes(), {
            headers: { 'Content-Type': 'text/html' },
          })
        }
        return new Response(await Bun.file('./src/web/index.html').bytes(), {
          headers: { 'Content-Type': 'text/html' },
        })
      }

      // Serve static assets from dist/web for test mode
      if (process.env.NODE_ENV === 'test' && url.pathname.startsWith('/assets/')) {
        try {
          const filePath = `./dist/web${url.pathname}`
          const file = Bun.file(filePath)
          if (await file.exists()) {
            const contentType = url.pathname.endsWith('.js')
              ? 'application/javascript'
              : url.pathname.endsWith('.css')
                ? 'text/css'
                : 'text/plain'
            return new Response(await file.bytes(), {
              headers: { 'Content-Type': contentType },
            })
          }
        } catch (err) {
          // File not found, continue to 404
        }
      }

      if (url.pathname === '/api/sessions' && req.method === 'GET') {
        const sessions = manager.list()
        return Response.json(sessions)
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
        return Response.json(session)
      }

      if (url.pathname === '/api/sessions/clear' && req.method === 'POST') {
        manager.clearAllSessions()
        // Broadcast updated session list to all clients
        for (const [ws] of wsClients) {
          sendSessionList(ws)
        }
        return Response.json({ success: true })
      }

      if (url.pathname.match(/^\/api\/sessions\/[^/]+$/) && req.method === 'GET') {
        const sessionId = url.pathname.split('/')[3]
        if (!sessionId) return new Response('Invalid session ID', { status: 400 })
        const session = manager.get(sessionId)
        if (!session) {
          return new Response('Session not found', { status: 404 })
        }
        return Response.json(session)
      }

      if (url.pathname.match(/^\/api\/sessions\/[^/]+\/input$/) && req.method === 'POST') {
        const sessionId = url.pathname.split('/')[3]
        if (!sessionId) return new Response('Invalid session ID', { status: 400 })
        const body = (await req.json()) as { data: string }
        const success = manager.write(sessionId, body.data)
        if (!success) {
          return new Response('Failed to write to session', { status: 400 })
        }
        return Response.json({ success: true })
      }

      if (url.pathname.match(/^\/api\/sessions\/[^/]+\/kill$/) && req.method === 'POST') {
        const sessionId = url.pathname.split('/')[3]
        if (!sessionId) return new Response('Invalid session ID', { status: 400 })
        const success = manager.kill(sessionId)
        if (!success) {
          return new Response('Failed to kill session', { status: 400 })
        }
        return Response.json({ success: true })
      }

      if (url.pathname.match(/^\/api\/sessions\/[^/]+\/output$/) && req.method === 'GET') {
        const sessionId = url.pathname.split('/')[3]
        if (!sessionId) return new Response('Invalid session ID', { status: 400 })
        const result = manager.read(sessionId, 0, 100)
        if (!result) {
          return new Response('Session not found', { status: 404 })
        }
        return Response.json({
          lines: result.lines,
          totalLines: result.totalLines,
          hasMore: result.hasMore,
        })
      }

      return new Response('Not found', { status: 404 })
    },
  })

  log.info('web server started', { url: `http://${finalConfig.hostname}:${finalConfig.port}` })
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
