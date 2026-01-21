import { initManager, manager } from "./src/plugin/pty/manager.ts";
import { initLogger } from "./src/plugin/logger.ts";
import { startWebServer } from "./src/web/server.ts";

const fakeClient = {
  app: {
    log: async (opts: any) => {
      const { level = 'info', message, extra } = opts.body || opts;
      const extraStr = extra ? ` ${JSON.stringify(extra)}` : '';
      console.log(`[${level}] ${message}${extraStr}`);
    },
  },
} as any;
initLogger(fakeClient);
initManager(fakeClient);

// Clear any existing sessions from previous runs
manager.clearAllSessions();
console.log("Cleared any existing sessions");

const url = startWebServer({ port: 8867 });
console.log(`Web server started at ${url}`);
console.log(`Server PID: ${process.pid}`);

// Create test sessions for manual testing and e2e tests
if (process.env.CI !== 'true' && process.env.NODE_ENV !== 'test') {
  console.log("\nStarting a running test session for live streaming...");
  const session = manager.spawn({
    command: "bash",
    args: ["-c", "echo 'Welcome to live streaming test'; echo 'Type commands and see real-time output'; for i in {1..100}; do echo \"$(date): Live update $i...\"; sleep 1; done"],
    description: "Live streaming test session",
    parentSessionId: "live-test",
  });

  console.log(`Session ID: ${session.id}`);
  console.log(`Session title: ${session.title}`);

  console.log(`Visit ${url} to see the session`);
  console.log("Server is running in background...");
  console.log("💡 Click on the session to see live output streaming!");
} else {
  console.log(`Server running in test mode at ${url} (no sessions created)`);
}

// Keep the server running indefinitely
setInterval(() => {
  // Keep-alive check - server will continue running
}, 1000);