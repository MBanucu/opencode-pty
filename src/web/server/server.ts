import type { Server } from 'bun'
import { handleHealth } from './handlers/health.ts'
import {
  getSessions,
  createSession,
  clearSessions,
  getSession,
  sendInput,
  killSession,
  getRawBuffer,
  getPlainBuffer,
} from './handlers/sessions.ts'

import { buildStaticRoutes } from './handlers/static.ts'
import { handleUpgrade } from './handlers/upgrade.ts'
import { handleWebSocketMessage } from './handlers/websocket.ts'
import { CallbackManager } from './CallbackManager.ts'

export class PTYServer implements Disposable {
  public readonly server: Server<any>
  private readonly staticRoutes: Record<string, Response>
  private static readonly wsEndpoint = '/ws'
  private readonly stack = new DisposableStack()

  private constructor(staticRoutes: Record<string, Response>) {
    this.staticRoutes = staticRoutes
    this.server = this.startWebServer()
    this.stack.use(this.server)
    this.stack.use(new CallbackManager(this.server))
  }

  [Symbol.dispose]() {
    this.stack.dispose()
  }

  public static async createServer(): Promise<PTYServer> {
    const staticRoutes = await buildStaticRoutes()

    return new PTYServer(staticRoutes)
  }

  private startWebServer(): Server<any> {
    return Bun.serve({
      port: 0,

      routes: {
        ...this.staticRoutes,
        [PTYServer.wsEndpoint]: (req: Request) => handleUpgrade(this.server, req),
        '/health': () => handleHealth(this.server),
        '/api/sessions': {
          GET: getSessions,
          POST: createSession,
          DELETE: clearSessions,
        },
        '/api/sessions/:id': {
          GET: getSession,
          DELETE: killSession,
        },
        '/api/sessions/:id/input': {
          POST: sendInput,
        },
        '/api/sessions/:id/buffer/raw': {
          GET: getRawBuffer,
        },
        '/api/sessions/:id/buffer/plain': {
          GET: getPlainBuffer,
        },
      },

      websocket: {
        perMessageDeflate: true,
        open: ws => ws.subscribe('sessions:update'),
        message: handleWebSocketMessage,
        close: (ws) => {
          ws.subscriptions.forEach(topic => {
            ws.unsubscribe(topic)
          })
        }
      },

      fetch: () => new Response(null, { status: 302, headers: { Location: '/index.html' } }),
    })
  }

  public getWsUrl(): string {
    return `${this.server.url.origin.replace(/^http/, "ws")}${PTYServer.wsEndpoint}`
  }
}
