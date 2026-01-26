import { join, resolve, dirname, isAbsolute } from 'node:path'
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

function get404Response(debugInfo?: Record<string, unknown>): Response {
  let body: string
  if (debugInfo) {
    body = `<!DOCTYPE html><html><head><title>404 Not Found</title></head><body><h1>404: Not Found</h1><pre>${escapeHtml(
      JSON.stringify(debugInfo, null, 2)
    )}</pre></body></html>`
  } else {
    body =
      '<!DOCTYPE html><html><head><title>404 Not Found</title></head><body><h1>404: Not Found</h1></body></html>'
  }
  return new Response(body, {
    status: 404,
    headers: { 'Content-Type': 'text/html', ...SECURITY_HEADERS },
  })
}

// Very basic HTML escape
function escapeHtml(raw: string): string {
  return raw.replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[ch] || ch)
}

export async function handleRoot(htmlPathOverride?: string): Promise<Response> {
  let htmlPath = htmlPathOverride || process.env.HTML_PATH
  if (!htmlPath) {
    const env = process.env.NODE_ENV || 'development'
    if (env === 'production' || env === 'test') {
      // Prefer built assets in prod/test, but fall back to source HTML for
      // local dev installs or when dist isn't packaged.
      const distPath = resolve(PROJECT_ROOT, 'dist/web/index.html')
      const distFile = Bun.file(distPath)
      htmlPath = (await distFile.exists()) ? 'dist/web/index.html' : 'src/web/index.html'
    } else {
      htmlPath = 'src/web/index.html'
    }
  }
  const finalPath = isAbsolute(htmlPath) ? htmlPath : resolve(PROJECT_ROOT, htmlPath)
  if (process.env.NODE_ENV !== 'production') {
    console.log('[handleRoot] Serving:', finalPath)
  }
  const file = Bun.file(finalPath)
  if (await file.exists()) {
    return new Response(await file.arrayBuffer(), {
      headers: { 'Content-Type': 'text/html', ...SECURITY_HEADERS },
    })
  }
  // Add extra debug info upon 404
  return get404Response({
    'process.cwd()': process.cwd(),
    'import.meta.dir (__dirname)': __dirname,
    'Bun.env.HTML_PATH': Bun.env.HTML_PATH,
    'Bun.env.NODE_ENV': Bun.env.NODE_ENV,
    PROJECT_ROOT: PROJECT_ROOT,
    __dirname: __dirname,
    htmlPathOverride,
    htmlPath,
    finalPath,
  })
}

export async function handleStaticAssets(url: URL): Promise<Response | null> {
  const pathname = url.pathname
  // ----- /assets/ handling with traversal check -----
  if (pathname.startsWith('/assets/')) {
    const relativePath = pathname.slice('/assets/'.length)
    if (!relativePath || relativePath.includes('..') || relativePath.startsWith('/')) {
      // Deny traversal or malformed asset paths explicitly
      return get404Response({
        'process.cwd()': process.cwd(),
        'import.meta.dir (__dirname)': __dirname,
        'Bun.env.HTML_PATH': Bun.env.HTML_PATH,
        'Bun.env.NODE_ENV': Bun.env.NODE_ENV,
        PROJECT_ROOT: PROJECT_ROOT,
        __dirname: __dirname,
        url: url.pathname,
        filePath: undefined,
      })
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
      return get404Response({
        'process.cwd()': process.cwd(),
        'import.meta.dir (__dirname)': __dirname,
        'Bun.env.HTML_PATH': Bun.env.HTML_PATH,
        'Bun.env.NODE_ENV': Bun.env.NODE_ENV,
        PROJECT_ROOT: PROJECT_ROOT,
        __dirname: __dirname,
        url: url.pathname,
        relativePath,
        filePath,
      })
    }
  }

  // ----- Dev/test source files -----
  if (process.env.NODE_ENV === 'test' && /\.[jt]sx?$/.test(pathname)) {
    const relativeTsPath = pathname.startsWith('/') ? pathname.slice(1) : pathname
    const filePath = join(PROJECT_ROOT, 'src/web', relativeTsPath)
    const file = Bun.file(filePath)
    if (await file.exists()) {
      return new Response(await file.arrayBuffer(), {
        headers: {
          'Content-Type': 'application/javascript; charset=utf-8',
          'Cache-Control': 'no-cache',
          ...SECURITY_HEADERS,
        },
      })
    } else {
      return get404Response({
        'process.cwd()': process.cwd(),
        'import.meta.dir (__dirname)': __dirname,
        'Bun.env.HTML_PATH': Bun.env.HTML_PATH,
        'Bun.env.NODE_ENV': Bun.env.NODE_ENV,
        PROJECT_ROOT: PROJECT_ROOT,
        __dirname: __dirname,
        url: url.pathname,
        relativeTsPath,
        filePath,
      })
    }
  }
  // For any other unhandled paths, return 404 with minimal info
  if (url.pathname.startsWith('/api/')) return null
  return get404Response({
    'process.cwd()': process.cwd(),
    'import.meta.dir (__dirname)': __dirname,
    'Bun.env.NODE_ENV': Bun.env.NODE_ENV,
    PROJECT_ROOT: PROJECT_ROOT,
    url: url.pathname,
    note: 'No asset/source-file handler matched',
  })
}
