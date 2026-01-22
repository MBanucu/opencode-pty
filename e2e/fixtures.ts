import { test as base, type WorkerInfo } from '@playwright/test'
import { spawn, type ChildProcess } from 'node:child_process'

const BASE_PORT = 8877

async function waitForServer(url: string, timeoutMs = 15000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(1000) })
      if (res.ok) return
    } catch {}
    await new Promise((r) => setTimeout(r, 400))
  }
  throw new Error(`Server did not become ready at ${url} within ${timeoutMs}ms`)
}

type TestFixtures = {}
type WorkerFixtures = {
  server: { baseURL: string; port: number }
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
  server: [
    async ({}, use, workerInfo: WorkerInfo) => {
      const port = BASE_PORT + workerInfo.workerIndex
      const url = `http://localhost:${port}`

      console.log(`[Worker ${workerInfo.workerIndex}] Starting test server on port ${port}`)

      const proc: ChildProcess = spawn('bun', ['run', 'test-web-server.ts', `--port=${port}`], {
        env: {
          ...process.env,
          TEST_WORKER_INDEX: workerInfo.workerIndex.toString(),
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      proc.stdout?.on('data', (data) => console.log(`[W${workerInfo.workerIndex}] ${data}`))
      proc.stderr?.on('data', (data) => console.error(`[W${workerInfo.workerIndex} ERR] ${data}`))

      try {
        await waitForServer(url)
        console.log(`[Worker ${workerInfo.workerIndex}] Server ready at ${url}`)
        await use({ baseURL: url, port })
      } finally {
        proc.kill('SIGTERM')
        await new Promise((resolve) => proc.on('exit', resolve))
        console.log(`[Worker ${workerInfo.workerIndex}] Server stopped`)
      }
    },
    { scope: 'worker', auto: true },
  ],
})

export { expect } from '@playwright/test'
