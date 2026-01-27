import { Router } from './router.ts'
import { handleRoot } from '../handlers/static.ts'
import { handleHealth } from '../handlers/api.ts'
import type { ServerWebSocket } from 'bun'
import type { WSClient } from '../types.ts'

/**
 * Create and configure the router with all routes
 */
export function createRouter(wsClients: Map<ServerWebSocket<WSClient>, WSClient>): Router {
  const router = new Router()

  // Simple routes
  router.get('/', handleRoot)
  router.get('/health', async (_url, _req, _ctx) => {
    return handleHealth(wsClients.size)
  })

  // Session API routes will be added in Phase 2
  // Static asset handling will be added in Phase 2

  return router
}

/**
 * Export router instance creator
 */
export { createRouter as router }
