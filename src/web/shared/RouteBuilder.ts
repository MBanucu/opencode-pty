// RouteBuilder: Type-safe URL builder for web API routes
// Provides nice function names for building route paths with parameters

export class RouteBuilder {
  // WebSocket routes
  static websocket(): string {
    return '/ws'
  }

  // Health check routes
  static health(): string {
    return '/health'
  }

  // Session collection routes
  static sessions = {
    list: (): string => '/api/sessions',
    create: (): string => '/api/sessions',
    clear: (): string => '/api/sessions',
  }

  // Individual session routes
  static session(id: string) {
    return {
      get: (): string => `/api/sessions/${id}`,
      kill: (): string => `/api/sessions/${id}`,
      cleanup: (): string => `/api/sessions/${id}/cleanup`,
      input: (): string => `/api/sessions/${id}/input`,
      rawBuffer: (): string => `/api/sessions/${id}/buffer/raw`,
      plainBuffer: (): string => `/api/sessions/${id}/buffer/plain`,
    }
  }
}
