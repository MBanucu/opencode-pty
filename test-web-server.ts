import { initManager, manager } from "./src/plugin/pty/manager.ts";
import { initLogger } from "./src/plugin/logger.ts";
import { startWebServer } from "./src/web/server.ts";

const fakeClient = {
  app: {
    log: async (opts: any) => {
      console.log(`[${opts.level}] ${opts.message}`, opts.context || '');
    },
  },
} as any;
initLogger(fakeClient);
initManager(fakeClient);

const url = startWebServer();
console.log(`Web server started at ${url}`);

console.log("\nStarting a test session...");
const session = manager.spawn({
  command: "echo",
  args: ["Hello, World!", "This is a test session.", "Check the web UI at http://localhost:8765"],
  description: "Test session for web UI",
  parentSessionId: "test-session",
});

console.log(`Session ID: ${session.id}`);
console.log(`Session title: ${session.title}`);
console.log(`Visit ${url} to see the session`);

await Bun.sleep(1000);

console.log("\nReading output...");
const output = manager.read(session.id);
if (output) {
  console.log("Output lines:", output.lines);
}

console.log("\nPress Ctrl+C to stop the server and exit");