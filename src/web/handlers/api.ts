import { manager } from '../../plugin/pty/manager.ts'
import { DEFAULT_READ_LIMIT } from '../../shared/constants.ts'
import type { ServerWebSocket } from 'bun'
import type { WSClient } from '../types.ts'

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

function broadcastSessionUpdate(wsClients: Map<ServerWebSocket<WSClient>, WSClient>): void {
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
  const message = { type: 'session_list', sessions: sessionData }
  for (const [ws] of wsClients) {
    ws.send(JSON.stringify(message))
  }
}

export async function handleHealth(wsConnections: number): Promise<Response> {
  const sessions = manager.list()
  const activeSessions = sessions.filter((s) => s.status === 'running').length
  const totalSessions = sessions.length

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

export async function handleAPISessions(
  url: URL,
  req: Request,
  wsClients: Map<ServerWebSocket<WSClient>, WSClient>
): Promise<Response | null> {
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
    broadcastSessionUpdate(wsClients)
    return secureJsonResponse(session)
  }

  if (url.pathname === '/api/sessions/clear' && req.method === 'POST') {
    manager.clearAllSessions()
    // Broadcast updated session list to all clients
    broadcastSessionUpdate(wsClients)
    return secureJsonResponse({ success: true })
  }

  const sessionMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)$/)
  if (sessionMatch) {
    const sessionId = sessionMatch[1]
    if (!sessionId) return new Response('Invalid session ID', { status: 400 })
    const session = manager.get(sessionId)
    if (!session) {
      return new Response('Session not found', { status: 404 })
    }
    return Response.json(session)
  }

  const inputMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/input$/)
  if (inputMatch && req.method === 'POST') {
    const sessionId = inputMatch[1]
    if (!sessionId) return new Response('Invalid session ID', { status: 400 })
    const body = (await req.json()) as { data: string }
    const success = manager.write(sessionId, body.data)
    if (!success) {
      return new Response('Failed to write to session', { status: 400 })
    }
    return secureJsonResponse({ success: true })
  }

  const killMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/kill$/)
  if (killMatch && req.method === 'POST') {
    const sessionId = killMatch[1]
    if (!sessionId) return new Response('Invalid session ID', { status: 400 })
    const success = manager.kill(sessionId)
    if (!success) {
      return new Response('Failed to kill session', { status: 400 })
    }
    return secureJsonResponse({ success: true })
  }

  const outputMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/output$/)
  if (outputMatch && req.method === 'GET') {
    const sessionId = outputMatch[1]
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

  return null
}
