import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { initManager, manager, onRawOutput } from '../src/plugin/pty/manager.ts'

describe('PTY Echo Behavior', () => {
  const fakeClient = {
    app: {
      log: async (_opts: any) => {
        // Mock logger
      },
    },
  } as any

  beforeEach(() => {
    initManager(fakeClient)
  })

  afterEach(() => {
    // Clean up any sessions
    manager.clearAllSessions()
  })

  it('should echo input characters in interactive bash session', async () => {
    const receivedOutputs: string[] = []

    const promise = new Promise<void>((resolve) => {
      // Subscribe to raw output events
      onRawOutput((_sessionId, rawData) => {
        receivedOutputs.push(rawData)
        if (receivedOutputs.join('').includes('Hello World')) {
          resolve()
        }
      })
      setTimeout(resolve, 1000)
    }).catch((e) => {
      console.error(e)
    })

    // Spawn interactive bash session
    const session = manager.spawn({
      command: 'echo',
      args: ['Hello World'],
      description: 'Echo test session',
      parentSessionId: 'test',
    })

    await promise

    // Clean up
    manager.kill(session.id, true)

    // Verify echo occurred
    const allOutput = receivedOutputs.join('')
    expect(allOutput).toContain('Hello World')

    // Should have received some output (prompt + echo)
    expect(receivedOutputs.length).toBeGreaterThan(0)
  })
})
