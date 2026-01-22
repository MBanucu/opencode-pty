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

      proc.stdout?.on('data', (data) => {
        const output = data.toString()
        console.log(`[W${workerInfo.workerIndex}] ${output}`)
      })

      proc.stderr?.on('data', (data) => {
        console.error(`[W${workerInfo.workerIndex} ERR] ${data}`)
      })

      proc.on('exit', (code, signal) => {
        console.log(
          `[Worker ${workerInfo.workerIndex}] Server process exited with code ${code}, signal ${signal}`
        )
      })

      proc.stderr?.on('data', (data) => {
        console.error(`[W${workerInfo.workerIndex} ERR] ${data}`)
      })

      proc.on('exit', (code, signal) => {
        console.log(
          `[Worker ${workerInfo.workerIndex}] Server process exited with code ${code}, signal ${signal}`
        )
      })

      try {
        await waitForServer(url, 15000) // Wait up to 15 seconds for server
        console.log(`[Worker ${workerInfo.workerIndex}] Server ready at ${url}`)
        await use({ baseURL: url, port })
      } catch (error) {
        console.error(`[Worker ${workerInfo.workerIndex}] Failed to start server: ${error}`)
        throw error
      } finally {
        // Ensure process is killed
        if (!proc.killed) {
          proc.kill('SIGTERM')
          // Wait a bit, then force kill if still running
          setTimeout(() => {
            if (!proc.killed) {
              proc.kill('SIGKILL')
            }
          }, 2000)
        }
        await new Promise((resolve) => {
          if (proc.killed) {
            resolve(void 0)
          } else {
            proc.on('exit', resolve)
          }
        })
        console.log(`[Worker ${workerInfo.workerIndex}] Server stopped`)
      }
    },
    { scope: 'worker', auto: true },
  ],
})

export { expect } from '@playwright/test'
