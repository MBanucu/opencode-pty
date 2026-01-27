import type { Middleware } from './router.ts'

/**
 * Security headers middleware
 */
export const securityHeaders: Middleware = async (_url, _req, _ctx, next) => {
  const response = await next()

  // Add security headers to the response
  const headers = new Headers(response.headers)
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('X-Frame-Options', 'DENY')
  headers.set('X-XSS-Protection', '1; mode=block')
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
  )

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

/**
 * Request logging middleware
 */
export const requestLogger: Middleware = async (url, req, _ctx, next) => {
  const start = Date.now()
  console.log(`${req.method} ${url.pathname} - ${new Date().toISOString()}`)

  const response = await next()

  const duration = Date.now() - start
  console.log(`${req.method} ${url.pathname} - ${response.status} (${duration}ms)`)

  return response
}

/**
 * CORS middleware
 */
export const cors = (
  options: {
    origins?: string[]
    methods?: string[]
    headers?: string[]
    credentials?: boolean
  } = {}
): Middleware => {
  const {
    origins = ['*'],
    methods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    headers = ['Content-Type', 'Authorization'],
    credentials = false,
  } = options

  return async (_url, req, _ctx, next) => {
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      const response = new Response(null, { status: 200 })

      // Add CORS headers
      if (origins.includes('*')) {
        response.headers.set('Access-Control-Allow-Origin', '*')
      } else {
        const origin = req.headers.get('origin')
        if (origin && origins.includes(origin)) {
          response.headers.set('Access-Control-Allow-Origin', origin)
        }
      }

      response.headers.set('Access-Control-Allow-Methods', methods.join(', '))
      response.headers.set('Access-Control-Allow-Headers', headers.join(', '))
      if (credentials) {
        response.headers.set('Access-Control-Allow-Credentials', 'true')
      }

      return response
    }

    const response = await next()

    // Add CORS headers to the actual response
    const responseWithCors = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    })

    if (origins.includes('*')) {
      responseWithCors.headers.set('Access-Control-Allow-Origin', '*')
    } else {
      const origin = req.headers.get('origin')
      if (origin && origins.includes(origin)) {
        responseWithCors.headers.set('Access-Control-Allow-Origin', origin)
      }
    }

    responseWithCors.headers.set('Access-Control-Allow-Methods', methods.join(', '))
    responseWithCors.headers.set('Access-Control-Allow-Headers', headers.join(', '))
    if (credentials) {
      responseWithCors.headers.set('Access-Control-Allow-Credentials', 'true')
    }

    return responseWithCors
  }
}

/**
 * JSON response helper (used by handlers)
 */
export class JsonResponse extends Response {
  constructor(data: any, status = 200, headers: Record<string, string> = {}) {
    super(JSON.stringify(data), {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    })
  }
}

/**
 * Error response helper
 */
export class ErrorResponse extends Response {
  constructor(message: string, status = 500, headers: Record<string, string> = {}) {
    super(JSON.stringify({ error: message }), {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    })
  }
}

/**
 * Rate limiting middleware (simple in-memory)
 */
export const rateLimit = (
  options: {
    windowMs?: number
    max?: number
    keyGenerator?: (req: Request) => string
  } = {}
): Middleware => {
  const {
    windowMs = 60 * 1000, // 1 minute
    max = 100, // 100 requests per window
    keyGenerator = (req) =>
      req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
  } = options

  const requests = new Map<string, { count: number; resetTime: number }>()

  return async (_url, req, _ctx, next) => {
    const key = keyGenerator(req)
    const now = Date.now()
    const record = requests.get(key)

    if (!record || now > record.resetTime) {
      requests.set(key, { count: 1, resetTime: now + windowMs })
      return await next()
    }

    if (record.count >= max) {
      return new ErrorResponse('Too Many Requests', 429, {
        'Retry-After': Math.ceil((record.resetTime - now) / 1000).toString(),
      })
    }

    record.count++
    return await next()
  }
}
