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
  cleanupSession,
} from './handlers/sessions.ts'

import { buildStaticRoutes } from './handlers/static.ts'
import { handleUpgrade } from './handlers/upgrade.ts'
import { handleWebSocketMessage } from './handlers/websocket.ts'
import { CallbackManager } from './CallbackManager.ts'

export const wsPath = '/ws'
export const healthPath = '/health'
export const apiBasePath = '/api/sessions'
export const apiSessionPath = '/api/sessions/:id'
export const apiSessionCleanupPath = '/api/sessions/:id/cleanup'
export const apiSessionInputPath = '/api/sessions/:id/input'
export const apiSessionRawBufferPath = '/api/sessions/:id/buffer/raw'
export const apiSessionPlainBufferPath = '/api/sessions/:id/buffer/plain'

export class PTYServer implements Disposable {
  public readonly server: Server<any>
  private readonly staticRoutes: Record<string, Response>
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
        [wsPath]: (req: Request) => handleUpgrade(this.server, req),
        [healthPath]: () => handleHealth(this.server),
        [apiBasePath]: {
          GET: getSessions,
          POST: createSession,
          DELETE: clearSessions,
        },
        [apiSessionPath]: {
          GET: getSession,
          DELETE: killSession,
        },
        [apiSessionCleanupPath]: {
          DELETE: cleanupSession,
        },
        [apiSessionInputPath]: {
          POST: sendInput,
        },
        [apiSessionRawBufferPath]: {
          GET: getRawBuffer,
        },
        [apiSessionPlainBufferPath]: {
          GET: getPlainBuffer,
        },
      },

      websocket: {
        perMessageDeflate: true,
        open: (ws) => ws.subscribe('sessions:update'),
        message: handleWebSocketMessage,
        close: (ws) => {
          ws.subscriptions.forEach((topic) => {
            ws.unsubscribe(topic)
          })
        },
      },

      fetch: () => new Response(null, { status: 302, headers: { Location: '/index.html' } }),
    })
  }

  public getWsUrl(): string {
    return `${this.server.url.origin.replace(/^http/, 'ws')}${wsPath}`
  }
}
