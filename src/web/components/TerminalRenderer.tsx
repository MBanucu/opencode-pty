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

interface ProcessedTerminalRendererProps extends BaseTerminalRendererProps {
  output: string[]
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
  }

  override componentDidUpdate() {
    const data = this.getDisplayData()
    if (data && this.xtermInstance) {
      this.xtermInstance.write(data)
    }
  }

  override componentWillUnmount() {
    if (this.xtermInstance) {
      this.xtermInstance.dispose()
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
      if (data === '\r') {
        // Enter key pressed
        term.write('\r\n')
        onSendInput?.('\n')
      } else if (data === '\u0003') {
        // Ctrl+C
        onInterrupt?.()
      } else {
        // Regular character input
        term.write(data)
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

// ProcessedTerminalRenderer subclass - handles line arrays
export class ProcessedTerminalRenderer extends BaseTerminalRenderer {
  constructor(props: ProcessedTerminalRendererProps) {
    super(props)
  }

  getDisplayData(): string {
    // Join processed lines for clean display
    const { output } = this.props as ProcessedTerminalRendererProps

    // Only add trailing newline if there are actual lines to display
    const joined = output.join('\n')
    const withTrailing = output.length > 0 ? joined + '\n' : ''

    return withTrailing
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

// Functional wrappers for easier usage
export const ProcessedTerminal: React.FC<ProcessedTerminalRendererProps> = (props) => {
  return <ProcessedTerminalRenderer {...props} />
}

export const RawTerminal: React.FC<RawTerminalRendererProps> = (props) => {
  return <RawTerminalRenderer {...props} />
}
