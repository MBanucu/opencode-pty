import { initManager, manager } from './src/plugin/pty/manager.ts'
import { initLogger } from './src/plugin/logger.ts'
import { startWebServer } from './src/web/server.ts'

const logLevels = { debug: 0, info: 1, warn: 2, error: 3 }
const currentLevel = logLevels[process.env.LOG_LEVEL as keyof typeof logLevels] ?? logLevels.info

// Set NODE_ENV if not set
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'test'
}

const fakeClient = {
  app: {
    log: async (opts: any) => {
      const { level = 'info', message, extra } = opts.body || opts
      const levelNum = logLevels[level as keyof typeof logLevels] ?? logLevels.info
      if (levelNum >= currentLevel) {
        const extraStr = extra ? ` ${JSON.stringify(extra)}` : ''
        console.log(`[${level}] ${message}${extraStr}`)
      }
    },
  },
} as any
initLogger(fakeClient)
initManager(fakeClient)

// Cleanup on process termination
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, cleaning up PTY sessions...')
  manager.cleanupAll()
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('Received SIGINT, cleaning up PTY sessions...')
  manager.cleanupAll()
  process.exit(0)
})

// Use the specified port after cleanup
function findAvailablePort(port: number): number {
  // Only kill processes if we're confident they belong to our test servers
  // In parallel execution, avoid killing other workers' servers
  if (process.env.TEST_WORKER_INDEX) {
    // For parallel workers, assume the port is available since we assign unique ports
    return port
  }

  // For single execution, clean up any stale processes
  Bun.spawnSync(['sh', '-c', `lsof -ti:${port} | xargs kill -9 2>/dev/null || true`])
  // Small delay to allow cleanup
  Bun.sleepSync(200)
  return port
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

let basePort = argv.port

// For parallel workers, ensure unique start ports
if (process.env.TEST_WORKER_INDEX) {
  const workerIndex = parseInt(process.env.TEST_WORKER_INDEX, 10)
  basePort = 8877 + workerIndex
}

let port = findAvailablePort(basePort)

console.log(`Test server starting on port ${port}`)

const url = startWebServer({ port })

// Only log in non-test environments or when explicitly requested
if (process.env.NODE_ENV !== 'test' || process.env.VERBOSE === 'true') {
  console.log(`Server started at ${url}`)
}

// Write port to file for tests to read
if (process.env.NODE_ENV === 'test') {
  const workerIndex = process.env.TEST_WORKER_INDEX || '0'
  await Bun.write(`/tmp/test-server-port-${workerIndex}.txt`, port.toString())
}

// Health check for test mode
if (process.env.NODE_ENV === 'test') {
  let retries = 20 // 10 seconds
  while (retries > 0) {
    try {
      const response = await fetch(`http://localhost:${port}/api/sessions`)
      if (response.ok) {
        break
      }
    } catch (error) {
      // Server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
    retries--
  }
  if (retries === 0) {
    console.error('Server failed to start properly after 10 seconds')
    process.exit(1)
  }
}

// Create test sessions for manual testing and e2e tests
if (process.env.NODE_ENV === 'test') {
  // Create an interactive bash session for e2e tests
  manager.spawn({
    command: 'bash',
    args: [], // Interactive bash
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

// Keep the server running indefinitely
setInterval(() => {
  // Keep-alive check - server will continue running
}, 1000)
