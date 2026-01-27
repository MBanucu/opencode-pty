import { describe, it, expect } from 'bun:test'
import { spawn } from 'bun-pty'

describe('bun-pty Minimum Working Example', () => {
  it('should spawn echo and receive output', async () => {
    const pty = spawn('echo', ['hello world'], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: process.cwd(),
      env: process.env as Record<string, string>,
    })

    let output = ''
    let exited = false

    pty.onData((data: string) => {
      output += data
    })

    pty.onExit(() => {
      exited = true
    })

    // Wait for exit
    await new Promise((resolve) => {
      const check = () => {
        if (exited) {
          resolve(void 0)
        } else {
          setTimeout(check, 10)
        }
      }
      check()
    })

    expect(output.trim()).toBe('hello world')
    pty.kill()
  })

  it('should spawn cat and echo input', async () => {
    const pty = spawn('cat', [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: process.cwd(),
      env: process.env as Record<string, string>,
    })

    let output = ''
    let exited = false

    pty.onData((data: string) => {
      output += data
    })

    pty.onExit(() => {
      exited = true
    })

    // Wait a bit for init
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Write input
    pty.write('test input\n')

    // Wait for output
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(output).toContain('test input')

    // Kill to exit
    pty.kill()

    // Wait for exit
    await new Promise((resolve) => {
      const check = () => {
        if (exited) {
          resolve(void 0)
        } else {
          setTimeout(check, 10)
        }
      }
      check()
    })
  })
})
