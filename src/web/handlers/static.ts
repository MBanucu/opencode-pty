import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ASSET_CONTENT_TYPES } from '../constants.ts'

// ----- MODULE-SCOPE CONSTANTS -----
const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '../../..')

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';",
} as const

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

export async function handleRoot(): Promise<Response> {
  // Always serve the built index.html
  const htmlPath = 'dist/web/index.html'
  const finalPath = resolve(PROJECT_ROOT, htmlPath)
  const file = Bun.file(finalPath)
  if (await file.exists()) {
    return new Response(await file.arrayBuffer(), {
      headers: { 'Content-Type': 'text/html', ...SECURITY_HEADERS },
    })
  }
  // Add extra debug info upon 404
  return get404Response({
    htmlPath,
    finalPath,
  })
}

export async function handleStaticAssets(url: URL): Promise<Response | null> {
  const pathname = url.pathname
  if (pathname.startsWith('/assets/')) {
    const relativePath = pathname.slice('/assets/'.length)
    if (!relativePath || relativePath.includes('..') || relativePath.startsWith('/')) {
      return get404Response({ url: pathname, note: 'Invalid asset path' })
    }
    const filePath = join(PROJECT_ROOT, 'dist/web/assets', relativePath)
    const file = Bun.file(filePath)
    if (await file.exists()) {
      const ct =
        file.type ||
        ASSET_CONTENT_TYPES[`.${filePath.split('.').pop()}`] ||
        'application/octet-stream'
      return new Response(await file.arrayBuffer(), {
        headers: {
          'Content-Type': ct,
          'Cache-Control': 'public, max-age=31536000, immutable',
          ...SECURITY_HEADERS,
        },
      })
    } else {
      return get404Response({ url: pathname, filePath, note: 'Asset not found' })
    }
  }
  return null
}
