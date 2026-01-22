import pino from 'pino'

/**
 * Create a Pino logger for tests with appropriate formatting
 * Uses console output for easier debugging in test environments
 */
export function createTestLogger(module: string) {
  return pino({
    level: process.env.LOG_LEVEL || 'warn', // Default to warn level for quieter test output

    // Format level as string for better readability
    formatters: {
      level: (label) => ({ level: label }),
    },

    // Base context for test logs
    base: {
      service: 'opencode-pty-test',
      env: 'test',
      module,
    },

    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
        singleLine: true,
        messageFormat: `[${module}] {msg}`,
      },
    },
  })
}
