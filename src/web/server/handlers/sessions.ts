import { manager } from '../../../plugin/pty/manager.ts'
import type { BunRequest } from 'bun'
import { JsonResponse, ErrorResponse } from './responses.ts'
import {
  apiSessionCleanupPath,
  apiSessionInputPath,
  apiSessionPath,
  apiSessionPlainBufferPath,
  apiSessionRawBufferPath,
} from '../server.ts'

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

export function getSession(req: BunRequest<typeof apiSessionPath>) {
  const session = manager.get(req.params.id)
  if (!session) {
    return new ErrorResponse('Session not found', 404)
  }
  return new JsonResponse(session)
}

export async function sendInput(req: BunRequest<typeof apiSessionInputPath>): Promise<Response> {
  try {
    const body = (await req.json()) as { data: string }
    if (!body.data || typeof body.data !== 'string') {
      return new ErrorResponse('Data field is required and must be a string', 400)
    }
    const success = manager.write(req.params.id, body.data)
    if (!success) {
      return new ErrorResponse('Failed to write to session', 400)
    }
    return new JsonResponse({ success: true })
  } catch (err) {
    return new ErrorResponse('Invalid JSON in request body', 400)
  }
}

export function cleanupSession(req: BunRequest<typeof apiSessionCleanupPath>) {
  console.log('Cleaning up session', req.params.id)
  const success = manager.kill(req.params.id, true)
  if (!success) {
    return new ErrorResponse('Failed to kill session', 400)
  }
  return new JsonResponse({ success: true })
}

export function killSession(req: BunRequest<typeof apiSessionPath>) {
  const success = manager.kill(req.params.id)
  if (!success) {
    return new ErrorResponse('Failed to kill session', 400)
  }
  return new JsonResponse({ success: true })
}

export function getRawBuffer(req: BunRequest<typeof apiSessionRawBufferPath>) {
  const bufferData = manager.getRawBuffer(req.params.id)
  if (!bufferData) {
    return new ErrorResponse('Session not found', 404)
  }

  return new JsonResponse(bufferData)
}

export function getPlainBuffer(req: BunRequest<typeof apiSessionPlainBufferPath>) {
  const bufferData = manager.getRawBuffer(req.params.id)
  if (!bufferData) {
    return new ErrorResponse('Session not found', 404)
  }

  const plainText = Bun.stripANSI(bufferData.raw)
  return new JsonResponse({
    plain: plainText,
    byteLength: new TextEncoder().encode(plainText).length,
  })
}
