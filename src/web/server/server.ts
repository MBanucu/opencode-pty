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
  public static readonly wsPath = '/ws'
  public static readonly healthPath = '/health'
  public static readonly apiBasePath = '/api/sessions'
  public static readonly apiSessionPath = '/api/sessions/:id'
  public static readonly apiSessionInputPath = '/api/sessions/:id/input'
  public static readonly apiSessionRawBufferPath = '/api/sessions/:id/buffer/raw'
  public static readonly apiSessionPlainBufferPath = '/api/sessions/:id/buffer/plain'
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
        [PTYServer.wsPath]: (req: Request) => handleUpgrade(this.server, req),
        [PTYServer.healthPath]: () => handleHealth(this.server),
        [PTYServer.apiBasePath]: {
          GET: getSessions,
          POST: createSession,
          DELETE: clearSessions,
        },
        [PTYServer.apiSessionPath]: {
          GET: getSession,
          DELETE: killSession,
        },
        [PTYServer.apiSessionInputPath]: {
          POST: sendInput,
        },
        [PTYServer.apiSessionRawBufferPath]: {
          GET: getRawBuffer,
        },
        [PTYServer.apiSessionPlainBufferPath]: {
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
    return `${this.server.url.origin.replace(/^http/, "ws")}${PTYServer.wsPath}`
  }
}
