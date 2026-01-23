import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import pinoLogger from '../logger.ts'

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
  const logger = pinoLogger.child({ component: 'TerminalRenderer' })
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
      scrollback: 5000,
      convertEol: true,
      allowTransparency: true,
    })
    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)

    term.open(terminalRef.current)
    fitAddon.fit()

    xtermRef.current = term

    // Write historical output once on mount
    if (output.length > 0) {
      term.write(output.join(''))
      lastOutputLengthRef.current = output.length
    }

    const handleResize = () => fitAddon.fit()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      term.dispose()
    }
  }, [])

  // Append new output chunks from WebSocket / API
  useEffect(() => {
    const term = xtermRef.current
    if (!term) return

    const newLines = output.slice(lastOutputLengthRef.current)
    if (newLines.length > 0) {
      term.write(newLines.join(''))
      lastOutputLengthRef.current = output.length
      term.scrollToBottom()
    }
  }, [output])

  // Handle user input → forward raw to backend
  useEffect(() => {
    const term = xtermRef.current
    if (!term || disabled || !onSendInput) return

    const onDataHandler = (data: string) => {
      logger.debug(
        {
          raw: JSON.stringify(data),
          hex: Array.from(data)
            .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
            .join(' '),
          length: data.length,
        },
        'onData → backend'
      )
      onSendInput(data) // Send every keystroke chunk
    }

    const onKeyHandler = ({ domEvent }: { key: string; domEvent: KeyboardEvent }) => {
      if (domEvent.ctrlKey && domEvent.key.toLowerCase() === 'c') {
        // Let ^C go through to backend, but also call interrupt
        if (onInterrupt) onInterrupt()
      } else if (domEvent.key === 'Enter') {
        // Handle Enter key since onData doesn't fire for it
        onSendInput('\r')
        domEvent.preventDefault()
      }
      // Space key is now handled by onData, no special case needed
    }

    const dataDisposable = term.onData(onDataHandler)
    const keyDisposable = term.onKey(onKeyHandler)

    // Focus the terminal so user can type immediately
    term.focus()

    return () => {
      dataDisposable.dispose()
      keyDisposable.dispose()
    }
  }, [onSendInput, onInterrupt, disabled])

  return <div ref={terminalRef} style={{ height: '100%', width: '100%' }} />
}
