import { Router } from './router.ts'
import { securityHeaders } from './middleware.ts'
import { handleRoot } from '../handlers/static.ts'
import { handleHealth } from '../handlers/health.ts'
import {
  getSessions,
  createSession,
  clearSessions,
  getSession,
  sendInput,
  killSession,
  getRawBuffer,
  getPlainBuffer,
} from '../handlers/sessions.ts'
import type { ServerWebSocket } from 'bun'
import type { WSClient } from '../types.ts'

/**
 * Create and configure the router with all routes
 */
export function createRouter(wsClients: Map<ServerWebSocket<WSClient>, WSClient>): Router {
  const router = new Router()

  // Global middleware
  router.use(securityHeaders)

  // Simple routes
  /**
   * GET /
   * Serves the main web UI page
   */
  router.get('/', handleRoot)

  /**
   * GET /health
   * Health check endpoint returning server status and WebSocket client count
   */
  router.get('/health', async (_url, _req, _ctx) => {
    return handleHealth(wsClients.size)
  })

  // Session API routes
  /**
   * GET /api/sessions
   * Retrieves a list of all active PTY sessions
   * Response: JSON array of session objects
   */
  router.get('/api/sessions', getSessions)

  /**
   * POST /api/sessions
   * Creates a new PTY session
   * Body: { command: string, args?: string[], description?: string, workdir?: string }
   * Response: JSON session object
   */
  router.post('/api/sessions', createSession)

  /**
   * POST /api/sessions/clear
   * Terminates and removes all active sessions
   * Response: JSON { success: true }
   */
  router.post('/api/sessions/clear', clearSessions)

  /**
   * GET /api/sessions/:id
   * Retrieves details of a specific session by ID
   * Params: id (session ID)
   * Response: JSON session object or 404 if not found
   */
  router.get('/api/sessions/:id', getSession)

  /**
   * POST /api/sessions/:id/input
   * Sends input data to a specific session
   * Params: id (session ID)
   * Body: { data: string }
   * Response: JSON { success: true }
   */
  router.post('/api/sessions/:id/input', sendInput)

  /**
   * POST /api/sessions/:id/kill
   * Terminates a specific session
   * Params: id (session ID)
   * Response: JSON { success: true }
   */
  router.post('/api/sessions/:id/kill', killSession)

  /**
   * GET /api/sessions/:id/buffer/raw
   * Retrieves the raw terminal buffer for a session (with ANSI codes)
   * Params: id (session ID)
   * Response: JSON { raw: string, ... }
   */
  router.get('/api/sessions/:id/buffer/raw', getRawBuffer)

  /**
   * GET /api/sessions/:id/buffer/plain
   * Retrieves the plain text terminal buffer for a session (ANSI stripped)
   * Params: id (session ID)
   * Response: JSON { plain: string, byteLength: number }
   */
  router.get('/api/sessions/:id/buffer/plain', getPlainBuffer)

  // Static asset handling remains in server.ts for now

  return router
}

/**
 * Export router instance creator
 */
export { createRouter as router }
