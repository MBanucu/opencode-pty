import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Session, AppState } from '../types.ts';
import pino from 'pino';

// Configure logger - reduce logging in test environment
const isTest = typeof window !== 'undefined' && window.location?.hostname === 'localhost' && window.location?.port === '8867';
const logger = {
  info: (...args: any[]) => { if (!isTest) console.log(...args); },
  error: (...args: any[]) => console.error(...args),
};

export function App() {
  if (!isTest) logger.info('[Browser] App component rendering/mounting');

  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [output, setOutput] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [connected, setConnected] = useState(false);
  const [autoSelected, setAutoSelected] = useState(false);
  const [wsMessageCount, setWsMessageCount] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const activeSessionRef = useRef<Session | null>(null);

  const refreshSessions = useCallback(async () => {
    try {
      const baseUrl = `${location.protocol}//${location.host}`;
      const response = await fetch(`${baseUrl}/api/sessions`);
      if (response.ok) {
        const sessions = await response.json();
        setSessions(Array.isArray(sessions) ? sessions : []);
        logger.info('[Browser] Refreshed sessions:', sessions.length);
      }
    } catch (error) {
      logger.error('[Browser] Failed to refresh sessions:', error);
    }
  }, []);

  // Simplified WebSocket connection management
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
      logger.info('[Browser] WebSocket already connected/connecting, skipping');
      return;
    }

    logger.info('[Browser] Establishing WebSocket connection');
    // Connect to the test server port (8867) or fallback to location.host for production
    const wsPort = location.port === '5173' ? '8867' : location.port; // Vite dev server uses 5173
    wsRef.current = new WebSocket(`ws://${location.hostname}:${wsPort}`);

    wsRef.current.onopen = () => {
      logger.info('[Browser] WebSocket connection established successfully');
      setConnected(true);

      // Subscribe to active session if one exists
      if (activeSession) {
        logger.info('[Browser] Subscribing to active session:', activeSession.id);
        wsRef.current?.send(JSON.stringify({ type: 'subscribe', sessionId: activeSession.id }));
      }

      // Request session list
      logger.info('[Browser] Requesting session list');
      wsRef.current?.send(JSON.stringify({ type: 'session_list' }));
    };

    wsRef.current.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        logger.info('[Browser] WS message:', JSON.stringify(message));

        if (message.type === 'session_list') {
          const newSessions = message.sessions || [];
          setSessions(newSessions);

          // Auto-select first session if none is active and we haven't auto-selected yet
          if (newSessions.length > 0 && !activeSession && !autoSelected) {
            const runningSession = newSessions.find((s: Session) => s.status === 'running');
            const sessionToSelect = runningSession || newSessions[0];
            logger.info('[Browser] Auto-selecting session:', sessionToSelect.id);
            setAutoSelected(true);

            // Defer execution to avoid React issues
            setTimeout(() => {
              handleSessionClick(sessionToSelect);
            }, 0);
          }

        }
        if (message.type === 'data') {
          logger.info('[Browser] Checking data message, sessionId:', message.sessionId, 'activeSession.id:', activeSessionRef.current?.id);
        }
        if (message.type === 'data' && message.sessionId === activeSessionRef.current?.id) {
          logger.info('[Browser] Received live data for active session:', message.sessionId, 'data length:', message.data.length, 'activeSession.id:', activeSession?.id);
          setWsMessageCount(prev => {
            const newCount = prev + 1;
            logger.info('[Browser] WS message count updated to:', newCount);
            return newCount;
          });
          setOutput(prev => {
            const newOutput = [...prev, ...message.data];
            logger.info('[Browser] Live update: output now has', newOutput.length, 'lines');
            return newOutput;
          });
        } else if (message.type === 'logger.error') {
          logger.error('[Browser] WebSocket logger.error:', message.logger.error);
        }
      } catch (error) {
        logger.error('[Browser] Failed to parse WebSocket message:', error);
      }
    };

    wsRef.current.onclose = (event) => {
      logger.info('[Browser] WebSocket connection closed:', event.code, event.reason);
      setConnected(false);
    };

    wsRef.current.onerror = (error) => {
      logger.error('[Browser] WebSocket connection error:', error);
    };
  }, [activeSession, autoSelected]);

  // Initialize WebSocket on mount
  useEffect(() => {
    logger.info('[Browser] App mounted, connecting to WebSocket');
    connectWebSocket();

    return () => {
      logger.info('[Browser] App unmounting');
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Refresh sessions on mount
  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]); // Empty dependency array - only run once

  useEffect(() => {
    if (activeSession && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'subscribe', sessionId: activeSession.id }));
      setOutput([]);
    }
    return () => {
      if (activeSession && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'unsubscribe', sessionId: activeSession.id }));
      }
    };
  }, [activeSession?.id]);

  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  const handleSessionClick = useCallback(async (session: Session) => {
      logger.info('[Browser] handleSessionClick called with session:', session.id, session.status);
      // Add visible debug indicator
      const debugDiv = document.createElement('div');
      debugDiv.id = 'debug-indicator';
      debugDiv.style.cssText = 'position: fixed; top: 0; left: 0; background: red; color: white; padding: 5px; z-index: 9999; font-size: 12px;';
      debugDiv.textContent = `CLICKED: ${session.id} (${session.status})`;
      document.body.appendChild(debugDiv);
      setTimeout(() => debugDiv.remove(), 3000);

    try {
      // Validate session object first
      if (!session?.id) {
        logger.error('[Browser] Invalid session object passed to handleSessionClick:', session);
        return;
      }

      logger.info('[Browser] Setting active session:', session.id);
      setActiveSession(session);
      setInputValue('');

       // Subscribe to this session for live updates
       if (wsRef.current?.readyState === WebSocket.OPEN) {
         logger.info('[Browser] Subscribing to session for live updates:', session.id);
         wsRef.current.send(JSON.stringify({ type: 'subscribe', sessionId: session.id }));
       } else {
         logger.info('[Browser] WebSocket not ready for subscription, retrying in 100ms');
         setTimeout(() => {
           if (wsRef.current?.readyState === WebSocket.OPEN) {
             logger.info('[Browser] Subscribing to session for live updates (retry):', session.id);
             wsRef.current.send(JSON.stringify({ type: 'subscribe', sessionId: session.id }));
           }
         }, 100);
       }

      // Always fetch output (buffered content for all sessions)
      logger.info('[Browser] Fetching output for session:', session.id, 'status:', session.status);

      // Update visible debug indicator
      const debugDiv = document.getElementById('debug-indicator');
      if (debugDiv) debugDiv.textContent = `FETCHING: ${session.id} (${session.status})`;

      try {
        const baseUrl = `${location.protocol}//${location.host}`;
        logger.info('[Browser] Making fetch request to:', `${baseUrl}/api/sessions/${session.id}/output`);
        if (debugDiv) debugDiv.textContent = `REQUESTING: ${session.id}`;

        const response = await fetch(`${baseUrl}/api/sessions/${session.id}/output`);
        logger.info('[Browser] Fetch completed, response status:', response.status);
        if (debugDiv) debugDiv.textContent = `RESPONSE ${response.status}: ${session.id}`;

        if (response.ok) {
          const outputData = await response.json();
          logger.info('[Browser] Successfully parsed JSON, lines:', outputData.lines?.length || 0);
          logger.info('[Browser] Setting output with lines:', outputData.lines);
          setOutput(outputData.lines || []);
          logger.info('[Browser] Output state updated');
          if (debugDiv) debugDiv.textContent = `LOADED ${outputData.lines?.length || 0} lines: ${session.id}`;
        } else {
          const errorText = await response.text().catch(() => 'Unable to read error response');
          logger.error('[Browser] Fetch failed - Status:', response.status, 'Error:', errorText);
          setOutput([]);
          if (debugDiv) debugDiv.textContent = `FAILED ${response.status}: ${session.id}`;
        }
      } catch (fetchError) {
        logger.error('[Browser] Network logger.error fetching output:', fetchError);
        setOutput([]);
        if (debugDiv) debugDiv.textContent = `ERROR: ${session.id}`;
      }
      logger.info(`[Browser] Fetch process completed for ${session.id}`);
    } catch (error) {
      logger.error('[Browser] Unexpected error in handleSessionClick:', error);
      // Ensure UI remains stable
      setOutput([]);
    }
  }, []);

  const handleSendInput = useCallback(async () => {
    if (!inputValue.trim() || !activeSession) {
      logger.info('[Browser] Send input skipped - no input or no active session');
      return;
    }

    logger.info('[Browser] Sending input:', inputValue.length, 'characters to session:', activeSession.id);

    try {
      const baseUrl = `${location.protocol}//${location.host}`;
      const response = await fetch(`${baseUrl}/api/sessions/${activeSession.id}/input`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: inputValue + '\n' }),
      });

      logger.info('[Browser] Input send response:', response.status, response.statusText);

      if (response.ok) {
        logger.info('[Browser] Input sent successfully, clearing input field');
        setInputValue('');
      } else {
        const errorText = await response.text().catch(() => 'Unable to read error response');
        logger.error('[Browser] Failed to send input - Status:', response.status, response.statusText, 'Error:', errorText);
      }
    } catch (error) {
      logger.error('[Browser] Network error sending input:', error);
    }
  }, [inputValue, activeSession]);

  const handleKillSession = useCallback(async () => {
    if (!activeSession) {
      logger.info('[Browser] Kill session skipped - no active session');
      return;
    }

    logger.info('[Browser] Attempting to kill session:', activeSession.id, activeSession.title);

    if (!confirm(`Are you sure you want to kill session "${activeSession.title}"?`)) {
      logger.info('[Browser] User cancelled session kill');
      return;
    }

    try {
      const baseUrl = `${location.protocol}//${location.host}`;
      logger.info('[Browser] Sending kill request to server');
      const response = await fetch(`${baseUrl}/api/sessions/${activeSession.id}/kill`, {
        method: 'POST',
      });

      logger.info('[Browser] Kill response:', response.status, response.statusText);

      if (response.ok) {
        logger.info('[Browser] Session killed successfully, clearing UI state');
        setActiveSession(null);
        setOutput([]);
      } else {
        const errorText = await response.text().catch(() => 'Unable to read error response');
        logger.error('[Browser] Failed to kill session - Status:', response.status, response.statusText, 'Error:', errorText);
      }
    } catch (error) {
      logger.error('[Browser] Network error killing session:', error);
    }
  }, [activeSession]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendInput();
    }
  }, [handleSendInput]);

  return (
    <div className="container">
      <div className="sidebar">
        <div className="sidebar-header">
          <h1>PTY Sessions</h1>
        </div>
        <div className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
          {connected ? '● Connected' : '○ Disconnected'}
        </div>
        <div className="session-list">
          {sessions.length === 0 ? (
            <div style={{ padding: '16px', color: '#8b949e', textAlign: 'center' }}>
              No active sessions
            </div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                className={`session-item ${activeSession?.id === session.id ? 'active' : ''}`}
                onClick={() => handleSessionClick(session)}
              >
                <div className="session-title">{session.title}</div>
                <div className="session-info">
                  <span>{session.command}</span>
                  <span
                    className={`status-badge status-${session.status}`}
                  >
                    {session.status}
                  </span>
                </div>
                <div className="session-info" style={{ marginTop: '4px' }}>
                  <span>PID: {session.pid}</span>
                  <span>{session.lineCount} lines</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="main">
        {activeSession ? (
          <>
            <div className="output-header">
              <div className="output-title">{activeSession.title}</div>
              <button className="kill-btn" onClick={handleKillSession}>
                Kill Session
              </button>
            </div>
             <div className="output-container" ref={outputRef}>
               {output.length === 0 ? (
                 <div className="empty-state">Waiting for output...</div>
               ) : (
                  output.map((line, index) => (
                    <div key={index} className="output-line" style={{ whiteSpace: 'pre' }}>
                      {line}
                    </div>
                  ))
               )}

               {/* Debug info */}
               <div style={{ fontSize: '10px', color: '#666', marginTop: '10px', borderTop: '1px solid #ccc', paddingTop: '5px' }}>
                 Debug: {output.length} lines, active: {activeSession?.id || 'none'}, WS messages: {wsMessageCount}
               </div>
             </div>
            <div className="input-container">
              <input
                type="text"
                className="input-field"
                placeholder={activeSession.status === 'running' ? 'Type input...' : 'Session not running'}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={activeSession.status !== 'running'}
              />
              <button
                className="send-btn"
                onClick={handleSendInput}
                disabled={activeSession.status !== 'running' || !inputValue.trim()}
              >
                Send
              </button>
            </div>
          </>
        ) : (
          <div className="empty-state">
            Select a session from the sidebar to view its output
          </div>
        )}
      </div>
    </div>
  );
}