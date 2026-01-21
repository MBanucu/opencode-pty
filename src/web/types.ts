import type { ServerWebSocket } from "bun";

export interface WSMessage {
  type: "subscribe" | "unsubscribe" | "data" | "session_list" | "error";
  sessionId?: string;
  data?: string;
  error?: string;
  sessions?: SessionData[];
}

export interface SessionData {
  id: string;
  title: string;
  command: string;
  status: string;
  exitCode?: number;
  pid: number;
  lineCount: number;
  createdAt: string;
}

export interface ServerConfig {
  port: number;
  hostname: string;
}

export interface WSClient {
  socket: ServerWebSocket<WSClient>;
  subscribedSessions: Set<string>;
}