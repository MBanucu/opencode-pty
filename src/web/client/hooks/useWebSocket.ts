import { useState, useEffect, useRef } from 'react'
import type { PTYSessionInfo } from 'opencode-pty/shared/types'
import { RETRY_DELAY, SKIP_AUTOSELECT_KEY } from 'opencode-pty/shared/constants'

interface UseWebSocketOptions {
  activeSession: PTYSessionInfo | null
  onRawData?: (rawData: string) => void
  onSessionList: (sessions: PTYSessionInfo[], autoSelected: PTYSessionInfo | null) => void
}

export function useWebSocket({ activeSession, onRawData, onSessionList }: UseWebSocketOptions) {
  const [connected, setConnected] = useState(false)

  const wsRef = useRef<WebSocket | null>(null)
  const activeSessionRef = useRef<PTYSessionInfo | null>(null)

  // Keep ref in sync with activeSession
  useEffect(() => {
    activeSessionRef.current = activeSession
  }, [activeSession])

  // Connect to WebSocket on mount
  useEffect(() => {
    const ws = new WebSocket(`ws://${location.host}/ws`)
    wsRef.current = ws
    ws.onopen = () => {
      setConnected(true)
      // Request initial session list
      ws.send(JSON.stringify({ type: 'session_list' }))
      // Resubscribe to active session if exists
      if (activeSessionRef.current) {
        ws.send(JSON.stringify({ type: 'subscribe', sessionId: activeSessionRef.current.id }))
      }
    }
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'session_list') {
          const sessions = data.sessions || []
          // Auto-select first running session if none selected (skip in tests that need empty state)
          const shouldSkipAutoselect = localStorage.getItem(SKIP_AUTOSELECT_KEY) === 'true'
          let autoSelected: PTYSessionInfo | null = null
          if (sessions.length > 0 && !activeSession && !shouldSkipAutoselect) {
            const runningSession = sessions.find((s: PTYSessionInfo) => s.status === 'running')
            autoSelected = runningSession || sessions[0]
          }
          onSessionList(sessions, autoSelected)
        } else if (data.type === 'raw_data') {
          const isForActiveSession = data.sessionId === activeSessionRef.current?.id
          if (isForActiveSession) {
            onRawData?.(data.rawData)
          }
        }
      } catch {}
    }
    ws.onclose = () => {
      setConnected(false)
    }
    ws.onerror = () => {}
    wsRef.current = ws
    return () => {
      ws.close()
    }
  }, [activeSession, onRawData, onSessionList])

  const subscribe = (sessionId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'subscribe', sessionId }))
    }
  }

  const subscribeWithRetry = (sessionId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      subscribe(sessionId)
    } else {
      setTimeout(() => {
        subscribe(sessionId)
      }, RETRY_DELAY)
    }
  }

  return { connected, subscribe, subscribeWithRetry }
}

// Export global subscription function for E2E tests
// E2E tests can call this to subscribe to session updates
// without creating a separate WebSocket connection
export declare function subscribeToSessionUpdates(callback: (sessions: PTYSessionInfo[]) => void): void
declare global {
  subscribeToSessionUpdates: (sessions: PTYSessionInfo[]) => void
}
globalThis.subscribeToSessionUpdates = callback
