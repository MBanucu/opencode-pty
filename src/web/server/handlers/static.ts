import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'
import { ASSET_CONTENT_TYPES } from '../../shared/constants.ts'

// ----- MODULE-SCOPE CONSTANTS -----
const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(import.meta.dir, '../../../..')
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';",
} as const
const STATIC_DIR = join(PROJECT_ROOT, 'dist/web')

export function get404Response(debugInfo: Record<string, unknown> = {}): Response {
  // Filter out sensitive environment variables
  const safeEnv: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (!/secret|key|password|token|auth/i.test(key)) {
      safeEnv[key] = value
    }
  }

  // Default debug info (includes safe env vars and constants)
  const defaultInfo = {
    ...safeEnv, // Safe environment variables
    PROJECT_ROOT,
    __dirname,
    'import.meta.dir': import.meta.dir,
    'process.cwd()': process.cwd(),
    'process.platform': process.platform,
    'process.version': process.version,
  }

  // Merge passed debugInfo (overrides defaults)
  const fullDebugInfo = { ...defaultInfo, ...debugInfo }

  const body = `<!DOCTYPE html><html><head><title>404 Not Found</title></head><body><h1>404: Not Found</h1><pre>${escapeHtml(
    JSON.stringify(fullDebugInfo, null, 2)
  )}</pre></body></html>`

  return new Response(body, {
    status: 404,
    headers: { 'Content-Type': 'text/html', ...SECURITY_HEADERS },
  })
}

// Very basic HTML escape
function escapeHtml(raw: string): string {
  return raw.replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[ch] || ch)
}

export async function buildStaticRoutes(): Promise<Record<string, Response>> {
  const routes: Record<string, Response> = {}
  const files = readdirSync(STATIC_DIR, { recursive: true })
  for (const file of files) {
    if (typeof file === 'string' && !statSync(join(STATIC_DIR, file)).isDirectory()) {
      const ext = extname(file)
      const routeKey = `/${file.replace(/\\/g, '/')}` // e.g., /assets/js/bundle.js
      const fullPath = join(STATIC_DIR, file)
      const fileObj = Bun.file(fullPath)
      const contentType = fileObj.type || ASSET_CONTENT_TYPES[ext] || 'application/octet-stream'

      // Buffer all files in memory
      routes[routeKey] = new Response(await fileObj.bytes(), {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, immutable',
          ...SECURITY_HEADERS,
        },
      })
    }
  }
  return routes
}
