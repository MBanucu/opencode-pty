// Type-safe URL builder using constants and manual parameter validation
// Provides compile-time type checking for route parameters

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

// Import route templates from shared constants
import {
  wsPath,
  healthPath,
  apiBasePath,
  apiSessionPath,
  apiSessionCleanupPath,
  apiSessionInputPath,
  apiSessionRawBufferPath,
  apiSessionPlainBufferPath,
} from './routes'

export class RouteBuilder {
  // WebSocket routes
  static websocket(): string {
    return wsPath
  }

  // Health check routes
  static health(): string {
    return healthPath
  }

  // Session collection routes
  static sessions = {
    list: (): string => apiBasePath,
    create: (): string => apiBasePath,
    clear: (): string => apiBasePath,
  }

  // Individual session routes with type-safe parameter building
  static session = {
    get: (params: { id: string | number }): string => buildUrl(apiSessionPath, params),

    kill: (params: { id: string | number }): string => buildUrl(apiSessionPath, params),

    cleanup: (params: { id: string | number }): string => buildUrl(apiSessionCleanupPath, params),

    input: (params: { id: string | number }): string => buildUrl(apiSessionInputPath, params),

    rawBuffer: (params: { id: string | number }): string =>
      buildUrl(apiSessionRawBufferPath, params),

    plainBuffer: (params: { id: string | number }): string =>
      buildUrl(apiSessionPlainBufferPath, params),
  }
}
