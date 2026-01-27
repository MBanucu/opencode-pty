import type { ServerWebSocket } from 'bun'
import type { WSClient } from '../types.ts'

export interface RouteContext {
  params: Record<string, string>
  query: Record<string, string>
  wsClients?: Map<ServerWebSocket<WSClient>, WSClient>
}

export interface RouteHandler {
  (url: URL, req: Request, ctx: RouteContext): Promise<Response> | Response
}

export interface Middleware {
  (url: URL, req: Request, ctx: RouteContext, next: () => Promise<Response>): Promise<Response>
}

export interface Route {
  method: string
  path: string
  handler: RouteHandler
  middleware?: Middleware[]
}

export class Router {
  private routes: Route[] = []
  private globalMiddleware: Middleware[] = []

  /**
   * Add a route to the router
   */
  add(method: string, path: string, handler: RouteHandler, middleware: Middleware[] = []): void {
    this.routes.push({ method: method.toUpperCase(), path, handler, middleware })
  }

  /**
   * Add GET route
   */
  get(path: string, handler: RouteHandler, middleware: Middleware[] = []): void {
    this.add('GET', path, handler, middleware)
  }

  /**
   * Add POST route
   */
  post(path: string, handler: RouteHandler, middleware: Middleware[] = []): void {
    this.add('POST', path, handler, middleware)
  }

  /**
   * Add PUT route
   */
  put(path: string, handler: RouteHandler, middleware: Middleware[] = []): void {
    this.add('PUT', path, handler, middleware)
  }

  /**
   * Add DELETE route
   */
  delete(path: string, handler: RouteHandler, middleware: Middleware[] = []): void {
    this.add('DELETE', path, handler, middleware)
  }

  /**
   * Add global middleware that runs for all routes
   */
  use(middleware: Middleware): void {
    this.globalMiddleware.push(middleware)
  }

  /**
   * Convert path pattern to regex and extract parameter names
   */
  private pathToRegex(path: string): { regex: RegExp; paramNames: string[] } {
    const paramNames: string[] = []
    const regexPattern = path
      .replace(/:[^/]+/g, (match) => {
        const paramName = match.slice(1)
        paramNames.push(paramName)
        return '([^/]+)'
      })
      .replace(/\*/g, '(.*)')

    return {
      regex: new RegExp(`^${regexPattern}$`),
      paramNames,
    }
  }

  /**
   * Extract parameters from URL path
   */
  private extractParams(path: string, routePath: string): Record<string, string> {
    const { regex, paramNames } = this.pathToRegex(routePath)
    const match = path.match(regex)

    if (!match) {
      return {}
    }

    const params: Record<string, string> = {}
    paramNames.forEach((name, index) => {
      params[name] = match[index + 1] || ''
    })

    return params
  }

  /**
   * Parse query parameters from URL
   */
  private parseQuery(url: URL): Record<string, string> {
    const query: Record<string, string> = {}
    url.searchParams.forEach((value, key) => {
      query[key] = value
    })
    return query
  }

  /**
   * Find matching route for the request
   */
  private findRoute(
    method: string,
    pathname: string
  ): { route: Route; params: Record<string, string> } | null {
    for (const route of this.routes) {
      if (route.method === method.toUpperCase()) {
        const params = this.extractParams(pathname, route.path)
        if (Object.keys(params).length > 0 || pathname === route.path) {
          return { route, params }
        }
      }
    }
    return null
  }

  /**
   * Handle a request and return the appropriate response
   */
  async handle(req: Request, additionalContext: Partial<RouteContext> = {}): Promise<Response> {
    const url = new URL(req.url)
    const method = req.method
    const pathname = url.pathname

    // Find matching route
    const match = this.findRoute(method, pathname)
    if (!match) {
      return new Response('Not Found', { status: 404 })
    }

    const { route, params } = match
    const query = this.parseQuery(url)

    // Build context
    const ctx: RouteContext = {
      params,
      query,
      ...additionalContext,
    }

    // Execute middleware chain and handler
    const allMiddleware = [...this.globalMiddleware, ...(route.middleware ?? [])]

    let index = 0
    const next = async (): Promise<Response> => {
      if (index < allMiddleware.length) {
        const middleware = allMiddleware[index++]
        if (middleware) {
          return await middleware(url, req, ctx, next)
        }
      }
      const result = await route.handler(url, req, ctx)
      return result instanceof Response ? result : new Response('Internal Error', { status: 500 })
    }

    try {
      return await next()
    } catch (error) {
      // Handle errors in the middleware chain
      console.error('Router error:', error)
      return new Response('Internal Server Error', { status: 500 })
    }
  }

  /**
   * Get all registered routes (for debugging)
   */
  getRoutes(): Route[] {
    return [...this.routes]
  }

  /**
   * Clear all routes (for testing)
   */
  clear(): void {
    this.routes = []
    this.globalMiddleware = []
  }
}
