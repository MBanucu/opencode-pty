import { initManager, manager } from '../src/plugin/pty/manager.ts'
import { initLogger } from '../src/plugin/logger.ts'
import { startWebServer } from '../src/web/server/server.ts'

// Set NODE_ENV if not set
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'test'
}

const fakeClient = {
  app: {
    log: async (_opts: any) => {},
  },
} as any
initLogger(fakeClient)
initManager(fakeClient)

// Cleanup on process termination
process.on('SIGTERM', cleanup)
process.on('SIGINT', cleanup)

function cleanup() {
  manager.cleanupAll()
  process.exit(0)
}

// Parse command line arguments
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

const argv = yargs(hideBin(process.argv))
  .option('port', {
    alias: 'p',
    type: 'number',
    description: 'Port to run the server on',
    default: 8877,
  })
  .parseSync()

let port = argv.port

// For parallel workers, ensure unique start ports
if (process.env.TEST_WORKER_INDEX) {
  const workerIndex = parseInt(process.env.TEST_WORKER_INDEX, 10)
  port = 8877 + workerIndex
}

await startWebServer({ port })

// Only log in non-test environments or when explicitly requested

// Write port to file for tests to read
if (process.env.NODE_ENV === 'test') {
  const workerIndex = process.env.TEST_WORKER_INDEX || '0'
  await Bun.write(`/tmp/test-server-port-${workerIndex}.txt`, port.toString())
}

// Health check for test mode
if (process.env.NODE_ENV === 'test') {
  try {
    const response = await fetch(`http://localhost:${port}/api/sessions`)
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
