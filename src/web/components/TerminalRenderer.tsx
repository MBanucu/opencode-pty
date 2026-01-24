import React from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SerializeAddon } from '@xterm/addon-serialize'
import '@xterm/xterm/css/xterm.css'

interface BaseTerminalRendererProps {
  onSendInput?: (data: string) => void
  onInterrupt?: () => void
  disabled?: boolean
}

interface RawTerminalRendererProps extends BaseTerminalRendererProps {
  rawOutput: string
}

// Base abstract class for terminal renderers
abstract class BaseTerminalRenderer extends React.Component<BaseTerminalRendererProps> {
  protected terminalRef = React.createRef<HTMLDivElement>()
  protected xtermInstance: Terminal | null = null
  protected fitAddon: FitAddon | null = null
  protected serializeAddon: SerializeAddon | null = null

  // Abstract method that subclasses must implement
  abstract getDisplayData(): string

  override componentDidMount() {
    this.initializeTerminal()
    if (this.xtermInstance && this.getDisplayData()) {
      this.xtermInstance.write(this.getDisplayData())
    }
  }

  override componentDidUpdate(prevProps: BaseTerminalRendererProps) {
    const currentData = this.getDisplayData()
    const prevData = (prevProps as any).rawOutput || ''
    const newData = currentData.slice(prevData.length)

    console.log(
      '🔍 TERMINAL RENDER:',
      'current length:',
      currentData.length,
      'prev length:',
      prevData.length,
      'new length:',
      newData.length,
      'new data:',
      JSON.stringify(newData.substring(0, 50))
    )
    if (this.xtermInstance && newData) {
      console.log('🔍 TERMINAL WRITE:', 'writing new data to xterm')
      this.xtermInstance.write(newData)
    } else {
      console.log('🔍 TERMINAL RENDER:', 'no new data or no xterm instance')
    }
  }

  override componentWillUnmount() {
    if (this.xtermInstance) {
      this.xtermInstance.dispose()
    }
  }

  clear() {
    if (this.xtermInstance) {
      this.xtermInstance.clear()
    }
  }

  private initializeTerminal() {
    const term = new Terminal({
      cursorBlink: true,
      theme: { background: '#1e1e1e', foreground: '#d4d4d4' },
      fontFamily: 'monospace',
      fontSize: 14,
      scrollback: 5000,
      convertEol: true,
      allowTransparency: true,
    })

    this.fitAddon = new FitAddon()
    this.serializeAddon = new SerializeAddon()
    term.loadAddon(this.fitAddon)
    term.loadAddon(this.serializeAddon)

    if (this.terminalRef.current) {
      term.open(this.terminalRef.current)
      this.fitAddon.fit()
    }

    this.xtermInstance = term

    // Expose terminal and serialize addon for testing purposes
    console.log('TerminalRenderer: Exposing terminal instance and serialize addon for testing')
    ;(window as any).xtermTerminal = term
    ;(window as any).xtermSerializeAddon = this.serializeAddon

    // Write initial data
    const initialData = this.getDisplayData()
    if (initialData) {
      term.write(initialData)
    }

    // Set up input handling
    this.setupInputHandling(term)
  }

  private setupInputHandling(term: Terminal) {
    const { onSendInput, onInterrupt, disabled } = this.props

    if (disabled) return

    const handleData = (data: string) => {
      console.log('🔄 TERMINAL handleData called:', {
        input: JSON.stringify(data),
        isEnter: data === '\r',
      })

      if (data === '\u0003') {
        // Ctrl+C
        onInterrupt?.()
      } else {
        console.log('🔄 REGULAR INPUT: Sending to PTY, no local echo')
        // Regular character input - let PTY handle echo, no local echo
        onSendInput?.(data)
      }
    }

    const handleKey = (event: { key: string; domEvent: KeyboardEvent }) => {
      const { key, domEvent } = event
      if (key === 'Enter') {
        domEvent.preventDefault()
        handleData('\r')
      } else if (key === 'Backspace') {
        domEvent.preventDefault()
        term.write('\b \b')
        onSendInput?.('\b')
      }
    }

    term.onData(handleData)
    term.onKey(handleKey)
  }

  override render() {
    return (
      <div ref={this.terminalRef} className="xterm" style={{ width: '100%', height: '100%' }} />
    )
  }
}

// RawTerminalRenderer subclass - handles raw strings
export class RawTerminalRenderer extends BaseTerminalRenderer {
  constructor(props: RawTerminalRendererProps) {
    super(props)
  }

  getDisplayData(): string {
    // Raw data goes directly to terminal (preserves ANSI codes, formatting)
    const { rawOutput } = this.props as RawTerminalRendererProps
    return rawOutput
  }
}

// Functional wrapper for easier usage
export const RawTerminal: React.FC<RawTerminalRendererProps> = (props) => {
  return <RawTerminalRenderer {...props} />
}
