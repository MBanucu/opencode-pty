import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

interface TerminalRendererProps {
  output: string[]
}

export function TerminalRenderer({ output }: TerminalRendererProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<Terminal | null>(null)
  const lastOutputLengthRef = useRef(0)

  useEffect(() => {
    if (!terminalRef.current) return

    const term = new Terminal({
      cursorBlink: true,
      theme: { background: '#1e1e1e', foreground: '#d4d4d4' },
      fontFamily: 'monospace',
      fontSize: 14,
      scrollback: 1000,
    })
    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)

    term.open(terminalRef.current)
    fitAddon.fit()

    xtermRef.current = term

    // Write initial output
    if (output.length > 0) {
      term.write(output.join('\n') + '\n')
      lastOutputLengthRef.current = output.length
    }

    const handleResize = () => {
      fitAddon.fit()
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      term.dispose()
    }
  }, [])

  // Handle output updates
  useEffect(() => {
    const term = xtermRef.current
    if (!term) return

    const newLines = output.slice(lastOutputLengthRef.current)
    if (newLines.length > 0) {
      term.write(newLines.join('\n') + '\n')
      lastOutputLengthRef.current = output.length
    }
  }, [output])

  return <div ref={terminalRef} style={{ height: '100%', width: '100%' }} />
}
