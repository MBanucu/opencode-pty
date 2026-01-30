import { manager } from '../../../plugin/pty/manager.ts'
import type { BunRequest } from 'bun'
import { JsonResponse, ErrorResponse } from './responses.ts'

export function getSessions() {
  const sessions = manager.list()
  return new JsonResponse(sessions)
}

export async function createSession(req: Request) {
  try {
    const body = (await req.json()) as {
      command: string
      args?: string[]
      description?: string
      workdir?: string
    }
    if (!body.command || typeof body.command !== 'string' || body.command.trim() === '') {
      return new ErrorResponse('Command is required', 400)
    }
    const session = manager.spawn({
      command: body.command,
      args: body.args || [],
      title: body.description,
      description: body.description,
      workdir: body.workdir,
      parentSessionId: 'web-api',
    })
    return new JsonResponse(session)
  } catch (err) {
    return new ErrorResponse('Invalid JSON in request body', 400)
  }
}

export function clearSessions() {
  manager.clearAllSessions()
  return new JsonResponse({ success: true })
}

export function getSession(req: BunRequest<'/api/sessions/:id'>) {
  const sessionId = req.params.id
  if (!sessionId || typeof sessionId !== 'string' || sessionId.trim() === '') {
    return new ErrorResponse('Invalid session ID', 400)
  }
  const session = manager.get(sessionId)
  if (!session) {
    return new ErrorResponse('Session not found', 404)
  }
  return new JsonResponse(session)
}

export async function sendInput(req: BunRequest<'/api/sessions/:id/input'>): Promise<Response> {
  const sessionId = req.params.id
  if (!sessionId || typeof sessionId !== 'string' || sessionId.trim() === '') {
    return new ErrorResponse('Invalid session ID', 400)
  }
  try {
    const body = (await req.json()) as { data: string }
    if (!body.data || typeof body.data !== 'string') {
      return new ErrorResponse('Data field is required and must be a string', 400)
    }
    const success = manager.write(sessionId, body.data)
    if (!success) {
      return new ErrorResponse('Failed to write to session', 400)
    }
    return new JsonResponse({ success: true })
  } catch (err) {
    return new ErrorResponse('Invalid JSON in request body', 400)
  }
}

export function killSession(req: BunRequest<'/api/sessions/:id/kill'>) {
  const sessionId = req.params.id
  if (!sessionId || typeof sessionId !== 'string' || sessionId.trim() === '') {
    return new ErrorResponse('Invalid session ID', 400)
  }
  const success = manager.kill(sessionId)
  if (!success) {
    return new ErrorResponse('Failed to kill session', 400)
  }
  return new JsonResponse({ success: true })
}

export function getRawBuffer(req: BunRequest<'/api/sessions/:id/buffer/raw'>) {
  const sessionId = req.params.id
  if (!sessionId || typeof sessionId !== 'string' || sessionId.trim() === '') {
    return new ErrorResponse('Invalid session ID', 400)
  }

  const bufferData = manager.getRawBuffer(sessionId)
  if (!bufferData) {
    return new ErrorResponse('Session not found', 404)
  }

  return new JsonResponse(bufferData)
}

export function getPlainBuffer(req: BunRequest<'/api/sessions/:id/buffer/plain'>) {
  const sessionId = req.params.id
  if (!sessionId || typeof sessionId !== 'string' || sessionId.trim() === '') {
    return new ErrorResponse('Invalid session ID', 400)
  }

  const bufferData = manager.getRawBuffer(sessionId)
  if (!bufferData) {
    return new ErrorResponse('Session not found', 404)
  }

  const plainText = Bun.stripANSI(bufferData.raw)
  return new JsonResponse({
    plain: plainText,
    byteLength: new TextEncoder().encode(plainText).length,
  })
}
