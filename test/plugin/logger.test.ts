import { describe, it, expect, mock } from 'bun:test'
import { createLogger, getLogger, initLogger } from '../../src/plugin/logger.ts'

describe('Plugin Logger', () => {
  describe('Logger Functions', () => {
    it('should create child logger with service name', () => {
      const logger = createLogger('test-service')
      expect(logger).toBeDefined()
      expect(typeof logger.info).toBe('function')
      expect(typeof logger.error).toBe('function')
      expect(typeof logger.debug).toBe('function')
    })

    it('should get logger with context', () => {
      const logger = getLogger({ module: 'test' })
      expect(logger).toBeDefined()
      expect(typeof logger.debug).toBe('function')
      expect(typeof logger.warn).toBe('function')
    })

    it('should initialize with client', () => {
      const mockLog = mock(() => Promise.resolve())
      const mockClient = {
        app: { log: mockLog },
        // Add other required properties with mocks
        postSessionIdPermissionsPermissionId: mock(() => Promise.resolve()),
        global: {},
        project: {},
        pty: {},
        user: {},
        session: {},
        permissions: {},
        workspace: {},
        files: {},
        commands: {},
        notifications: {},
        integrations: {},
        auth: {},
        analytics: {},
      } as any

      expect(() => initLogger(mockClient)).not.toThrow()
    })

    it('should handle logger methods', () => {
      const logger = createLogger('test')

      // These should not throw
      expect(() => logger.info('test message')).not.toThrow()
      expect(() => logger.error({ err: new Error('test') }, 'error message')).not.toThrow()
      expect(() => logger.debug({ data: 'test' }, 'debug message')).not.toThrow()
    })

    it('should create loggers with different service names', () => {
      const logger1 = createLogger('service1')
      const logger2 = createLogger('service2')

      expect(logger1).toBeDefined()
      expect(logger2).toBeDefined()
      expect(logger1).not.toBe(logger2) // Different instances
    })
  })
})
