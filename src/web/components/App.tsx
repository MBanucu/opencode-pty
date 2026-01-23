import { useState, useEffect, useCallback } from 'react'
import type { Session } from '../types.ts'

import { useWebSocket } from '../hooks/useWebSocket.ts'
import { useSessionManager } from '../hooks/useSessionManager.ts'

import { Sidebar } from './Sidebar.tsx'
import { TerminalRenderer } from './TerminalRenderer.tsx'

export function App() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSession, setActiveSession] = useState<Session | null>(null)
  const [output, setOutput] = useState<string[]>([])
  const [rawOutput, setRawOutput] = useState<string>('')

  const [connected, setConnected] = useState(false)
  const [wsMessageCount, setWsMessageCount] = useState(0)

  const { connected: wsConnected, subscribeWithRetry } = useWebSocket({
    activeSession,
    onData: useCallback((lines: string[]) => {
      setOutput((prev) => [...prev, ...lines])
      setWsMessageCount((prev) => prev + 1)
    }, []),
    onRawData: useCallback((rawData: string) => {
      setRawOutput((prev) => prev + rawData)
    }, []),
    onSessionList: useCallback((newSessions: Session[], autoSelected: Session | null) => {
      setSessions(newSessions)
      if (autoSelected) {
        setActiveSession(autoSelected)
        fetch(`${location.protocol}//${location.host}/api/sessions/${autoSelected.id}/buffer/raw`)
          .then((response) => (response.ok ? response.json() : { raw: '' }))
          .then((data) => {
            setOutput(data.raw ? data.raw.split('\n').filter((line: string) => line !== '') : [])
            setRawOutput(data.raw || '')
          })
          .catch(() => {
            setOutput([])
            setRawOutput('')
          })
      }
    }, []),
  })

  // Update connected from wsConnected
  useEffect(() => {
    setConnected(wsConnected)
  }, [wsConnected])

  const { handleSessionClick, handleSendInput, handleKillSession } = useSessionManager({
    activeSession,
    setActiveSession,
    subscribeWithRetry,
    onOutputUpdate: useCallback((output: string[]) => {
      setOutput(output)
    }, []),
    onRawOutputUpdate: useCallback((rawOutput: string) => {
      setRawOutput(rawOutput)
    }, []),
  })

  return (
    <div className="container" data-active-session={activeSession?.id}>
      <Sidebar
        sessions={sessions}
        activeSession={activeSession}
        onSessionClick={handleSessionClick}
        connected={connected}
      />
      <div className="main">
        {activeSession ? (
          <>
            <div className="output-header">
              <div className="output-title">{activeSession.description ?? activeSession.title}</div>
              <button className="kill-btn" onClick={handleKillSession}>
                Kill Session
              </button>
            </div>
            <div className="output-container">
              <TerminalRenderer
                output={output}
                onSendInput={handleSendInput}
                onInterrupt={handleKillSession}
                disabled={!activeSession || activeSession.status !== 'running'}
              />
            </div>
            {/* Hidden output for testing purposes */}
            <div
              style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}
              data-testid="test-output"
            >
              {output.map((line, i) => (
                <div key={i} className="output-line">
                  {line}
                </div>
              ))}
            </div>
            <div className="debug-info" data-testid="debug-info">
              Debug: {output.length} lines, active: {activeSession?.id || 'none'}, WS messages:{' '}
              {wsMessageCount}
            </div>
          </>
        ) : (
          <div className="empty-state">Select a session from the sidebar to view its output</div>
        )}
      </div>
    </div>
  )
}
