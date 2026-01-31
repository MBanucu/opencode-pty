// Structured route definitions with paths, methods, and type information
// Used by both server and client for type-safe API interactions

export const routes = {
  websocket: {
    path: '/ws',
    methods: ['GET'] as const,
  },
  health: {
    path: '/health',
    methods: ['GET'] as const,
  },
  sessions: {
    path: '/api/sessions',
    methods: ['GET', 'POST', 'DELETE'] as const,
  },
  session: {
    path: '/api/sessions/:id',
    methods: ['GET', 'DELETE'] as const,
    input: {
      path: '/api/sessions/:id/input',
      methods: ['POST'] as const,
    },
    cleanup: {
      path: '/api/sessions/:id/cleanup',
      methods: ['DELETE'] as const,
    },
    buffer: {
      raw: {
        path: '/api/sessions/:id/buffer/raw',
        methods: ['GET'] as const,
      },
      plain: {
        path: '/api/sessions/:id/buffer/plain',
        methods: ['GET'] as const,
      },
    },
  },
} as const

// Backward compatibility exports
export const wsPath = routes.websocket.path
export const healthPath = routes.health.path
export const apiBasePath = routes.sessions.path
export const apiSessionPath = routes.session.path
export const apiSessionCleanupPath = routes.session.cleanup.path
export const apiSessionInputPath = routes.session.input.path
export const apiSessionRawBufferPath = routes.session.buffer.raw.path
export const apiSessionPlainBufferPath = routes.session.buffer.plain.path
