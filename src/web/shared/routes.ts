// Shared route path constants used by both server and client
// These define the URL patterns for the web API

export const wsPath = '/ws'
export const healthPath = '/health'
export const apiBasePath = '/api/sessions'
export const apiSessionPath = '/api/sessions/:id'
export const apiSessionCleanupPath = '/api/sessions/:id/cleanup'
export const apiSessionInputPath = '/api/sessions/:id/input'
export const apiSessionRawBufferPath = '/api/sessions/:id/buffer/raw'
export const apiSessionPlainBufferPath = '/api/sessions/:id/buffer/plain'
