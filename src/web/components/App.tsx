import { useState, useEffect, useCallback } from 'react'
import type { Session } from '../types.ts'

import { useWebSocket } from '../hooks/useWebSocket.ts'
import { useSessionManager } from '../hooks/useSessionManager.ts'

import { Sidebar } from './Sidebar.tsx'
import { RawTerminal } from './TerminalRenderer.tsx'

export function App() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSession, setActiveSession] = useState<Session | null>(null)
  const [rawOutput, setRawOutput] = useState<string>('')

  const [connected, setConnected] = useState(false)
  const [wsMessageCount, setWsMessageCount] = useState(0)

  const { connected: wsConnected, subscribeWithRetry } = useWebSocket({
    activeSession,
    onRawData: useCallback((rawData: string) => {
      setRawOutput((prev) => prev + rawData)
      setWsMessageCount((prev) => prev + 1)
    }, []),
    onSessionList: useCallback((newSessions: Session[], autoSelected: Session | null) => {
      setSessions(newSessions)
      if (autoSelected) {
        setActiveSession(autoSelected)
        fetch(`${location.protocol}//${location.host}/api/sessions/${autoSelected.id}/buffer/raw`)
          .then((response) => (response.ok ? response.json() : { raw: '' }))
          .then((data) => {
            setRawOutput(data.raw || '')
          })
          .catch(() => {
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
              <RawTerminal
                rawOutput={rawOutput}
                onSendInput={handleSendInput}
                onInterrupt={handleKillSession}
                disabled={!activeSession || activeSession.status !== 'running'}
              />
            </div>
            <div className="debug-info" data-testid="debug-info">
              Debug: {rawOutput.length} chars, active: {activeSession?.id || 'none'}, WS messages:{' '}
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
