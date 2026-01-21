import { describe, it, expect, beforeEach, mock, spyOn } from "bun:test";
import { ptySpawn } from "../src/plugin/pty/tools/spawn.ts";
import { ptyRead } from "../src/plugin/pty/tools/read.ts";
import { ptyList } from "../src/plugin/pty/tools/list.ts";
import { RingBuffer } from "../src/plugin/pty/buffer.ts";
import { manager } from "../src/plugin/pty/manager.ts";
import { checkCommandPermission, checkWorkdirPermission } from "../src/plugin/pty/permissions.ts";

describe("PTY Tools", () => {
  describe("ptySpawn", () => {
    beforeEach(() => {
      spyOn(manager, 'spawn').mockImplementation((opts) => ({
        id: "test-session-id",
        title: opts.title || "Test Session",
        command: opts.command,
        args: opts.args || [],
        workdir: opts.workdir || "/tmp",
        pid: 12345,
        status: "running",
        createdAt: new Date(),
        lineCount: 0,
      }));
    });

    it("should spawn a PTY session with minimal args", async () => {
      const ctx = { sessionID: "parent-session-id", messageID: "msg-1", agent: "test-agent", abort: new AbortController().signal };
      const args = {
        command: "echo",
        args: ["hello"],
        description: "Test session",
      };

      const result = await ptySpawn.execute(args, ctx);

      expect(manager.spawn).toHaveBeenCalledWith({
        command: "echo",
        args: ["hello"],
        description: "Test session",
        parentSessionId: "parent-session-id",
        workdir: undefined,
        env: undefined,
        title: undefined,
        notifyOnExit: undefined,
      });

      expect(result).toContain("<pty_spawned>");
      expect(result).toContain("ID: test-session-id");
      expect(result).toContain("Command: echo hello");
      expect(result).toContain("</pty_spawned>");
    });

    it("should spawn with all optional args", async () => {
      const ctx = { sessionID: "parent-session-id", messageID: "msg-2", agent: "test-agent", abort: new AbortController().signal };
      const args = {
        command: "node",
        args: ["script.js"],
        workdir: "/home/user",
        env: { NODE_ENV: "test" },
        title: "My Node Session",
        description: "Running Node.js script",
        notifyOnExit: true,
      };

      const result = await ptySpawn.execute(args, ctx);

      expect(manager.spawn).toHaveBeenCalledWith({
        command: "node",
        args: ["script.js"],
        workdir: "/home/user",
        env: { NODE_ENV: "test" },
        title: "My Node Session",
        description: "Running Node.js script",
        parentSessionId: "parent-session-id",
        notifyOnExit: true,
      });

      expect(result).toContain("Title: My Node Session");
      expect(result).toContain("Workdir: /home/user");
      expect(result).toContain("Command: node script.js");
      expect(result).toContain("PID: 12345");
      expect(result).toContain("Status: running");
    });
  });

  describe("ptyRead", () => {
    beforeEach(() => {
      spyOn(manager, 'get').mockReturnValue({
        id: "test-session-id",
        status: "running",
        // other fields not needed for this test
      } as any);
      spyOn(manager, 'read').mockReturnValue({
        lines: ["line 1", "line 2"],
        offset: 0,
        hasMore: false,
        totalLines: 2,
      });
      spyOn(manager, 'search').mockReturnValue({
        matches: [{ lineNumber: 1, text: "line 1" }],
        totalMatches: 1,
        totalLines: 2,
        hasMore: false,
        offset: 0,
      });
    });

    it("should read output without pattern", async () => {
      const args = { id: "test-session-id" };
      const ctx = { sessionID: "parent", messageID: "msg", agent: "agent", abort: new AbortController().signal };

      const result = await ptyRead.execute(args, ctx);

      expect(manager.get).toHaveBeenCalledWith("test-session-id");
      expect(manager.read).toHaveBeenCalledWith("test-session-id", 0, 500);
      expect(result).toContain('<pty_output id="test-session-id" status="running">');
      expect(result).toContain('00001| line 1');
      expect(result).toContain('00002| line 2');
      expect(result).toContain('(End of buffer - total 2 lines)');
      expect(result).toContain('</pty_output>');
    });

    it("should read with pattern", async () => {
      const args = { id: "test-session-id", pattern: "line" };
      const ctx = { sessionID: "parent", messageID: "msg", agent: "agent", abort: new AbortController().signal };

      const result = await ptyRead.execute(args, ctx);

      expect(manager.search).toHaveBeenCalledWith("test-session-id", /line/, 0, 500);
      expect(result).toContain('<pty_output id="test-session-id" status="running" pattern="line">');
      expect(result).toContain('00001| line 1');
      expect(result).toContain('(1 match from 2 total lines)');
    });

    it("should throw for invalid session", async () => {
      spyOn(manager, 'get').mockReturnValue(null);

      const args = { id: "invalid-id" };
      const ctx = { sessionID: "parent", messageID: "msg", agent: "agent", abort: new AbortController().signal };

      await expect(ptyRead.execute(args, ctx)).rejects.toThrow("PTY session 'invalid-id' not found");
    });

    it("should throw for invalid regex", async () => {
      const args = { id: "test-session-id", pattern: "[invalid" };
      const ctx = { sessionID: "parent", messageID: "msg", agent: "agent", abort: new AbortController().signal };

      await expect(ptyRead.execute(args, ctx)).rejects.toThrow("Invalid regex pattern");
    });
  });

  describe("ptyList", () => {
    it("should list active sessions", async () => {
      const mockSessions = [
        {
          id: "pty_123",
          title: "Test Session",
          command: "echo",
          args: ["hello"],
          status: "running" as const,
          pid: 12345,
          lineCount: 10,
          workdir: "/tmp",
          createdAt: new Date("2023-01-01T00:00:00Z"),
        },
      ];
      spyOn(manager, 'list').mockReturnValue(mockSessions);

      const result = await ptyList.execute({}, { sessionID: "parent", messageID: "msg", agent: "agent", abort: new AbortController().signal });

      expect(manager.list).toHaveBeenCalled();
      expect(result).toContain("<pty_list>");
      expect(result).toContain("[pty_123] Test Session");
      expect(result).toContain("Command: echo hello");
      expect(result).toContain("Status: running");
      expect(result).toContain("PID: 12345 | Lines: 10 | Workdir: /tmp");
      expect(result).toContain("Total: 1 session(s)");
      expect(result).toContain("</pty_list>");
    });

    it("should handle no sessions", async () => {
      spyOn(manager, 'list').mockReturnValue([]);

      const result = await ptyList.execute({}, { sessionID: "parent", messageID: "msg", agent: "agent", abort: new AbortController().signal });

      expect(result).toBe("<pty_list>\nNo active PTY sessions.\n</pty_list>");
    });
  });

  describe("RingBuffer", () => {
    it("should append and read lines", () => {
      const buffer = new RingBuffer(5);
      buffer.append("line1\nline2\nline3");

      expect(buffer.length).toBe(3);
      expect(buffer.read()).toEqual(["line1", "line2", "line3"]);
    });

    it("should handle offset and limit", () => {
      const buffer = new RingBuffer(5);
      buffer.append("line1\nline2\nline3\nline4");

      expect(buffer.read(1, 2)).toEqual(["line2", "line3"]);
    });

    it("should search with regex", () => {
      const buffer = new RingBuffer(5);
      buffer.append("hello world\nfoo bar\nhello test");

      const matches = buffer.search(/hello/);
      expect(matches).toEqual([
        { lineNumber: 1, text: "hello world" },
        { lineNumber: 3, text: "hello test" },
      ]);
    });

    it("should clear buffer", () => {
      const buffer = new RingBuffer(5);
      buffer.append("line1\nline2");
      expect(buffer.length).toBe(2);

      buffer.clear();
      expect(buffer.length).toBe(0);
      expect(buffer.read()).toEqual([]);
    });

    it("should evict old lines when exceeding max", () => {
      const buffer = new RingBuffer(3);
      buffer.append("line1\nline2\nline3\nline4");

      expect(buffer.length).toBe(3);
      expect(buffer.read()).toEqual(["line2", "line3", "line4"]);
    });
  });
});