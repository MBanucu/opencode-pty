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

    // Subscribe to raw output events
    onRawOutput((_sessionId, rawData) => {
      receivedOutputs.push(rawData)
    })

    // Spawn interactive bash session
    const session = manager.spawn({
      command: 'bash',
      args: ['-i'],
      description: 'Echo test session',
      parentSessionId: 'test',
    })

    // Wait for PTY to initialize and show prompt
    await new Promise((resolve) => setTimeout(resolve, 200))

    // Send test input
    const success = manager.write(session.id, 'a')
    expect(success).toBe(true)

    // Wait for echo to be processed
    await new Promise((resolve) => setTimeout(resolve, 200))

    // Clean up
    manager.kill(session.id, true)

    // Verify echo occurred
    const allOutput = receivedOutputs.join('')
    expect(allOutput).toContain('a')

    // Should have received some output (prompt + echo)
    expect(receivedOutputs.length).toBeGreaterThan(0)
  })
})
