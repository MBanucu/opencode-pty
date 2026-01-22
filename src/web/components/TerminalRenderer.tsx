import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

interface TerminalRendererProps {
  output: string[]
  onSendInput?: (data: string) => void
  onInterrupt?: () => void
  disabled?: boolean
}

export function TerminalRenderer({
  output,
  onSendInput,
  onInterrupt,
  disabled = false,
}: TerminalRendererProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<Terminal | null>(null)
  const lastOutputLengthRef = useRef(0)
  const inputBufferRef = useRef('')

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

  // Handle input
  useEffect(() => {
    const term = xtermRef.current
    if (!term || disabled) return

    const handleData = (data: string) => {
      if (data === '\r' || data === '\n') {
        // Send the buffered line
        const line = inputBufferRef.current.trim()
        if (line && onSendInput) {
          onSendInput(line + '\n')
        }
        inputBufferRef.current = ''
      } else if (data === '\x7f' || data === '\b') {
        // Backspace
        if (inputBufferRef.current.length > 0) {
          inputBufferRef.current = inputBufferRef.current.slice(0, -1)
          term.write('\b \b') // Erase character
        }
      } else {
        // Regular character
        inputBufferRef.current += data
        term.write(data) // Echo
      }
    }

    const handleKey = ({ key, domEvent }: { key: string; domEvent: KeyboardEvent }) => {
      if (domEvent.ctrlKey && (key === 'c' || key === 'C')) {
        // Ctrl+C interrupt
        term.writeln('^C')
        if (onInterrupt) onInterrupt()
        domEvent.preventDefault()
      }
    }

    term.onData(handleData)
    term.onKey(handleKey)

    return () => {
      // Remove listeners by disposing or setting to null
      // xterm doesn't have removeListener, so we rely on effect cleanup
    }
  }, [onSendInput, onInterrupt, disabled])

  return <div ref={terminalRef} style={{ height: '100%', width: '100%' }} />
}
