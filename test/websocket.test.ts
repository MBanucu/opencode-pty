import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { startWebServer, stopWebServer } from "../src/web/server.ts";
import { initManager, manager } from "../src/plugin/pty/manager.ts";
import { initLogger } from "../src/plugin/logger.ts";

describe("WebSocket Functionality", () => {
  const fakeClient = {
    app: {
      log: async (opts: any) => {
        // Mock logger
      },
    },
  } as any;

  beforeEach(() => {
    initLogger(fakeClient);
    initManager(fakeClient);
  });

  afterEach(() => {
    stopWebServer();
  });

  describe("WebSocket Connection", () => {
    it("should accept WebSocket connections", async () => {
      manager.cleanupAll(); // Clean up any leftover sessions
      startWebServer({ port: 8772 });

      // Create a WebSocket connection
      const ws = new WebSocket("ws://localhost:8772");

      await new Promise((resolve, reject) => {
        ws.onopen = () => {
          expect(ws.readyState).toBe(WebSocket.OPEN);
          ws.close();
          resolve(void 0);
        };

        ws.onerror = (error) => {
          reject(error);
        };

        // Timeout after 2 seconds
        setTimeout(() => reject(new Error("WebSocket connection timeout")), 2000);
      });
    });

    it("should send session list on connection", async () => {
      startWebServer({ port: 8773 });

      const ws = new WebSocket("ws://localhost:8773");

      const messages: any[] = [];
      ws.onmessage = (event) => {
        messages.push(JSON.parse(event.data));
      };

      await new Promise((resolve) => {
        ws.onopen = () => {
          // Wait a bit for the session list message
          setTimeout(() => {
            ws.close();
            resolve(void 0);
          }, 100);
        };
      });

      expect(messages.length).toBeGreaterThan(0);
      const sessionListMessage = messages.find(msg => msg.type === "session_list");
      expect(sessionListMessage).toBeDefined();
      expect(Array.isArray(sessionListMessage.sessions)).toBe(true);
    });
  });

  describe("WebSocket Message Handling", () => {
    let ws: WebSocket;
    let serverUrl: string;

    beforeEach(async () => {
      manager.cleanupAll(); // Clean up any leftover sessions
      serverUrl = startWebServer({ port: 8774 });
      ws = new WebSocket("ws://localhost:8774");

      await new Promise((resolve, reject) => {
        ws.onopen = () => resolve(void 0);
        ws.onerror = reject;
        // Timeout after 2 seconds
        setTimeout(() => reject(new Error("WebSocket connection timeout")), 2000);
      });
    });

    afterEach(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });

    it("should handle subscribe message", async () => {
      const testSession = manager.spawn({
        command: "echo",
        args: ["test"],
        description: "Test session",
        parentSessionId: "test",
      });

      const messages: any[] = [];
      ws.onmessage = (event) => {
        messages.push(JSON.parse(event.data));
      };

      ws.send(JSON.stringify({
        type: "subscribe",
        sessionId: testSession.id,
      }));

      // Wait for any response or timeout
      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });

      // Should not have received an error message
      const errorMessages = messages.filter(msg => msg.type === "error");
      expect(errorMessages.length).toBe(0);
    });

    it("should handle subscribe to non-existent session", async () => {
      const messages: any[] = [];
      ws.onmessage = (event) => {
        messages.push(JSON.parse(event.data));
      };

      ws.send(JSON.stringify({
        type: "subscribe",
        sessionId: "nonexistent-session",
      }));

      // Wait for error response
      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });

      const errorMessages = messages.filter(msg => msg.type === "error");
      expect(errorMessages.length).toBe(1);
      expect(errorMessages[0].error).toContain("not found");
    });

    it("should handle unsubscribe message", async () => {
      ws.send(JSON.stringify({
        type: "unsubscribe",
        sessionId: "some-session-id",
      }));

      // Should not crash or send error
      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });

      expect(ws.readyState).toBe(WebSocket.OPEN);
    });

    it("should handle session_list request", async () => {
      const messages: any[] = [];
      ws.onmessage = (event) => {
        messages.push(JSON.parse(event.data));
      };

      ws.send(JSON.stringify({
        type: "session_list",
      }));

      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });

      const sessionListMessages = messages.filter(msg => msg.type === "session_list");
      expect(sessionListMessages.length).toBeGreaterThan(0); // At least one session_list message
    });

    it("should handle invalid message format", async () => {
      const messages: any[] = [];
      ws.onmessage = (event) => {
        messages.push(JSON.parse(event.data));
      };

      ws.send("invalid json");

      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });

      const errorMessages = messages.filter(msg => msg.type === "error");
      expect(errorMessages.length).toBe(1);
      expect(errorMessages[0].error).toContain("Invalid message format");
    });

    it("should handle unknown message type", async () => {
      const messages: any[] = [];
      ws.onmessage = (event) => {
        messages.push(JSON.parse(event.data));
      };

      ws.send(JSON.stringify({
        type: "unknown_type",
        data: "test",
      }));

      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });

      const errorMessages = messages.filter(msg => msg.type === "error");
      expect(errorMessages.length).toBe(1);
      expect(errorMessages[0].error).toContain("Unknown message type");
    });
  });
});