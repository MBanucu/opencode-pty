import { useCallback } from 'react'
import type { PTYSessionInfo } from 'opencode-pty/shared/types'

import { RouteBuilder } from '../../shared/RouteBuilder'

interface UseSessionManagerOptions {
  activeSession: PTYSessionInfo | null
  setActiveSession: (session: PTYSessionInfo | null) => void
  subscribeWithRetry: (sessionId: string) => void
  onRawOutputUpdate?: (rawOutput: string) => void
}

export function useSessionManager({
  activeSession,
  setActiveSession,
  subscribeWithRetry,
  onRawOutputUpdate,
}: UseSessionManagerOptions) {
  const handleSessionClick = useCallback(
    async (session: PTYSessionInfo) => {
      try {
        // Validate session object first
        if (!session?.id) {
          return
        }
        setActiveSession(session)
        onRawOutputUpdate?.('')
        // Subscribe to this session for live updates
        subscribeWithRetry(session.id)

        try {
          const baseUrl = `${location.protocol}//${location.host}`

          // Fetch raw buffer data only (processed output endpoint removed)
          const rawResponse = await fetch(
            `${baseUrl}${RouteBuilder.session(session.id).rawBuffer()}`
          )

          // Process response with graceful error handling
          const rawData = rawResponse.ok ? await rawResponse.json() : { raw: '' }

          // Call callback with raw data
          onRawOutputUpdate?.(rawData.raw || '')
        } catch (fetchError) {
          onRawOutputUpdate?.('')
        }
      } catch (error) {
        // Ensure UI remains stable
        onRawOutputUpdate?.('')
      }
    },
    [setActiveSession, subscribeWithRetry, onRawOutputUpdate]
  )

  const handleSendInput = useCallback(
    async (data: string) => {
      if (!data || !activeSession) {
        return
      }

      try {
        const baseUrl = `${location.protocol}//${location.host}`
        await fetch(`${baseUrl}${RouteBuilder.session(activeSession.id).input()}`, {
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
      const response = await fetch(`${baseUrl}${RouteBuilder.session(activeSession.id).get()}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setActiveSession(null)
        onRawOutputUpdate?.('')
      }
      // eslint-disable-next-line no-empty
    } catch {}
  }, [activeSession, setActiveSession, onRawOutputUpdate])

  return {
    handleSessionClick,
    handleSendInput,
    handleKillSession,
  }
}
