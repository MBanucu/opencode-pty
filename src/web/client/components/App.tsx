import { useState, useEffect, useCallback } from 'react'
import type { PTYSessionInfo } from 'opencode-pty/shared/types'

import { useWebSocket } from '../hooks/useWebSocket.ts'
import { useSessionManager } from '../hooks/useSessionManager.ts'

import { Sidebar } from './Sidebar.tsx'
import { RawTerminal } from './TerminalRenderer.tsx'

export function App() {
  const [sessions, setSessions] = useState<PTYSessionInfo[]>([])
  const [activeSession, setActiveSession] = useState<PTYSessionInfo | null>(null)
  const [rawOutput, setRawOutput] = useState<string>('')

  const [connected, setConnected] = useState(false)
  const [wsMessageCount, setWsMessageCount] = useState(0)
  const [sessionUpdateCount, setSessionUpdateCount] = useState(0)

  const {
    connected: wsConnected,
    subscribeWithRetry,
    sendInput,
  } = useWebSocket({
    activeSession,
    onRawData: useCallback((rawData: string) => {
      setRawOutput((prev) => {
        const newOutput = prev + rawData
        return newOutput
      })
      setWsMessageCount((prev) => prev + 1)
    }, []),
    onSessionList: useCallback(
      (newSessions: PTYSessionInfo[], autoSelected: PTYSessionInfo | null) => {
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
      },
      []
    ),
    onSessionUpdate: useCallback((updatedSession: PTYSessionInfo) => {
      setSessionUpdateCount((prev) => prev + 1)
      setSessions((prevSessions) => {
        const existingIndex = prevSessions.findIndex((s) => s.id === updatedSession.id)
        if (existingIndex >= 0) {
          // Replace the existing session
          const newSessions = [...prevSessions]
          newSessions[existingIndex] = updatedSession
          return newSessions
        } else {
          // Add the new session to the list
          return [...prevSessions, updatedSession]
        }
      })
    }, []),
  })

  // Update connected from wsConnected
  useEffect(() => {
    setConnected(wsConnected)
  }, [wsConnected])

  // Periodic session list sync every 10 seconds
  useEffect(() => {
    const syncInterval = setInterval(async () => {
      try {
        const response = await fetch(`${location.protocol}//${location.host}/api/sessions`)
        if (response.ok) {
          const sessionsData = await response.json()
          setSessions(sessionsData)
        }
      } catch {
        // Silently ignore sync errors to avoid console spam
      }
    }, 10000) // 10 seconds

    return () => clearInterval(syncInterval)
  }, [])

  const { handleSessionClick, handleSendInput, handleKillSession } = useSessionManager({
    activeSession,
    setActiveSession,
    subscribeWithRetry,
    sendInput,
    wsConnected,
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
                key={activeSession?.id}
                rawOutput={rawOutput}
                onSendInput={handleSendInput}
                onInterrupt={handleKillSession}
                disabled={!activeSession || activeSession.status !== 'running'}
              />
            </div>
            <div className="debug-info" data-testid="debug-info">
              Debug: {rawOutput.length} chars, active: {activeSession?.id || 'none'}, WS raw_data:{' '}
              {wsMessageCount}, session_updates: {sessionUpdateCount}
            </div>
            <div data-testid="test-output" style={{ position: 'absolute', left: '-9999px' }}>
              {rawOutput.split('\n').map((line, i) => (
                <div key={i} className="output-line">
                  {line}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="empty-state">Select a session from the sidebar to view its output</div>
        )}
      </div>
    </div>
  )
}
