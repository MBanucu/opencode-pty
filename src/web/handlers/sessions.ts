/* eslint-disable no-undef */
import { manager } from '../../plugin/pty/manager.ts'
import type { ServerWebSocket } from 'bun'
import type { WSClient, RouteContext } from '../types.ts'
import { JsonResponse } from '../router/middleware.ts'

function broadcastSessionUpdate(wsClients: Map<ServerWebSocket<WSClient>, WSClient>): void {
  const sessions = manager.list()
  const sessionData = sessions.map((s) => ({
    id: s.id,
    title: s.title,
    description: s.description,
    command: s.command,
    status: s.status,
    exitCode: s.exitCode,
    pid: s.pid,
    lineCount: s.lineCount,
    createdAt: s.createdAt.toISOString(),
  }))
  const message = { type: 'session_list', sessions: sessionData }
  for (const [ws] of wsClients) {
    ws.send(JSON.stringify(message))
  }
}

export async function getSessions(_url: URL, _req: Request, _ctx: RouteContext): Promise<Response> {
  const sessions = manager.list()
  return new JsonResponse(sessions)
}

export async function createSession(_url: URL, req: Request, ctx: RouteContext): Promise<Response> {
  const body = (await req.json()) as {
    command: string
    args?: string[]
    description?: string
    workdir?: string
  }
  const session = manager.spawn({
    command: body.command,
    args: body.args || [],
    title: body.description,
    description: body.description,
    workdir: body.workdir,
    parentSessionId: 'web-api',
  })
  // Broadcast updated session list to all clients
  broadcastSessionUpdate(ctx.wsClients!)
  return new JsonResponse(session)
}

export async function clearSessions(
  _url: URL,
  _req: Request,
  ctx: RouteContext
): Promise<Response> {
  manager.clearAllSessions()
  // Broadcast updated session list to all clients
  broadcastSessionUpdate(ctx.wsClients!)
  return new JsonResponse({ success: true })
}

export async function getSession(_url: URL, _req: Request, ctx: RouteContext): Promise<Response> {
  const sessionId = ctx.params.id
  if (!sessionId) return new Response('Invalid session ID', { status: 400 })
  const session = manager.get(sessionId)
  if (!session) {
    return new Response('Session not found', { status: 404 })
  }
  return new JsonResponse(session)
}

export async function sendInput(_url: URL, req: Request, ctx: RouteContext): Promise<Response> {
  const sessionId = ctx.params.id
  if (!sessionId) return new Response('Invalid session ID', { status: 400 })
  const body = (await req.json()) as { data: string }
  const success = manager.write(sessionId, body.data)
  if (!success) {
    return new Response('Failed to write to session', { status: 400 })
  }
  return new JsonResponse({ success: true })
}

export async function killSession(_url: URL, _req: Request, ctx: RouteContext): Promise<Response> {
  const sessionId = ctx.params.id
  if (!sessionId) return new Response('Invalid session ID', { status: 400 })
  const success = manager.kill(sessionId)
  if (!success) {
    return new Response('Failed to kill session', { status: 400 })
  }
  return new JsonResponse({ success: true })
}

export async function getRawBuffer(_url: URL, _req: Request, ctx: RouteContext): Promise<Response> {
  const sessionId = ctx.params.id
  if (!sessionId) return new Response('Invalid session ID', { status: 400 })

  const bufferData = manager.getRawBuffer(sessionId)
  if (!bufferData) {
    return new Response('Session not found', { status: 404 })
  }

  return new JsonResponse(bufferData)
}

export async function getPlainBuffer(
  _url: URL,
  _req: Request,
  ctx: RouteContext
): Promise<Response> {
  const sessionId = ctx.params.id
  if (!sessionId) return new Response('Invalid session ID', { status: 400 })

  const bufferData = manager.getRawBuffer(sessionId)
  if (!bufferData) {
    return new Response('Session not found', { status: 404 })
  }

  const plainText = Bun.stripANSI(bufferData.raw)
  return new JsonResponse({
    plain: plainText,
    byteLength: new TextEncoder().encode(plainText).length,
  })
}
