/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/web/test/setup.ts',
    coverage: {
      reporter: ['text', 'html', 'json'],
      thresholds: {
        global: {
          branches: 80,
          functions: 90,
          lines: 85,
          statements: 85
        }
      },
      exclude: [
        'node_modules/',
        'dist/',
        'src/web/test/',
        '**/*.d.ts',
        '**/*.config.*',
        'test-web-server.ts',
        'test-e2e-manual.ts'
      ]
    }
  },
})