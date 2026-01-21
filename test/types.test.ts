import { describe, it, expect } from "bun:test";
import type { WSMessage, SessionData, ServerConfig, WSClient } from "../src/web/types.ts";

describe("Web Types", () => {
  describe("WSMessage", () => {
    it("should validate subscribe message structure", () => {
      const message: WSMessage = {
        type: "subscribe",
        sessionId: "pty_12345",
      };

      expect(message.type).toBe("subscribe");
      expect(message.sessionId).toBe("pty_12345");
    });

    it("should validate data message structure", () => {
      const message: WSMessage = {
        type: "data",
        sessionId: "pty_12345",
        data: ["test output", ""],
      };

      expect(message.type).toBe("data");
      expect(message.sessionId).toBe("pty_12345");
      expect(message.data).toEqual(["test output", ""]);
    });

    it("should validate session_list message structure", () => {
      const sessions: SessionData[] = [
        {
          id: "pty_12345",
          title: "Test Session",
          command: "echo",
          status: "running",
          pid: 1234,
          lineCount: 5,
          createdAt: "2026-01-21T10:00:00.000Z",
        },
      ];

      const message: WSMessage = {
        type: "session_list",
        sessions,
      };

      expect(message.type).toBe("session_list");
      expect(message.sessions).toEqual(sessions);
    });

    it("should validate error message structure", () => {
      const message: WSMessage = {
        type: "error",
        error: "Session not found",
      };

      expect(message.type).toBe("error");
      expect(message.error).toBe("Session not found");
    });
  });

  describe("SessionData", () => {
    it("should validate complete session data structure", () => {
      const session: SessionData = {
        id: "pty_12345",
        title: "Test Echo Session",
        command: "echo",
        status: "exited",
        exitCode: 0,
        pid: 1234,
        lineCount: 2,
        createdAt: "2026-01-21T10:00:00.000Z",
      };

      expect(session.id).toBe("pty_12345");
      expect(session.title).toBe("Test Echo Session");
      expect(session.command).toBe("echo");
      expect(session.status).toBe("exited");
      expect(session.exitCode).toBe(0);
      expect(session.pid).toBe(1234);
      expect(session.lineCount).toBe(2);
      expect(session.createdAt).toBe("2026-01-21T10:00:00.000Z");
    });

    it("should allow optional exitCode", () => {
      const session: SessionData = {
        id: "pty_67890",
        title: "Running Session",
        command: "sleep",
        status: "running",
        pid: 5678,
        lineCount: 0,
        createdAt: "2026-01-21T10:00:00.000Z",
      };

      expect(session.exitCode).toBeUndefined();
      expect(session.status).toBe("running");
    });
  });

  describe("ServerConfig", () => {
    it("should validate server configuration", () => {
      const config: ServerConfig = {
        port: 8765,
        hostname: "localhost",
      };

      expect(config.port).toBe(8765);
      expect(config.hostname).toBe("localhost");
    });
  });

  describe("WSClient", () => {
    it("should validate WebSocket client structure", () => {
      const mockWebSocket = {} as any; // Mock WebSocket for testing

      const client: WSClient = {
        socket: mockWebSocket,
        subscribedSessions: new Set(["pty_12345", "pty_67890"]),
      };

      expect(client.socket).toBe(mockWebSocket);
      expect(client.subscribedSessions).toBeInstanceOf(Set);
      expect(client.subscribedSessions.has("pty_12345")).toBe(true);
      expect(client.subscribedSessions.has("pty_67890")).toBe(true);
      expect(client.subscribedSessions.has("pty_99999")).toBe(false);
    });

    it("should handle empty subscriptions", () => {
      const mockWebSocket = {} as any;

      const client: WSClient = {
        socket: mockWebSocket,
        subscribedSessions: new Set(),
      };

      expect(client.subscribedSessions.size).toBe(0);
    });
  });
});