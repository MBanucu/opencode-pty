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
  router.get('/', handleRoot)
  router.get('/health', async (_url, _req, _ctx) => {
    return handleHealth(wsClients.size)
  })

  // Session API routes
  router.get('/api/sessions', getSessions)
  router.post('/api/sessions', createSession)
  router.post('/api/sessions/clear', clearSessions)
  router.get('/api/sessions/:id', getSession)
  router.post('/api/sessions/:id/input', sendInput)
  router.post('/api/sessions/:id/kill', killSession)
  router.get('/api/sessions/:id/buffer/raw', getRawBuffer)
  router.get('/api/sessions/:id/buffer/plain', getPlainBuffer)

  // Static asset handling remains in server.ts for now

  return router
}

/**
 * Export router instance creator
 */
export { createRouter as router }
