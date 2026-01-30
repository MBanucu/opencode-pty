import { initManager, manager } from '../src/plugin/pty/manager.ts'
import { PTYServer } from '../src/web/server/server.ts'

const fakeClient = {
  app: {
    log: async (_opts: any) => {},
  },
} as any
initManager(fakeClient)

const server = await PTYServer.createServer()

// Only log in non-test environments or when explicitly requested

// Write server URL to file for tests to read
if (process.env.NODE_ENV === 'test') {
  const workerIndex = process.env.TEST_WORKER_INDEX || '0'
  if (!server.server.url) {
    throw new Error('Server URL not available. File an issue if you need this feature.')
  }
  await Bun.write(`/tmp/test-server-port-${workerIndex}.txt`, server.server.url.href)
}

// Health check for test mode
if (process.env.NODE_ENV === 'test') {
  try {
    const response = await fetch(`${server.server.url}/api/sessions`)
    if (!response.ok) {
      console.error('Server health check failed')
      process.exit(1)
    }
  } catch (error) {
    console.error('Server health check failed:', error)
    process.exit(1)
  }
}

// Create test sessions for manual testing and e2e tests
if (process.env.NODE_ENV === 'test') {
  // Create an interactive bash session for e2e tests
  manager.spawn({
    command: 'bash',
    args: ['-i'], // Interactive bash
    description: 'Interactive bash session for e2e tests',
    parentSessionId: 'test-session',
  })
} else if (process.env.CI !== 'true') {
  manager.spawn({
    command: 'bash',
    args: [
      '-c',
      "echo 'Welcome to live streaming test'; echo 'Type commands and see real-time output'; for i in {1..100}; do echo \"$(date): Live update $i...\"; sleep 1; done",
    ],
    description: 'Live streaming test session',
    parentSessionId: 'live-test',
  })
}
