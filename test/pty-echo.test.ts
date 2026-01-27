import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { PTYManager } from '../src/plugin/pty/manager.ts'

describe('PTY Echo Behavior', () => {
  const fakeClient = {
    app: {
      log: async (_opts: any) => {
        // Mock logger
      },
    },
  } as any

  let testManager: PTYManager

  beforeEach(() => {
    testManager = new PTYManager()
    testManager.init(fakeClient)
  })

  afterEach(() => {
    // Clean up any sessions
    testManager.clearAllSessions()
  })

  it('should echo input characters in interactive bash session', async () => {
    const receivedOutputs: string[] = []

    // Spawn interactive bash session
    const session = testManager.spawn({
      command: 'bash',
      args: ['-i'],
      description: 'Echo test session',
      parentSessionId: 'test',
      onData: (_sessionId, rawData) => {
        receivedOutputs.push(rawData)
      },
    })

    console.log('Echo session:', session)
    const fullSession = testManager.get(session.id)
    console.log('Echo session from get:', fullSession)

    // Wait for PTY to initialize and show prompt
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Send test input
    const success = testManager.write(session.id, 'a\n')
    console.log('Write success:', success)

    // Wait for echo to be processed
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Clean up
    testManager.kill(session.id, true)

    // Verify echo occurred
    const allOutput = receivedOutputs.join('')
    console.log('All output:', allOutput)
    console.log('Received outputs:', receivedOutputs)
    expect(allOutput).toContain('a')

    // Should have received some output (prompt + echo)
    expect(receivedOutputs.length).toBeGreaterThan(0)
  })

  it('should echo different input characters in interactive bash session', async () => {
    const receivedOutputs: string[] = []

    // Spawn interactive bash session
    const session = testManager.spawn({
      command: 'bash',
      args: ['-i'],
      description: 'Echo test session 2',
      parentSessionId: 'test2',
      onData: (_sessionId, rawData) => {
        receivedOutputs.push(rawData)
      },
    })

    console.log('Echo session 2:', session)
    const fullSession = testManager.get(session.id)
    console.log('Echo session 2 from get:', fullSession)

    // Wait for PTY to initialize and show prompt
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Send test input
    const success = testManager.write(session.id, 'b\n')
    console.log('Write success:', success)

    // Wait for echo to be processed
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Clean up
    testManager.kill(session.id, true)

    // Verify echo occurred
    const allOutput = receivedOutputs.join('')
    console.log('All output:', allOutput)
    console.log('Received outputs:', receivedOutputs)
    expect(allOutput).toContain('b')

    // Should have received some output (prompt + echo)
    expect(receivedOutputs.length).toBeGreaterThan(0)
  })
})
