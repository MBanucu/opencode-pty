import { describe, it, expect, afterEach } from 'bun:test'
import { mkdtempSync, rmSync, readFileSync, copyFileSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

// This test ensures the npm package can be packed, installed, and serves assets correctly

async function run(cmd: string[], opts: { cwd?: string } = {}) {
  const proc = Bun.spawn(cmd, {
    cwd: opts.cwd,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  return { code, stdout, stderr }
}

function findPackFileFromOutput(stdout: string): string {
  const lines = stdout.trim().split(/\r?\n/)
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim()
    if (line.endsWith('.tgz')) return line
  }
  throw new Error('No .tgz file found in npm pack output')
}

describe('npm pack integration', () => {
  let tempDir: string
  let packFile: string | null = null
  let serverProcess: ReturnType<typeof Bun.spawn> | null = null

  afterEach(async () => {
    // Cleanup server process
    if (serverProcess) {
      serverProcess.kill()
      serverProcess = null
    }

    // Cleanup temp directory
    if (tempDir) {
      try {
        rmSync(tempDir, { recursive: true, force: true })
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    // Cleanup pack file
    if (packFile) {
      try {
        await run(['rm', '-f', packFile])
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  })

  it('packs, installs, and serves assets correctly', async () => {
    // 1) Create temp workspace
    tempDir = mkdtempSync(join(tmpdir(), 'opencode-pty-test-'))

    // 2) Pack the package
    const pack = await run(['npm', 'pack'])
    expect(pack.code).toBe(0)
    const tgz = findPackFileFromOutput(pack.stdout)
    packFile = tgz
    const tgzPath = join(process.cwd(), tgz)

    // List tarball contents to find an asset
    const list = await run(['tar', '-tf', tgzPath])
    expect(list.code).toBe(0)
    const files = list.stdout.split(/\r?\n/).filter(Boolean)
    const jsAsset = files.find((f) => /package\/dist\/web\/assets\/[^/]+\.js$/.test(f))
    expect(jsAsset).toBeDefined()
    const assetName = jsAsset!.replace('package/dist/web/assets/', '')

    // 3) Install in temp workspace
    const install = await run(['npm', 'install', tgzPath], { cwd: tempDir })
    expect(install.code).toBe(0)

    // Copy the server script to tempDir
    copyFileSync(join(process.cwd(), 'start-server.ts'), join(tempDir, 'start-server.ts'))

    // Verify the package structure
    const packageDir = join(tempDir, 'node_modules/opencode-pty-test')
    expect(existsSync(join(packageDir, 'src/plugin/pty/manager.ts'))).toBe(true)
    expect(existsSync(join(packageDir, 'dist/web/index.html'))).toBe(true)
    serverProcess = Bun.spawn(['bun', 'run', 'start-server.ts'], {
      cwd: tempDir,
      env: { ...process.env, NODE_ENV: 'test' },
      stdout: 'inherit',
      stderr: 'inherit',
    })

    // Wait for port file to be written
    let port: number | null = null
    let retries = 20 // 10 seconds
    while (retries > 0) {
      try {
        const portFile = readFileSync('/tmp/test-server-port-0.txt', 'utf8')
        port = parseInt(portFile.trim(), 10)
        if (!isNaN(port)) break
      } catch (error) {
        // File not ready yet
      }
      await new Promise((resolve) => setTimeout(resolve, 500))
      retries--
    }
    expect(port).not.toBeNull()

    // Wait for server to be ready
    retries = 20 // 10 seconds
    while (retries > 0) {
      try {
        const response = await fetch(`http://localhost:${port}/api/sessions`)
        if (response.ok) break
      } catch (error) {
        // Server not ready
      }
      await new Promise((resolve) => setTimeout(resolve, 500))
      retries--
    }
    expect(retries).toBeGreaterThan(0) // Server should be ready

    // 5) Fetch assets
    const assetResponse = await fetch(`http://localhost:${port}/assets/${assetName}`)
    expect(assetResponse.status).toBe(200)
    // Could add more specific checks here, like content-type or specific assets

    // 6) Fetch index.html and verify it's the built version
    const indexResponse = await fetch(`http://localhost:${port}/`)
    expect(indexResponse.status).toBe(200)
    const indexContent = await indexResponse.text()
    expect(indexContent).not.toContain('main.tsx') // Fails if raw HTML is served
    expect(indexContent).toContain('/assets/') // Confirms built assets are referenced
  }, 30000)
})
