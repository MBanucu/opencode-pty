import { join, resolve } from 'path'
import { ASSET_CONTENT_TYPES } from '../constants.ts'

// Security headers for all responses
function getSecurityHeaders(): Record<string, string> {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy':
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';",
  }
}

export async function handleRoot(): Promise<Response> {
  // In test mode, serve built HTML from dist/web, otherwise serve source
  // const htmlPath =
  //   process.env.NODE_ENV === 'test'
  //     ? resolve(PROJECT_ROOT, 'dist/web/index.html')
  //     : resolve(PROJECT_ROOT, 'src/web/index.html')
  const htmlPath = 'dist/web/index.html'
  return new Response(await Bun.file(htmlPath).bytes(), {
    headers: { 'Content-Type': 'text/html', ...getSecurityHeaders() },
  })
}

export async function handleStaticAssets(url: URL): Promise<Response | null> {
  // Serve static assets
  if (url.pathname.startsWith('/assets/')) {
    // Always serve assets from dist/web in both test and production
    const baseDir = 'dist/web'
    const assetDir = resolve(process.cwd(), baseDir)
    const assetPath = url.pathname.slice(1) // remove leading /
    const filePath = join(assetDir, assetPath)
    const file = Bun.file(filePath)
    const exists = await file.exists()
    if (exists) {
      const ext = url.pathname.split('.').pop() || ''
      const contentType = ASSET_CONTENT_TYPES[`.${ext}`] || 'text/plain'
      return new Response(await file.bytes(), {
        headers: { 'Content-Type': contentType, ...getSecurityHeaders() },
      })
    }
  }

  // Serve TypeScript files in test mode
  if (
    process.env.NODE_ENV === 'test' &&
    (url.pathname.endsWith('.tsx') ||
      url.pathname.endsWith('.ts') ||
      url.pathname.endsWith('.jsx') ||
      url.pathname.endsWith('.js'))
  ) {
    const filePath = join(process.cwd(), 'src/web', url.pathname)
    const file = Bun.file(filePath)
    const exists = await file.exists()
    if (exists) {
      return new Response(await file.bytes(), {
        headers: { 'Content-Type': 'application/javascript', ...getSecurityHeaders() },
      })
    }
  }

  return null
}
