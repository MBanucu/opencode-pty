import type { Server, ServerWebSocket } from "bun";
import { manager, onOutput } from "../plugin/pty/manager.ts";
import { createLogger } from "../plugin/logger.ts";
import type { WSMessage, WSClient, ServerConfig } from "./types.ts";

const log = createLogger("web-server");

let server: Server<WSClient> | null = null;
const wsClients: Map<ServerWebSocket<WSClient>, WSClient> = new Map();

const defaultConfig: ServerConfig = {
  port: 8765,
  hostname: "localhost",
};

function subscribeToSession(wsClient: WSClient, sessionId: string): boolean {
  const session = manager.get(sessionId);
  if (!session) {
    return false;
  }
  wsClient.subscribedSessions.add(sessionId);
  return true;
}

function unsubscribeFromSession(wsClient: WSClient, sessionId: string): void {
  wsClient.subscribedSessions.delete(sessionId);
}

function broadcastSessionData(sessionId: string, data: string): void {
  const message: WSMessage = { type: "data", sessionId, data };
  const messageStr = JSON.stringify(message);

  for (const [ws, client] of wsClients) {
    if (client.subscribedSessions.has(sessionId)) {
      try {
        ws.send(messageStr);
      } catch (err) {
        log.error("failed to send to ws client", { error: String(err) });
      }
    }
  }
}

function sendSessionList(ws: ServerWebSocket<WSClient>): void {
  const sessions = manager.list();
  const sessionData = sessions.map((s) => ({
    id: s.id,
    title: s.title,
    command: s.command,
    status: s.status,
    exitCode: s.exitCode,
    pid: s.pid,
    lineCount: s.lineCount,
    createdAt: s.createdAt.toISOString(),
  }));
  const message: WSMessage = { type: "session_list", sessions: sessionData };
  ws.send(JSON.stringify(message));
}

function handleWebSocketMessage(ws: ServerWebSocket<WSClient>, wsClient: WSClient, data: string): void {
  try {
    const message: WSMessage = JSON.parse(data);

    switch (message.type) {
      case "subscribe":
        if (message.sessionId) {
          const success = subscribeToSession(wsClient, message.sessionId);
          if (!success) {
            ws.send(JSON.stringify({ type: "error", error: `Session ${message.sessionId} not found` }));
          }
        }
        break;

      case "unsubscribe":
        if (message.sessionId) {
          unsubscribeFromSession(wsClient, message.sessionId);
        }
        break;

      case "session_list":
        sendSessionList(ws);
        break;

      default:
        ws.send(JSON.stringify({ type: "error", error: "Unknown message type" }));
    }
  } catch (err) {
    log.error("failed to handle ws message", { error: String(err) });
    ws.send(JSON.stringify({ type: "error", error: "Invalid message format" }));
  }
}

const wsHandler = {
  open(ws: ServerWebSocket<WSClient>) {
    log.info("ws client connected");
    const wsClient: WSClient = { socket: ws, subscribedSessions: new Set() };
    wsClients.set(ws, wsClient);
    sendSessionList(ws);
  },

  message(ws: ServerWebSocket<WSClient>, message: string) {
    const wsClient = wsClients.get(ws);
    if (wsClient) {
      handleWebSocketMessage(ws, wsClient, message);
    }
  },

  close(ws: ServerWebSocket<WSClient>) {
    log.info("ws client disconnected");
    wsClients.delete(ws);
  },
};

export function startWebServer(config: Partial<ServerConfig> = {}): string {
  const finalConfig = { ...defaultConfig, ...config };

  if (server) {
    log.warn("web server already running");
    return `http://${finalConfig.hostname}:${finalConfig.port}`;
  }

  onOutput((sessionId, data) => {
    broadcastSessionData(sessionId, data);
  });

  server = Bun.serve({
    hostname: finalConfig.hostname,
    port: finalConfig.port,

    websocket: wsHandler,

    async fetch(req, server) {
      const url = new URL(req.url);

      if (url.pathname === "/") {
        return new Response(await Bun.file("./src/web/index.html").bytes(), {
          headers: { "Content-Type": "text/html" },
        });
      }

      if (url.pathname === "/api/sessions" && req.method === "GET") {
        const sessions = manager.list();
        return Response.json(sessions);
      }

      if (url.pathname.match(/^\/api\/sessions\/[^/]+$/) && req.method === "GET") {
        const sessionId = url.pathname.split("/")[3];
        if (!sessionId) return new Response("Invalid session ID", { status: 400 });
        const session = manager.get(sessionId);
        if (!session) {
          return new Response("Session not found", { status: 404 });
        }
        return Response.json(session);
      }

      if (url.pathname.match(/^\/api\/sessions\/[^/]+\/input$/) && req.method === "POST") {
        const sessionId = url.pathname.split("/")[3];
        if (!sessionId) return new Response("Invalid session ID", { status: 400 });
        const body = await req.json() as { data: string };
        const success = manager.write(sessionId, body.data);
        if (!success) {
          return new Response("Failed to write to session", { status: 400 });
        }
        return Response.json({ success: true });
      }

      if (url.pathname.match(/^\/api\/sessions\/[^/]+\/kill$/) && req.method === "POST") {
        const sessionId = url.pathname.split("/")[3];
        if (!sessionId) return new Response("Invalid session ID", { status: 400 });
        const success = manager.kill(sessionId);
        if (!success) {
          return new Response("Failed to kill session", { status: 400 });
        }
        return Response.json({ success: true });
      }

      return new Response("Not found", { status: 404 });
    },
  });

  log.info("web server started", { url: `http://${finalConfig.hostname}:${finalConfig.port}` });
  return `http://${finalConfig.hostname}:${finalConfig.port}`;
}

export function stopWebServer(): void {
  if (server) {
    server.stop();
    server = null;
    wsClients.clear();
    log.info("web server stopped");
  }
}

export function getServerUrl(): string | null {
  if (!server) return null;
  return `http://${server.hostname}:${server.port}`;
}