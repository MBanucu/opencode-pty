import React from 'react'

interface TerminalModeSwitcherProps {
  mode: 'raw' | 'processed'
  onModeChange: (mode: 'raw' | 'processed') => void
  className?: string
}

export const TerminalModeSwitcher: React.FC<TerminalModeSwitcherProps> = ({
  mode,
  onModeChange,
  className = '',
}) => {
  return (
    <div className={`terminal-mode-switcher ${className}`} data-testid="terminal-mode-switcher">
      <fieldset
        style={{
          border: '1px solid #30363d',
          borderRadius: '6px',
          padding: '12px',
          margin: 0,
          background: '#161b22',
        }}
      >
        <legend
          style={{
            color: '#c9d1d9',
            fontSize: '12px',
            fontWeight: '600',
            padding: '0 8px',
          }}
        >
          Terminal Display Mode
        </legend>

        <div
          style={{
            display: 'flex',
            gap: '16px',
            alignItems: 'center',
          }}
        >
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              color: '#c9d1d9',
              fontSize: '14px',
            }}
          >
            <input
              type="radio"
              name="terminal-mode"
              value="processed"
              checked={mode === 'processed'}
              onChange={() => onModeChange('processed')}
              style={{
                margin: 0,
                accentColor: '#58a6ff',
              }}
            />
            Processed View
          </label>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              color: '#c9d1d9',
              fontSize: '14px',
            }}
          >
            <input
              type="radio"
              name="terminal-mode"
              value="raw"
              checked={mode === 'raw'}
              onChange={() => onModeChange('raw')}
              style={{
                margin: 0,
                accentColor: '#58a6ff',
              }}
            />
            Raw View
          </label>
        </div>
      </fieldset>
    </div>
  )
}
