// Type-safe URL builder using constants and manual parameter validation
// Provides compile-time type checking for route parameters

// Import route templates from shared constants
import { routes } from './routes'

// Simple URL builder that validates parameters are present
function buildUrl(template: string, params: Record<string, string | number>): string {
  let result = template
  const requiredParams = template.match(/:(\w+)/g)?.map((p) => p.slice(1)) || []

  for (const param of requiredParams) {
    if (!(param in params)) {
      throw new Error(`Missing required parameter '${param}' for route '${template}'`)
    }
    result = result.replace(`:${param}`, String(params[param]))
  }

  return result
}

// WebSocket routes
export function websocket(): string {
  return routes.websocket.path
}

// Health check routes
export function health(): string {
  return routes.health.path
}

// Session collection routes
export const sessions = {
  list: (): string => routes.sessions.path,
  create: (): string => routes.sessions.path,
  clear: (): string => routes.sessions.path,
}

// Individual session routes with type-safe parameter building
export const session = {
  get: (params: { id: string | number }): string => buildUrl(routes.session.path, params),

  kill: (params: { id: string | number }): string => buildUrl(routes.session.path, params),

  cleanup: (params: { id: string | number }): string =>
    buildUrl(routes.session.cleanup.path, params),

  input: (params: { id: string | number }): string => buildUrl(routes.session.input.path, params),

  rawBuffer: (params: { id: string | number }): string =>
    buildUrl(routes.session.buffer.raw.path, params),

  plainBuffer: (params: { id: string | number }): string =>
    buildUrl(routes.session.buffer.plain.path, params),
}
