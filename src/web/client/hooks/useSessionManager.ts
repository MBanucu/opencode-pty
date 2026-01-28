import { useCallback } from 'react'
import type { Session } from 'opencode-pty-test/shared/types'

interface UseSessionManagerOptions {
  activeSession: Session | null
  setActiveSession: (session: Session | null) => void
  subscribeWithRetry: (sessionId: string) => void
  onOutputUpdate?: (output: string[]) => void
  onRawOutputUpdate?: (rawOutput: string) => void
}

export function useSessionManager({
  activeSession,
  setActiveSession,
  subscribeWithRetry,
  onOutputUpdate,
  onRawOutputUpdate,
}: UseSessionManagerOptions) {
  const handleSessionClick = useCallback(
    async (session: Session) => {
      try {
        // Validate session object first
        if (!session?.id) {
          return
        }
        setActiveSession(session)
        onOutputUpdate?.([])
        onRawOutputUpdate?.('')
        // Subscribe to this session for live updates
        subscribeWithRetry(session.id)

        try {
          const baseUrl = `${location.protocol}//${location.host}`

          // Fetch raw buffer data only (processed output endpoint removed)
          const rawResponse = await fetch(`${baseUrl}/api/sessions/${session.id}/buffer/raw`)

          // Process response with graceful error handling
          const rawData = rawResponse.ok ? await rawResponse.json() : { raw: '' }

          // Call callback with raw data
          onRawOutputUpdate?.(rawData.raw || '')
        } catch (fetchError) {
          onOutputUpdate?.([])
          onRawOutputUpdate?.('')
        }
      } catch (error) {
        // Ensure UI remains stable
        onOutputUpdate?.([])
        onRawOutputUpdate?.('')
      }
    },
    [setActiveSession, subscribeWithRetry, onOutputUpdate, onRawOutputUpdate]
  )

  const handleSendInput = useCallback(
    async (data: string) => {
      if (!data || !activeSession) {
        return
      }

      try {
        const baseUrl = `${location.protocol}//${location.host}`
        await fetch(`${baseUrl}/api/sessions/${activeSession.id}/input`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data }),
        })
        // eslint-disable-next-line no-empty
      } catch {}
    },
    [activeSession]
  )

  const handleKillSession = useCallback(async () => {
    if (!activeSession) {
      return
    }

    if (
      !confirm(
        `Are you sure you want to kill session "${activeSession.description ?? activeSession.title}"?`
      )
    ) {
      return
    }

    try {
      const baseUrl = `${location.protocol}//${location.host}`
      const response = await fetch(`${baseUrl}/api/sessions/${activeSession.id}/kill`, {
        method: 'POST',
      })

      if (response.ok) {
        setActiveSession(null)
        onOutputUpdate?.([])
        onRawOutputUpdate?.('')
      }
      // eslint-disable-next-line no-empty
    } catch {}
  }, [activeSession, setActiveSession, onOutputUpdate, onRawOutputUpdate])

  return {
    handleSessionClick,
    handleSendInput,
    handleKillSession,
  }
}
